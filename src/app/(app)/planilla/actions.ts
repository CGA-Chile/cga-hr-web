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

export type CalendarDateState = { message: string } | null;

const calendarDateSchema = z.object({
  holiday: z.boolean(),
  dayRate: z
    .string()
    .trim()
    .transform((text) => (text === "" ? null : Number(text)))
    .refine((amount) => amount === null || (Number.isInteger(amount) && amount > 0)),
});

/**
 * Sets a date's holiday mark and, when HR fixes one, the amount for that date alone. An empty
 * amount means the default for its kind. The database decides who may: HR and the admin.
 */
export async function setCalendarDate(
  date: string,
  doneHref: string,
  _previous: CalendarDateState,
  formData: FormData,
): Promise<CalendarDateState> {
  const parsed = calendarDateSchema.safeParse({
    holiday: formData.get("holiday") === "on",
    dayRate: formData.get("dayRate") ?? "",
  });
  if (!parsed.success) return { message: sheetCopy.invalidDayRate };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_calendar_date", {
    p_date: date,
    p_holiday: parsed.data.holiday,
    p_day_rate: parsed.data.dayRate ?? undefined,
  });
  if (error) return { message: error.code === "42501" ? sheetCopy.calendarNoPermission : sheetCopy.unavailable };

  revalidatePath("/planilla");
  redirect(doneHref.startsWith("/planilla") ? doneHref : "/planilla");
}
