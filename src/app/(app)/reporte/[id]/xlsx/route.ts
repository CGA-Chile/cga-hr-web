import { SeverityNumber } from "@opentelemetry/api-logs";
import { after } from "next/server";
import writeExcelFile from "write-excel-file/node";
import { reportCopy } from "@/copy/report";
import { exportTable, LEADING_TEXT_COLUMNS } from "@/sections/report/exportTable";
import { loadReportFor } from "@/sections/report/loadReportFor";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { posthogExportLogger, posthogLogProvider } from "@/utils/posthog/exportLogger";

const PESOS = "$#,##0";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadReportFor(await createSupabaseServerClient(), id);
  if (!loaded) return new Response(null, { status: 404 });

  const [header, ...body] = exportTable(loaded.report);
  const sheet = [
    header.map((value) => ({ value, fontWeight: "bold" as const })),
    ...body.map((row) =>
      row.map((value, column) => (column >= LEADING_TEXT_COLUMNS && typeof value === "number" ? { value, format: PESOS } : { value })),
    ),
  ];
  const buffer = await writeExcelFile(sheet).toBuffer();

  posthogExportLogger?.emit({
    body: "XLSX report export generated",
    severityNumber: SeverityNumber.INFO,
    attributes: { "report.format": "xlsx", "report.row_count": body.length },
  });
  after(async () => {
    await posthogLogProvider?.forceFlush();
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${reportCopy.fileName(loaded.name)}.xlsx"`,
    },
  });
}
