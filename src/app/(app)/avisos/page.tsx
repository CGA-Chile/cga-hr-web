import { summaryCopy } from "@/copy/summary";
import { AnomalyList, type DescribedDate } from "@/sections/bonus/AnomalyList";
import { loadAnomalousDates } from "@/sections/bonus/anomalousDates";
import { describeAnomaly } from "@/sections/bonus/anomalyText";
import { loadDuplicateDates } from "@/sections/bonus/duplicateDates";
import { loadPositions } from "@/sections/day/queries";
import { loadCurrentProfile, seesAmounts } from "@/utils/supabase/currentProfile";
import type { ServerSupabase } from "@/utils/supabase/query";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export default async function AnomaliesPage() {
  const supabase = await createSupabaseServerClient();
  const [positions, profile] = await Promise.all([loadPositions(supabase), loadCurrentProfile(supabase)]);
  const names = new Map(positions.map((position) => [position.id, position.name]));
  const positionName = (id: string) => names.get(id) ?? "";

  const days = seesAmounts(profile)
    ? await describedAnomalies(supabase, positionName)
    : await describedDuplicates(supabase, positionName);
  return <AnomalyList days={days} />;
}

async function describedAnomalies(supabase: ServerSupabase, positionName: (id: string) => string): Promise<DescribedDate[]> {
  return (await loadAnomalousDates(supabase)).map((day) => ({
    date: day.date,
    reasons: day.result.anomalies.map((anomaly) => describeAnomaly(anomaly, positionName)),
  }));
}

/** For a role without amounts: the duplicates it can fix, and nothing that names a figure. */
async function describedDuplicates(supabase: ServerSupabase, positionName: (id: string) => string): Promise<DescribedDate[]> {
  return (await loadDuplicateDates(supabase)).map((day) => ({
    date: day.date,
    reasons: day.duplicates.map((duplicate) => ({
      text: summaryCopy.duplicate(positionName(duplicate.positionId), duplicate.occupantCount),
      quiet: false,
    })),
  }));
}
