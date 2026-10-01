"use client";

import { useActionState, useState } from "react";
import { setPeriodEnd, type PeriodEndState } from "@/app/(app)/planilla/actions";
import { sheetCopy } from "@/copy/sheet";
import { addDays, daysInRange, formatDayMonth } from "@/utils/chileDate";
import styles from "./SheetPanels.module.css";

type PeriodEndFormProps = { periodId: string; start: string; end: string; doneHref: string };

/** Moves the open period's end. The start is shown, never sent: it is the previous end plus one. */
export function PeriodEndForm({ periodId, start, end, doneHref }: PeriodEndFormProps) {
  const [draft, setDraft] = useState(end);
  const [state, action, pending] = useActionState<PeriodEndState, FormData>(
    setPeriodEnd.bind(null, periodId, doneHref),
    null,
  );

  return (
    <form action={action} className={styles.form}>
      <label className={styles.field}>
        <span className={styles.label}>{sheetCopy.startLabel}</span>
        <input type="date" value={start} readOnly className={styles.input} />
        <span className={styles.muted}>{sheetCopy.startFixed}</span>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>{sheetCopy.endLabel}</span>
        <input
          type="date"
          name="end"
          value={draft}
          min={start}
          required
          onChange={(event) => setDraft(event.target.value)}
          className={styles.input}
        />
        <span className={styles.muted}>{sheetCopy.endHint}</span>
      </label>
      {draft >= start && (
        <p className={styles.effect}>
          {sheetCopy.endEffect(
            daysInRange(start, draft),
            formatDayMonth(start),
            formatDayMonth(draft),
            formatDayMonth(addDays(draft, 1)),
          )}
        </p>
      )}
      {state && (
        <p role="alert" className={styles.alert}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.primary}>
        {pending ? sheetCopy.savingEnd : sheetCopy.saveEnd}
      </button>
      <p className={styles.muted}>{sheetCopy.endWho}</p>
    </form>
  );
}
