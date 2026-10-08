import { describe, expect, it } from "vitest";
import type { BonusSettingsVersion, DailyBonusResult } from "@/domain/bonus/types";
import type { DailyBonus } from "../bonus/dailyBonuses";
import type { Assignment, Employee } from "../day/queries";
import { buildSheet, copyFromPreviousDate, toneOf } from "./sheetModel";

const SETTINGS: BonusSettingsVersion = {
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  dailyCap: 1_000,
  maxAmountPerPerson: 300,
  positionRates: new Map(),
  dayRates: null,
};

function employee(id: string, firstName: string, active = true): Employee {
  return { id, first_name: firstName, last_name: "Test", national_id: null, active };
}

function assignment(date: string, employeeId: string, positionId: string): Assignment {
  return { id: `${date}-${employeeId}`, date, employee_id: employeeId, position_id: positionId, note: null, settled_in_period_id: null, late: false };
}

function bonus(date: string, result: DailyBonusResult): DailyBonus {
  return { date, settings: SETTINGS, dayRate: null, result };
}

const ana = employee("ana", "Ana");
const bruno = employee("bruno", "Bruno");
const gone = employee("gone", "Zoe", false);
const idle = employee("idle", "Yago", false);

describe("buildSheet", () => {
  const sheet = buildSheet({
    dates: ["2026-09-01", "2026-09-02", "2026-09-03"],
    employees: [bruno, idle, gone, ana],
    assignments: [
      assignment("2026-09-01", "ana", "RIE"),
      assignment("2026-09-01", "bruno", "RIE"),
      assignment("2026-09-02", "ana", "ACM"),
      assignment("2026-09-02", "gone", "BOD"),
    ],
    dailyBonuses: [
      bonus("2026-09-01", {
        scheme: "POSITION_RATE",
        perEmployee: [
          { employeeId: "ana", positionId: "RIE", amount: 400, late: false },
          { employeeId: "bruno", positionId: "RIE", amount: 400, late: false },
        ],
        total: 800,
        anomalies: [{ kind: "DUPLICATE_OCCUPANCY", positionId: "RIE", occupantCount: 2, affectsAmount: true }],
      }),
      bonus("2026-09-02", {
        scheme: "POSITION_RATE",
        perEmployee: [{ employeeId: "ana", positionId: "ACM", amount: 400, late: false }],
        total: 400,
        anomalies: [],
      }),
    ],
  });

  it("lists active people and inactive people with a day in the range, by name", () => {
    expect(sheet.rows.map((row) => row.employee.id)).toEqual(["ana", "bruno", "gone"]);
  });

  it("puts each assignment in its cell and marks the duplicated position", () => {
    const [anaRow] = sheet.rows;
    expect(anaRow.cells.map((cell) => cell.assignment?.position_id ?? null)).toEqual(["RIE", "ACM", null]);
    expect(anaRow.cells.map((cell) => cell.duplicated)).toEqual([true, false, false]);
  });

  it("adds up each person's bonus across the range, and the line's bonus per date", () => {
    expect(sheet.rows.map((row) => row.total)).toEqual([800, 400, 0]);
    expect(sheet.days.map((day) => day.total)).toEqual([800, 400, null]);
    expect(sheet.grandTotal).toBe(1_200);
  });

  it("flags the dates with an anomaly", () => {
    expect(sheet.days.map((day) => day.flagged)).toEqual([true, false, false]);
  });

  it("flags a date with assignments but no rates in force", () => {
    const noRates = buildSheet({
      dates: ["2026-09-01"],
      employees: [ana],
      assignments: [assignment("2026-09-01", "ana", "RIE")],
      dailyBonuses: [{ date: "2026-09-01", settings: null, dayRate: null, result: null }],
    });
    expect(noRates.days).toEqual([{ date: "2026-09-01", total: null, flagged: true }]);
  });
});

it("colours a cell by what its position is, never by its code", () => {
  expect(toneOf({ type: "WORK", bonus_eligible: true, triggers_equal_share: false })).toBe("LINE");
  expect(toneOf({ type: "WORK", bonus_eligible: true, triggers_equal_share: true })).toBe("TRIGGER");
  expect(toneOf({ type: "WORK", bonus_eligible: false, triggers_equal_share: false })).toBe("OTHER");
  expect(toneOf({ type: "ABSENCE", bonus_eligible: false, triggers_equal_share: false })).toBe("ABSENCE");
});

describe("copyFromPreviousDate", () => {
  const rows = [ana, bruno, gone].map((employee) => ({ employee }));

  it("fills only the empty cells", () => {
    const assignments = [
      assignment("2026-09-01", "ana", "RIE"),
      assignment("2026-09-01", "bruno", "ACM"),
      assignment("2026-09-02", "bruno", "LIC"),
    ];

    expect(copyFromPreviousDate("2026-09-02", rows, assignments)).toEqual({
      from: "2026-09-01",
      cells: [{ employeeId: "ana", positionId: "RIE" }],
    });
  });

  it("skips back over empty dates, so Monday copies Saturday", () => {
    const assignments = [assignment("2026-09-12", "ana", "RIE"), assignment("2026-09-15", "bruno", "ACM")];

    expect(copyFromPreviousDate("2026-09-14", rows, assignments)?.from).toBe("2026-09-12");
  });

  it("has nothing to copy when no earlier date has anything", () => {
    expect(copyFromPreviousDate("2026-09-01", rows, [assignment("2026-09-02", "ana", "RIE")])).toBeNull();
  });
});
