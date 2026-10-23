import Link from "next/link";
import { Fragment } from "react";
import { sheetCopy } from "@/copy/sheet";
import type { IsoDate } from "@/domain/bonus/types";
import { addDays, formatLongDate } from "@/utils/chileDate";
import { formatAmount, formatPesos, formatThousands } from "@/utils/money";
import { fullName, type Employee, type Position } from "../day/queries";
import { sheetPath, type SheetParams } from "./paths";
import { describeMarks } from "./incompleteDay";
import { FixedDayRateIcon, LateIcon, LeftEarlyIcon } from "./MarkIcons";
import { SheetCellLabel } from "./SheetCellLabel";
import { BreakdownAllToggle, BreakdownRows, BreakdownToggle, SheetBreakdown } from "./SheetBreakdown";
import { cellKey, toneOf, type BonusBasis, type Sheet, type SheetRow } from "./sheetModel";
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
  /** The amount HR fixed for a date, over the rates' default: its header carries a mark. Empty for the supervisor. */
  fixedDayRates: ReadonlyMap<IsoDate, number>;
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
  const { sheet, positionsById, params, weekStart, today, holidays, fixedDayRates, showAmounts, reprimanded } = props;
  const weekEnd = addDays(weekStart, 6);
  const outOfWeek = (date: IsoDate) => date < weekStart || date > weekEnd || undefined;
  const selected = (date: IsoDate) => params.date === date || undefined;
  const restDay = (date: IsoDate) => dateParts(date).weekday === 0 || holidays.has(date) || undefined;
  const weekdayOf = (date: IsoDate) => dateParts(date).weekday;

  return (
    <SheetBreakdown employeeIds={sheet.rows.map((row) => row.employee.id)}>
      <div className={styles.scroller}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th scope="col" className={styles.corner}>
                {sheetCopy.employeeColumn}
              </th>
              {sheet.days.map((day, index) => {
                const { weekday, dayOfMonth, month } = dateParts(day.date);
                const fixedDayRate = fixedDayRates.get(day.date);
                const longDate = formatLongDate(day.date);
                return (
                  <th
                    key={day.date}
                    scope="col"
                    className={styles.dayHeader}
                    data-out={outOfWeek(day.date)}
                    data-rest={restDay(day.date)}
                    data-weekday={weekday}
                    data-selected={selected(day.date)}
                    data-today={day.date === today || undefined}
                    data-date={day.date}
                    aria-current={day.date === today ? "date" : undefined}
                  >
                    <Link
                      href={sheetPath({ ...params, date: day.date, employeeId: null, endPanel: false })}
                      scroll={false}
                      title={
                        fixedDayRate === undefined ? undefined : sheetCopy.fixedDayRate(formatPesos(fixedDayRate))
                      }
                      aria-label={
                        fixedDayRate === undefined
                          ? sheetCopy.daySummaryFor(longDate)
                          : sheetCopy.daySummaryWithFixedRate(longDate, formatPesos(fixedDayRate))
                      }
                    >
                      {fixedDayRate !== undefined && (
                        <span className={styles.fixedDayRate}>
                          <FixedDayRateIcon />
                        </span>
                      )}
                      <span className={styles.month}>
                        {index === 0 || dayOfMonth === 1 ? sheetCopy.monthAbbreviations[month] : ""}
                      </span>
                      <span className={styles.weekday}>{sheetCopy.weekdayHeaders[weekday]}</span>
                      <span className={styles.dayNumber}>{dayOfMonth}</span>
                      {day.flagged && <FlagIcon />}
                    </Link>
                  </th>
                );
              })}
              {showAmounts && (
                <th scope="col" className={styles.totalHeader}>
                  <BreakdownAllToggle />
                  {sheetCopy.periodTotal}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row) => (
              <Fragment key={row.employee.id}>
                <tr data-employee={row.employee.id}>
                  <th scope="row" className={styles.name}>
                    <EmployeeName
                      employee={row.employee}
                      href={
                        showAmounts
                          ? sheetPath({
                              ...params,
                              date: null,
                              employeeId: null,
                              endPanel: false,
                              person: row.employee.id,
                            })
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
                        data-weekday={weekdayOf(cell.date)}
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
                  {showAmounts && (
                    <td className={styles.total}>
                      <BreakdownToggle employeeId={row.employee.id} name={fullName(row.employee)}>
                        {formatPesos(row.total)}
                      </BreakdownToggle>
                    </td>
                  )}
                </tr>
                {showAmounts && (
                  <BreakdownRows employeeId={row.employee.id}>
                    {BREAKDOWN_KINDS.map((kind) => (
                      <BreakdownRow
                        key={kind.label}
                        row={row}
                        kind={kind}
                        params={params}
                        restDay={restDay}
                        weekdayOf={weekdayOf}
                        outOfWeek={outOfWeek}
                      />
                    ))}
                  </BreakdownRows>
                )}
              </Fragment>
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
                    data-weekday={weekdayOf(day.date)}
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
    </SheetBreakdown>
  );
}

type BreakdownKind = { label: string; counts: (basis: BonusBasis) => boolean; total: (row: SheetRow) => number };

/** The two daily bonuses, each on its own row under the person, in the same date columns. */
const BREAKDOWN_KINDS: readonly BreakdownKind[] = [
  { label: sheetCopy.breakdownCarding, counts: (basis) => basis.scheme !== "DAY_RATE", total: (row) => row.carding },
  { label: sheetCopy.breakdownDayRate, counts: (basis) => basis.scheme === "DAY_RATE", total: (row) => row.dayRate },
];

type BreakdownRowProps = {
  row: SheetRow;
  kind: BreakdownKind;
  params: SheetParams;
  restDay: (date: IsoDate) => true | undefined;
  weekdayOf: (date: IsoDate) => number;
  outOfWeek: (date: IsoDate) => true | undefined;
};

/**
 * One daily bonus for one person, date by date. Each amount opens the same cell panel as the
 * position above it, where the scheme of that date is explained. A day lost to arriving late or
 * leaving early shows its zero, faint, because that is the day someone will ask about.
 */
function BreakdownRow({ row, kind, params, restDay, weekdayOf, outOfWeek }: BreakdownRowProps) {
  const name = fullName(row.employee);
  return (
    <tr className={styles.breakdown}>
      <th scope="row" className={styles.name}>
        {kind.label}
      </th>
      {row.cells.map(({ date, bonus }) => {
        const shown = bonus && kind.counts(bonus.basis) ? bonus : null;
        return (
          <td
            key={date}
            className={styles.breakdownCell}
            data-rest={restDay(date)}
            data-weekday={weekdayOf(date)}
            data-out={outOfWeek(date)}
            data-equal={shown?.basis.scheme === "EQUAL_SHARE" || undefined}
            data-incomplete={shown?.incomplete || undefined}
          >
            {shown && (
              <a
                href={sheetPath({ ...params, date, employeeId: row.employee.id, endPanel: false })}
                data-cell-link
                aria-label={sheetCopy.breakdownAmount(
                  `${kind.label}, ${name}`,
                  formatLongDate(date),
                  formatPesos(shown.amount),
                )}
              >
                {formatAmount(shown.amount)}
              </a>
            )}
          </td>
        );
      })}
      <td className={styles.total}>{formatPesos(kind.total(row))}</td>
    </tr>
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
    <Link
      href={href}
      scroll={false}
      className={styles.nameLink}
      aria-label={sheetCopy.person.openFor(fullName(employee))}
    >
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
