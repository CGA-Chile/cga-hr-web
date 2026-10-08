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
 * Computes one date's bonus. Pure: the caller supplies the date's assignments, the positions with
 * their flags, the settings in force on that date, and the date's day rate when it has one.
 *
 * On a day-rate date everyone who worked earns that rate and nothing else applies. Otherwise the
 * carding line is paid, and the daily cap appears only in the EQUAL_SHARE formula: a
 * POSITION_RATE total above it is returned as is and reported as an anomaly; enforcing the cap is
 * the close gate's job.
 */
export function calculateDailyBonus(input: DailyBonusInput): DailyBonusResult {
  const resolved = resolvePositions(input);
  const eligible = resolved.filter((assignment) => assignment.position.bonusEligible);
  const onLine = eligible.filter((assignment) => !assignment.late);
  if (input.dayRate !== null) return payDayRate(resolved, onLine, input.dayRate);

  const scheme = deriveScheme(onLine);
  const equalShare = equalShareAmount(input.settings, onLine.length);
  const perEmployee = eligible.map((assignment) =>
    toBonus(assignment, scheme === "EQUAL_SHARE" ? equalShare : positionRate(assignment, input.settings)),
  );
  const total = sumOf(perEmployee);

  return {
    scheme,
    perEmployee,
    total,
    anomalies: [
      ...findDuplicateOccupancy(onLine, scheme),
      ...findAboveDailyCap(total, input.settings),
    ],
  };
}

/** The daily cap does not apply: the day rate is a fixed amount per person, not a shared pot. */
function payDayRate(
  resolved: readonly ResolvedAssignment[],
  onLine: readonly ResolvedAssignment[],
  dayRate: number,
): DailyBonusResult {
  const perEmployee = resolved
    .filter((assignment) => !assignment.position.absence)
    .map((assignment) => toBonus(assignment, dayRate));
  return {
    scheme: "DAY_RATE",
    perEmployee,
    total: sumOf(perEmployee),
    anomalies: findDuplicateOccupancy(onLine, "DAY_RATE"),
  };
}

/** A late arrival is listed at zero whatever the scheme would pay. */
function toBonus(assignment: ResolvedAssignment, amount: number): EmployeeBonus {
  return {
    employeeId: assignment.employeeId,
    positionId: assignment.positionId,
    amount: assignment.late ? 0 : amount,
    late: assignment.late,
  };
}

function sumOf(entries: readonly EmployeeBonus[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
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

/** A missing rate is a configuration gap; paying zero would hide it inside a plausible total. */
function positionRate(assignment: ResolvedAssignment, settings: BonusSettings): number {
  if (assignment.late) return 0;
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
