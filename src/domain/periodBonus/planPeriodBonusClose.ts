import { calculatePeriodBonuses, daysCountedBy, periodBonusAmount } from "./calculatePeriodBonuses";
import type {
  ClosedPeriod,
  CountableAssignment,
  PeriodBonusCloseInput,
  PeriodBonusClosePlan,
  PeriodBonusKind,
  PeriodBonusPosition,
  PeriodBonusSettlement,
  PeriodBonusStamp,
} from "./types";

const KINDS: readonly PeriodBonusKind[] = ["PRODUCTION", "COMPLIANCE"];

/**
 * Plans what a close settles of the period bonuses (docs/adr/0016):
 * - the closing period's own bonuses, with its terms frozen and a row per employee and bonus,
 *   strikes and reprimand included even when the amount is zero, so a later carry-over finds them;
 * - carry-over from each closed period that froze terms: the days a close never counted, paid at
 *   that period's terms as the recomputed total less what was already paid, with the strikes and
 *   the reprimand it froze. Nothing recorded after a close deducts retroactively.
 *
 * Every assignment that adds a day is stamped, per bonus, so no later close counts it again.
 */
export function planPeriodBonusClose(input: PeriodBonusCloseInput): PeriodBonusClosePlan {
  const positionsById = new Map(input.positions.map((position) => [position.id, position]));
  const own = settleOwnPeriod(input, positionsById);
  const carried = input.closedPeriods
    .filter((period) => period.terms !== null)
    .map((period) => settleCarryOver(input, period, positionsById));

  return {
    terms: own.terms,
    settlements: [...own.settlements, ...carried.flatMap((part) => part.settlements)],
    stamps: [...own.stamps, ...carried.flatMap((part) => part.stamps)],
  };
}

type PositionsById = ReadonlyMap<string, PeriodBonusPosition>;

function settleOwnPeriod(input: PeriodBonusCloseInput, positionsById: PositionsById): PeriodBonusClosePlan {
  const { period, amounts } = input;
  if (!amounts) return { terms: null, settlements: [], stamps: [] };

  const inPeriod = input.assignments.filter((a) => period.startDate <= a.date && a.date <= period.endDate);
  const result = calculatePeriodBonuses({
    startDate: period.startDate,
    endDate: period.endDate,
    amounts,
    assignments: inPeriod,
    positions: input.positions,
    calendar: input.calendar,
    reprimanded: input.reprimanded,
  });
  const settlements = result.perEmployee.flatMap((entry) =>
    KINDS.map((bonus) => ({
      originPeriodId: period.id,
      employeeId: entry.employeeId,
      bonus,
      days: bonus === "PRODUCTION" ? entry.productionDays : entry.complianceDays,
      strikes: entry.strikes,
      reprimanded: entry.reprimanded,
      amount: bonus === "PRODUCTION" ? entry.production : entry.compliance,
    })),
  );

  return {
    terms: { ...amounts, workingDays: result.workingDays },
    settlements,
    stamps: stampsFor(inPeriod, input, positionsById),
  };
}

function settleCarryOver(
  input: PeriodBonusCloseInput,
  period: ClosedPeriod,
  positionsById: PositionsById,
): Omit<PeriodBonusClosePlan, "terms"> {
  const { terms } = period;
  if (!terms) return { settlements: [], stamps: [] };

  const inPeriod = input.assignments.filter((a) => period.startDate <= a.date && a.date <= period.endDate);
  const stamps = stampsFor(inPeriod, input, positionsById);
  const assignmentsById = new Map(inPeriod.map((assignment) => [assignment.id, assignment]));
  const earlier = input.settled.filter((row) => row.originPeriodId === period.id);

  const settlements = KINDS.flatMap((bonus) => {
    const byEmployee = Map.groupBy(
      stamps.filter((stamp) => stamp.bonus === bonus),
      (stamp) => assignmentsById.get(stamp.assignmentId)?.employeeId ?? "",
    );
    return [...byEmployee].map(([employeeId, employeeStamps]): PeriodBonusSettlement => {
      const days = employeeStamps.length;
      const frozen = earlier.find((row) => row.employeeId === employeeId);
      const strikes = frozen?.strikes ?? 0;
      const reprimanded = frozen?.reprimanded ?? false;
      const paid = earlier.filter((row) => row.employeeId === employeeId && row.bonus === bonus);
      const paidDays = paid.reduce((sum, row) => sum + row.days, 0);
      const paidAmount = paid.reduce((sum, row) => sum + row.amount, 0);
      const total = periodBonusAmount(bonus, terms, paidDays + days, strikes, reprimanded);
      return { originPeriodId: period.id, employeeId, bonus, days, strikes, reprimanded, amount: Math.max(0, total - paidAmount) };
    });
  });

  return { settlements, stamps };
}

/** One stamp per assignment and bonus it adds a day to, and that no close has counted yet. */
function stampsFor(
  assignments: readonly CountableAssignment[],
  input: PeriodBonusCloseInput,
  positionsById: PositionsById,
): PeriodBonusStamp[] {
  return assignments.flatMap((assignment) => {
    const position = positionsById.get(assignment.positionId);
    if (!position) throw new Error(`Assignment references unknown position ${assignment.positionId}`);
    const adds = daysCountedBy(assignment, position, input.calendar);
    return KINDS.filter((bonus) => adds[bonus] && !assignment.counted[bonus]).map((bonus) => ({
      assignmentId: assignment.id,
      positionId: assignment.positionId,
      bonus,
    }));
  });
}
