import type { BonusScheme, IsoDate } from "@/domain/bonus/types";
import type { PeriodBonusSettlement } from "@/domain/periodBonus/types";
import type { SettlementEntry } from "@/domain/settlement/types";
import { aggregateReport, personOf, type CloseReport, type Person } from "@/sections/report/closeReport";
import { orThrow, type ServerSupabase } from "@/utils/supabase/query";
import type { LoadedClosePlan } from "./closePlan";
import { loadPeriods, type Period } from "./queries";

export type ClosePreviewInput = {
  toSettle: readonly SettlementEntry[];
  periodBonusSettlements: readonly PeriodBonusSettlement[];
  /** The scheme each date to settle was calculated under. */
  schemes: ReadonlyMap<IsoDate, BonusScheme>;
};

export type PreviewNames = {
  person: (employeeId: string) => Person;
  position: (positionId: string) => string;
  period: (periodId: string) => string;
};

/**
 * What closing `periodId` now would pay, in the shape of the report the close will leave behind,
 * so the preview and the report read the same. Carry-over is whatever the plan settles from
 * outside the period: earlier dates, and period bonuses whose origin is an earlier period.
 * Someone the close settles only at zero, like a late day, has nothing to show and is left out.
 */
export function closePreview(input: ClosePreviewInput, periodId: string, names: PreviewNames): CloseReport {
  const daily = input.toSettle.map((entry) => ({
    employeeId: entry.employeeId,
    person: names.person(entry.employeeId),
    date: entry.date,
    positionName: names.position(entry.positionId),
    scheme: schemeOn(input.schemes, entry.date),
    amount: entry.amount,
    carryOver: entry.kind === "CARRY_OVER",
  }));
  const periodBonus = input.periodBonusSettlements.map((settlement) => ({
    employeeId: settlement.employeeId,
    person: names.person(settlement.employeeId),
    bonus: settlement.bonus,
    originName: names.period(settlement.originPeriodId),
    carryOver: settlement.originPeriodId !== periodId,
    days: settlement.days,
    workingDays: null,
    strikes: settlement.strikes,
    reprimanded: settlement.reprimanded,
    amount: settlement.amount,
  }));
  const report = aggregateReport(daily, periodBonus);
  return { ...report, rows: report.rows.filter((row) => row.total > 0) };
}

/** The preview of an open period, with the names of the people and periods its plan names. */
export async function loadClosePreview(
  supabase: ServerSupabase,
  period: Period,
  loaded: LoadedClosePlan,
  positionName: (positionId: string) => string,
): Promise<CloseReport> {
  const toSettle = loaded.plan.toSettle;
  const periodBonusSettlements = loaded.periodBonuses.settlements;
  const employeeIds = [...new Set([...toSettle, ...periodBonusSettlements].map((row) => row.employeeId))];
  const [employees, periods] = await Promise.all([
    employeeIds.length
      ? supabase.from("employees").select("id, first_name, last_name, national_id").in("id", employeeIds)
      : Promise.resolve({ data: [], error: null }),
    loadPeriods(supabase),
  ]);
  const people = new Map(orThrow(employees).map((employee) => [employee.id, personOf(employee)]));
  const periodNames = new Map(periods.map((each) => [each.id, each.name]));

  return closePreview({ toSettle, periodBonusSettlements, schemes: loaded.schemes }, period.id, {
    person: (employeeId) => people.get(employeeId) ?? personOf(null),
    position: positionName,
    period: (periodId) => periodNames.get(periodId) ?? "",
  });
}

function schemeOn(schemes: ClosePreviewInput["schemes"], date: IsoDate): BonusScheme {
  const scheme = schemes.get(date);
  if (!scheme) throw new Error(`No calculated scheme for ${date}`);
  return scheme;
}
