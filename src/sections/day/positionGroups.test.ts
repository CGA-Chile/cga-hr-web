import { describe, expect, it } from "vitest";
import { groupPositionsForPicker } from "./positionGroups";
import type { Position } from "./queries";

function position(code: string, overrides: Partial<Position> = {}): Position {
  return {
    id: code,
    code,
    name: code,
    abbreviation: code.slice(0, 3),
    bonus_eligible: false,
    triggers_equal_share: false,
    type: "WORK",
    display_order: 0,
    active: true,
    ...overrides,
  };
}

describe("the picker's position groups", () => {
  it("leaves out an inactive position, which past cells still show but nobody assigns again", () => {
    const groups = groupPositionsForPicker([
      position("FALTA", { type: "ABSENCE", active: false, display_order: 920 }),
      position("FALTA_CON_AVISO", { type: "ABSENCE", display_order: 900 }),
      position("LICENCIA", { type: "ABSENCE", display_order: 910 }),
    ]);

    expect(groups).toEqual([
      {
        key: "ABSENCE",
        positions: [
          expect.objectContaining({ code: "FALTA_CON_AVISO" }),
          expect.objectContaining({ code: "LICENCIA" }),
        ],
      },
    ]);
  });

  it("drops a group whose positions are all inactive", () => {
    const groups = groupPositionsForPicker([
      position("RIETER", { bonus_eligible: true }),
      position("BODEGA", { active: false }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["LINE"]);
  });
});
