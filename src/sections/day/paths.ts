import type { IsoDate } from "@/domain/bonus/types";

export type DayViewParams = { editing?: boolean; employeeId?: string; cellEmployeeId?: string };

/** The day view's URL. Edit mode and the open drawer live in the query string. */
export function dayPath(date: IsoDate, { editing, employeeId, cellEmployeeId }: DayViewParams = {}): string {
  const query = new URLSearchParams();
  if (editing) query.set("modo", "editar");
  if (employeeId) query.set("persona", employeeId);
  if (cellEmployeeId) query.set("celda", cellEmployeeId);
  const search = query.toString();
  return `/dia/${date}${search ? `?${search}` : ""}`;
}
