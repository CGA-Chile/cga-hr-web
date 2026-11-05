import { describe, expect, it } from "vitest";
import type { BonusSettingsVersion } from "@/domain/bonus/types";
import { planTaskSettlements } from "./planTaskSettlements";
import type { OwedTask } from "./types";

// Fictional amounts, never production's.
const VERSION: BonusSettingsVersion = {
  effectiveFrom: "2026-01-01",
  effectiveTo: "2026-06-30",
  dailyCap: 15_000,
  maxAmountPerPerson: 2_500,
  dayRates: null,
  positionRates: new Map(),
  taskRates: new Map([["unloading", 3_000]]),
};
const LATER: BonusSettingsVersion = {
  ...VERSION,
  effectiveFrom: "2026-07-01",
  effectiveTo: null,
  taskRates: new Map([["unloading", 5_000]]),
};

function owed(date: string, paidAmount = 0): OwedTask {
  return { assignmentId: `assignment-${date}`, date, employeeId: "employee", bonusTaskId: "unloading", paidAmount };
}

function plan(days: OwedTask[], versions = [VERSION, LATER]) {
  return planTaskSettlements({ startDate: "2026-07-01", endDate: "2026-07-31", owed: days, versions });
}

describe("planTaskSettlements", () => {
  it("pays a task of the period at the amount in force on its date", () => {
    expect(plan([owed("2026-07-10")]).toSettle).toEqual([
      { assignmentId: "assignment-2026-07-10", date: "2026-07-10", employeeId: "employee", bonusTaskId: "unloading", amount: 5_000, kind: "PERIOD" },
    ]);
  });

  it("carries over a task of a closed period at the amount in force on its own date", () => {
    expect(plan([owed("2026-06-10")]).toSettle).toMatchObject([{ amount: 3_000, kind: "CARRY_OVER" }]);
  });

  it("case 32 — tops up a day whose line amount was frozen, paying only the difference", () => {
    expect(plan([owed("2026-06-10", 2_000)]).toSettle).toMatchObject([{ amount: 1_000 }]);
  });

  it("case 33 — pays nothing more, and never a negative amount, when the frozen day paid more than the task", () => {
    expect(plan([owed("2026-06-10", 4_000)]).toSettle).toMatchObject([{ amount: 0 }]);
  });

  it("leaves days after the period's end for a later close", () => {
    expect(plan([owed("2026-08-01")]).toSettle).toEqual([]);
  });

  it("reports a date no settings version covers instead of guessing an amount", () => {
    const result = plan([owed("2025-12-31")]);

    expect(result.toSettle).toEqual([]);
    expect(result.unpricedDates).toEqual(["2025-12-31"]);
  });
});
