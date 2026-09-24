/**
 * Input and output of the bonus calculation. Defined here rather than derived from the generated
 * database types, so that a migration can never silently change the module that computes wages.
 */

export type BonusScheme = "POSITION_RATE" | "EQUAL_SHARE";

export type BonusPosition = {
  id: string;
  bonusEligible: boolean;
  /** Its presence on a date forces EQUAL_SHARE. Always bonus-eligible, never rate-bearing. */
  triggersEqualShare: boolean;
};

export type BonusAssignment = {
  employeeId: string;
  positionId: string;
};

/** Amounts are integer Chilean pesos. */
export type BonusSettings = {
  dailyCap: number;
  maxAmountPerPerson: number;
  /** Keyed by position id. The scheme trigger deliberately has no entry. */
  positionRates: ReadonlyMap<string, number>;
};

/** A calendar date as `YYYY-MM-DD`. Compared as text, so no time zone is ever involved. */
export type IsoDate = string;

/** One row of `bonus_settings` with its rates. Both bounds are inclusive; a null end is open. */
export type BonusSettingsVersion = BonusSettings & {
  effectiveFrom: IsoDate;
  effectiveTo: IsoDate | null;
};

export type DailyBonusInput = {
  assignments: readonly BonusAssignment[];
  positions: readonly BonusPosition[];
  settings: BonusSettings;
};

export type EmployeeBonus = {
  employeeId: string;
  positionId: string;
  amount: number;
};

export type DailyBonusAnomaly =
  | {
      kind: "DUPLICATE_OCCUPANCY";
      positionId: string;
      occupantCount: number;
      /** True under POSITION_RATE, where the extra occupant is paid; false under EQUAL_SHARE. */
      affectsAmount: boolean;
    }
  | { kind: "ABOVE_DAILY_CAP"; total: number; dailyCap: number };

export type DailyBonusResult = {
  scheme: BonusScheme;
  perEmployee: EmployeeBonus[];
  total: number;
  anomalies: DailyBonusAnomaly[];
};
