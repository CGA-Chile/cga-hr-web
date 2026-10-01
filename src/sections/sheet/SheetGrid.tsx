import Link from "next/link";
import { sheetCopy } from "@/copy/sheet";
import type { IsoDate } from "@/domain/bonus/types";
import { addDays, formatLongDate } from "@/utils/chileDate";
import { formatPesos, formatThousands } from "@/utils/money";
import { fullName, type Position } from "../day/queries";
import { sheetPath, type SheetParams } from "./paths";
import { SheetCellLabel } from "./SheetCellLabel";
import { toneOf, type Sheet } from "./sheetModel";
import styles from "./SheetGrid.module.css";

type SheetGridProps = {
  sheet: Sheet;
  positionsById: ReadonlyMap<string, Position>;
  /** The page's own parameters, so every link keeps the range, the week and the mode. */
  params: SheetParams;
  /** The Monday of the week a phone shows; the other columns are hidden on narrow screens. */
  weekStart: IsoDate;
};

/**
 * One row per person, one column per date, like the sheet it replaces. Every cell and every
 * date is a link that opens the side panel; the grid itself never edits.
 */
export function SheetGrid({ sheet, positionsById, params, weekStart }: SheetGridProps) {
  const weekEnd = addDays(weekStart, 6);
  const outOfWeek = (date: IsoDate) => date < weekStart || date > weekEnd || undefined;
  const selected = (date: IsoDate) => params.date === date || undefined;

  return (
    <div className={styles.scroller}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th scope="col" className={styles.corner}>
              {sheetCopy.employeeColumn}
            </th>
            {sheet.days.map((day, index) => {
              const { weekday, dayOfMonth, month } = dateParts(day.date);
              return (
                <th
                  key={day.date}
                  scope="col"
                  className={styles.dayHeader}
                  data-out={outOfWeek(day.date)}
                  data-sunday={weekday === 0 || undefined}
                  data-selected={selected(day.date)}
                >
                  <Link
                    href={sheetPath({ ...params, date: day.date, employeeId: null, endPanel: false })}
                    scroll={false}
                    aria-label={sheetCopy.daySummaryFor(formatLongDate(day.date))}
                  >
                    <span className={styles.month}>{index === 0 || dayOfMonth === 1 ? sheetCopy.monthAbbreviations[month] : ""}</span>
                    <span className={styles.weekday}>{sheetCopy.weekdayInitials[weekday]}</span>
                    <span className={styles.dayNumber}>{dayOfMonth}</span>
                    {day.flagged && <FlagIcon />}
                  </Link>
                </th>
              );
            })}
            <th scope="col" className={styles.totalHeader}>
              {sheetCopy.periodTotal}
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row) => (
            <tr key={row.employee.id} data-selected={params.employeeId === row.employee.id || undefined}>
              <th scope="row" className={styles.name}>
                <span className={styles.fullName}>{fullName(row.employee)}</span>
                <span className={styles.shortName}>
                  {row.employee.first_name} {row.employee.last_name.charAt(0)}.
                </span>
              </th>
              {row.cells.map((cell) => {
                const position = cell.assignment ? positionsById.get(cell.assignment.position_id) : undefined;
                const isSelected = params.date === cell.date && params.employeeId === row.employee.id;
                return (
                  <td
                    key={cell.date}
                    className={styles.cell}
                    data-tone={position ? toneOf(position) : undefined}
                    data-duplicated={cell.duplicated || undefined}
                    data-sunday={dateParts(cell.date).weekday === 0 || undefined}
                    data-out={outOfWeek(cell.date)}
                    data-selected={isSelected || undefined}
                  >
                    <Link
                      href={sheetPath({ ...params, date: cell.date, employeeId: row.employee.id, endPanel: false })}
                      scroll={false}
                      title={position?.name}
                      aria-label={sheetCopy.cellFor(
                        fullName(row.employee),
                        formatLongDate(cell.date),
                        position?.name ?? sheetCopy.noPosition,
                      )}
                    >
                      <SheetCellLabel date={cell.date} employeeId={row.employee.id} stored={position?.abbreviation ?? ""} />
                    </Link>
                  </td>
                );
              })}
              <td className={styles.total}>{formatPesos(row.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={styles.name}>
              {sheetCopy.dayTotal}
            </th>
            {sheet.days.map((day) => (
              <td
                key={day.date}
                className={styles.dayTotal}
                data-flagged={day.flagged || undefined}
                data-out={outOfWeek(day.date)}
              >
                <Link
                  href={sheetPath({ ...params, date: day.date, employeeId: null, endPanel: false })}
                  scroll={false}
                  aria-label={sheetCopy.daySummaryFor(formatLongDate(day.date))}
                >
                  {day.total === null ? "" : formatThousands(day.total)}
                </Link>
              </td>
            ))}
            <td className={styles.total}>{formatPesos(sheet.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function dateParts(date: IsoDate): { weekday: number; dayOfMonth: number; month: number } {
  const utc = new Date(`${date}T00:00:00Z`);
  return { weekday: utc.getUTCDay(), dayOfMonth: utc.getUTCDate(), month: utc.getUTCMonth() };
}

function FlagIcon() {
  return (
    <svg
      className={styles.flag}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={sheetCopy.flagged}
    >
      <path d="M12 3 2 21h20L12 3z" />
      <path d="M12 10v5" />
      <path d="M12 18h.01" />
    </svg>
  );
}
