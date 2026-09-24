import type {
  BonusAssignment,
  BonusPosition,
  BonusScheme,
  BonusSettings,
  DailyBonusAnomaly,
  DailyBonusInput,
  DailyBonusResult,
  EmployeeBonus,
} from "./types";

type ResolvedAssignment = BonusAssignment & { position: BonusPosition };

/**
 * Computes one date's carding-line bonus. Pure: the caller supplies the date's assignments, the
 * positions with their flags, and the settings in force on that date.
 *
 * The daily cap appears only in the EQUAL_SHARE formula. A POSITION_RATE total above it is
 * returned as is and reported as an anomaly; enforcing the cap is the close gate's job.
 */
export function calculateDailyBonus(input: DailyBonusInput): DailyBonusResult {
  const eligible = resolvePositions(input)
    .filter((assignment) => assignment.position.bonusEligible);
  const scheme = deriveScheme(eligible);
  const perEmployee = computeAmounts(eligible, scheme, input.settings);
  const total = perEmployee.reduce((sum, entry) => sum + entry.amount, 0);

  return {
    scheme,
    perEmployee,
    total,
    anomalies: [
      ...findDuplicateOccupancy(eligible, scheme),
      ...findAboveDailyCap(total, input.settings),
    ],
  };
}

function resolvePositions(input: DailyBonusInput): ResolvedAssignment[] {
  const positionsById = new Map(input.positions.map((position) => [position.id, position]));
  return input.assignments.map((assignment) => {
    const position = positionsById.get(assignment.positionId);
    if (!position) {
      throw new Error(`Assignment references unknown position ${assignment.positionId}`);
    }
    return { ...assignment, position };
  });
}

function deriveScheme(eligible: readonly ResolvedAssignment[]): BonusScheme {
  return eligible.some((assignment) => assignment.position.triggersEqualShare)
    ? "EQUAL_SHARE"
    : "POSITION_RATE";
}

function computeAmounts(
  eligible: readonly ResolvedAssignment[],
  scheme: BonusScheme,
  settings: BonusSettings,
): EmployeeBonus[] {
  const equalShare = equalShareAmount(settings, eligible.length);
  return eligible.map((assignment) => ({
    employeeId: assignment.employeeId,
    positionId: assignment.positionId,
    amount: scheme === "EQUAL_SHARE" ? equalShare : positionRate(assignment, settings),
  }));
}

/** A missing rate is a configuration gap; paying zero would hide it inside a plausible total. */
function positionRate(assignment: ResolvedAssignment, settings: BonusSettings): number {
  const rate = settings.positionRates.get(assignment.positionId);
  if (rate === undefined) {
    throw new Error(`No rate in force for rate-bearing position ${assignment.positionId}`);
  }
  return rate;
}

/** floor(min(maxAmountPerPerson, dailyCap / n)), in integer arithmetic. */
function equalShareAmount(settings: BonusSettings, eligibleCount: number): number {
  if (eligibleCount === 0) return 0;
  const flooredShare = (settings.dailyCap - (settings.dailyCap % eligibleCount)) / eligibleCount;
  return Math.min(settings.maxAmountPerPerson, flooredShare);
}

/** A scheme trigger legitimately holds several people, so only rate-bearing positions count. */
function findDuplicateOccupancy(
  eligible: readonly ResolvedAssignment[],
  scheme: BonusScheme,
): DailyBonusAnomaly[] {
  const occupantsByPosition = new Map<string, number>();
  for (const assignment of eligible) {
    if (assignment.position.triggersEqualShare) continue;
    const count = occupantsByPosition.get(assignment.positionId) ?? 0;
    occupantsByPosition.set(assignment.positionId, count + 1);
  }

  return [...occupantsByPosition]
    .filter(([, occupantCount]) => occupantCount > 1)
    .map(([positionId, occupantCount]) => ({
      kind: "DUPLICATE_OCCUPANCY",
      positionId,
      occupantCount,
      affectsAmount: scheme === "POSITION_RATE",
    }));
}

function findAboveDailyCap(total: number, settings: BonusSettings): DailyBonusAnomaly[] {
  return total > settings.dailyCap
    ? [{ kind: "ABOVE_DAILY_CAP", total, dailyCap: settings.dailyCap }]
    : [];
}
