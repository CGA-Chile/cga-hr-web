import type { DailyBonusAnomaly, DailyBonusResult, IsoDate } from "@/domain/bonus/types";

/** A live bonus-eligible assignment. `settledAmount` is set once a close froze it. */
export type SettlementAssignment = {
  employeeId: string;
  positionId: string;
  settledAmount: number | null;
};

/**
 * One date the close would touch: its live bonus-eligible assignments, settled or not, and the
 * calculation over all of them at the date's real n, with the settings in force on that date.
 */
export type SettlementDay = {
  date: IsoDate;
  dailyCap: number;
  assignments: readonly SettlementAssignment[];
  calculation: DailyBonusResult;
};

/** An admin's recorded approval to settle `date` at `approvedAmount`, above the cap. */
export type ValidatedExcess = {
  date: IsoDate;
  approvedAmount: number;
};

export type CloseCandidate = {
  startDate: IsoDate;
  endDate: IsoDate;
  days: readonly SettlementDay[];
  validatedExcesses: readonly ValidatedExcess[];
};

export type SettlementKind = "PERIOD" | "CARRY_OVER";

export type SettlementEntry = {
  date: IsoDate;
  employeeId: string;
  positionId: string;
  amount: number;
  kind: SettlementKind;
};

export type BlockingDate = {
  date: IsoDate;
  anomalies: DailyBonusAnomaly[];
};

/** A date whose settled total would exceed the cap and cannot be corrected (docs/adr/0008). */
export type ExcessRequiringValidation = {
  date: IsoDate;
  settledTotal: number;
  dailyCap: number;
  validated: boolean;
};

export type ClosePlan = {
  toSettle: SettlementEntry[];
  periodTotal: number;
  carryOverTotal: number;
  blockingDates: BlockingDate[];
  excessesRequiringValidation: ExcessRequiringValidation[];
  canClose: boolean;
};
