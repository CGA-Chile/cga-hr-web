/**
 * Derives the incomplete-day marks —late arrival and early departure— from a day's clockings
 * compared with the person's schedule, plus a tolerance in minutes (docs/DOMAIN.md §5d).
 *
 * Pure: no I/O, no clock. The caller turns stored clockings and the schedule into minutes of the
 * day and passes them in. This rule lives twice, here and in `private.derive_attendance_marks` in
 * SQL, because the write path runs inside the database (apply_assignment_operation). They change
 * together, the same way `dayRateOn` and `private.is_day_rate_date` do.
 */

/** Minutes from midnight of the first entry and the last exit that still count, or null if missing. */
export type ClockingTimes = { entryMinutes: number | null; exitMinutes: number | null };

/** The scheduled window in minutes from midnight, or null when the day has no schedule. */
export type ScheduleWindow = { startMinutes: number; endMinutes: number };

export type DerivedMarks = { late: boolean; leftEarly: boolean };

const NO_MARKS: DerivedMarks = { late: false, leftEarly: false };

/** Workera's own clocking codes: 0 entry, 1 exit; 2–5 are extraordinary and rest, which never count. */
const ENTRY = 0;
const EXIT = 1;
const COUNTING_STATUSES = new Set(["ACTIVE", "MODIFIED"]);

export type TimedClocking = { workera_type: number; status: string; clocked_at: string };

/**
 * No schedule, or an incomplete clocking, produces no mark: a day with no shift is counted as
 * attended, and a forgotten fingerprint does not cost the bonus by itself.
 */
export function deriveMarks(
  times: ClockingTimes,
  schedule: ScheduleWindow | null,
  toleranceMinutes: number,
): DerivedMarks {
  if (schedule === null || times.entryMinutes === null || times.exitMinutes === null) return NO_MARKS;
  return {
    late: times.entryMinutes > schedule.startMinutes + toleranceMinutes,
    leftEarly: times.exitMinutes < schedule.endMinutes - toleranceMinutes,
  };
}

/** The first entry and the last exit of a day, in minutes, from the clockings that still count. */
export function clockingTimes(clockings: readonly TimedClocking[]): ClockingTimes {
  const counting = clockings.filter((clocking) => COUNTING_STATUSES.has(clocking.status));
  const entries = counting.filter((clocking) => clocking.workera_type === ENTRY).map((c) => minutesOfDay(c.clocked_at));
  const exits = counting.filter((clocking) => clocking.workera_type === EXIT).map((c) => minutesOfDay(c.clocked_at));
  return {
    entryMinutes: entries.length > 0 ? Math.min(...entries) : null,
    exitMinutes: exits.length > 0 ? Math.max(...exits) : null,
  };
}

/** The scheduled window from a stored schedule's two wall-clock timestamps, or null when absent. */
export function scheduleWindow(schedule: { starts_at: string; ends_at: string } | null): ScheduleWindow | null {
  if (schedule === null) return null;
  return { startMinutes: minutesOfDay(schedule.starts_at), endMinutes: minutesOfDay(schedule.ends_at) };
}

/**
 * Minutes from midnight of a naive wall-clock timestamp. Workera sends no zone, so only the clock
 * face is read —"06:05" is 365— and the date is irrelevant: a day's clockings and schedule share it.
 */
export function minutesOfDay(timestamp: string): number {
  const match = /[T ](\d{2}):(\d{2})/.exec(timestamp);
  if (!match) throw new Error(`Timestamp without a time of day: ${timestamp}`);
  return Number(match[1]) * 60 + Number(match[2]);
}
