import type { Database } from "@/types/database";
import { fetchAllRows, type ServerSupabase } from "@/utils/supabase/query";

export type ReviewEntry = Database["public"]["Views"]["review_history"]["Row"];

/** Review items, newest first: the tray (not yet acknowledged) or the acknowledged ones. */
export async function loadReviewEntries(supabase: ServerSupabase, acknowledged: boolean): Promise<ReviewEntry[]> {
  return fetchAllRows((first, last) => {
    const query = supabase.from("review_history").select("*");
    return (acknowledged ? query.not("acknowledged_at", "is", null) : query.is("acknowledged_at", null))
      .order("changed_at", { ascending: false })
      .order("history_id")
      .range(first, last);
  });
}
