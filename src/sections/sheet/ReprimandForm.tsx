"use client";

import { useActionState } from "react";
import { setReprimand, type ReprimandState } from "@/app/(app)/planilla/actions";
import { sheetCopy } from "@/copy/sheet";
import styles from "./SheetPanels.module.css";

type ReprimandFormProps = {
  periodId: string;
  employeeId: string;
  reprimanded: boolean;
  note: string | null;
  doneHref: string;
};

/** HR records a letter of reprimand for the period, which voids both period bonuses. */
export function ReprimandForm({ periodId, employeeId, reprimanded, note, doneHref }: ReprimandFormProps) {
  const copy = sheetCopy.person;
  const [state, action, pending] = useActionState<ReprimandState, FormData>(
    setReprimand.bind(null, periodId, employeeId, doneHref),
    null,
  );

  return (
    <form action={action} className={styles.form}>
      <label className={styles.check}>
        <input type="checkbox" name="reprimanded" defaultChecked={reprimanded} />
        {copy.reprimandLabel}
      </label>
      <span className={styles.muted}>{copy.reprimandEffect}</span>
      <label className={styles.field}>
        <span className={styles.label}>{copy.reprimandNote}</span>
        <textarea name="note" defaultValue={note ?? ""} maxLength={500} rows={2} className={styles.input} />
      </label>
      {state && (
        <p role="alert" className={styles.alert}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.primary}>
        {pending ? copy.savingReprimand : copy.saveReprimand}
      </button>
      <p className={styles.muted}>{copy.reprimandWho}</p>
    </form>
  );
}
