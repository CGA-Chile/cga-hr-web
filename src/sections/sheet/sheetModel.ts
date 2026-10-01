import type { IsoDate } from "@/domain/bonus/types";
import type { DailyBonus } from "../bonus/dailyBonuses";
import type { Assignment, Employee, Position } from "../day/queries";
import { fullName } from "../day/queries";

/** How a cell is coloured: the carding line, its scheme trigger, any other job, or an absence. */
export type CellTone = "LINE" | "TRIGGER" | "OTHER" | "ABSENCE";

export type SheetCell = {
  date: IsoDate;
  assignment: Assignment | null;
  /** The position has more than one occupant this date: the duplicate the close gate stops on. */
  duplicated: boolean;
};

export type SheetRow = { employee: Employee; cells: SheetCell[]; total: number };

export type SheetDay = {
  date: IsoDate;
  /** The line's bonus for the date, or null when nobody worked the line or no rates cover it. */
  total: number | null;
  /** Something to look at: an anomaly, or no rates in force. Same rule as the notices list. */
  flagged: boolean;
};

export type Sheet = { days: SheetDay[]; rows: SheetRow[]; grandTotal: number };

type SheetInput = {
  dates: readonly IsoDate[];
  employees: readonly Employee[];
  assignments: readonly Assignment[];
  dailyBonuses: readonly DailyBonus[];
};

export function toneOf(position: Pick<Position, "type" | "bonus_eligible" | "triggers_equal_share">): CellTone {
  if (position.type === "ABSENCE") return "ABSENCE";
  if (position.triggers_equal_share) return "TRIGGER";
  return position.bonus_eligible ? "LINE" : "OTHER";
}

/**
 * The period as the sheet it replaces: one row per person, one cell per date, the line's bonus
 * per date underneath and each person's bonus for the range at the end. Everyone active is
 * listed, plus anyone inactive who still has a day in the range.
 */
export function buildSheet({ dates, employees, assignments, dailyBonuses }: SheetInput): Sheet {
  const assignmentByCell = new Map(assignments.map((assignment) => [cellKey(assignment.date, assignment.employee_id), assignment]));
  const bonusByDate = new Map(dailyBonuses.map((bonus) => [bonus.date, bonus]));
  const withAssignments = new Set(assignments.map((assignment) => assignment.employee_id));

  const rows = employees
    .filter((employee) => employee.active || withAssignments.has(employee.id))
    .sort((a, b) => fullName(a).localeCompare(fullName(b), "es"))
    .map((employee) => ({
      employee,
      cells: dates.map((date) => {
        const assignment = assignmentByCell.get(cellKey(date, employee.id)) ?? null;
        return { date, assignment, duplicated: isDuplicated(bonusByDate.get(date), assignment) };
      }),
      total: employeeTotal(dailyBonuses, employee.id),
    }));

  const days = dates.map((date) => {
    const bonus = bonusByDate.get(date);
    return {
      date,
      total: bonus?.result && bonus.result.perEmployee.length > 0 ? bonus.result.total : null,
      flagged: bonus !== undefined && (!bonus.result || bonus.result.anomalies.length > 0),
    };
  });

  return { days, rows, grandTotal: days.reduce((sum, day) => sum + (day.total ?? 0), 0) };
}

function cellKey(date: IsoDate, employeeId: string): string {
  return `${date}|${employeeId}`;
}

function isDuplicated(bonus: DailyBonus | undefined, assignment: Assignment | null): boolean {
  if (!assignment || !bonus?.result) return false;
  return bonus.result.anomalies.some(
    (anomaly) => anomaly.kind === "DUPLICATE_OCCUPANCY" && anomaly.positionId === assignment.position_id,
  );
}

function employeeTotal(dailyBonuses: readonly DailyBonus[], employeeId: string): number {
  return dailyBonuses.reduce(
    (sum, bonus) =>
      sum + (bonus.result?.perEmployee.find((entry) => entry.employeeId === employeeId)?.amount ?? 0),
    0,
  );
}

export type ColumnCopy = { from: IsoDate; cells: { employeeId: string; positionId: string }[] };

/**
 * The column copy: the date's empty cells, among the people on the sheet, filled from the latest
 * earlier date that has anything recorded, so a Monday copies Saturday rather than an empty
 * Sunday. A cell that already holds anything, an absence included, is left alone. Null when no
 * earlier date in the assignments given has anything.
 */
export function copyFromPreviousDate(
  date: IsoDate,
  rows: readonly Pick<SheetRow, "employee">[],
  assignments: readonly Assignment[],
): ColumnCopy | null {
  const from = assignments
    .map((assignment) => assignment.date)
    .filter((day) => day < date)
    .sort()
    .at(-1);
  if (!from) return null;

  const positionOn = (day: IsoDate, employeeId: string) =>
    assignments.find((assignment) => assignment.date === day && assignment.employee_id === employeeId)?.position_id;
  const cells = rows.flatMap(({ employee }) => {
    const positionId = positionOn(from, employee.id);
    return positionId && !positionOn(date, employee.id) ? [{ employeeId: employee.id, positionId }] : [];
  });
  return { from, cells };
}
