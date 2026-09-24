import { describe, expect, it } from "vitest";
import { calculateDailyBonus } from "./calculateDailyBonus";
import { findSettingsInForce, settingsInForceOn } from "./settingsInForce";
import type { BonusPosition, BonusSettingsVersion } from "./types";

const RIETER: BonusPosition = { id: "rieter", bonusEligible: true, triggersEqualShare: false };
const ACM: BonusPosition = { id: "acm", bonusEligible: true, triggersEqualShare: false };
const POSITIONS = [RIETER, ACM];

const BEFORE_CHANGE: BonusSettingsVersion = {
  effectiveFrom: "2026-01-01",
  effectiveTo: "2026-09-09",
  dailyCap: 15_000,
  maxAmountPerPerson: 2_500,
  positionRates: new Map([
    [RIETER.id, 4_000],
    [ACM.id, 4_000],
  ]),
};
const AFTER_CHANGE: BonusSettingsVersion = {
  effectiveFrom: "2026-09-10",
  effectiveTo: null,
  dailyCap: 18_000,
  maxAmountPerPerson: 3_000,
  positionRates: new Map([
    [RIETER.id, 5_000],
    [ACM.id, 4_500],
  ]),
};
const VERSIONS = [BEFORE_CHANGE, AFTER_CHANGE];

function totalOn(date: string) {
  return calculateDailyBonus({
    assignments: [
      { employeeId: "a", positionId: RIETER.id },
      { employeeId: "b", positionId: ACM.id },
    ],
    positions: POSITIONS,
    settings: settingsInForceOn(date, VERSIONS),
  }).total;
}

describe("each date is calculated with the settings in force on that date", () => {
  it("case 12 — a rate change mid-period applies from its effective date and not before", () => {
    expect(totalOn("2026-09-09")).toBe(8_000);
    expect(totalOn("2026-09-10")).toBe(9_500);
  });

  it("case 11 — a Saturday pays like any other day; the bonus does not look at the weekday", () => {
    const saturday = "2026-09-26";
    const thursday = "2026-09-24";

    expect(totalOn(saturday)).toBe(9_500);
    expect(totalOn(saturday)).toBe(totalOn(thursday));
  });

  it("a date before any version has no parameters to be paid with, and is refused", () => {
    expect(() => totalOn("2025-12-31")).toThrow(/found 0/);
  });

  it("finding the version for a date no version covers returns nothing, for callers that show it", () => {
    expect(findSettingsInForce("2025-12-31", VERSIONS)).toBeNull();
    expect(findSettingsInForce("2026-09-10", VERSIONS)).toBe(AFTER_CHANGE);
  });

  it("overlapping versions are refused rather than one being picked", () => {
    const overlapping = { ...AFTER_CHANGE, effectiveFrom: "2026-09-01" };

    expect(() => settingsInForceOn("2026-09-05", [BEFORE_CHANGE, overlapping])).toThrow(/found 2/);
  });
});
