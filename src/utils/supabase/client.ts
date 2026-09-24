import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { publicSupabaseEnv } from "./env";

/** A Supabase client for Client Components, sharing the session cookies with the server. */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = publicSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
