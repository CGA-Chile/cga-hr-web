import { reportCopy } from "@/copy/report";
import { formatNumericDate } from "@/utils/chileDate";
import { formatPesos } from "@/utils/money";
import type { CloseReport } from "./closeReport";
import styles from "./CloseReportView.module.css";

/**
 * One row per person, carry-over in its own column so HR can explain why a month came out
 * different. Each row opens to the dates behind it.
 */
export function CloseReportView({ report }: { report: CloseReport }) {
  const { columns, detail } = reportCopy;
  if (report.rows.length === 0) return <p className={styles.muted}>{reportCopy.empty}</p>;

  return (
    <div className={styles.table} role="table">
      <div className={styles.headerRow} role="row">
        <span role="columnheader">{columns.person}</span>
        <span role="columnheader">{columns.nationalId}</span>
        <span role="columnheader" className={styles.number}>{columns.bonusDays}</span>
        <span role="columnheader" className={styles.number}>{columns.periodAmount}</span>
        <span role="columnheader" className={styles.number}>{columns.carryOver}</span>
        <span role="columnheader" className={styles.number}>{columns.total}</span>
      </div>

      {report.rows.map((row) => (
        <details key={row.employeeId} className={styles.person}>
          <summary className={styles.row} role="row">
            <span role="cell" className={styles.name}>{row.name}</span>
            <span role="cell">{row.nationalId ?? "—"}</span>
            <span role="cell" className={styles.number}>{row.bonusDays}</span>
            <span role="cell" className={styles.number}>{formatPesos(row.periodAmount)}</span>
            <span role="cell" className={styles.number}>{formatPesos(row.carryOverAmount)}</span>
            <span role="cell" className={`${styles.number} ${styles.strong}`}>{formatPesos(row.total)}</span>
          </summary>
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
        </details>
      ))}

      <div className={`${styles.row} ${styles.totals}`} role="row">
        <span role="cell">{reportCopy.totals}</span>
        <span role="cell" />
        <span role="cell" />
        <span role="cell" className={styles.number}>{formatPesos(report.periodAmount)}</span>
        <span role="cell" className={styles.number}>{formatPesos(report.carryOverAmount)}</span>
        <span role="cell" className={styles.number}>{formatPesos(report.total)}</span>
      </div>
    </div>
  );
}
