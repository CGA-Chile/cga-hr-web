import { AnomalyList } from "@/sections/bonus/AnomalyList";
import { loadAnomalousDates } from "@/sections/bonus/anomalousDates";
import { loadPositions } from "@/sections/day/queries";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export default async function AnomaliesPage() {
  const supabase = await createSupabaseServerClient();
  const [days, positions] = await Promise.all([loadAnomalousDates(supabase), loadPositions(supabase)]);
  const names = new Map(positions.map((position) => [position.id, position.name]));

  return <AnomalyList days={days} positionName={(id) => names.get(id) ?? ""} />;
}
