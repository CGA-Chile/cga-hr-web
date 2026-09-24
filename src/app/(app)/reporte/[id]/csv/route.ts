import { reportCopy } from "@/copy/report";
import { exportTable, toCsv } from "@/sections/report/exportTable";
import { loadReportFor } from "@/sections/report/loadReportFor";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadReportFor(await createSupabaseServerClient(), id);
  if (!loaded) return new Response(null, { status: 404 });

  return new Response(toCsv(exportTable(loaded.report)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${reportCopy.fileName(loaded.name)}.csv"`,
    },
  });
}
