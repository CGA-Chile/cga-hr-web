import { reportCopy } from "@/copy/report";
import { loadPeriods } from "@/sections/periods/queries";
import { CloseReportView } from "@/sections/report/CloseReportView";
import { loadReportFor } from "@/sections/report/loadReportFor";
import styles from "@/sections/report/ReportPage.module.css";
import { createSupabaseServerClient } from "@/utils/supabase/server";

type ReportPageProps = { searchParams: Promise<{ cierre?: string | string[] }> };

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const { cierre } = await searchParams;
  const supabase = await createSupabaseServerClient();
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
          <CloseReportView report={loaded.report} />
        </>
      )}
    </main>
  );
}
