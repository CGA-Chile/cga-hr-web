import type { CalendarDate, IsoDate } from "@/domain/bonus/types";

/**
 * Input and output of the period bonuses: production and compliance. Like the daily calculation,
 * defined here rather than derived from the database types, so a migration cannot silently change
 * what pays wages.
 */

export type PeriodBonusKind = "PRODUCTION" | "COMPLIANCE";

/** The settings part of a period's terms. Amounts are integer Chilean pesos. */
export type PeriodBonusAmounts = {
  /** What attending every working day on a production position earns. */
  productionAmount: number;
  /** What attending every working day on a compliance position earns, before deductions. */
  complianceAmount: number;
  /** Deducted from the compliance bonus earned, once per strike. */
  strikeDeduction: number;
  /** From this many strikes on, the compliance bonus is zero. */
  strikeLimit: number;
};

/** Everything a period's bonuses depend on besides the assignments. Frozen at the close. */
export type PeriodBonusTerms = PeriodBonusAmounts & {
  /** The divisor: Monday to Friday, not paid under the day rate. */
  workingDays: number;
};

export type PeriodBonusPosition = {
  id: string;
  /** The faltas, Licencia, Vacaciones: the person did not come. */
  absence: boolean;
  /** Its working days earn the production bonus. */
  production: boolean;
  /** Its working days earn the compliance bonus. */
  compliance: boolean;
  /** An absence that is a strike: Falta sin aviso. */
  strike: boolean;
};

export type PeriodBonusAssignment = {
  employeeId: string;
  date: IsoDate;
  positionId: string;
  /** A late arrival, with or without notice, is a strike on any date. */
  late: boolean;
};

export type Calendar = ReadonlyMap<IsoDate, CalendarDate>;

/** One employee's counts over a period: what the amounts are computed from. */
export type EmployeeTally = {
  employeeId: string;
  productionDays: number;
  complianceDays: number;
  strikes: number;
};

export type EmployeePeriodBonus = EmployeeTally & {
  reprimanded: boolean;
  production: number;
  compliance: number;
};

export type PeriodBonusInput = {
  startDate: IsoDate;
  endDate: IsoDate;
  amounts: PeriodBonusAmounts;
  assignments: readonly PeriodBonusAssignment[];
  positions: readonly PeriodBonusPosition[];
  calendar: Calendar;
  /** Employees with a reprimand in this period. */
  reprimanded: ReadonlySet<string>;
};

export type PeriodBonusResult = {
  workingDays: number;
  perEmployee: EmployeePeriodBonus[];
};

/** A period as the close sees it. Both bounds are inclusive. */
export type PeriodBounds = { id: string; startDate: IsoDate; endDate: IsoDate };

/** A closed period, with the terms it froze; null when it closed before the period bonuses. */
export type ClosedPeriod = PeriodBounds & { terms: PeriodBonusTerms | null };

/** A live assignment, and whether a close already counted it for each bonus. */
export type CountableAssignment = PeriodBonusAssignment & {
  id: string;
  counted: Record<PeriodBonusKind, boolean>;
};

/**
 * What one close paid one employee of one bonus, for the days of `originPeriodId`. Strikes and the
 * reprimand are the origin period's, as frozen when it closed.
 */
export type PeriodBonusSettlement = {
  originPeriodId: string;
  employeeId: string;
  bonus: PeriodBonusKind;
  days: number;
  strikes: number;
  reprimanded: boolean;
  amount: number;
};

/** An assignment the close counts for one bonus, so no later close counts it again. */
export type PeriodBonusStamp = { assignmentId: string; positionId: string; bonus: PeriodBonusKind };

export type PeriodBonusCloseInput = {
  period: PeriodBounds;
  /** The amounts in force on the period's end date; null when that version has none. */
  amounts: PeriodBonusAmounts | null;
  closedPeriods: readonly ClosedPeriod[];
  /** Every live assignment dated on or before the period's end. */
  assignments: readonly CountableAssignment[];
  positions: readonly PeriodBonusPosition[];
  calendar: Calendar;
  /** Employees reprimanded in the period being closed. */
  reprimanded: ReadonlySet<string>;
  /** Every settlement row already written for the closed periods. */
  settled: readonly PeriodBonusSettlement[];
};

export type PeriodBonusClosePlan = {
  /** What the period freezes; null when it pays no period bonuses. */
  terms: PeriodBonusTerms | null;
  settlements: PeriodBonusSettlement[];
  stamps: PeriodBonusStamp[];
};
