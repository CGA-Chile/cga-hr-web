"use client";

import { useState } from "react";
import { dayCopy } from "@/copy/day";
import { useAssignmentWriter } from "@/hooks/useAssignmentWriter";
import styles from "./CellDrawer.module.css";

type NoteFormProps = { date: string; employeeId: string; positionId: string; note: string | null };

export function NoteForm({ date, employeeId, positionId, note }: NoteFormProps) {
  const [draft, setDraft] = useState(note ?? "");
  const { status, write } = useAssignmentWriter(date, employeeId);

  return (
    <form
      className={styles.noteForm}
      onSubmit={(event) => {
        event.preventDefault();
        void write({ positionId, note: draft.trim() || null });
      }}
    >
      <label className={styles.noteLabel}>
        <span>{dayCopy.note}</span>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} className={styles.textarea} />
      </label>
      <div className={styles.noteActions}>
        <button type="submit" className={styles.saveNote}>
          {dayCopy.saveNote}
        </button>
        {status !== "IDLE" && <span role="status">{dayCopy.writeStatus[status]}</span>}
      </div>
    </form>
  );
}
