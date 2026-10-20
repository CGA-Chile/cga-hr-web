import Link from "next/link";
import { sheetCopy } from "@/copy/sheet";
import type { IsoDate } from "@/domain/bonus/types";
import { addDays, formatLongDate } from "@/utils/chileDate";
import { formatPesos, formatThousands } from "@/utils/money";
import { fullName, type Employee, type Position } from "../day/queries";
import { sheetPath, type SheetParams } from "./paths";
import { describeMarks } from "./incompleteDay";
import { LateIcon, LeftEarlyIcon } from "./MarkIcons";
import { SheetCellLabel } from "./SheetCellLabel";
import { cellKey, toneOf, type Sheet } from "./sheetModel";
import styles from "./SheetGrid.module.css";

type SheetGridProps = {
  sheet: Sheet;
  positionsById: ReadonlyMap<string, Position>;
  /** The page's own parameters, so every link keeps the range, the week and the mode. */
  params: SheetParams;
  /** The Monday of the week a phone shows; the other columns are hidden on narrow screens. */
  weekStart: IsoDate;
  /** Today in Chile: its date header is marked so the eye finds where the sheet stands. */
  today: IsoDate;
  /** Holidays HR marked: shaded like Sundays, the other dates paid under the day rate. */
  holidays: ReadonlySet<IsoDate>;
  /** False for a role that never sees amounts: no totals row, no period column, no person panel. */
  showAmounts: boolean;
  /** Employees with a reprimand in the period: their name carries a mark. Empty for the supervisor. */
  reprimanded: ReadonlySet<string>;
};

/**
 * One row per person, one column per date, like the sheet it replaces. Every cell and every
 * date is a link that opens the side panel; the grid itself never edits. A cell's link is a plain
 * anchor: the cell panel host opens it in the browser, so the open cell is marked there too.
 */
export function SheetGrid(props: SheetGridProps) {
  const { sheet, positionsById, params, weekStart, today, holidays, showAmounts, reprimanded } = props;
  const weekEnd = addDays(weekStart, 6);
  const outOfWeek = (date: IsoDate) => date < weekStart || date > weekEnd || undefined;
  const selected = (date: IsoDate) => params.date === date || undefined;
  const restDay = (date: IsoDate) => dateParts(date).weekday === 0 || holidays.has(date) || undefined;

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
                  data-rest={restDay(day.date)}
                  data-selected={selected(day.date)}
                  data-today={day.date === today || undefined}
                  data-date={day.date}
                  aria-current={day.date === today ? "date" : undefined}
                >
                  <Link
                    href={sheetPath({ ...params, date: day.date, employeeId: null, endPanel: false })}
                    scroll={false}
                    aria-label={sheetCopy.daySummaryFor(formatLongDate(day.date))}
                  >
                    <span className={styles.month}>
                      {index === 0 || dayOfMonth === 1 ? sheetCopy.monthAbbreviations[month] : ""}
                    </span>
                    <span className={styles.weekday}>{sheetCopy.weekdayInitials[weekday]}</span>
                    <span className={styles.dayNumber}>{dayOfMonth}</span>
                    {day.flagged && <FlagIcon />}
                  </Link>
                </th>
              );
            })}
            {showAmounts && (
              <th scope="col" className={styles.totalHeader}>
                {sheetCopy.periodTotal}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row) => (
            <tr key={row.employee.id} data-employee={row.employee.id}>
              <th scope="row" className={styles.name}>
                <EmployeeName
                  employee={row.employee}
                  href={
                    showAmounts
                      ? sheetPath({ ...params, date: null, employeeId: null, endPanel: false, person: row.employee.id })
                      : null
                  }
                  reprimanded={reprimanded.has(row.employee.id)}
                />
              </th>
              {row.cells.map((cell) => {
                const position = cell.assignment ? positionsById.get(cell.assignment.position_id) : undefined;
                const marks = cell.assignment ? describeMarks(cell.assignment) : null;
                return (
                  <td
                    key={cell.date}
                    className={styles.cell}
                    data-tone={position ? toneOf(position) : undefined}
                    data-duplicated={cell.duplicated || undefined}
                    data-rest={restDay(cell.date)}
                    data-out={outOfWeek(cell.date)}
                    data-cell={cellKey(cell.date, row.employee.id)}
                  >
                    <a
                      href={sheetPath({ ...params, date: cell.date, employeeId: row.employee.id, endPanel: false })}
                      data-cell-link
                      title={marks ? `${position?.name ?? ""} · ${marks}` : position?.name}
                      aria-label={sheetCopy.cellFor(
                        fullName(row.employee),
                        formatLongDate(cell.date),
                        marks ? `${position?.name ?? ""}, ${marks}` : (position?.name ?? sheetCopy.noPosition),
                      )}
                    >
                      <SheetCellLabel
                        date={cell.date}
                        employeeId={row.employee.id}
                        stored={position?.abbreviation ?? ""}
                      />
                      {marks && (
                        <span className={styles.marks}>
                          {cell.assignment?.late && <LateIcon />}
                          {cell.assignment?.left_early && <LeftEarlyIcon />}
                        </span>
                      )}
                    </a>
                  </td>
                );
              })}
              {showAmounts && <td className={styles.total}>{formatPesos(row.total)}</td>}
            </tr>
          ))}
        </tbody>
        {showAmounts && (
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
        )}
      </table>
    </div>
  );
}

type EmployeeNameProps = {
  employee: Pick<Employee, "first_name" | "last_name">;
  /** The person panel, for a role that sees amounts; null leaves the name as plain text. */
  href: string | null;
  reprimanded: boolean;
};

function EmployeeName({ employee, href, reprimanded }: EmployeeNameProps) {
  const name = (
    <>
      <span className={styles.fullName}>{fullName(employee)}</span>
      <span className={styles.shortName}>
        {employee.first_name} {employee.last_name.charAt(0)}.
      </span>
      {reprimanded && (
        <span className={styles.reprimand} title={sheetCopy.person.reprimanded}>
          {sheetCopy.person.reprimandMark}
        </span>
      )}
    </>
  );
  if (!href) return name;
  return (
    <Link href={href} scroll={false} className={styles.nameLink} aria-label={sheetCopy.person.openFor(fullName(employee))}>
      {name}
    </Link>
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
