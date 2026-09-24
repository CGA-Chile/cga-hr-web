"use client";

import { useActionState } from "react";
import { validateExcess, type ActionState } from "@/app/(app)/cierres/actions";
import { periodsCopy } from "@/copy/periods";
import styles from "./Periods.module.css";

type ValidateExcessFormProps = { periodId: string; date: string; total: string };

export function ValidateExcessForm({ periodId, date, total }: ValidateExcessFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    (_previous, formData) => validateExcess(periodId, date, formData),
    null,
  );

  return (
    <form action={action} className={styles.drawerForm}>
      <label className={styles.field}>
        <span>{periodsCopy.noteLabel}</span>
        <textarea name="note" rows={3} maxLength={500} className={styles.input} />
      </label>
      {state && (
        <p role="alert" className={styles.alert}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.primary}>
        {periodsCopy.validate(total)}
      </button>
    </form>
  );
}
