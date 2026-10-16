import { describe, expect, it } from "vitest";
import { planRange, rangeDates, summarizePlan, undoCells, type PlannedDay, type StoredDay } from "./rangePlan";

describe("rangeDates", () => {
  it("counts calendar days, both ends included, as a medical leave does", () => {
    const dates = rangeDates({ from: "2026-10-14", to: "2026-10-28", days: "ALL" });
    expect(dates).toHaveLength(15);
    expect([dates[0], dates.at(-1)]).toEqual(["2026-10-14", "2026-10-28"]);
  });

  it("leaves out the weekend, or only Sunday, for a fixed post", () => {
    // Wednesday 14 to Tuesday 20 October 2026.
    expect(rangeDates({ from: "2026-10-14", to: "2026-10-20", days: "MON_FRI" })).toEqual([
      "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-19", "2026-10-20",
    ]);
    expect(rangeDates({ from: "2026-10-14", to: "2026-10-20", days: "MON_SAT" })).toEqual([
      "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-19", "2026-10-20",
    ]);
  });

  it("has no dates when the end comes before the start", () => {
    expect(rangeDates({ from: "2026-10-14", to: "2026-10-13", days: "ALL" })).toEqual([]);
  });
});

describe("planRange", () => {
  const dates = ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"];
  const stored: StoredDay[] = [
    { date: "2026-10-14", position_id: "ACM", note: null, settled_in_period_id: null },
    { date: "2026-10-15", position_id: "LIC", note: null, settled_in_period_id: null },
    { date: "2026-10-16", position_id: "ACM", note: null, settled_in_period_id: "september" },
  ];

  it("says what each date had and what it will have, as the database will write it", () => {
    expect(planRange({ dates, stored, positionId: "LIC", note: null, mayChangePaid: false })).toEqual([
      { date: "2026-10-14", before: "ACM", after: "LIC", change: "REPLACE" },
      { date: "2026-10-15", before: "LIC", after: "LIC", change: "SAME" },
      { date: "2026-10-16", before: "ACM", after: "ACM", change: "PAID" },
      { date: "2026-10-17", before: null, after: "LIC", change: "FILL" },
    ]);
  });

  it("replaces a paid date for someone who may change one", () => {
    const plan = planRange({ dates, stored, positionId: "LIC", note: null, mayChangePaid: true });
    expect(plan[2]).toEqual({ date: "2026-10-16", before: "ACM", after: "LIC", change: "REPLACE" });
  });

  it("changes only the note of a date that already has the position, when a new note is given", () => {
    const plan = planRange({ dates, stored, positionId: "LIC", note: "Licencia médica", mayChangePaid: false });
    expect(plan[1].change).toBe("NOTE");
  });

  it("empties the dates that had a position when none is given, and leaves the empty ones alone", () => {
    const plan = planRange({ dates, stored, positionId: null, note: null, mayChangePaid: false });
    expect(plan.map((day) => day.change)).toEqual(["CLEAR", "CLEAR", "PAID", "SAME"]);
  });

  it("never empties a paid date, not even for someone who may change one", () => {
    const plan = planRange({ dates, stored, positionId: null, note: null, mayChangePaid: true });
    expect(plan[2].change).toBe("PAID");
  });
});

describe("summarizePlan", () => {
  const day = (date: string, change: PlannedDay["change"]): PlannedDay => ({ date, before: null, after: "LIC", change });

  it("counts each kind of change, and the changed dates past the end of the period on screen", () => {
    const plan = [
      day("2026-10-23", "REPLACE"),
      day("2026-10-24", "FILL"),
      day("2026-10-25", "FILL"),
      day("2026-10-26", "SAME"),
      day("2026-10-27", "PAID"),
    ];
    expect(summarizePlan(plan, "2026-10-24")).toEqual({
      replace: 1, fill: 2, clear: 0, note: 0, same: 1, paid: 1, changing: 3, afterEnd: 1, firstAfterEnd: "2026-10-25",
    });
  });
});

describe("undoCells", () => {
  it("puts back what each changed date held, marks and note included, and empties the ones that were empty", () => {
    expect(
      undoCells([
        { changed_date: "2026-10-14", previous_position_id: "ACM", previous_note: "Llegó 9:15", previous_late: true, previous_late_notified: false, previous_left_early: false },
        { changed_date: "2026-10-18", previous_position_id: null, previous_note: null, previous_late: null, previous_late_notified: null, previous_left_early: null },
      ]),
    ).toEqual([
      { date: "2026-10-14", positionId: "ACM", note: "Llegó 9:15", late: true, lateNotified: false, leftEarly: false },
      { date: "2026-10-18", positionId: null, note: null },
    ]);
  });
});
