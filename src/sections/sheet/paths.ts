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
};

/** The sheet's URL. Like the day view, edit mode and the open panel live in the query string. */
export function sheetPath({ start, week, editing, date, employeeId, endPanel }: SheetParams = {}): string {
  const query = new URLSearchParams();
  if (start) query.set("desde", start);
  if (week) query.set("semana", week);
  if (editing) query.set("modo", "editar");
  if (date) query.set("dia", date);
  if (date && employeeId) query.set("persona", employeeId);
  if (endPanel) query.set("panel", "cierre");
  const search = query.toString();
  return `/planilla${search ? `?${search}` : ""}`;
}
