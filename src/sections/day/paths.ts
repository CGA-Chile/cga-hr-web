import type { IsoDate } from "@/domain/bonus/types";

export type DayViewParams = { employeeId?: string; cellEmployeeId?: string };

/** The day view's URL. The open drawer lives in the query string. */
export function dayPath(date: IsoDate, { employeeId, cellEmployeeId }: DayViewParams = {}): string {
  const query = new URLSearchParams();
  if (employeeId) query.set("persona", employeeId);
  if (cellEmployeeId) query.set("celda", cellEmployeeId);
  const search = query.toString();
  return `/dia/${date}${search ? `?${search}` : ""}`;
}
