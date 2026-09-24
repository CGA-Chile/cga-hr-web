"use server";

import { redirect } from "next/navigation";
import { SIGN_IN_PATH } from "@/utils/routes";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(SIGN_IN_PATH);
}
