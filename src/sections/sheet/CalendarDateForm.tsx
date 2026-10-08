"use client";

import { useActionState } from "react";
import { setCalendarDate, type CalendarDateState } from "@/app/(app)/planilla/actions";
import { sheetCopy } from "@/copy/sheet";
import { formatPesos } from "@/utils/money";
import styles from "./SheetPanels.module.css";

type CalendarDateFormProps = {
  date: string;
  holiday: boolean;
  /** The amount HR set for this date, or null for the default. */
  dayRate: number | null;
  /** The default this date falls back to, when one is in force; shown so an empty field is clear. */
  fallback: number | null;
  doneHref: string;
};

/** HR marks a holiday and, when the plant pays a different amount that day, sets it here. */
export function CalendarDateForm({ date, holiday, dayRate, fallback, doneHref }: CalendarDateFormProps) {
  const [state, action, pending] = useActionState<CalendarDateState, FormData>(
    setCalendarDate.bind(null, date, doneHref),
    null,
  );

  return (
    <form action={action} className={styles.form}>
      <label className={styles.check}>
        <input type="checkbox" name="holiday" defaultChecked={holiday} />
        {sheetCopy.holidayLabel}
      </label>
      <label className={styles.field}>
        <span className={styles.label}>{sheetCopy.dayRateLabel}</span>
        <input
          type="number"
          name="dayRate"
          inputMode="numeric"
          min={1}
          defaultValue={dayRate ?? ""}
          className={styles.input}
        />
        <span className={styles.muted}>
          {sheetCopy.dayRateHint(fallback === null ? "" : sheetCopy.dayRateFallback(formatPesos(fallback)))}
        </span>
      </label>
      {state && (
        <p role="alert" className={styles.alert}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.primary}>
        {pending ? sheetCopy.savingCalendar : sheetCopy.saveCalendar}
      </button>
      <p className={styles.muted}>{sheetCopy.calendarWho}</p>
    </form>
  );
}
