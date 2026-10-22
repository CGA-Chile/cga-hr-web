import { SeverityNumber } from "@opentelemetry/api-logs";
import { after } from "next/server";
import { reportCopy } from "@/copy/report";
import { exportTable, toCsv } from "@/sections/report/exportTable";
import { loadReportFor } from "@/sections/report/loadReportFor";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { posthogExportLogger, posthogLogProvider } from "@/utils/posthog/exportLogger";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadReportFor(await createSupabaseServerClient(), id);
  if (!loaded) return new Response(null, { status: 404 });

  const rows = exportTable(loaded.report);
  posthogExportLogger?.emit({
    body: "CSV report export generated",
    severityNumber: SeverityNumber.INFO,
    attributes: { "report.format": "csv", "report.row_count": rows.length - 1 },
  });
  after(async () => {
    await posthogLogProvider?.forceFlush();
  });

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${reportCopy.fileName(loaded.name)}.csv"`,
    },
  });
}
