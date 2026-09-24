import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SIGN_IN_PATH } from "@/utils/routes";
import { publicSupabaseEnv } from "@/utils/supabase/env";

/**
 * Refreshes the Supabase session on every navigation, writing renewed cookies onto the response,
 * so nobody has to sign in again in daily use. Sends anyone without a session to sign-in.
 *
 * This is an optimistic check for navigation only. Access to data is enforced by RLS.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = publicSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = data !== null;
  const onSignIn = request.nextUrl.pathname === SIGN_IN_PATH;

  if (!signedIn && !onSignIn) {
    return NextResponse.redirect(new URL(SIGN_IN_PATH, request.url));
  }
  if (signedIn && onSignIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
