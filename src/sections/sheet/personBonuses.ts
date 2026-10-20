import type { IsoDate } from "@/domain/bonus/types";
import { calculatePeriodBonuses } from "@/domain/periodBonus/calculatePeriodBonuses";
import type { Calendar, PeriodBonusAmounts, PeriodBonusAssignment, PeriodBonusPosition } from "@/domain/periodBonus/types";
import type { DailyBonus } from "@/sections/bonus/dailyBonuses";
import type { PersonBonuses } from "./PersonPanel";

type PersonBonusesInput = {
  employeeId: string;
  startDate: IsoDate;
  endDate: IsoDate;
  dailyBonuses: readonly DailyBonus[];
  /** Null when the version in force on the end date has no period-bonus amounts. */
  amounts: PeriodBonusAmounts | null;
  assignments: readonly PeriodBonusAssignment[];
  positions: readonly PeriodBonusPosition[];
  calendar: Calendar;
  reprimanded: ReadonlySet<string>;
};

/** One person's four bonuses over the range: the daily ones as calculated, the period ones as of today. */
export function personBonuses(input: PersonBonusesInput): PersonBonuses {
  let carding = 0;
  let dayRate = 0;
  for (const day of input.dailyBonuses) {
    for (const entry of day.result?.perEmployee ?? []) {
      if (entry.employeeId !== input.employeeId) continue;
      if (day.result?.scheme === "DAY_RATE") dayRate += entry.amount;
      else carding += entry.amount;
    }
  }
  if (!input.amounts) return { carding, dayRate, period: null };

  const result = calculatePeriodBonuses({
    startDate: input.startDate,
    endDate: input.endDate,
    amounts: input.amounts,
    assignments: input.assignments.filter((assignment) => assignment.employeeId === input.employeeId),
    positions: input.positions,
    calendar: input.calendar,
    reprimanded: input.reprimanded,
  });
  const own = result.perEmployee.find((entry) => entry.employeeId === input.employeeId) ?? {
    employeeId: input.employeeId,
    productionDays: 0,
    complianceDays: 0,
    strikes: 0,
    reprimanded: input.reprimanded.has(input.employeeId),
    production: 0,
    compliance: 0,
  };
  return { carding, dayRate, period: { ...own, workingDays: result.workingDays } };
}
