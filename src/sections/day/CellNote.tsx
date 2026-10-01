import { dayCopy } from "@/copy/day";
import { NoteForm } from "./NoteForm";
import type { Assignment } from "./queries";
import styles from "./CellDrawer.module.css";

type CellNoteProps = { date: string; employeeId: string; assignment: Assignment | null; editing: boolean };

/** A cell's note: a form in edit mode when there is a position to attach it to, text otherwise. */
export function CellNote({ date, employeeId, assignment, editing }: CellNoteProps) {
  if (editing && assignment) {
    return <NoteForm date={date} employeeId={employeeId} positionId={assignment.position_id} note={assignment.note} />;
  }
  if (editing) return <p className={styles.muted}>{dayCopy.noteNeedsPosition}</p>;
  return <p className={assignment?.note ? undefined : styles.muted}>{assignment?.note ?? dayCopy.noNote}</p>;
}
