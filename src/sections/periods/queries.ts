import type { IsoDate } from "@/domain/bonus/types";
import type { Database } from "@/types/database";
import { addDays, formatMonth } from "@/utils/chileDate";
import { orThrow, type ServerSupabase } from "@/utils/supabase/query";

export type Period = Pick<
  Database["public"]["Tables"]["periods"]["Row"],
  "id" | "name" | "start_date" | "end_date" | "status" | "closed_at" | "closed_by"
>;

const PERIOD_COLUMNS = "id, name, start_date, end_date, status, closed_at, closed_by";

/** Newest first. */
export async function loadPeriods(supabase: ServerSupabase): Promise<Period[]> {
  return orThrow(
    await supabase
      .from("periods")
      .select(PERIOD_COLUMNS)
      .is("deleted_at", null)
      .order("start_date", { ascending: false }),
  );
}

export async function loadPeriod(supabase: ServerSupabase, id: string): Promise<Period | null> {
  const { data, error } = await supabase
    .from("periods")
    .select(PERIOD_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** The start of the next period: fixed by the previous one, or free when there is none yet. */
export function nextPeriodStart(periods: readonly Period[]): IsoDate | null {
  const latest = periods.reduce<Period | null>(
    (found, period) => (!found || period.end_date > found.end_date ? period : found),
    null,
  );
  return latest ? addDays(latest.end_date, 1) : null;
}

/**
 * The end HR almost always picks: the 24th on or after the start, since the bonus period runs
 * roughly from the 25th to the 24th. It is a proposal; HR adjusts it when the month differs.
 */
export function proposedEnd(start: IsoDate): IsoDate {
  const sameMonth = `${start.slice(0, 7)}-24`;
  if (start <= sameMonth) return sameMonth;
  return `${addDays(`${start.slice(0, 7)}-28`, 7).slice(0, 7)}-24`;
}

/** "Septiembre 2026", named after the month the period ends in. */
export function periodNameFor(end: IsoDate): string {
  const month = formatMonth(end).replace(" de ", " ");
  return month.charAt(0).toUpperCase() + month.slice(1);
}

export async function loadUsername(supabase: ServerSupabase, userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data?.username ?? null;
}
