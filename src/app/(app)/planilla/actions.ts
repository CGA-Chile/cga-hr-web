"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { sheetCopy } from "@/copy/sheet";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export type PeriodEndState = { message: string } | null;

/**
 * Moves an open period's end to the date the accountant fixed. The database decides whether it
 * may move: only the latest open period's, never before its start. The return path comes from the
 * browser, so only a path inside the sheet is followed.
 */
export async function setPeriodEnd(
  periodId: string,
  doneHref: string,
  _previous: PeriodEndState,
  formData: FormData,
): Promise<PeriodEndState> {
  const end = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(formData.get("end"));
  if (!end.success) return { message: sheetCopy.endBeforeStart };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_period_end", { p_period_id: periodId, p_end_date: end.data });
  if (error) return { message: messageFor(error.code) };

  revalidatePath("/planilla");
  revalidatePath("/cierres");
  redirect(doneHref.startsWith("/planilla") ? doneHref : "/planilla");
}

function messageFor(code: string): string {
  if (code === "42501") return sheetCopy.endNoPermission;
  if (code === "23514") return sheetCopy.endNotMovable;
  return sheetCopy.unavailable;
}
