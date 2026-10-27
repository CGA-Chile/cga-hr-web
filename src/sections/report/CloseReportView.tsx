import Link from "next/link";
import { reportCopy } from "@/copy/report";
import { formatNumericDate } from "@/utils/chileDate";
import { formatPesos } from "@/utils/money";
import { REPORT_BONUSES, type BonusAmounts, type CloseReport, type ReportRow } from "./closeReport";
import styles from "./CloseReportView.module.css";

export type ReportView = "summary" | "detail";

type CloseReportViewProps = {
  report: CloseReport;
  view: ReportView;
  /** Where each person's name leads, when it leads anywhere. */
  personHref?: (employeeId: string) => string;
  /** Shows, under each amount, the part of it that is carry-over. */
  showCarryOver?: boolean;
};

/**
 * One row per person and one column per bonus. The summary is exactly what the download holds,
 * for accounting; the detail opens each person to the days and counts behind every amount, so HR
 * can explain any of them.
 */
export function CloseReportView({ report, view, personHref, showCarryOver = false }: CloseReportViewProps) {
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
              <AmountCells row={row} showCarryOver={showCarryOver} expandable />
            </summary>
            <PersonDetail row={row} />
          </details>
        ) : (
          <div key={row.employeeId} className={styles.row} role="row">
            <AmountCells row={row} personHref={personHref} showCarryOver={showCarryOver} />
          </div>
        ),
      )}

      <div className={`${styles.row} ${styles.totals}`} role="row">
        <span role="cell">{reportCopy.totals}</span>
        <span role="cell" />
        {REPORT_BONUSES.map((bonus) => (
          <span key={bonus} role="cell" className={styles.number}>
            {formatPesos(report.amounts[bonus])}
            {showCarryOver && <CarryOver amount={carryOverOf(report.rows, bonus)} />}
          </span>
        ))}
        <span role="cell" className={styles.number}>{formatPesos(report.total)}</span>
      </div>
    </div>
  );
}

type AmountCellsProps = Pick<CloseReportViewProps, "personHref" | "showCarryOver"> & {
  row: ReportRow;
  expandable?: boolean;
};

function AmountCells({ row, personHref, showCarryOver, expandable = false }: AmountCellsProps) {
  return (
    <>
      <span role="cell" className={expandable ? styles.name : undefined}>
        {personHref ? <Link href={personHref(row.employeeId)}>{row.name}</Link> : row.name}
      </span>
      <span role="cell">{row.nationalId ?? "—"}</span>
      {REPORT_BONUSES.map((bonus) => (
        <span key={bonus} role="cell" className={styles.number}>
          {formatPesos(row.amounts[bonus])}
          {showCarryOver && <CarryOver amount={row.carryOver[bonus]} />}
        </span>
      ))}
      <span role="cell" className={`${styles.number} ${styles.strong}`}>{formatPesos(row.total)}</span>
    </>
  );
}

function CarryOver({ amount }: { amount: number }) {
  if (amount === 0) return null;
  return <span className={styles.carryOverHint}>{reportCopy.includesCarryOver(formatPesos(amount))}</span>;
}

function carryOverOf(rows: readonly ReportRow[], bonus: keyof BonusAmounts): number {
  return rows.reduce((sum, row) => sum + row.carryOver[bonus], 0);
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
