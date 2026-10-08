"use server";

import { revalidatePath } from "next/cache";
import { reviewCopy } from "@/copy/review";
import { createSupabaseServerClient } from "@/utils/supabase/server";

/** Which history table a review item lives in. */
export type ReviewKind = "ASSIGNMENT" | "CALENDAR";

/**
 * Acknowledges one review item: it leaves the tray and stays findable. The database records who
 * acknowledged it and refuses any other change to the history row.
 */
export async function acknowledgeReviewItem(historyId: string, kind: ReviewKind): Promise<{ message: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from(kind === "CALENDAR" ? "calendar_date_history" : "assignment_history")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", historyId)
    .is("acknowledged_at", null);
  if (error) return { message: reviewCopy.unavailable };

  revalidatePath("/revision");
  return null;
}
