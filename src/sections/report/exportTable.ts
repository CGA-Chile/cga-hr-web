import { reportCopy } from "@/copy/report";
import type { CloseReport } from "./closeReport";

export type ExportCell = string | number;

/** The report as the export sees it: the on-screen columns, one row per person, then totals. */
export function exportTable(report: CloseReport): ExportCell[][] {
  const { columns } = reportCopy;
  return [
    [columns.person, columns.nationalId, columns.bonusDays, columns.periodAmount, columns.carryOver, columns.total],
    ...report.rows.map((row) => [
      row.name,
      row.nationalId ?? "",
      row.bonusDays,
      row.periodAmount,
      row.carryOverAmount,
      row.total,
    ]),
    [reportCopy.totals, "", "", report.periodAmount, report.carryOverAmount, report.total],
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
