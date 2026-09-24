import type { ServerSupabase } from "./query";

export type CurrentProfile = { id: string; role: "admin" | "editor"; username: string | null };

/**
 * The signed-in user's profile, for showing or hiding controls. Courtesy only: every write is
 * decided by RLS, which reads the same profile on the server.
 */
export async function loadCurrentProfile(supabase: ServerSupabase): Promise<CurrentProfile | null> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, role, username")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data || (data.role !== "admin" && data.role !== "editor")) return null;
  return { id: data.id, role: data.role, username: data.username };
}
