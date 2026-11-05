import { describe, expect, it } from "vitest";
import { findMismatch, summarizeClockings, type CellAttendance, type DayClockings, type MismatchReason } from "./mismatch";

const NONE: DayClockings = { entry: false, exit: false };
const FULL: DayClockings = { entry: true, exit: true };
const ENTRY_ONLY: DayClockings = { entry: true, exit: false };
const EXIT_ONLY: DayClockings = { entry: false, exit: true };

describe("findMismatch", () => {
  it.each<[CellAttendance, DayClockings, MismatchReason | null]>([
    ["EMPTY", FULL, "CLOCKED_WITHOUT_POSITION"],
    ["EMPTY", ENTRY_ONLY, "CLOCKED_WITHOUT_POSITION"],
    ["EMPTY", NONE, null],
    ["WORK", FULL, null],
    ["WORK", NONE, "POSITION_WITHOUT_CLOCKING"],
    ["WORK", ENTRY_ONLY, "MISSING_EXIT"],
    ["WORK", EXIT_ONLY, "MISSING_ENTRY"],
    ["ABSENCE", FULL, "CLOCKED_WHILE_ABSENT"],
    ["ABSENCE", EXIT_ONLY, "CLOCKED_WHILE_ABSENT"],
    ["ABSENCE", NONE, null],
  ])("a %s cell with %o is %s", (cell, day, reason) => {
    expect(findMismatch(cell, day)).toBe(reason);
  });
});

describe("summarizeClockings", () => {
  it("reads entries and exits", () => {
    expect(
      summarizeClockings([
        { workera_type: 0, status: "ACTIVE" },
        { workera_type: 1, status: "MODIFIED" },
      ]),
    ).toEqual(FULL);
  });

  it("ignores a clocking Workera made inactive", () => {
    expect(summarizeClockings([{ workera_type: 0, status: "INACTIVE" }])).toEqual(NONE);
  });

  it("ignores rest and extraordinary clockings", () => {
    expect(summarizeClockings([2, 3, 4, 5].map((workera_type) => ({ workera_type, status: "ACTIVE" })))).toEqual(NONE);
  });
});
