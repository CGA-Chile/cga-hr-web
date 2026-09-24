"use server";

import { revalidatePath } from "next/cache";
import { reviewCopy } from "@/copy/review";
import { createSupabaseServerClient } from "@/utils/supabase/server";

/**
 * Acknowledges one review item: it leaves the tray and stays findable. The database records who
 * acknowledged it and refuses any other change to the history row.
 */
export async function acknowledgeReviewItem(historyId: string): Promise<{ message: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("assignment_history")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", historyId)
    .is("acknowledged_at", null);
  if (error) return { message: reviewCopy.unavailable };

  revalidatePath("/revision");
  return null;
}
