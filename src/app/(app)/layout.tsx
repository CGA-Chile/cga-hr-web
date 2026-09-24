import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/sections/layout/AppHeader";
import { SIGN_IN_PATH } from "@/utils/routes";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export default async function AuthenticatedLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect(SIGN_IN_PATH);

  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
