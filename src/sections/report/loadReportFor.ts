import { loadPeriod } from "@/sections/periods/queries";
import type { ServerSupabase } from "@/utils/supabase/query";
import { loadCloseReport, type CloseReport } from "./closeReport";

/** A closed period's report, or null when the period does not exist or is still open. */
export async function loadReportFor(
  supabase: ServerSupabase,
  periodId: string,
): Promise<{ name: string; report: CloseReport } | null> {
  const period = await loadPeriod(supabase, periodId);
  if (!period || period.status !== "CLOSED") return null;
  return { name: period.name, report: await loadCloseReport(supabase, period) };
}
