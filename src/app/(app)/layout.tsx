import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PendingWritesProvider } from "@/hooks/usePendingWrites";
import { AnalyticsIdentity } from "@/sections/layout/AnalyticsIdentity";
import { AppHeader } from "@/sections/layout/AppHeader";
import { SIGN_IN_PATH } from "@/utils/routes";
import { loadCurrentProfile } from "@/utils/supabase/currentProfile";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export default async function AuthenticatedLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect(SIGN_IN_PATH);
  const profile = await loadCurrentProfile(supabase);

  return (
    <PendingWritesProvider>
      <AnalyticsIdentity userId={userId} username={profile?.username ?? null} role={profile?.role ?? null} />
      <AppHeader role={profile?.role ?? null} />
      {children}
    </PendingWritesProvider>
  );
}
