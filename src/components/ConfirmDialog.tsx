"use client";

import { useRef, useState, useTransition } from "react";
import styles from "./ConfirmDialog.module.css";

type ConfirmDialogProps = {
  triggerLabel: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pendingLabel: string;
  /** Resolves to a message to show when the action did not go through, or null. */
  onConfirm: () => Promise<{ message: string } | null>;
};

/** A modal confirmation for a destructive act. It holds text and two buttons, never a form. */
export function ConfirmDialog({
  triggerLabel,
  title,
  body,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => dialog.current?.showModal()}>
        {triggerLabel}
      </button>
      {message && (
        <p role="alert" className={styles.message}>
          {message}
        </p>
      )}
      <dialog ref={dialog} className={styles.dialog} aria-labelledby="confirm-title">
        <h2 id="confirm-title" className={styles.title}>
          {title}
        </h2>
        <p>{body}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={() => dialog.current?.close()}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.confirm}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await onConfirm();
                setMessage(result?.message ?? null);
                dialog.current?.close();
              })
            }
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
