import { dayCopy } from "@/copy/day";

type Marks = { late: boolean; late_notified: boolean | null; left_early: boolean };

/** The incomplete-day marks in words, "Atraso con aviso · Salida temprana", or null on a full day. */
export function describeMarks(marks: Marks): string | null {
  const parts = [
    marks.late ? dayCopy.markedLate(marks.late_notified) : null,
    marks.left_early ? dayCopy.markedLeftEarly : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}
