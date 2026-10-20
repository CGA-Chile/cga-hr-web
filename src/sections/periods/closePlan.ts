import type { IsoDate } from "@/domain/bonus/types";
import { planPeriodBonusClose } from "@/domain/periodBonus/planPeriodBonusClose";
import type { PeriodBonusClosePlan, PeriodBonusKind } from "@/domain/periodBonus/types";
import { planClose } from "@/domain/settlement/planClose";
import type { ClosePlan, SettlementDay } from "@/domain/settlement/types";
import {
  calculateDates,
  loadBonusPositions,
  loadCalendar,
  loadLiveAssignments,
  loadSettingsVersions,
} from "@/sections/bonus/dailyBonuses";
import { loadPeriodBonusCloseInput } from "@/sections/bonus/periodBonuses";
import type { Json } from "@/types/database";
import { orThrow, type ServerSupabase } from "@/utils/supabase/query";
import type { Period } from "./queries";

export type Settlement = { assignment_id: string; position_id: string; amount: number };

export type LoadedClosePlan = {
  plan: ClosePlan;
  /** Dates with something to settle and no settings version to price them with. */
  unpricedDates: IsoDate[];
  /** What close_period receives: the plan's entries, keyed back to their assignments. */
  settlements: Settlement[];
  /** The production and compliance bonuses this close settles, its own and carried over. */
  periodBonuses: PeriodBonusClosePlan;
  /** Totals of `periodBonuses` per bonus: the period's own days, and carry-over. */
  periodBonusTotals: Record<PeriodBonusKind, { period: number; carryOver: number }>;
  canClose: boolean;
};

/**
 * Everything the close of `period` would settle, run through the settlement rules: every date on
 * or before its end that still has an unsettled assignment, calculated over all of that date's
 * live assignments with the settings in force on it. What gets settled is what the calculation
 * pays: the line on an ordinary date, everyone who worked on a day-rate date.
 */
export async function loadClosePlan(supabase: ServerSupabase, period: Period): Promise<LoadedClosePlan> {
  const [unsettled, positions, versions, validations, periodBonusInput] = await Promise.all([
    supabase
      .from("assignments")
      .select("date")
      .is("settled_in_period_id", null)
      .is("deleted_at", null)
      .lte("date", period.end_date),
    loadBonusPositions(supabase),
    loadSettingsVersions(supabase),
    supabase.from("cap_overrides").select("date, approved_amount").eq("period_id", period.id).is("deleted_at", null),
    loadPeriodBonusCloseInput(supabase, period),
  ]);
  const dateSet = new Set(orThrow(unsettled).map((row) => row.date));
  const dates = [...dateSet].sort();
  const [inRange, calendar] = dates.length
    ? await Promise.all([
        loadLiveAssignments(supabase, dates[0], dates[dates.length - 1]),
        loadCalendar(supabase, dates[0], dates[dates.length - 1]),
      ])
    : [[], new Map()];
  const assignments = inRange.filter((a) => dateSet.has(a.date));
  const calculated = calculateDates(assignments, positions, versions, calendar);

  const days: SettlementDay[] = calculated.flatMap((day) =>
    day.result
      ? [
          {
            date: day.date,
            dailyCap: day.settings.dailyCap,
            calculation: day.result,
            assignments: assignments.filter(
              (a) => a.date === day.date && day.result.perEmployee.some((entry) => entry.employeeId === a.employeeId),
            ),
          },
        ]
      : [],
  );
  const unpricedDates = calculated.filter((day) => !day.result).map((day) => day.date);

  const plan = planClose({
    startDate: period.start_date,
    endDate: period.end_date,
    days,
    validatedExcesses: orThrow(validations).map((row) => ({ date: row.date, approvedAmount: row.approved_amount })),
  });

  const assignmentIds = new Map(assignments.map((a) => [`${a.date}|${a.employeeId}`, a.id]));
  const settlements = plan.toSettle.map((entry) => {
    const id = assignmentIds.get(`${entry.date}|${entry.employeeId}`);
    if (!id) throw new Error(`No assignment for ${entry.employeeId} on ${entry.date}`);
    return { assignment_id: id, position_id: entry.positionId, amount: entry.amount };
  });

  const periodBonuses = planPeriodBonusClose(periodBonusInput);

  return {
    plan,
    unpricedDates,
    settlements,
    periodBonuses,
    periodBonusTotals: totalsOf(periodBonuses, period.id),
    canClose: plan.canClose && unpricedDates.length === 0,
  };
}

/** The total a close pays, daily and period bonuses together. */
export function grandTotal(loaded: LoadedClosePlan): number {
  const { PRODUCTION, COMPLIANCE } = loaded.periodBonusTotals;
  return (
    loaded.plan.periodTotal +
    loaded.plan.carryOverTotal +
    PRODUCTION.period +
    PRODUCTION.carryOver +
    COMPLIANCE.period +
    COMPLIANCE.carryOver
  );
}

/** close_period's p_period_bonuses, in the database's column names. */
export function periodBonusArgument(plan: PeriodBonusClosePlan): Json {
  return {
    terms: plan.terms && {
      working_days: plan.terms.workingDays,
      production_amount: plan.terms.productionAmount,
      compliance_amount: plan.terms.complianceAmount,
      strike_deduction: plan.terms.strikeDeduction,
      strike_limit: plan.terms.strikeLimit,
    },
    settlements: plan.settlements.map((row) => ({
      origin_period_id: row.originPeriodId,
      employee_id: row.employeeId,
      bonus: row.bonus,
      days: row.days,
      strikes: row.strikes,
      reprimanded: row.reprimanded,
      amount: row.amount,
    })),
    stamps: plan.stamps.map((stamp) => ({
      assignment_id: stamp.assignmentId,
      position_id: stamp.positionId,
      bonus: stamp.bonus,
    })),
  };
}

function totalsOf(plan: PeriodBonusClosePlan, periodId: string): LoadedClosePlan["periodBonusTotals"] {
  const totals = { PRODUCTION: { period: 0, carryOver: 0 }, COMPLIANCE: { period: 0, carryOver: 0 } };
  for (const row of plan.settlements) {
    if (row.originPeriodId === periodId) totals[row.bonus].period += row.amount;
    else totals[row.bonus].carryOver += row.amount;
  }
  return totals;
}
