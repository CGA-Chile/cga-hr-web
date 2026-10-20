import type { IsoDate } from "@/domain/bonus/types";

export type SheetParams = {
  /** The range's first date; absent means the range holding today. */
  start?: IsoDate | null;
  /** The Monday of the week a phone shows. */
  week?: IsoDate | null;
  editing?: boolean;
  /** A date alone opens its summary; with an employee it opens that cell. */
  date?: IsoDate | null;
  employeeId?: string | null;
  endPanel?: boolean;
  /** The range panel, which starts from the open cell's person and date when there is one. */
  range?: boolean;
  /** The person panel: an employee's bonuses in the range and their reprimand. */
  person?: string | null;
};

/** The sheet's URL. Like the day view, edit mode and the open panel live in the query string. */
export function sheetPath({ start, week, editing, date, employeeId, endPanel, range, person }: SheetParams = {}): string {
  const query = new URLSearchParams();
  if (start) query.set("desde", start);
  if (week) query.set("semana", week);
  if (editing) query.set("modo", "editar");
  if (date) query.set("dia", date);
  if (date && employeeId) query.set("persona", employeeId);
  if (endPanel) query.set("panel", "cierre");
  if (range) query.set("rango", "1");
  if (person) query.set("trabajador", person);
  const search = query.toString();
  return `/planilla${search ? `?${search}` : ""}`;
}
