import Link from "next/link";
import { Drawer } from "@/components/Drawer";
import { dayCopy } from "@/copy/day";
import { sheetCopy } from "@/copy/sheet";
import type { CalendarDate, IsoDate } from "@/domain/bonus/types";
import { addDays, formatLongDate } from "@/utils/chileDate";
import { formatPesos } from "@/utils/money";
import { DailySummary } from "../bonus/DailySummary";
import type { DailyBonus } from "../bonus/dailyBonuses";
import { CellHistoryList } from "../day/CellHistoryList";
import { CellNote } from "../day/CellNote";
import { dayPath } from "../day/paths";
import type { PositionGroup } from "../day/positionGroups";
import { fullName, type Assignment, type CellMovement, type Employee, type Position } from "../day/queries";
import { CalendarDateForm } from "./CalendarDateForm";
import { CopyPreviousDay } from "./CopyPreviousDay";
import { sheetPath, type SheetParams } from "./paths";
import { PeriodEndForm } from "./PeriodEndForm";
import { PositionPicker } from "./PositionPicker";
import type { ColumnCopy } from "./sheetModel";
import styles from "./SheetPanels.module.css";

type DayPanelProps = {
  date: IsoDate;
  params: SheetParams;
  dailyBonus: DailyBonus | null;
  positions: readonly Position[];
  employeeName: (employeeId: string) => string;
  /** What the column copy would fill; null outside edit mode or with nothing earlier to copy. */
  columnCopy: ColumnCopy | null;
  calendar: CalendarDate | undefined;
  /** The day rate the date would fall back to with no amount set for it, if one is in force. */
  dayRateFallback: number | null;
  /** HR and the admin mark holidays; the form shows only to them, and only in edit mode. */
  canManageCalendar: boolean;
};

/**
 * The date's summary, the same one the day view shows, plus the column copy and the holiday mark
 * in edit mode.
 */
export function DayPanel(props: DayPanelProps) {
  const { date, params, dailyBonus, positions, employeeName, columnCopy, calendar, dayRateFallback, canManageCalendar } =
    props;
  return (
    <Drawer title={formatLongDate(date)} closeHref={sheetPath({ ...params, date: null })} closeLabel={dayCopy.close}>
      {calendar?.holiday && <p className={styles.tag}>{sheetCopy.holidayTag}</p>}
      <DailySummary dailyBonus={dailyBonus} positions={positions} employeeName={employeeName} />
      {columnCopy && <CopyPreviousDay key={date} date={date} copy={columnCopy} />}
      {params.editing && canManageCalendar && (
        <section className={styles.section}>
          <h3 className={styles.heading}>{sheetCopy.calendarTitle}</h3>
          <CalendarDateForm
            key={date}
            date={date}
            holiday={calendar?.holiday ?? false}
            dayRate={calendar?.dayRate ?? null}
            fallback={dayRateFallback}
            doneHref={sheetPath(params)}
          />
        </section>
      )}
      <Link href={dayPath(date, { editing: params.editing })} className={styles.link}>
        {sheetCopy.openDayView}
      </Link>
    </Drawer>
  );
}

type CellPanelProps = {
  date: IsoDate;
  params: SheetParams;
  range: { start: IsoDate; end: IsoDate };
  employee: Employee;
  assignment: Assignment | null;
  amount: number | null;
  history: readonly CellMovement[];
  positionsById: ReadonlyMap<string, Position>;
  positionGroups: readonly PositionGroup[];
};

/**
 * One person on one date: what they did and earned, the picker in edit mode, the note and the
 * history. The arrows walk along the row without closing the panel.
 */
export function CellPanel(props: CellPanelProps) {
  const { date, params, range, employee, assignment, amount, history, positionsById, positionGroups } = props;
  const editing = Boolean(params.editing);
  const step = (days: number) => {
    const target = addDays(date, days);
    return target < range.start || target > range.end ? null : sheetPath({ ...params, date: target });
  };
  const previous = step(-1);
  const next = step(1);

  return (
    <Drawer
      title={`${fullName(employee)} · ${formatLongDate(date)}`}
      closeHref={sheetPath({ ...params, date: null })}
      closeLabel={dayCopy.close}
    >
      <dl className={styles.facts}>
        <div>
          <dt>{sheetCopy.position}</dt>
          <dd>{assignment ? (positionsById.get(assignment.position_id)?.name ?? "") : sheetCopy.noPosition}</dd>
        </div>
        <div>
          <dt>{sheetCopy.dayBonus}</dt>
          <dd>{amount ? formatPesos(amount) : sheetCopy.noBonus}</dd>
        </div>
      </dl>

      {editing ? (
        <PositionPicker
          key={date}
          date={date}
          employeeId={employee.id}
          positionId={assignment?.position_id ?? null}
          note={assignment?.note ?? null}
          groups={positionGroups}
        />
      ) : (
        <p className={styles.muted}>{sheetCopy.readOnlyCell}</p>
      )}

      <nav className={styles.steps}>
        {previous ? (
          <Link href={previous} scroll={false} className={styles.step}>
            {sheetCopy.previousDay}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={next} scroll={false} className={styles.step}>
            {sheetCopy.nextDay}
          </Link>
        )}
      </nav>

      <section className={styles.section}>
        <h3 className={styles.heading}>{dayCopy.note}</h3>
        <CellNote key={date} date={date} employeeId={employee.id} assignment={assignment} editing={editing} />
      </section>
      <section className={styles.section}>
        <h3 className={styles.heading}>{dayCopy.history}</h3>
        <CellHistoryList history={history} positionsById={positionsById} />
      </section>
    </Drawer>
  );
}

type PeriodEndPanelProps = { periodId: string; start: IsoDate; end: IsoDate; params: SheetParams };

export function PeriodEndPanel({ periodId, start, end, params }: PeriodEndPanelProps) {
  const back = sheetPath({ ...params, endPanel: false });
  return (
    <Drawer title={sheetCopy.endTitle} closeHref={back} closeLabel={dayCopy.close}>
      <PeriodEndForm periodId={periodId} start={start} end={end} doneHref={back} />
    </Drawer>
  );
}
