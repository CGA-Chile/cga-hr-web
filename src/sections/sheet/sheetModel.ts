import { findDuplicatedPositions } from "@/domain/bonus/duplicates";
import type { BonusPosition, BonusScheme, DailyBonusResult, EmployeeBonus, IsoDate } from "@/domain/bonus/types";
import { earnsDailyBonus } from "@/domain/bonus/fullDay";
import type { MismatchReason } from "@/domain/attendance/mismatch";
import type { MismatchOf } from "../attendance/mismatches";
import type { DailyBonus } from "../bonus/dailyBonuses";
import { toBonusAssignment } from "../bonus/toBonus";
import type { Assignment, Employee, Position } from "../day/queries";
import { fullName } from "../day/queries";

/** How a cell is coloured: the carding line, its scheme trigger, any other job, or an absence. */
export type CellTone = "LINE" | "TRIGGER" | "OTHER" | "ABSENCE";

/** Why a date paid what it did, for the cell panel to explain and the breakdown to colour. */
export type BonusBasis =
  | { scheme: "POSITION_RATE" }
  | { scheme: "EQUAL_SHARE"; sharedBy: number }
  | { scheme: "DAY_RATE" }
  | { scheme: "TASK"; bonusTaskId: string };

/**
 * One person's bonus on one date: the line's, the day rate's, or a bonus task's, which replaces
 * both. Incomplete: listed at zero for arriving late or leaving early.
 */
export type CellBonus = { amount: number; incomplete: boolean; basis: BonusBasis };

export type SheetCell = {
  date: IsoDate;
  assignment: Assignment | null;
  /** The position has more than one occupant this date: the duplicate the close gate stops on. */
  duplicated: boolean;
  /** Null when the date pays this person nothing, or for a role that never sees amounts. */
  bonus: CellBonus | null;
  /** Where the sheet and Workera disagree, for everyone to see. */
  mismatch: MismatchReason | null;
};

/** The total is the daily bonuses together; the breakdown under the row shows each apart. */
export type SheetRow = {
  employee: Employee;
  cells: SheetCell[];
  total: number;
  carding: number;
  dayRate: number;
  tasks: number;
};

export type SheetDay = {
  date: IsoDate;
  /** What the date pays: the line's or the day rate's bonus plus its tasks. Null when it pays nobody. */
  total: number | null;
  /** Something to look at: an anomaly, or no rates in force. Same rule as the notices list. */
  flagged: boolean;
};

export type Sheet = { days: SheetDay[]; rows: SheetRow[]; grandTotal: number };

type SheetInput = {
  dates: readonly IsoDate[];
  employees: readonly Employee[];
  assignments: readonly Assignment[];
  /** Empty for a role that never sees amounts: the totals stay empty, the duplicates still show. */
  dailyBonuses: readonly DailyBonus[];
  positions: readonly BonusPosition[];
  /** Left out where Workera is not read: no cell then has a mismatch. */
  mismatchOf?: MismatchOf;
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
export function buildSheet({ dates, employees, assignments, dailyBonuses, positions, mismatchOf }: SheetInput): Sheet {
  const assignmentByCell = new Map(assignments.map((assignment) => [cellKey(assignment.date, assignment.employee_id), assignment]));
  const bonusByDate = new Map(dailyBonuses.map((bonus) => [bonus.date, bonus]));
  const duplicatedByDate = duplicatedPositionsByDate(assignments, positions);
  const withAssignments = new Set(assignments.map((assignment) => assignment.employee_id));

  const rows = employees
    .filter((employee) => employee.active || withAssignments.has(employee.id))
    .sort((a, b) => fullName(a).localeCompare(fullName(b), "es"))
    .map((employee) => {
      const cells = dates.map((date) => {
        const assignment = assignmentByCell.get(cellKey(date, employee.id)) ?? null;
        const duplicated = assignment !== null && earnsDailyBonus(toBonusAssignment(assignment)) && Boolean(duplicatedByDate.get(date)?.has(assignment.position_id));
        const dailyBonus = bonusByDate.get(date);
        return {
          date,
          assignment,
          duplicated,
          bonus: dailyBonus ? cellBonus(dailyBonus, employee.id) : null,
          mismatch: mismatchOf?.(date, employee, assignment) ?? null,
        };
      });
      const carding = sumBonuses(cells, isCarding);
      const dayRate = sumBonuses(cells, (basis) => basis.scheme === "DAY_RATE");
      const tasks = sumBonuses(cells, (basis) => basis.scheme === "TASK");
      return { employee, cells, total: carding + dayRate + tasks, carding, dayRate, tasks };
    });

  const days = dates.map((date) => {
    const bonus = bonusByDate.get(date);
    return {
      date,
      total: bonus?.result ? dayTotal(bonus.result) : null,
      flagged:
        (bonus !== undefined && (!bonus.result || bonus.result.anomalies.length > 0)) ||
        (duplicatedByDate.get(date)?.size ?? 0) > 0,
    };
  });

  return { days, rows, grandTotal: days.reduce((sum, day) => sum + (day.total ?? 0), 0) };
}

function dayTotal(result: DailyBonusResult): number | null {
  if (result.perEmployee.length === 0 && result.taskBonuses.length === 0) return null;
  return result.total + result.taskBonuses.reduce((sum, task) => sum + task.amount, 0);
}

/** The carding line's own schemes, as the breakdown and the totals split them. */
export function isCarding(basis: BonusBasis): boolean {
  return basis.scheme === "POSITION_RATE" || basis.scheme === "EQUAL_SHARE";
}

/** One cell's key: in the panel payload, on the grid's data-cell attribute and in the browser. */
export function cellKey(date: IsoDate, employeeId: string): string {
  return `${date}|${employeeId}`;
}

/** Same rule as the calculation's duplicate mark, computed without settings so every role sees it. */
function duplicatedPositionsByDate(
  assignments: readonly Assignment[],
  positions: readonly BonusPosition[],
): Map<IsoDate, Set<string>> {
  const byDate = Map.groupBy(assignments, (assignment) => assignment.date);
  return new Map(
    [...byDate].map(([date, dateAssignments]) => [
      date,
      new Set(
        findDuplicatedPositions(
          dateAssignments.map(toBonusAssignment),
          positions,
        ).map((duplicate) => duplicate.positionId),
      ),
    ]),
  );
}

function cellBonus({ result }: DailyBonus, employeeId: string): CellBonus | null {
  const task = result?.taskBonuses.find((candidate) => candidate.employeeId === employeeId);
  if (task) return { amount: task.amount, incomplete: false, basis: { scheme: "TASK", bonusTaskId: task.bonusTaskId } };
  const entry = result?.perEmployee.find((candidate) => candidate.employeeId === employeeId);
  if (!result || !entry) return null;
  return { amount: entry.amount, incomplete: !earnsDailyBonus(entry), basis: basisOf(result.scheme, result.perEmployee) };
}

/** Equal share is split among those the line pays; the rest are listed at zero. */
function basisOf(scheme: BonusScheme, perEmployee: readonly EmployeeBonus[]): BonusBasis {
  if (scheme === "EQUAL_SHARE") return { scheme, sharedBy: perEmployee.filter(earnsDailyBonus).length };
  return { scheme };
}

function sumBonuses(cells: readonly SheetCell[], counts: (basis: BonusBasis) => boolean): number {
  return cells.reduce((sum, { bonus }) => sum + (bonus && counts(bonus.basis) ? bonus.amount : 0), 0);
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

export type PanelAssignment = Pick<Assignment, "position_id" | "note" | "late" | "late_notified" | "left_early" | "bonus_task_id">;
type PanelCell = { assignment: PanelAssignment | null; bonus?: CellBonus | null; mismatch?: MismatchReason };
export type PanelCells = { amounts: boolean; byCell: Record<string, PanelCell> };

/**
 * What the cell panel shows, for every filled cell on the sheet, so it opens in the browser
 * without asking the server. For a role that never sees amounts the bonus is left out of the
 * payload, not hidden in the browser.
 */
export function buildPanelCells(rows: readonly Pick<SheetRow, "employee" | "cells">[], amounts: boolean): PanelCells {
  const byCell: Record<string, PanelCell> = {};
  for (const { employee, cells } of rows) {
    for (const { date, assignment, bonus, mismatch } of cells) {
      if (!assignment && !mismatch) continue;
      byCell[cellKey(date, employee.id)] = {
        assignment: assignment && panelAssignment(assignment),
        ...(amounts && { bonus }),
        ...(mismatch && { mismatch }),
      };
    }
  }
  return { amounts, byCell };
}

export function findPanelCell(
  cells: PanelCells,
  { date, employeeId }: { date: IsoDate; employeeId: string },
): { assignment: PanelAssignment | null; bonus: CellBonus | null | undefined; mismatch: MismatchReason | null } {
  const cell = cells.byCell[cellKey(date, employeeId)];
  const emptyBonus = cells.amounts ? null : undefined;
  return {
    assignment: cell?.assignment ?? null,
    bonus: cell?.assignment ? cell.bonus : emptyBonus,
    mismatch: cell?.mismatch ?? null,
  };
}

function panelAssignment(assignment: Assignment): PanelAssignment {
  const { position_id, note, late, late_notified, left_early, bonus_task_id } = assignment;
  return { position_id, note, late, late_notified, left_early, bonus_task_id };
}
