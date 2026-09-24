import type {
  BlockingDate,
  CloseCandidate,
  ClosePlan,
  ExcessRequiringValidation,
  SettlementAssignment,
  SettlementDay,
  SettlementEntry,
  SettlementKind,
  ValidatedExcess,
} from "./types";

/**
 * Plans the close of a period. Closing settles every unsettled bonus-eligible assignment dated on
 * or before the period end, including dates before its start: that is carry-over, and it is how a
 * date the company forgot to record still gets paid. Frozen amounts are never recomputed.
 *
 * Its central job is telling correctable from not correctable (docs/adr/0006, 0008):
 * - a duplicated rate-bearing position, or an over-cap total on a date with nothing frozen, has a
 *   correct answer in the assignments, so it blocks the close;
 * - an over-cap total on a date whose earlier amounts are frozen has nothing left to correct, so
 *   instead of blocking it requires the admin's validation of exactly that amount.
 */
export function planClose(candidate: CloseCandidate): ClosePlan {
  const days = candidate.days.filter(
    (day) => day.date <= candidate.endDate && day.assignments.some(isUnsettled),
  );
  const toSettle = days.flatMap((day) => entriesToSettle(day, kindOf(day, candidate)));
  const blockingDates = days.filter(isBlocking).map(toBlockingDate);
  const excessesRequiringValidation = days
    .filter((day) => !isBlocking(day) && hasFrozenAmounts(day) && settledTotal(day) > day.dailyCap)
    .map((day) => toExcess(day, candidate.validatedExcesses));

  return {
    toSettle,
    periodTotal: totalOf(toSettle, "PERIOD"),
    carryOverTotal: totalOf(toSettle, "CARRY_OVER"),
    blockingDates,
    excessesRequiringValidation,
    canClose:
      blockingDates.length === 0 &&
      excessesRequiringValidation.every((excess) => excess.validated),
  };
}

function kindOf(day: SettlementDay, candidate: CloseCandidate): SettlementKind {
  return day.date < candidate.startDate ? "CARRY_OVER" : "PERIOD";
}

function entriesToSettle(day: SettlementDay, kind: SettlementKind): SettlementEntry[] {
  return day.assignments.filter(isUnsettled).map((assignment) => ({
    date: day.date,
    employeeId: assignment.employeeId,
    positionId: assignment.positionId,
    amount: calculatedAmount(day, assignment),
    kind,
  }));
}

function isUnsettled(assignment: SettlementAssignment): boolean {
  return assignment.settledAmount === null;
}

/** Settling an assignment the calculation did not price at zero would hide the gap. */
function calculatedAmount(day: SettlementDay, assignment: SettlementAssignment): number {
  const priced = day.calculation.perEmployee.find(
    (entry) => entry.employeeId === assignment.employeeId,
  );
  if (!priced) {
    throw new Error(`Assignment of ${assignment.employeeId} on ${day.date} was not priced by the calculation`);
  }
  return priced.amount;
}

function hasFrozenAmounts(day: SettlementDay): boolean {
  return day.assignments.some((assignment) => assignment.settledAmount !== null);
}

/** What the date will have paid in total once this close settles it: frozen plus new. */
function settledTotal(day: SettlementDay): number {
  return day.assignments.reduce(
    (sum, assignment) => sum + (assignment.settledAmount ?? calculatedAmount(day, assignment)),
    0,
  );
}

function isBlocking(day: SettlementDay): boolean {
  return day.calculation.anomalies.some(
    (anomaly) =>
      anomaly.kind === "DUPLICATE_OCCUPANCY" ||
      (anomaly.kind === "ABOVE_DAILY_CAP" && !hasFrozenAmounts(day)),
  );
}

function toBlockingDate(day: SettlementDay): BlockingDate {
  return { date: day.date, anomalies: day.calculation.anomalies };
}

function toExcess(
  day: SettlementDay,
  validatedExcesses: readonly ValidatedExcess[],
): ExcessRequiringValidation {
  const total = settledTotal(day);
  return {
    date: day.date,
    settledTotal: total,
    dailyCap: day.dailyCap,
    validated: validatedExcesses.some(
      (validation) => validation.date === day.date && validation.approvedAmount === total,
    ),
  };
}

function totalOf(entries: readonly SettlementEntry[], kind: SettlementKind): number {
  return entries
    .filter((entry) => entry.kind === kind)
    .reduce((sum, entry) => sum + entry.amount, 0);
}
