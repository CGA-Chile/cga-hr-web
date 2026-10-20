import { reportCopy } from "@/copy/report";
import { REPORT_BONUSES, type CloseReport } from "./closeReport";

export type ExportCell = string | number;

/** Columns before the amounts: the person and their RUT. */
export const LEADING_TEXT_COLUMNS = 2;

/**
 * The summary as accounting receives it: who, and how much of each bonus, then the total. The
 * carry-over is already inside each bonus; the breakdown stays in the web view.
 */
export function exportTable(report: CloseReport): ExportCell[][] {
  const { columns } = reportCopy;
  return [
    [columns.person, columns.nationalId, ...REPORT_BONUSES.map((bonus) => columns[bonus]), columns.total],
    ...report.rows.map((row) => [
      row.name,
      row.nationalId ?? "",
      ...REPORT_BONUSES.map((bonus) => row.amounts[bonus]),
      row.total,
    ]),
    [reportCopy.totals, "", ...REPORT_BONUSES.map((bonus) => report.amounts[bonus]), report.total],
  ];
}

/**
 * Semicolon-separated with a UTF-8 byte order mark: what Excel set to Spanish opens directly,
 * accents included, with each value in its own column.
 */
export function toCsv(table: readonly ExportCell[][]): string {
  const escape = (cell: ExportCell) => {
    const text = String(cell);
    return /[";\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `\uFEFF${table.map((row) => row.map(escape).join(";")).join("\r\n")}\r\n`;
}
