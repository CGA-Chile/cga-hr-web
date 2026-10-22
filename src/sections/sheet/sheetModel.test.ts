import { describe, expect, it } from "vitest";
import type { BonusPosition, BonusSettingsVersion, DailyBonusResult } from "@/domain/bonus/types";
import type { DailyBonus } from "../bonus/dailyBonuses";
import type { Assignment, Employee } from "../day/queries";
import { buildPanelCells, buildSheet, copyFromPreviousDate, findPanelCell, toneOf, type CellBonus } from "./sheetModel";

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
  return {
    id: `${date}-${employeeId}`,
    date,
    employee_id: employeeId,
    position_id: positionId,
    note: null,
    settled_in_period_id: null,
    late: false,
    late_notified: null,
    left_early: false,
  };
}

function bonus(date: string, result: DailyBonusResult): DailyBonus {
  return { date, settings: SETTINGS, dayRate: null, result };
}

const POSITIONS: BonusPosition[] = [
  { id: "RIE", bonusEligible: true, triggersEqualShare: false, absence: false },
  { id: "ACM", bonusEligible: true, triggersEqualShare: false, absence: false },
  { id: "BOD", bonusEligible: false, triggersEqualShare: false, absence: false },
];

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
          { employeeId: "ana", positionId: "RIE", amount: 400, late: false, leftEarly: false },
          { employeeId: "bruno", positionId: "RIE", amount: 400, late: false, leftEarly: false },
        ],
        total: 800,
        anomalies: [{ kind: "DUPLICATE_OCCUPANCY", positionId: "RIE", occupantCount: 2, affectsAmount: true }],
      }),
      bonus("2026-09-02", {
        scheme: "POSITION_RATE",
        perEmployee: [{ employeeId: "ana", positionId: "ACM", amount: 400, late: false, leftEarly: false }],
        total: 400,
        anomalies: [],
      }),
    ],
    positions: POSITIONS,
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
      positions: POSITIONS,
    });
    expect(noRates.days).toEqual([{ date: "2026-09-01", total: null, flagged: true }]);
  });

  it("without amounts, as the supervisor sees it, still marks and flags a duplicated position", () => {
    const withoutAmounts = buildSheet({
      dates: ["2026-09-01"],
      employees: [ana, bruno],
      assignments: [assignment("2026-09-01", "ana", "RIE"), assignment("2026-09-01", "bruno", "RIE")],
      dailyBonuses: [],
      positions: POSITIONS,
    });

    expect(withoutAmounts.rows.flatMap((row) => row.cells.map((cell) => cell.duplicated))).toEqual([true, true]);
    expect(withoutAmounts.days).toEqual([{ date: "2026-09-01", total: null, flagged: true }]);
    expect(withoutAmounts.rows.flatMap((row) => row.cells.map((cell) => cell.bonus))).toEqual([null, null]);
  });
});

describe("the breakdown under each row", () => {
  const sheet = buildSheet({
    dates: ["2026-09-04", "2026-09-05", "2026-09-07"],
    employees: [ana, bruno],
    assignments: [
      assignment("2026-09-04", "ana", "RIE"),
      assignment("2026-09-04", "bruno", "ACM"),
      assignment("2026-09-05", "ana", "BOD"),
      assignment("2026-09-07", "ana", "RIE"),
      assignment("2026-09-07", "bruno", "ACM"),
    ],
    dailyBonuses: [
      bonus("2026-09-04", {
        scheme: "EQUAL_SHARE",
        perEmployee: [
          { employeeId: "ana", positionId: "RIE", amount: 300, late: false, leftEarly: false },
          { employeeId: "bruno", positionId: "ACM", amount: 0, late: true, leftEarly: false },
        ],
        total: 300,
        anomalies: [],
      }),
      bonus("2026-09-05", {
        scheme: "DAY_RATE",
        perEmployee: [{ employeeId: "ana", positionId: "BOD", amount: 900, late: false, leftEarly: false }],
        total: 900,
        anomalies: [],
      }),
      bonus("2026-09-07", {
        scheme: "POSITION_RATE",
        perEmployee: [
          { employeeId: "ana", positionId: "RIE", amount: 200, late: false, leftEarly: false },
          { employeeId: "bruno", positionId: "ACM", amount: 150, late: false, leftEarly: false },
        ],
        total: 350,
        anomalies: [],
      }),
    ],
    positions: POSITIONS,
  });
  const [anaRow, brunoRow] = sheet.rows;

  it("splits each person's total into the carding line and the day rate, which add up to it", () => {
    expect(anaRow).toMatchObject({ carding: 500, dayRate: 900, total: 1_400 });
    expect(brunoRow).toMatchObject({ carding: 150, dayRate: 0, total: 150 });
  });

  it("gives each date the amount and the scheme that paid it", () => {
    expect(anaRow.cells.map((cell) => cell.bonus)).toEqual([
      { amount: 300, incomplete: false, basis: { scheme: "EQUAL_SHARE", sharedBy: 1 } },
      { amount: 900, incomplete: false, basis: { scheme: "DAY_RATE" } },
      { amount: 200, incomplete: false, basis: { scheme: "POSITION_RATE" } },
    ]);
  });

  it("keeps a day lost to arriving late as an incomplete zero, left out of those sharing", () => {
    expect(brunoRow.cells.map((cell) => cell.bonus)).toEqual([
      { amount: 0, incomplete: true, basis: { scheme: "EQUAL_SHARE", sharedBy: 1 } },
      null,
      { amount: 150, incomplete: false, basis: { scheme: "POSITION_RATE" } },
    ]);
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

describe("panel cells", () => {
  const late = { ...assignment("2026-09-01", "ana", "RIE"), note: "Llegó 9:15", late: true, late_notified: true };
  const lateBonus: CellBonus = { amount: 0, incomplete: true, basis: { scheme: "POSITION_RATE" } };
  const rows = [
    {
      employee: ana,
      cells: [
        { date: "2026-09-01", assignment: late, duplicated: false, bonus: lateBonus },
        { date: "2026-09-02", assignment: null, duplicated: false, bonus: null },
      ],
    },
  ];

  it("hands the panel what the cell holds: position, note and marks", () => {
    const cells = buildPanelCells(rows, true);
    expect(findPanelCell(cells, { date: "2026-09-01", employeeId: "ana" }).assignment).toEqual({
      position_id: "RIE",
      note: "Llegó 9:15",
      late: true,
      late_notified: true,
      left_early: false,
    });
  });

  it("gives the bonus to a role that sees amounts, and null to an empty cell", () => {
    const cells = buildPanelCells(rows, true);
    expect(findPanelCell(cells, { date: "2026-09-01", employeeId: "ana" }).bonus).toEqual(lateBonus);
    expect(findPanelCell(cells, { date: "2026-09-02", employeeId: "ana" })).toEqual({ assignment: null, bonus: null });
  });

  it("leaves the bonus out entirely for a role that never sees one", () => {
    const cells = buildPanelCells(rows, false);
    expect(findPanelCell(cells, { date: "2026-09-01", employeeId: "ana" }).bonus).toBeUndefined();
    expect(findPanelCell(cells, { date: "2026-09-02", employeeId: "ana" }).bonus).toBeUndefined();
    expect(JSON.stringify(cells)).not.toContain('"amount"');
  });
});
