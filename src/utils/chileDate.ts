import type { IsoDate } from "@/domain/bonus/types";

const CHILE = "America/Santiago";
const DAY_MS = 86_400_000;

/**
 * "Today" as the plant sees it. Resolved in UTC, the hours between 21:00 and midnight in Chile
 * would already be tomorrow, and a bonus would be recorded on the wrong date.
 */
export function todayInChile(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CHILE }).format(now);
}

export function isIsoDate(value: string): value is IsoDate {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && toUtc(value).toISOString().startsWith(value);
}

/** Calendar arithmetic on a date without time. UTC is used only as a neutral calendar. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(toUtc(date).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function monthRange(date: IsoDate): { first: IsoDate; last: IsoDate } {
  const first = `${date.slice(0, 7)}-01`;
  const nextMonth = toUtc(first);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return { first, last: addDays(nextMonth.toISOString().slice(0, 10), -1) };
}

/** "jueves 24 de septiembre de 2026" */
export function formatLongDate(date: IsoDate): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(toUtc(date));
}

/** "jue 24" */
export function formatShortDate(date: IsoDate): string {
  return new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", weekday: "short", day: "numeric" }).format(
    toUtc(date),
  );
}

/** "septiembre de 2026" */
export function formatMonth(date: IsoDate): string {
  return new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    toUtc(date),
  );
}

function toUtc(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** "24 sept, 10:32", in Chile's time, for a timestamp. */
export function formatDateTimeInChile(timestamp: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: CHILE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

/** "24-09-2026" */
export function formatNumericDate(date: IsoDate): string {
  return new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    toUtc(date),
  );
}
