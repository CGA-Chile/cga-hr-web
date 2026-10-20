import Link from "next/link";
import { reportCopy } from "@/copy/report";
import { loadPeriods } from "@/sections/periods/queries";
import { CloseReportView, type ReportView } from "@/sections/report/CloseReportView";
import { loadReportFor } from "@/sections/report/loadReportFor";
import styles from "@/sections/report/ReportPage.module.css";
import { requireAmounts } from "@/utils/supabase/currentProfile";
import { createSupabaseServerClient } from "@/utils/supabase/server";

type ReportPageProps = { searchParams: Promise<{ cierre?: string | string[]; vista?: string | string[] }> };

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const { cierre, vista } = await searchParams;
  const view: ReportView = vista === "detalle" ? "detail" : "summary";
  const supabase = await createSupabaseServerClient();
  await requireAmounts(supabase);
  const closed = (await loadPeriods(supabase)).filter((period) => period.status === "CLOSED");
  const selectedId = (typeof cierre === "string" && closed.some((p) => p.id === cierre) ? cierre : closed[0]?.id) ?? null;
  const loaded = selectedId ? await loadReportFor(supabase, selectedId) : null;

  return (
    <main className="page">
      <h1 className={styles.title}>{reportCopy.title}</h1>
      <p className={styles.intro}>{reportCopy.intro}</p>

      {!selectedId || !loaded ? (
        <p className={styles.muted}>{reportCopy.noClosedPeriods}</p>
      ) : (
        <>
          <div className={styles.toolbar}>
            <form method="get" className={styles.picker}>
              <label>
                <span>{reportCopy.choosePeriod}</span>{" "}
                <select name="cierre" defaultValue={selectedId} className={styles.select}>
                  {closed.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={styles.secondary}>
                {reportCopy.show}
              </button>
            </form>
            <div className={styles.downloads}>
              <a href={`/reporte/${selectedId}/xlsx`} className={styles.secondary}>
                {reportCopy.downloadXlsx}
              </a>
              <a href={`/reporte/${selectedId}/csv`} className={styles.secondary}>
                {reportCopy.downloadCsv}
              </a>
            </div>
          </div>
          <nav className={styles.views} aria-label={reportCopy.title}>
            {(["summary", "detail"] as const).map((option) => (
              <Link
                key={option}
                href={`/reporte?cierre=${selectedId}${option === "detail" ? "&vista=detalle" : ""}`}
                aria-current={option === view ? "page" : undefined}
                className={option === view ? styles.currentView : styles.view}
              >
                {reportCopy.views[option]}
              </Link>
            ))}
          </nav>
          <CloseReportView report={loaded.report} view={view} />
        </>
      )}
    </main>
  );
}
