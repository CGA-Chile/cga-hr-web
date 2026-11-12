import type { SupabaseClient } from "@supabase/supabase-js";
import type { IsoDate } from "@/domain/bonus/types";
import type { Database } from "@/types/database";
import { addDays } from "@/utils/chileDate";
import { orThrow } from "@/utils/supabase/query";
import type { WorkeraClient } from "./client";

type Supabase = SupabaseClient<Database>;

/** How far back each night rereads, so that corrections made in Workera arrive. */
const NIGHTLY_REREAD_DAYS = 7;

/**
 * The dates a nightly read covers: never today, since who did not come is only known once the day
 * is over. The first read reaches back to the first open period.
 */
export function nightlyRange(today: IsoDate, firstRead: IsoDate | null): { from: IsoDate; to: IsoDate } {
  const lastWeek = addDays(today, -NIGHTLY_REREAD_DAYS);
  return {
    from: firstRead !== null && firstRead < lastWeek ? firstRead : lastWeek,
    to: addDays(today, -1),
  };
}

/** Reads a range and stores it whole, or stores that it could not be read. */
export async function readWorkeraRange(
  workera: WorkeraClient,
  supabase: Supabase,
  from: IsoDate,
  to: IsoDate,
): Promise<void> {
  try {
    const clockings = await workera.readClockings(from, to);
    const schedules = await workera.readSchedules(from, to);
    const { error } = await supabase.rpc("record_attendance_read", {
      p_from: from,
      p_to: to,
      p_clockings: clockings,
      p_schedules: schedules,
    });
    if (error) throw new Error(error.message);

    // A fresh read moves the derived marks of the range it covers (docs/DOMAIN.md §5d). It is a
    // no-op before stage 2, so the nightly read stays cheap until an admin turns it on.
    const { error: recomputeError } = await supabase.rpc("recompute_attendance_marks", { p_from: from, p_to: to });
    if (recomputeError) throw new Error(recomputeError.message);
  } catch (error) {
    const { error: recordError } = await supabase.rpc("record_attendance_read_failure", {
      p_from: from,
      p_to: to,
      p_failure: error instanceof Error ? error.message : "Unknown failure",
    });
    if (recordError) throw new Error(recordError.message);
    throw error;
  }
}

/** The first open period's start while nothing has been read yet, and null once something has. */
export async function firstReadDate(supabase: Supabase): Promise<IsoDate | null> {
  const reads = orThrow(
    await supabase.from("attendance_reads").select("id").is("deleted_at", null).eq("succeeded", true).limit(1),
  );
  if (reads.length > 0) return null;

  const periods = orThrow(
    await supabase
      .from("periods")
      .select("start_date")
      .is("deleted_at", null)
      .eq("status", "OPEN")
      .order("start_date")
      .limit(1),
  );
  return periods[0]?.start_date ?? null;
}
