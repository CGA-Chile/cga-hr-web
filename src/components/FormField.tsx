import type { ReactNode } from "react";
import styles from "./FormField.module.css";

type FormFieldProps = { label: string; hint?: string; error?: string; children: ReactNode };

/** A labelled control with its hint and, when there is one, the reason it was not accepted. */
export function FormField({ label, hint, error, children }: FormFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
      {error && (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </label>
  );
}
