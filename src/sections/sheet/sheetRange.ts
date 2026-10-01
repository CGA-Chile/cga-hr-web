import type { IsoDate } from "@/domain/bonus/types";
import { addDays } from "@/utils/chileDate";
import { periodNameFor, proposedEnd, type Period } from "../periods/queries";

/**
 * The dates one sheet shows. Usually a stored period; after the latest period ends and before
 * it is closed, the days that follow still need a sheet, so they get the range the next period
 * will have when the close creates it.
 */
export type SheetRange = {
  start: IsoDate;
  end: IsoDate;
  name: string;
  period: Period | null;
  /** True for the latest stored period while it is open: the only one whose end may move. */
  endMovable: boolean;
};

export type SheetRanges = { current: SheetRange; previousStart: IsoDate | null; nextStart: IsoDate | null };

/**
 * Picks the range to show: the one starting on `requested`, else the one holding today. The
 * upcoming range exists only while no open period covers today, which is the gap between a
 * period's end and its close.
 */
export function resolveSheetRanges(periods: readonly Period[], requested: IsoDate | null, today: IsoDate): SheetRanges {
  const chain = [...periods]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((period, index, all) => toRange(period, index === all.length - 1));
  const latest = chain.at(-1);
  const needsUpcoming = !latest || today > latest.end || latest.period?.status === "CLOSED";
  const ranges = needsUpcoming ? [...chain, upcomingRange(latest?.end ?? null, today)] : chain;

  const requestedIndex = ranges.findIndex((range) => range.start === requested);
  const index = requestedIndex >= 0 ? requestedIndex : defaultIndex(ranges, today);

  return {
    current: ranges[index],
    previousStart: ranges[index - 1]?.start ?? null,
    nextStart: ranges[index + 1]?.start ?? null,
  };
}

function toRange(period: Period, isLatest: boolean): SheetRange {
  return {
    start: period.start_date,
    end: period.end_date,
    name: period.name,
    period,
    endMovable: isLatest && period.status === "OPEN",
  };
}

function upcomingRange(latestEnd: IsoDate | null, today: IsoDate): SheetRange {
  const start = latestEnd ? addDays(latestEnd, 1) : firstStartFor(today);
  const end = proposedEnd(start);
  return { start, end, name: periodNameFor(end), period: null, endMovable: false };
}

/** With no period at all, the period holding today starts on the 25th before it. */
function firstStartFor(today: IsoDate): IsoDate {
  const thisMonth25 = `${today.slice(0, 7)}-25`;
  if (today >= thisMonth25) return thisMonth25;
  return `${addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)}-25`;
}

function defaultIndex(ranges: readonly SheetRange[], today: IsoDate): number {
  const holding = ranges.findIndex((range) => range.start <= today && today <= range.end);
  if (holding >= 0) return holding;
  return today < ranges[0].start ? 0 : ranges.length - 1;
}

/** The Monday on or before a date. */
export function weekStartOf(date: IsoDate): IsoDate {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export type SheetWeek = { start: IsoDate; previous: IsoDate | null; next: IsoDate | null };

/** The week a phone shows: the requested one if it touches the range, else today's, else the first. */
export function resolveWeek(range: SheetRange, requested: IsoDate | null, today: IsoDate): SheetWeek {
  const first = weekStartOf(range.start);
  const last = weekStartOf(range.end);
  const inRange = (monday: IsoDate) => monday >= first && monday <= last;
  const requestedMonday = requested ? weekStartOf(requested) : null;
  const todayMonday = weekStartOf(today);
  const start =
    requestedMonday && inRange(requestedMonday) ? requestedMonday : inRange(todayMonday) ? todayMonday : first;
  return {
    start,
    previous: start > first ? addDays(start, -7) : null,
    next: start < last ? addDays(start, 7) : null,
  };
}

export function datesOf(start: IsoDate, end: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}
