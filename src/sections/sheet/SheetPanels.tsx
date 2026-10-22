import Link from "next/link";
import type { ReactNode } from "react";
import { Drawer } from "@/components/Drawer";
import { dayCopy } from "@/copy/day";
import { sheetCopy } from "@/copy/sheet";
import type { CalendarDate, IsoDate } from "@/domain/bonus/types";
import { formatLongDate } from "@/utils/chileDate";
import { dayPath } from "../day/paths";
import { CalendarDateForm } from "./CalendarDateForm";
import { CopyPreviousDay } from "./CopyPreviousDay";
import { sheetPath, type SheetParams } from "./paths";
import { PeriodEndForm } from "./PeriodEndForm";
import type { ColumnCopy } from "./sheetModel";
import styles from "./SheetPanels.module.css";

type DayPanelProps = {
  date: IsoDate;
  params: SheetParams;
  /** The daily summary, with amounts or, for a role without them, the duplicates only. */
  summary: ReactNode;
  /** What the column copy would fill; null with nothing earlier to copy. */
  columnCopy: ColumnCopy | null;
  calendar: CalendarDate | undefined;
  /** The day rate the date would fall back to with no amount set for it, if one is in force. */
  dayRateFallback: number | null;
  /** HR and the admin mark holidays; the form shows only to them. */
  canManageCalendar: boolean;
};

/**
 * The date's summary, the same one the day view shows, plus the column copy and the holiday mark.
 */
export function DayPanel(props: DayPanelProps) {
  const { date, params, summary, columnCopy, calendar, dayRateFallback, canManageCalendar } = props;
  return (
    <Drawer title={formatLongDate(date)} closeHref={sheetPath({ ...params, date: null })} closeLabel={dayCopy.close}>
      {calendar?.holiday && <p className={styles.tag}>{sheetCopy.holidayTag}</p>}
      {summary}
      {columnCopy && <CopyPreviousDay key={date} date={date} copy={columnCopy} />}
      {canManageCalendar && (
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
      <Link href={dayPath(date)} className={styles.link}>
        {sheetCopy.openDayView}
      </Link>
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
