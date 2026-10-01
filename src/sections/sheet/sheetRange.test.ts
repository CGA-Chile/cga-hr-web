import { describe, expect, it } from "vitest";
import type { Period } from "../periods/queries";
import { datesOf, resolveSheetRanges, resolveWeek, weekStartOf } from "./sheetRange";

function period(start: string, end: string, status: "OPEN" | "CLOSED", name = `P ${start}`): Period {
  return { id: start, name, start_date: start, end_date: end, status, closed_at: null, closed_by: null };
}

const july = period("2026-06-25", "2026-07-24", "CLOSED");
const august = period("2026-07-25", "2026-08-24", "OPEN");

describe("resolveSheetRanges", () => {
  it("shows the period holding today, with its neighbours", () => {
    const { current, previousStart, nextStart } = resolveSheetRanges([august, july], null, "2026-08-10");

    expect(current.period).toBe(august);
    expect(previousStart).toBe("2026-06-25");
    expect(nextStart).toBeNull();
  });

  it("only lets the latest open period's end move", () => {
    const august2 = period("2026-07-25", "2026-08-24", "OPEN");
    const september = period("2026-08-25", "2026-09-24", "OPEN");

    const ranges = [september, august2];
    expect(resolveSheetRanges(ranges, "2026-07-25", "2026-09-01").current.endMovable).toBe(false);
    expect(resolveSheetRanges(ranges, "2026-08-25", "2026-09-01").current.endMovable).toBe(true);
  });

  it("after the latest period ends, shows the upcoming range from the day after, ending on the 24th", () => {
    const { current, previousStart } = resolveSheetRanges([august, july], null, "2026-08-27");

    expect(current).toMatchObject({ start: "2026-08-25", end: "2026-09-24", period: null, endMovable: false });
    expect(previousStart).toBe("2026-07-25");
  });

  it("starts from the 25th before today when there is no period at all", () => {
    expect(resolveSheetRanges([], null, "2026-10-01").current).toMatchObject({ start: "2026-09-25", end: "2026-10-24" });
    expect(resolveSheetRanges([], null, "2026-10-26").current).toMatchObject({ start: "2026-10-25", end: "2026-11-24" });
  });

  it("follows the requested start, and falls back to today's range for an unknown one", () => {
    expect(resolveSheetRanges([august, july], "2026-06-25", "2026-08-10").current.period).toBe(july);
    expect(resolveSheetRanges([august, july], "2026-01-01", "2026-08-10").current.period).toBe(august);
  });
});

describe("weeks on a phone", () => {
  it("weeks start on Monday", () => {
    expect(weekStartOf("2026-09-24")).toBe("2026-09-21");
    expect(weekStartOf("2026-09-21")).toBe("2026-09-21");
    expect(weekStartOf("2026-09-27")).toBe("2026-09-21");
  });

  it("opens on today's week, and steps only through weeks that touch the range", () => {
    const range = resolveSheetRanges([period("2026-08-25", "2026-09-24", "OPEN")], null, "2026-09-24").current;

    expect(resolveWeek(range, null, "2026-09-24")).toEqual({ start: "2026-09-21", previous: "2026-09-14", next: null });
    expect(resolveWeek(range, "2026-08-26", "2026-09-24")).toEqual({ start: "2026-08-24", previous: null, next: "2026-08-31" });
    expect(resolveWeek(range, null, "2026-12-01").start).toBe("2026-08-24");
  });
});

it("lists every date of a range, both ends included", () => {
  expect(datesOf("2026-08-30", "2026-09-02")).toEqual(["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]);
});
