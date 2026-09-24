import writeExcelFile from "write-excel-file/node";
import { reportCopy } from "@/copy/report";
import { exportTable } from "@/sections/report/exportTable";
import { loadReportFor } from "@/sections/report/loadReportFor";
import { createSupabaseServerClient } from "@/utils/supabase/server";

const PESOS = "$#,##0";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadReportFor(await createSupabaseServerClient(), id);
  if (!loaded) return new Response(null, { status: 404 });

  const [header, ...body] = exportTable(loaded.report);
  const sheet = [
    header.map((value) => ({ value, fontWeight: "bold" as const })),
    ...body.map((row) =>
      row.map((value, column) => (column >= 3 && typeof value === "number" ? { value, format: PESOS } : { value })),
    ),
  ];
  const buffer = await writeExcelFile(sheet).toBuffer();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${reportCopy.fileName(loaded.name)}.xlsx"`,
    },
  });
}
