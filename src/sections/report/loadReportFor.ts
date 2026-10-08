import { loadPeriod } from "@/sections/periods/queries";
import { loadCurrentProfile, seesAmounts } from "@/utils/supabase/currentProfile";
import type { ServerSupabase } from "@/utils/supabase/query";
import { loadCloseReport, type CloseReport } from "./closeReport";

/**
 * A closed period's report, or null when the period does not exist, is still open, or the user
 * is a role that never sees amounts. The downloads go through here too, so they share the check.
 */
export async function loadReportFor(
  supabase: ServerSupabase,
  periodId: string,
): Promise<{ name: string; report: CloseReport } | null> {
  if (!seesAmounts(await loadCurrentProfile(supabase))) return null;
  const period = await loadPeriod(supabase, periodId);
  if (!period || period.status !== "CLOSED") return null;
  return { name: period.name, report: await loadCloseReport(supabase, period) };
}
