import { isWorkingDay } from "@/domain/bonus/dayRate";
import type { IsoDate } from "@/domain/bonus/types";
import { addDays } from "@/utils/chileDate";
import type {
  Calendar,
  EmployeeTally,
  PeriodBonusAssignment,
  PeriodBonusInput,
  PeriodBonusKind,
  PeriodBonusPosition,
  PeriodBonusResult,
  PeriodBonusTerms,
} from "./types";

/**
 * Computes one period's production and compliance bonuses, per employee. Pure: the caller supplies
 * the period's bounds, the amounts in force on its end date, every assignment, the calendar and
 * who was reprimanded.
 *
 * Both are a period amount spread over the working days and paid for each one attended on a
 * position that earns it. Compliance then loses a fixed deduction per strike, never going below
 * zero, and is zero from the strike limit on. A reprimand voids both.
 */
export function calculatePeriodBonuses(input: PeriodBonusInput): PeriodBonusResult {
  const terms = { ...input.amounts, workingDays: countWorkingDays(input.startDate, input.endDate, input.calendar) };
  const inPeriod = input.assignments.filter(
    (assignment) => input.startDate <= assignment.date && assignment.date <= input.endDate,
  );
  const tallies = tallyEmployees(inPeriod, input.positions, input.calendar);
  for (const employeeId of input.reprimanded) {
    if (!tallies.has(employeeId)) tallies.set(employeeId, emptyTally(employeeId));
  }

  return {
    workingDays: terms.workingDays,
    perEmployee: [...tallies.values()].map((tally) => {
      const reprimanded = input.reprimanded.has(tally.employeeId);
      return {
        ...tally,
        reprimanded,
        production: periodBonusAmount("PRODUCTION", terms, tally.productionDays, tally.strikes, reprimanded),
        compliance: periodBonusAmount("COMPLIANCE", terms, tally.complianceDays, tally.strikes, reprimanded),
      };
    }),
  };
}

/**
 * What `days` attended earn of one bonus under `terms`. Multiplying before dividing makes a full
 * period earn exactly the amount; the division truncates so rounding never pays more than it.
 */
export function periodBonusAmount(
  kind: PeriodBonusKind,
  terms: PeriodBonusTerms,
  days: number,
  strikes: number,
  reprimanded: boolean,
): number {
  if (reprimanded || terms.workingDays === 0) return 0;
  if (kind === "PRODUCTION") return share(terms.productionAmount, days, terms.workingDays);
  if (strikes >= terms.strikeLimit) return 0;
  return Math.max(0, share(terms.complianceAmount, days, terms.workingDays) - strikes * terms.strikeDeduction);
}

export function countWorkingDays(startDate: IsoDate, endDate: IsoDate, calendar: Calendar): number {
  let count = 0;
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    if (isWorkingDay(date, calendar.get(date))) count += 1;
  }
  return count;
}

/** Which bonuses an assignment adds a day to: a working day attended on a position that earns it. */
export function daysCountedBy(
  assignment: PeriodBonusAssignment,
  position: PeriodBonusPosition,
  calendar: Calendar,
): Record<PeriodBonusKind, boolean> {
  const attended = !position.absence && isWorkingDay(assignment.date, calendar.get(assignment.date));
  return { PRODUCTION: attended && position.production, COMPLIANCE: attended && position.compliance };
}

/** A late arrival or a Falta sin aviso, on any date. */
export function isStrike(assignment: PeriodBonusAssignment, position: PeriodBonusPosition): boolean {
  return assignment.late || position.strike;
}

/** Each employee's days and strikes over the assignments given. */
export function tallyEmployees(
  assignments: readonly PeriodBonusAssignment[],
  positions: readonly PeriodBonusPosition[],
  calendar: Calendar,
): Map<string, EmployeeTally> {
  const positionsById = new Map(positions.map((position) => [position.id, position]));
  const tallies = new Map<string, EmployeeTally>();
  for (const assignment of assignments) {
    const position = positionsById.get(assignment.positionId);
    if (!position) throw new Error(`Assignment references unknown position ${assignment.positionId}`);
    const tally = tallies.get(assignment.employeeId) ?? emptyTally(assignment.employeeId);
    const counted = daysCountedBy(assignment, position, calendar);
    if (counted.PRODUCTION) tally.productionDays += 1;
    if (counted.COMPLIANCE) tally.complianceDays += 1;
    if (isStrike(assignment, position)) tally.strikes += 1;
    tallies.set(assignment.employeeId, tally);
  }
  return tallies;
}

function emptyTally(employeeId: string): EmployeeTally {
  return { employeeId, productionDays: 0, complianceDays: 0, strikes: 0 };
}

/** floor(amount × days / workingDays), in integer arithmetic. */
function share(amount: number, days: number, workingDays: number): number {
  const product = amount * days;
  return (product - (product % workingDays)) / workingDays;
}
