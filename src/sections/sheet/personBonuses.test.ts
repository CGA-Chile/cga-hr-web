import { describe, expect, it } from "vitest";
import type { BonusSettingsVersion } from "@/domain/bonus/types";
import type { PeriodBonusPosition } from "@/domain/periodBonus/types";
import type { DailyBonus } from "@/sections/bonus/dailyBonuses";
import { personBonuses } from "./personBonuses";

// Fictional amounts, never production's.
const SETTINGS: BonusSettingsVersion = {
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  dailyCap: 15_000,
  maxAmountPerPerson: 2_500,
  positionRates: new Map(),
  dayRates: null,
};
const RIETER: PeriodBonusPosition = { id: "rieter", absence: false, production: true, compliance: true, strike: false };

function day(date: string, scheme: "POSITION_RATE" | "DAY_RATE", amount: number): DailyBonus {
  return {
    date,
    settings: SETTINGS,
    dayRate: null,
    result: {
      scheme,
      perEmployee: [
        { employeeId: "ana", positionId: "rieter", amount, late: false, leftEarly: false },
        { employeeId: "bruno", positionId: "rieter", amount: 999, late: false, leftEarly: false },
      ],
      total: amount + 999,
      anomalies: [],
    },
  };
}

const BASE = {
  employeeId: "ana",
  startDate: "2026-10-05",
  endDate: "2026-10-09",
  dailyBonuses: [day("2026-10-05", "POSITION_RATE", 4_000), day("2026-10-10", "DAY_RATE", 25_000)],
  assignments: ["2026-10-05", "2026-10-06"].map((date) => ({ employeeId: "ana", date, positionId: "rieter", late: false })),
  positions: [RIETER],
  calendar: new Map(),
  reprimanded: new Set<string>(),
};

describe("personBonuses", () => {
  it("splits the person's daily amounts into carding and day rate, and estimates the period bonuses", () => {
    const amounts = { productionAmount: 10_000, complianceAmount: 5_000, strikeDeduction: 1_000, strikeLimit: 3 };
    expect(personBonuses({ ...BASE, amounts })).toEqual({
      carding: 4_000,
      dayRate: 25_000,
      period: {
        employeeId: "ana",
        productionDays: 2,
        complianceDays: 2,
        strikes: 0,
        reprimanded: false,
        production: 4_000,
        compliance: 2_000,
        workingDays: 5,
      },
    });
  });

  it("leaves the period bonuses out when the version in force has no amounts for them", () => {
    expect(personBonuses({ ...BASE, amounts: null }).period).toBeNull();
  });
});
