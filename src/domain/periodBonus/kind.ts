import type { PeriodBonusKind } from "./types";

export const PERIOD_BONUS_KINDS: readonly PeriodBonusKind[] = ["PRODUCTION", "COMPLIANCE"];

/** Narrows the `bonus` column, which the database types as plain text. */
export function isPeriodBonusKind(value: string | null): value is PeriodBonusKind {
  return value === "PRODUCTION" || value === "COMPLIANCE";
}
