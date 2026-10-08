import { redirect } from "next/navigation";
import type { ServerSupabase } from "./query";

export type AppRole = "admin" | "editor" | "supervisor";
export type CurrentProfile = { id: string; role: AppRole; username: string | null };

const ROLES: readonly string[] = ["admin", "editor", "supervisor"] satisfies AppRole[];

function isAppRole(role: string): role is AppRole {
  return ROLES.includes(role);
}

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
  if (!data || !isAppRole(data.role)) return null;
  return { id: data.id, role: data.role, username: data.username };
}

/** HR and the admin work with amounts; the supervisor assigns people and never sees one. */
export function roleSeesAmounts(role: AppRole | null | undefined): boolean {
  return role === "admin" || role === "editor";
}

export function seesAmounts(profile: CurrentProfile | null): boolean {
  return roleSeesAmounts(profile?.role);
}

/**
 * For the screens that exist to show money: closes, reports, the review list. The supervisor is
 * sent to the sheet. The database already refuses them the rates; this keeps them off pages that
 * would only show half of something.
 */
export async function requireAmounts(supabase: ServerSupabase): Promise<CurrentProfile> {
  const profile = await loadCurrentProfile(supabase);
  if (!profile || !seesAmounts(profile)) redirect("/planilla");
  return profile;
}
