import { dayCopy } from "@/copy/day";

type Marks = { late: boolean; late_notified: boolean | null; left_early: boolean; bonus_task_id: string | null };

/**
 * The cell's marks in words, "Atraso con aviso · Salida temprana · Tarea: Descarga de camión", or
 * null on a full day with no task.
 */
export function describeMarks(marks: Marks, taskName: (id: string) => string): string | null {
  const parts = [
    marks.late ? dayCopy.markedLate(marks.late_notified) : null,
    marks.left_early ? dayCopy.markedLeftEarly : null,
    marks.bonus_task_id ? dayCopy.markedBonusTask(taskName(marks.bonus_task_id)) : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}
