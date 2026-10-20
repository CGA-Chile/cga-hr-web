import type { BonusSettings, CalendarDate, DayRate, DayRateReason, IsoDate } from "./types";

/**
 * The day rate a date is paid at, or null when the line's schemes apply. Saturdays, Sundays and
 * holidays take their default from the settings in force; an amount HR set for the date wins
 * over the default, and makes even an ordinary weekday a day-rate date.
 *
 * supabase/migrations/*_add_day_rate_and_holidays.sql holds the SQL copy of this rule in
 * private.is_day_rate_date. Change both together.
 */
export function dayRateOn(date: IsoDate, settings: BonusSettings, calendar: CalendarDate | undefined): DayRate | null {
  const reason = kindOfDate(date, calendar);
  if (calendar?.dayRate) return { reason, amount: calendar.dayRate, setForDate: true };
  if (reason === "WEEKDAY" || !settings.dayRates) return null;

  const defaults = { SATURDAY: settings.dayRates.saturday, SUNDAY: settings.dayRates.sunday, HOLIDAY: settings.dayRates.holiday };
  return { reason, amount: defaults[reason], setForDate: false };
}

/**
 * A working day: a Monday to Friday that is not paid under the day rate. The divisor of the period
 * bonuses. It does not depend on the settings, so a weekday holiday is not a working day even
 * under a version that predates the day rate.
 *
 * private.is_working_day holds the SQL copy. Change both together.
 */
export function isWorkingDay(date: IsoDate, calendar: CalendarDate | undefined): boolean {
  return kindOfDate(date, calendar) === "WEEKDAY" && !calendar?.dayRate;
}

function kindOfDate(date: IsoDate, calendar: CalendarDate | undefined): DayRateReason {
  if (calendar?.holiday) return "HOLIDAY";
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (weekday === 6) return "SATURDAY";
  if (weekday === 0) return "SUNDAY";
  return "WEEKDAY";
}
