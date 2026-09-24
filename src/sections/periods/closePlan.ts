import type { IsoDate } from "@/domain/bonus/types";
import { planClose } from "@/domain/settlement/planClose";
import type { ClosePlan, SettlementDay } from "@/domain/settlement/types";
import { calculateDates, loadBonusPositions, loadLiveAssignments, loadSettingsVersions } from "@/sections/bonus/dailyBonuses";
import { orThrow, type ServerSupabase } from "@/utils/supabase/query";
import type { Period } from "./queries";

export type Settlement = { assignment_id: string; position_id: string; amount: number };

export type LoadedClosePlan = {
  plan: ClosePlan;
  /** Dates with something to settle and no settings version to price them with. */
  unpricedDates: IsoDate[];
  /** What close_period receives: the plan's entries, keyed back to their assignments. */
  settlements: Settlement[];
  canClose: boolean;
};

/**
 * Everything the close of `period` would settle, run through the settlement rules: every date on
 * or before its end that still has an unsettled bonus-eligible assignment, calculated over all of
 * that date's live assignments with the settings in force on it.
 */
export async function loadClosePlan(supabase: ServerSupabase, period: Period): Promise<LoadedClosePlan> {
  const [unsettled, positions, versions, validations] = await Promise.all([
    supabase
      .from("assignments")
      .select("date, positions!inner(bonus_eligible)")
      .is("settled_in_period_id", null)
      .is("deleted_at", null)
      .lte("date", period.end_date)
      .eq("positions.bonus_eligible", true),
    loadBonusPositions(supabase),
    loadSettingsVersions(supabase),
    supabase.from("cap_overrides").select("date, approved_amount").eq("period_id", period.id).is("deleted_at", null),
  ]);
  const dateSet = new Set(orThrow(unsettled).map((row) => row.date));
  const dates = [...dateSet].sort();
  const eligible = new Set(positions.filter((position) => position.bonusEligible).map((position) => position.id));

  const assignments = dates.length
    ? (await loadLiveAssignments(supabase, dates[0], dates[dates.length - 1])).filter((a) => dateSet.has(a.date))
    : [];
  const calculated = calculateDates(assignments, positions, versions);

  const days: SettlementDay[] = calculated.flatMap((day) =>
    day.result
      ? [
          {
            date: day.date,
            dailyCap: day.settings.dailyCap,
            calculation: day.result,
            assignments: assignments.filter((a) => a.date === day.date && eligible.has(a.positionId)),
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

  return { plan, unpricedDates, settlements, canClose: plan.canClose && unpricedDates.length === 0 };
}
