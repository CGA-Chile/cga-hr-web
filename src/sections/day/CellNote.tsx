import { dayCopy } from "@/copy/day";
import { NoteForm } from "./NoteForm";
import type { Assignment } from "./queries";
import styles from "./CellDrawer.module.css";

type CellNoteProps = {
  date: string;
  employeeId: string;
  assignment: Pick<Assignment, "position_id" | "note"> | null;
};

/** A cell's note: a form when there is a position to attach it to. */
export function CellNote({ date, employeeId, assignment }: CellNoteProps) {
  if (!assignment) return <p className={styles.muted}>{dayCopy.noteNeedsPosition}</p>;
  return <NoteForm date={date} employeeId={employeeId} positionId={assignment.position_id} note={assignment.note} />;
}
