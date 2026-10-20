import { describe, expect, it } from "vitest";
import type { IsoDate } from "@/domain/bonus/types";
import { planPeriodBonusClose } from "./planPeriodBonusClose";
import type {
  ClosedPeriod,
  CountableAssignment,
  PeriodBonusAmounts,
  PeriodBonusCloseInput,
  PeriodBonusPosition,
  PeriodBonusSettlement,
} from "./types";

// The example values of docs/DOMAIN.md §5b. Fictional, never production's.
const AMOUNTS: PeriodBonusAmounts = {
  productionAmount: 21_000,
  complianceAmount: 12_600,
  strikeDeduction: 1_500,
  strikeLimit: 3,
};

const RIETER: PeriodBonusPosition = { id: "rieter", absence: false, production: true, compliance: true, strike: false };
const BODEGA: PeriodBonusPosition = { id: "bodega", absence: false, production: false, compliance: true, strike: false };
const FALTA_SIN_AVISO: PeriodBonusPosition = { id: "fsa", absence: true, production: false, compliance: false, strike: true };
const POSITIONS = [RIETER, BODEGA, FALTA_SIN_AVISO];

const JUAN = "juan";

// September: Monday 7 to Friday 11, five working days, closed with frozen terms.
const SEPTEMBER: ClosedPeriod = {
  id: "september",
  startDate: "2026-09-07",
  endDate: "2026-09-11",
  terms: { ...AMOUNTS, workingDays: 5 },
};
// October: Monday 12 to Friday 16, the period being closed.
const OCTOBER = { id: "october", startDate: "2026-10-12", endDate: "2026-10-16" };

let nextId = 0;
function assignment(date: IsoDate, position = RIETER, extra: Partial<CountableAssignment> = {}): CountableAssignment {
  nextId += 1;
  return {
    id: `a${nextId}`,
    employeeId: JUAN,
    date,
    positionId: position.id,
    late: false,
    counted: { PRODUCTION: false, COMPLIANCE: false },
    ...extra,
  };
}

const counted = { PRODUCTION: true, COMPLIANCE: true };

function settled(bonus: "PRODUCTION" | "COMPLIANCE", extra: Partial<PeriodBonusSettlement>): PeriodBonusSettlement {
  return { originPeriodId: SEPTEMBER.id, employeeId: JUAN, bonus, days: 4, strikes: 0, reprimanded: false, amount: 0, ...extra };
}

function close(overrides: Partial<PeriodBonusCloseInput>): ReturnType<typeof planPeriodBonusClose> {
  return planPeriodBonusClose({
    period: OCTOBER,
    amounts: AMOUNTS,
    closedPeriods: [SEPTEMBER],
    assignments: [],
    positions: POSITIONS,
    calendar: new Map(),
    reprimanded: new Set(),
    settled: [],
    ...overrides,
  });
}

/** The four days September already paid Juan: 4 of 5 working days. */
const SEPTEMBER_PAID = [
  settled("PRODUCTION", { amount: 16_800 }),
  settled("COMPLIANCE", { amount: 10_080 }),
];
const SEPTEMBER_DAYS = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10"].map((date) =>
  assignment(date, RIETER, { counted }),
);

describe("closing the period bonuses", () => {
  it("freezes the period's terms and settles each employee's bonuses for its days", () => {
    const days = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"].map((date) => assignment(date));
    const plan = close({ assignments: days });

    expect(plan.terms).toEqual({ ...AMOUNTS, workingDays: 5 });
    expect(plan.settlements).toEqual([
      { originPeriodId: OCTOBER.id, employeeId: JUAN, bonus: "PRODUCTION", days: 5, strikes: 0, reprimanded: false, amount: 21_000 },
      { originPeriodId: OCTOBER.id, employeeId: JUAN, bonus: "COMPLIANCE", days: 5, strikes: 0, reprimanded: false, amount: 12_600 },
    ]);
    expect(plan.stamps).toHaveLength(10);
  });

  it("stamps a Bodega day for compliance only", () => {
    const bodega = assignment("2026-10-12", BODEGA);
    expect(close({ assignments: [bodega] }).stamps).toEqual([
      { assignmentId: bodega.id, positionId: BODEGA.id, bonus: "COMPLIANCE" },
    ]);
  });

  it("freezes the strikes even of someone who earned nothing", () => {
    const plan = close({ assignments: [assignment("2026-10-12", FALTA_SIN_AVISO)] });
    expect(plan.settlements.map((row) => [row.bonus, row.strikes, row.amount])).toEqual([
      ["PRODUCTION", 1, 0],
      ["COMPLIANCE", 1, 0],
    ]);
  });

  it("pays nothing and freezes nothing when the version in force has no period-bonus amounts", () => {
    expect(close({ amounts: null, assignments: [assignment("2026-10-12")] })).toEqual({
      terms: null,
      settlements: [],
      stamps: [],
    });
  });

  it("P19: a working day of a closed period entered late is paid at that period's frozen terms, less what was paid", () => {
    const late = assignment("2026-09-11");
    const plan = close({ assignments: [...SEPTEMBER_DAYS, late], settled: SEPTEMBER_PAID });

    expect(plan.settlements).toEqual([
      { originPeriodId: SEPTEMBER.id, employeeId: JUAN, bonus: "PRODUCTION", days: 1, strikes: 0, reprimanded: false, amount: 4_200 },
      { originPeriodId: SEPTEMBER.id, employeeId: JUAN, bonus: "COMPLIANCE", days: 1, strikes: 0, reprimanded: false, amount: 2_520 },
    ]);
    expect(plan.stamps.map((stamp) => stamp.assignmentId)).toEqual([late.id, late.id]);
  });

  it("P20: a strike entered after the close does not deduct; the frozen strikes do", () => {
    const frozenStrike = SEPTEMBER_PAID.map((row) => ({ ...row, strikes: 1, amount: row.bonus === "COMPLIANCE" ? 8_580 : row.amount }));
    const lateAndLateEntered = assignment("2026-09-11", RIETER, { late: true });
    const plan = close({ assignments: [...SEPTEMBER_DAYS, lateAndLateEntered], settled: frozenStrike });

    const compliance = plan.settlements.find((row) => row.bonus === "COMPLIANCE");
    expect(compliance).toMatchObject({ strikes: 1, amount: 12_600 - 1_500 - 8_580 });
  });

  it("P21: a carry-over day of a period with a reprimand pays nothing", () => {
    const reprimanded = SEPTEMBER_PAID.map((row) => ({ ...row, reprimanded: true, amount: 0 }));
    const plan = close({ assignments: [...SEPTEMBER_DAYS, assignment("2026-09-11")], settled: reprimanded });
    expect(plan.settlements.map((row) => row.amount)).toEqual([0, 0]);
  });

  it("a reprimand in the closing period does not void a carry-over day from a period without one", () => {
    const plan = close({
      assignments: [...SEPTEMBER_DAYS, assignment("2026-09-11")],
      settled: SEPTEMBER_PAID,
      reprimanded: new Set([JUAN]),
    });
    const september = plan.settlements.filter((row) => row.originPeriodId === SEPTEMBER.id);
    const october = plan.settlements.filter((row) => row.originPeriodId === OCTOBER.id);
    expect(september.map((row) => row.amount)).toEqual([4_200, 2_520]);
    expect(october.map((row) => [row.reprimanded, row.amount])).toEqual([
      [true, 0],
      [true, 0],
    ]);
  });

  it("a carry-over with no earlier row for the employee starts from nothing and no strikes", () => {
    const plan = close({ assignments: [assignment("2026-09-11")] });
    expect(plan.settlements.map((row) => [row.bonus, row.days, row.strikes, row.amount])).toEqual([
      ["PRODUCTION", 1, 0, 4_200],
      ["COMPLIANCE", 1, 0, 2_520],
    ]);
  });

  it("never counts an assignment twice", () => {
    expect(close({ assignments: SEPTEMBER_DAYS, settled: SEPTEMBER_PAID })).toMatchObject({ settlements: [], stamps: [] });
  });

  it("never pays carry-over for a period that closed before the period bonuses", () => {
    const old: ClosedPeriod = { ...SEPTEMBER, terms: null };
    expect(close({ closedPeriods: [old], assignments: [assignment("2026-09-11")] }).settlements).toEqual([]);
  });

  it("ignores days that belong to no period", () => {
    expect(close({ assignments: [assignment("2026-08-03")] }).settlements).toEqual([]);
  });
});
