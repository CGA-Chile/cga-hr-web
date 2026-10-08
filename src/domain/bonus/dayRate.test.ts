import { describe, expect, it } from "vitest";
import { dayRateOn } from "./dayRate";
import type { BonusSettings } from "./types";

// Fictional amounts, distinct per kind so each test shows which default was picked.
const WITH_DAY_RATES: BonusSettings = {
  dailyCap: 15_000,
  maxAmountPerPerson: 4_000,
  positionRates: new Map(),
  dayRates: { saturday: 10_000, sunday: 11_000, holiday: 12_000 },
};
const BEFORE_DAY_RATES: BonusSettings = { ...WITH_DAY_RATES, dayRates: null };

const THURSDAY = "2026-10-08";
const SATURDAY = "2026-10-10";
const SUNDAY = "2026-10-11";

describe("which dates are paid under the day rate", () => {
  it("an ordinary weekday is not", () => {
    expect(dayRateOn(THURSDAY, WITH_DAY_RATES, undefined)).toBeNull();
  });

  it("a Saturday and a Sunday are, each with its own default", () => {
    expect(dayRateOn(SATURDAY, WITH_DAY_RATES, undefined)).toEqual({ reason: "SATURDAY", amount: 10_000, setForDate: false });
    expect(dayRateOn(SUNDAY, WITH_DAY_RATES, undefined)).toEqual({ reason: "SUNDAY", amount: 11_000, setForDate: false });
  });

  it("a weekday HR marked as a holiday is, with the holiday default", () => {
    expect(dayRateOn(THURSDAY, WITH_DAY_RATES, { holiday: true, dayRate: null })).toEqual({
      reason: "HOLIDAY",
      amount: 12_000,
      setForDate: false,
    });
  });

  it("a holiday on a weekend is named and paid as a holiday", () => {
    expect(dayRateOn(SATURDAY, WITH_DAY_RATES, { holiday: true, dayRate: null })?.reason).toBe("HOLIDAY");
  });

  it("an amount HR set for the date replaces the default", () => {
    expect(dayRateOn(SATURDAY, WITH_DAY_RATES, { holiday: false, dayRate: 14_000 })).toEqual({
      reason: "SATURDAY",
      amount: 14_000,
      setForDate: true,
    });
  });

  it("an amount HR set on an ordinary weekday makes it a day-rate date", () => {
    expect(dayRateOn(THURSDAY, WITH_DAY_RATES, { holiday: false, dayRate: 9_000 })).toEqual({
      reason: "WEEKDAY",
      amount: 9_000,
      setForDate: true,
    });
  });

  it("under settings that predate the day rate, weekends and holidays pay like any other day", () => {
    expect(dayRateOn(SATURDAY, BEFORE_DAY_RATES, undefined)).toBeNull();
    expect(dayRateOn(THURSDAY, BEFORE_DAY_RATES, { holiday: true, dayRate: null })).toBeNull();
  });
});
