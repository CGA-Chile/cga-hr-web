import { orThrow, type ServerSupabase } from "@/utils/supabase/query";
import { calculateDates, loadBonusPositions, loadLiveAssignments, loadSettingsVersions } from "./dailyBonuses";
import type { DailyBonus } from "./dailyBonuses";

export type AnomalousDate = Extract<DailyBonus, { settings: object }>;

/**
 * Dates that still carry an unsettled assignment and whose calculation reports an anomaly: the
 * dates the next close will settle, and therefore the ones its gate will check. Recomputed on
 * every read, so a date leaves the list the moment its assignments are corrected — never
 * because somebody marked it as seen.
 */
export async function loadAnomalousDates(supabase: ServerSupabase): Promise<AnomalousDate[]> {
  const unsettled = orThrow(
    await supabase.from("assignments").select("date").is("settled_in_period_id", null).is("deleted_at", null),
  );
  const dates = new Set(unsettled.map((row) => row.date));
  if (dates.size === 0) return [];

  const sorted = [...dates].sort();
  const [assignments, positions, versions] = await Promise.all([
    loadLiveAssignments(supabase, sorted[0], sorted[sorted.length - 1]),
    loadBonusPositions(supabase),
    loadSettingsVersions(supabase),
  ]);

  return calculateDates(
    assignments.filter((assignment) => dates.has(assignment.date)),
    positions,
    versions,
  ).filter((day): day is AnomalousDate => day.result !== null && day.result.anomalies.length > 0);
}
