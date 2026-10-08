import { findDuplicatedPositions, type DuplicatedPosition } from "@/domain/bonus/duplicates";
import type { IsoDate } from "@/domain/bonus/types";
import { orThrow, type ServerSupabase } from "@/utils/supabase/query";
import { loadBonusPositions, loadLiveAssignments } from "./dailyBonuses";

export type DuplicateDate = { date: IsoDate; duplicates: DuplicatedPosition[] };

/**
 * The anomalies a role without amounts can see and fix: duplicated positions, on the dates the
 * next close will settle. The same dates as the notices list, found without reading a rate.
 */
export async function loadDuplicateDates(supabase: ServerSupabase): Promise<DuplicateDate[]> {
  const unsettled = orThrow(
    await supabase.from("assignments").select("date").is("settled_in_period_id", null).is("deleted_at", null),
  );
  const dates = new Set(unsettled.map((row) => row.date));
  if (dates.size === 0) return [];

  const sorted = [...dates].sort();
  const [assignments, positions] = await Promise.all([
    loadLiveAssignments(supabase, sorted[0], sorted[sorted.length - 1]),
    loadBonusPositions(supabase),
  ]);
  return [...Map.groupBy(assignments.filter((assignment) => dates.has(assignment.date)), (a) => a.date)]
    .map(([date, dateAssignments]) => ({ date, duplicates: findDuplicatedPositions(dateAssignments, positions) }))
    .filter((day) => day.duplicates.length > 0);
}
