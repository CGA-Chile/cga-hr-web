import { describe, expect, it } from "vitest";
import {
  clockingTimes,
  deriveMarks,
  minutesOfDay,
  scheduleWindow,
  type DerivedMarks,
  type ScheduleWindow,
  type TimedClocking,
} from "./marks";

const SHIFT: ScheduleWindow = { startMinutes: 8 * 60, endMinutes: 17 * 60 }; // 08:00–17:00
const NONE: DerivedMarks = { late: false, leftEarly: false };

describe("deriveMarks", () => {
  it("marks neither when on time, both ends", () => {
    expect(deriveMarks({ entryMinutes: 8 * 60, exitMinutes: 17 * 60 }, SHIFT, 0)).toEqual(NONE);
  });

  it("marks late when the entry is after the start", () => {
    expect(deriveMarks({ entryMinutes: 8 * 60 + 1, exitMinutes: 17 * 60 }, SHIFT, 0)).toEqual({ late: true, leftEarly: false });
  });

  it("marks left early when the exit is before the end", () => {
    expect(deriveMarks({ entryMinutes: 8 * 60, exitMinutes: 17 * 60 - 1 }, SHIFT, 0)).toEqual({ late: false, leftEarly: true });
  });

  it("marks both when late and leaving early", () => {
    expect(deriveMarks({ entryMinutes: 9 * 60, exitMinutes: 16 * 60 }, SHIFT, 0)).toEqual({ late: true, leftEarly: true });
  });

  it("the tolerance is inclusive at its edge and forgives within it", () => {
    // 10 past, tolerance 10: exactly at the edge is not late; one more minute is.
    expect(deriveMarks({ entryMinutes: 8 * 60 + 10, exitMinutes: 17 * 60 }, SHIFT, 10).late).toBe(false);
    expect(deriveMarks({ entryMinutes: 8 * 60 + 11, exitMinutes: 17 * 60 }, SHIFT, 10).late).toBe(true);
    // Same both ways for leaving early.
    expect(deriveMarks({ entryMinutes: 8 * 60, exitMinutes: 17 * 60 - 10 }, SHIFT, 10).leftEarly).toBe(false);
    expect(deriveMarks({ entryMinutes: 8 * 60, exitMinutes: 17 * 60 - 11 }, SHIFT, 10).leftEarly).toBe(true);
  });

  it("changing the tolerance changes the mark", () => {
    const times = { entryMinutes: 8 * 60 + 5, exitMinutes: 17 * 60 };
    expect(deriveMarks(times, SHIFT, 0).late).toBe(true);
    expect(deriveMarks(times, SHIFT, 5).late).toBe(false);
  });

  it("produces no mark on a day without a schedule", () => {
    expect(deriveMarks({ entryMinutes: 10 * 60, exitMinutes: 12 * 60 }, null, 0)).toEqual(NONE);
  });

  it("produces no mark when the clocking is incomplete", () => {
    expect(deriveMarks({ entryMinutes: null, exitMinutes: 17 * 60 }, SHIFT, 0)).toEqual(NONE);
    expect(deriveMarks({ entryMinutes: 8 * 60, exitMinutes: null }, SHIFT, 0)).toEqual(NONE);
    expect(deriveMarks({ entryMinutes: null, exitMinutes: null }, SHIFT, 0)).toEqual(NONE);
  });
});

describe("clockingTimes", () => {
  const entry = (at: string, status = "ACTIVE"): TimedClocking => ({ workera_type: 0, status, clocked_at: at });
  const exit = (at: string, status = "ACTIVE"): TimedClocking => ({ workera_type: 1, status, clocked_at: at });

  it("takes the first entry and the last exit", () => {
    expect(
      clockingTimes([entry("2026-11-18T08:10:00"), entry("2026-11-18T08:02:00"), exit("2026-11-18T16:50:00"), exit("2026-11-18T17:05:00")]),
    ).toEqual({ entryMinutes: 8 * 60 + 2, exitMinutes: 17 * 60 + 5 });
  });

  it("reports a missing side as null", () => {
    expect(clockingTimes([entry("2026-11-18T08:00:00")])).toEqual({ entryMinutes: 8 * 60, exitMinutes: null });
    expect(clockingTimes([exit("2026-11-18T17:00:00")])).toEqual({ entryMinutes: null, exitMinutes: 17 * 60 });
  });

  it("ignores inactive clockings and rest and extraordinary codes", () => {
    expect(
      clockingTimes([entry("2026-11-18T08:00:00", "INACTIVE"), { workera_type: 4, status: "ACTIVE", clocked_at: "2026-11-18T12:00:00" }]),
    ).toEqual({ entryMinutes: null, exitMinutes: null });
  });
});

describe("scheduleWindow and minutesOfDay", () => {
  it("reads the clock face of a naive timestamp", () => {
    expect(minutesOfDay("2026-11-18T06:05:00")).toBe(6 * 60 + 5);
    expect(minutesOfDay("2026-11-18 23:59:00")).toBe(23 * 60 + 59);
  });

  it("builds a window from a stored schedule, or null", () => {
    expect(scheduleWindow({ starts_at: "2026-11-18T08:00:00", ends_at: "2026-11-18T17:30:00" })).toEqual({
      startMinutes: 8 * 60,
      endMinutes: 17 * 60 + 30,
    });
    expect(scheduleWindow(null)).toBeNull();
  });
});
