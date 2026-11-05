import type { MismatchReason } from "@/domain/attendance/mismatch";

/** The note on a mismatch: one mark for every case, and the words say which (docs/DOMAIN.md §5d). */
export const mismatchCopy: Record<MismatchReason, string> = {
  CLOCKED_WITHOUT_POSITION: "Marcó en Workera y no tiene puesto",
  POSITION_WITHOUT_CLOCKING: "Tiene puesto y no marcó en Workera",
  CLOCKED_WHILE_ABSENT: "Figura ausente y marcó en Workera",
  MISSING_ENTRY: "Olvidó marcar la entrada",
  MISSING_EXIT: "Olvidó marcar la salida",
};
