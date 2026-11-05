import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { publicSupabaseEnv } from "./env";

/**
 * Bypasses Row Level Security. Only for work that runs with nobody signed in, like the nightly read
 * of Workera. Never import this from anything that reaches a browser.
 */
export function createSupabaseServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set");

  return createClient<Database>(publicSupabaseEnv().url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
