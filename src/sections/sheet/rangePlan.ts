import type { IsoDate } from "@/domain/bonus/types";
import type { CellState } from "@/hooks/useAssignmentWriter";
import type { Database } from "@/types/database";
import { addDays, weekdayOf } from "@/utils/chileDate";
import type { loadStoredDays } from "../day/queries";

/** Which dates of the range get the position: all of them, as a leave counts, or the working week. */
export type RangeDays = "ALL" | "MON_FRI" | "MON_SAT";
export type RangeRequest = { from: IsoDate; to: IsoDate; days: RangeDays };

const SUNDAY = 0;
const SATURDAY = 6;

export function rangeDates({ from, to, days }: RangeRequest): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const weekday = weekdayOf(date);
    if (weekday === SUNDAY && days !== "ALL") continue;
    if (weekday === SATURDAY && days === "MON_FRI") continue;
    dates.push(date);
  }
  return dates;
}

export type StoredDay = Awaited<ReturnType<typeof loadStoredDays>>[number];

/**
 * What happens to one date. PAID is a paid date the range skips: one the user may not change, or
 * one it would empty, which would lose its settlement with no way to undo it.
 */
export type DayChange = "REPLACE" | "FILL" | "CLEAR" | "NOTE" | "SAME" | "PAID";
export type PlannedDay = { date: IsoDate; before: string | null; after: string | null; change: DayChange };

type PlanInput = {
  dates: readonly IsoDate[];
  stored: readonly StoredDay[];
  /** Null empties the dates. */
  positionId: string | null;
  note: string | null;
  /** The admin may replace a paid date, as with a single cell. */
  mayChangePaid: boolean;
};

/** The preview of a range, date by date, following the rules apply_assignment_range writes by. */
export function planRange({ dates, stored, positionId, note, mayChangePaid }: PlanInput): PlannedDay[] {
  const byDate = new Map(stored.map((day) => [day.date, day]));
  return dates.map((date) => {
    const day = byDate.get(date);
    const before = day?.position_id ?? null;
    const planned = (change: DayChange, after: string | null = positionId) => ({ date, before, after, change });

    if (day && day.settled_in_period_id !== null && (!mayChangePaid || positionId === null)) {
      return planned("PAID", before);
    }
    if (before === positionId) {
      return planned(positionId !== null && note !== null && note !== day?.note ? "NOTE" : "SAME");
    }
    if (positionId === null) return planned("CLEAR");
    return planned(before === null ? "FILL" : "REPLACE");
  });
}

export type PlanSummary = Record<"replace" | "fill" | "clear" | "note" | "same" | "paid", number> & {
  /** Dates the range writes to. */
  changing: number;
  /** Changing dates past the last date on screen, which belong to the next period. */
  afterEnd: number;
  firstAfterEnd: IsoDate | null;
};

export function summarizePlan(plan: readonly PlannedDay[], end: IsoDate): PlanSummary {
  const count = (change: DayChange) => plan.filter((day) => day.change === change).length;
  const changing = plan.filter((day) => WRITES.has(day.change));
  const afterEnd = changing.filter((day) => day.date > end);
  return {
    replace: count("REPLACE"),
    fill: count("FILL"),
    clear: count("CLEAR"),
    note: count("NOTE"),
    same: count("SAME"),
    paid: count("PAID"),
    changing: changing.length,
    afterEnd: afterEnd.length,
    firstAfterEnd: afterEnd[0]?.date ?? null,
  };
}

const WRITES: ReadonlySet<DayChange> = new Set(["REPLACE", "FILL", "CLEAR", "NOTE"]);

type RangeRow = Database["public"]["Functions"]["apply_assignment_range"]["Returns"][number];
/** A changed date as the database answers it. The generated type misses that an empty date answers nulls. */
export type PreviousDay = { [Column in keyof RangeRow]: Column extends "changed_date" ? IsoDate : RangeRow[Column] | null };
export type UndoCell = CellState & { date: IsoDate };

/** The cell writes that put back what the range replaced, one per changed date. */
export function undoCells(previous: readonly PreviousDay[]): UndoCell[] {
  return previous.map((day) => {
    if (day.previous_position_id === null) return { date: day.changed_date, positionId: null, note: null };
    return {
      date: day.changed_date,
      positionId: day.previous_position_id,
      note: day.previous_note,
      late: day.previous_late ?? false,
      ...(day.previous_late_notified !== null && { lateNotified: day.previous_late_notified }),
      leftEarly: day.previous_left_early ?? false,
    };
  });
}
