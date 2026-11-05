/**
 * Where the sheet and Workera disagree about one person on one date (docs/DOMAIN.md §5d). Derived,
 * never stored: correcting either side makes it go away.
 */
export type MismatchReason =
  | "CLOCKED_WITHOUT_POSITION"
  | "POSITION_WITHOUT_CLOCKING"
  | "CLOCKED_WHILE_ABSENT"
  | "MISSING_ENTRY"
  | "MISSING_EXIT";

/** What the cell holds, as far as attendance is concerned. */
export type CellAttendance = "EMPTY" | "WORK" | "ABSENCE";

export type StoredClocking = { workera_type: number; status: string };

/** What a day's clockings add up to. Only entries and exits that still count in Workera. */
export type DayClockings = { entry: boolean; exit: boolean };

const ENTRY = 0;
const EXIT = 1;
const COUNTING_STATUSES = new Set(["ACTIVE", "MODIFIED"]);

export function summarizeClockings(clockings: readonly StoredClocking[]): DayClockings {
  const counting = clockings.filter((clocking) => COUNTING_STATUSES.has(clocking.status));
  return {
    entry: counting.some((clocking) => clocking.workera_type === ENTRY),
    exit: counting.some((clocking) => clocking.workera_type === EXIT),
  };
}

/**
 * An empty cell with no clocking is not a mismatch: it is an absence, which Stage 2 records on its
 * own. A work position with half a day's clocking is, because a forgotten fingerprint has to be
 * looked at by someone, not turned into a late or early mark.
 */
export function findMismatch(cell: CellAttendance, day: DayClockings): MismatchReason | null {
  const clocked = day.entry || day.exit;
  if (cell === "EMPTY") return clocked ? "CLOCKED_WITHOUT_POSITION" : null;
  if (cell === "ABSENCE") return clocked ? "CLOCKED_WHILE_ABSENT" : null;
  if (!clocked) return "POSITION_WITHOUT_CLOCKING";
  if (!day.entry) return "MISSING_ENTRY";
  if (!day.exit) return "MISSING_EXIT";
  return null;
}
