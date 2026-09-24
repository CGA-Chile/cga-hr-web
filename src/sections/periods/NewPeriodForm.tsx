"use client";

import { useActionState } from "react";
import { createPeriod, type ActionState } from "@/app/(app)/cierres/actions";
import { periodsCopy } from "@/copy/periods";
import styles from "./Periods.module.css";

type NewPeriodFormProps = {
  /** Fixed by the previous period, or null for the very first one. */
  start: string | null;
  proposedEnd: string;
  proposedName: string;
};

export function NewPeriodForm({ start, proposedEnd, proposedName }: NewPeriodFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createPeriod, null);

  return (
    <form action={action} className={styles.form}>
      <h2 className={styles.subtitle}>{periodsCopy.newTitle}</h2>
      <label className={styles.field}>
        <span>{periodsCopy.startLabel}</span>
        {start ? (
          <>
            <input type="date" value={start} readOnly className={styles.input} />
            <span className={styles.hint}>{periodsCopy.startFixed}</span>
          </>
        ) : (
          <input type="date" name="start" required className={styles.input} />
        )}
      </label>
      <label className={styles.field}>
        <span>{periodsCopy.endLabel}</span>
        <input type="date" name="end" defaultValue={proposedEnd} min={start ?? undefined} required className={styles.input} />
        <span className={styles.hint}>{periodsCopy.endHint}</span>
      </label>
      <label className={styles.field}>
        <span>{periodsCopy.nameLabel}</span>
        <input name="name" defaultValue={proposedName} className={styles.input} />
      </label>
      {state && (
        <p role="alert" className={styles.alert}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.primary}>
        {periodsCopy.create}
      </button>
    </form>
  );
}
