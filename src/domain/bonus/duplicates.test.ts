import { describe, expect, it } from "vitest";
import { findDuplicatedPositions } from "./duplicates";
import type { BonusPosition } from "./types";

const RIETER: BonusPosition = { id: "rieter", bonusEligible: true, triggersEqualShare: false, absence: false };
const PACKING_ACM: BonusPosition = { id: "packing-acm", bonusEligible: true, triggersEqualShare: true, absence: false };
const BODEGA: BonusPosition = { id: "bodega", bonusEligible: false, triggersEqualShare: false, absence: false };
const POSITIONS = [RIETER, PACKING_ACM, BODEGA];

const seat = (employeeId: string, position: BonusPosition, late = false) => ({ employeeId, positionId: position.id, late });

describe("duplicated positions, found without any amount", () => {
  it("reports a rate-bearing position held by two people", () => {
    expect(findDuplicatedPositions([seat("a", RIETER), seat("b", RIETER)], POSITIONS)).toEqual([
      { positionId: RIETER.id, occupantCount: 2 },
    ]);
  });

  it("ignores scheme triggers and positions off the line, which legitimately hold several people", () => {
    const assignments = [seat("a", PACKING_ACM), seat("b", PACKING_ACM), seat("c", BODEGA), seat("d", BODEGA)];

    expect(findDuplicatedPositions(assignments, POSITIONS)).toEqual([]);
  });

  it("does not count a late arrival as an occupant", () => {
    expect(findDuplicatedPositions([seat("a", RIETER, true), seat("b", RIETER)], POSITIONS)).toEqual([]);
  });
});
