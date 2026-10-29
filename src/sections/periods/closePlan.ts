import type { BonusScheme, IsoDate } from "@/domain/bonus/types";
import { planPeriodBonusClose } from "@/domain/periodBonus/planPeriodBonusClose";
import type { PeriodBonusClosePlan } from "@/domain/periodBonus/types";
import { planClose } from "@/domain/settlement/planClose";
import { planTaskSettlements } from "@/domain/settlement/planTaskSettlements";
import type { ClosePlan, OwedTask, SettlementDay, TaskSettlementPlan } from "@/domain/settlement/types";
import {
  calculateDates,
  loadBonusPositions,
  loadCalendar,
  loadLiveAssignments,
  loadSettingsVersions,
  loadUnsettledDates,
} from "@/sections/bonus/dailyBonuses";
import { loadPeriodBonusCloseInput } from "@/sections/bonus/periodBonuses";
import type { Json } from "@/types/database";
import { fetchAllRows, orThrow, type ServerSupabase } from "@/utils/supabase/query";
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
  /** The bonus tasks this close settles, its own and carried over. */
  taskSettlements: TaskSettlementPlan;
  /** The scheme each date with something to settle was calculated under. */
  schemes: ReadonlyMap<IsoDate, BonusScheme>;
  canClose: boolean;
};

/**
 * Everything the close of `period` would settle, run through the settlement rules: every date on
 * or before its end that still has an unsettled assignment, calculated over all of that date's
 * live assignments with the settings in force on it. What gets settled is what the calculation
 * pays: the line on an ordinary date, everyone who worked on a day-rate date.
 */
export async function loadClosePlan(supabase: ServerSupabase, period: Period): Promise<LoadedClosePlan> {
  const [dateSet, positions, versions, validations, periodBonusInput, owedTasks] = await Promise.all([
    loadUnsettledDates(supabase, period.end_date),
    loadBonusPositions(supabase),
    loadSettingsVersions(supabase),
    supabase.from("cap_overrides").select("date, approved_amount").eq("period_id", period.id).is("deleted_at", null),
    loadPeriodBonusCloseInput(supabase, period),
    loadOwedTasks(supabase, period.end_date),
  ]);
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
  const taskSettlements = planTaskSettlements({
    startDate: period.start_date,
    endDate: period.end_date,
    owed: owedTasks,
    versions,
  });
  const unpricedDates = [
    ...new Set([...calculated.filter((day) => !day.result).map((day) => day.date), ...taskSettlements.unpricedDates]),
  ].sort();

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
    taskSettlements,
    schemes: new Map(days.map((day) => [day.date, day.calculation.scheme])),
    canClose: plan.canClose && unpricedDates.length === 0,
  };
}

async function loadOwedTasks(supabase: ServerSupabase, endDate: IsoDate): Promise<OwedTask[]> {
  const rows = await fetchAllRows((first, last) =>
    supabase
      .from("bonus_task_owed_days")
      .select("assignment_id, date, employee_id, bonus_task_id, paid_amount")
      .lte("date", endDate)
      .order("assignment_id")
      .order("bonus_task_id")
      .range(first, last),
  );
  return rows.flatMap((row) =>
    row.assignment_id && row.date && row.employee_id && row.bonus_task_id && row.paid_amount !== null
      ? [
          {
            assignmentId: row.assignment_id,
            date: row.date,
            employeeId: row.employee_id,
            bonusTaskId: row.bonus_task_id,
            paidAmount: row.paid_amount,
          },
        ]
      : [],
  );
}

/** close_period's p_task_settlements, in the database's column names. */
export function taskSettlementArgument(plan: TaskSettlementPlan): Json {
  return plan.toSettle.map((entry) => ({
    assignment_id: entry.assignmentId,
    bonus_task_id: entry.bonusTaskId,
    amount: entry.amount,
  }));
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
