import type { Database } from "@/types/database";
import { orThrow, type ServerSupabase } from "@/utils/supabase/query";

export type ReviewEntry = Database["public"]["Views"]["review_history"]["Row"];

/** Review items, newest first: the tray (not yet acknowledged) or the acknowledged ones. */
export async function loadReviewEntries(supabase: ServerSupabase, acknowledged: boolean): Promise<ReviewEntry[]> {
  const query = supabase.from("review_history").select("*").order("changed_at", { ascending: false });
  return orThrow(await (acknowledged ? query.not("acknowledged_at", "is", null) : query.is("acknowledged_at", null)));
}
