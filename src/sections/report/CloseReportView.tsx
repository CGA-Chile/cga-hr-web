import { reportCopy } from "@/copy/report";
import { formatNumericDate } from "@/utils/chileDate";
import { formatPesos } from "@/utils/money";
import { REPORT_BONUSES, type CloseReport, type ReportRow } from "./closeReport";
import styles from "./CloseReportView.module.css";

export type ReportView = "summary" | "detail";

/**
 * One row per person and one column per bonus. The summary is exactly what the download holds,
 * for accounting; the detail opens each person to the days and counts behind every amount, so HR
 * can explain any of them.
 */
export function CloseReportView({ report, view }: { report: CloseReport; view: ReportView }) {
  const { columns } = reportCopy;
  if (report.rows.length === 0) return <p className={styles.muted}>{reportCopy.empty}</p>;

  return (
    <div className={styles.table} role="table">
      <div className={styles.headerRow} role="row">
        <span role="columnheader">{columns.person}</span>
        <span role="columnheader">{columns.nationalId}</span>
        {REPORT_BONUSES.map((bonus) => (
          <span key={bonus} role="columnheader" className={styles.number}>
            {columns[bonus]}
          </span>
        ))}
        <span role="columnheader" className={styles.number}>{columns.total}</span>
      </div>

      {report.rows.map((row) =>
        view === "detail" ? (
          <details key={row.employeeId} className={styles.person}>
            <summary className={styles.row} role="row">
              <AmountCells row={row} expandable />
            </summary>
            <PersonDetail row={row} />
          </details>
        ) : (
          <div key={row.employeeId} className={styles.row} role="row">
            <AmountCells row={row} />
          </div>
        ),
      )}

      <div className={`${styles.row} ${styles.totals}`} role="row">
        <span role="cell">{reportCopy.totals}</span>
        <span role="cell" />
        {REPORT_BONUSES.map((bonus) => (
          <span key={bonus} role="cell" className={styles.number}>
            {formatPesos(report.amounts[bonus])}
          </span>
        ))}
        <span role="cell" className={styles.number}>{formatPesos(report.total)}</span>
      </div>
    </div>
  );
}

function AmountCells({ row, expandable = false }: { row: ReportRow; expandable?: boolean }) {
  return (
    <>
      <span role="cell" className={expandable ? styles.name : undefined}>{row.name}</span>
      <span role="cell">{row.nationalId ?? "—"}</span>
      {REPORT_BONUSES.map((bonus) => (
        <span key={bonus} role="cell" className={styles.number}>
          {formatPesos(row.amounts[bonus])}
        </span>
      ))}
      <span role="cell" className={`${styles.number} ${styles.strong}`}>{formatPesos(row.total)}</span>
    </>
  );
}

function PersonDetail({ row }: { row: ReportRow }) {
  const { detail, columns } = reportCopy;
  const carried = REPORT_BONUSES.filter((bonus) => row.carryOver[bonus] > 0);

  return (
    <div className={styles.detailBlock}>
      {carried.length > 0 && (
        <ul className={styles.carryOver}>
          {carried.map((bonus) => (
            <li key={bonus}>
              {columns[bonus]}: {reportCopy.includesCarryOver(formatPesos(row.carryOver[bonus]))}
            </li>
          ))}
        </ul>
      )}

      {row.periodBonusLines.length > 0 && (
        <>
          <h3 className={styles.detailTitle}>{detail.periodBonusTitle}</h3>
          <table className={styles.detail}>
            <thead>
              <tr>
                <th scope="col">{detail.bonus}</th>
                <th scope="col">{detail.origin}</th>
                <th scope="col" className={styles.number}>{detail.days}</th>
                <th scope="col" className={styles.number}>{detail.workingDays}</th>
                <th scope="col" className={styles.number}>{detail.strikes}</th>
                <th scope="col" className={styles.number}>{detail.amount}</th>
              </tr>
            </thead>
            <tbody>
              {row.periodBonusLines.map((line) => (
                <tr key={`${line.bonus}|${line.originName}`}>
                  <td>
                    {reportCopy.bonuses[line.bonus]}
                    {line.carryOver && <span className={styles.tag}>{detail.carryOverTag}</span>}
                    {line.reprimanded && <span className={styles.tag}>{detail.reprimandedTag}</span>}
                  </td>
                  <td>{line.originName}</td>
                  <td className={styles.number}>{line.days}</td>
                  <td className={styles.number}>{line.workingDays ?? "—"}</td>
                  <td className={styles.number}>{line.bonus === "COMPLIANCE" ? line.strikes : "—"}</td>
                  <td className={styles.number}>{formatPesos(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {row.lines.length > 0 && (
        <>
          <h3 className={styles.detailTitle}>{detail.dailyTitle}</h3>
          <table className={styles.detail}>
            <thead>
              <tr>
                <th scope="col">{detail.date}</th>
                <th scope="col">{detail.position}</th>
                <th scope="col">{detail.scheme}</th>
                <th scope="col" className={styles.number}>{detail.amount}</th>
              </tr>
            </thead>
            <tbody>
              {row.lines.map((line) => (
                <tr key={line.date}>
                  <td>
                    {formatNumericDate(line.date)}
                    {line.carryOver && <span className={styles.tag}>{detail.carryOverTag}</span>}
                  </td>
                  <td>{line.positionName}</td>
                  <td>{reportCopy.schemes[line.scheme]}</td>
                  <td className={styles.number}>{formatPesos(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
