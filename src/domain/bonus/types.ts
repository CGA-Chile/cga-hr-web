/**
 * Input and output of the bonus calculation. Defined here rather than derived from the generated
 * database types, so that a migration can never silently change the module that computes wages.
 */

export type BonusScheme = "POSITION_RATE" | "EQUAL_SHARE" | "DAY_RATE";

export type BonusPosition = {
  id: string;
  bonusEligible: boolean;
  /** Its presence on a date forces EQUAL_SHARE. Always bonus-eligible, never rate-bearing. */
  triggersEqualShare: boolean;
  /** Falta, Licencia, Vacaciones: the person did not work, so no scheme pays them. */
  absence: boolean;
};

export type BonusAssignment = {
  employeeId: string;
  positionId: string;
};

/** The day-rate defaults, one per kind of date. Amounts are integer Chilean pesos. */
export type DayRates = {
  saturday: number;
  sunday: number;
  holiday: number;
};

/** Amounts are integer Chilean pesos. */
export type BonusSettings = {
  dailyCap: number;
  maxAmountPerPerson: number;
  /** Keyed by position id. The scheme trigger deliberately has no entry. */
  positionRates: ReadonlyMap<string, number>;
  /** Null on a version that predates the day rate: no date it covers is paid under it. */
  dayRates: DayRates | null;
};

/** A calendar date as `YYYY-MM-DD`. Compared as text, so no time zone is ever involved. */
export type IsoDate = string;

/** One row of `bonus_settings` with its rates. Both bounds are inclusive; a null end is open. */
export type BonusSettingsVersion = BonusSettings & {
  effectiveFrom: IsoDate;
  effectiveTo: IsoDate | null;
};

/** What HR recorded about one date. A date with no entry is an ordinary date. */
export type CalendarDate = {
  holiday: boolean;
  /** The amount HR set for this one date; null means the default for its kind. */
  dayRate: number | null;
};

/** Why a date is paid under the day rate. WEEKDAY only happens when HR set an amount for it. */
export type DayRateReason = "SATURDAY" | "SUNDAY" | "HOLIDAY" | "WEEKDAY";

export type DayRate = {
  reason: DayRateReason;
  amount: number;
  /** True when HR set this amount for the date, rather than it being the default. */
  setForDate: boolean;
};

export type DailyBonusInput = {
  assignments: readonly BonusAssignment[];
  positions: readonly BonusPosition[];
  settings: BonusSettings;
  /** The date's day rate, or null on a date paid under the line's schemes. */
  dayRate: number | null;
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
      /** True under POSITION_RATE, where the extra occupant is paid; false otherwise. */
      affectsAmount: boolean;
    }
  | { kind: "ABOVE_DAILY_CAP"; total: number; dailyCap: number };

export type DailyBonusResult = {
  scheme: BonusScheme;
  perEmployee: EmployeeBonus[];
  total: number;
  anomalies: DailyBonusAnomaly[];
};
