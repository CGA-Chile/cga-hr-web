import { describe, expect, it } from "vitest";
import { calculateDailyBonus } from "./calculateDailyBonus";
import type { BonusAssignment, BonusPosition, BonusSettings } from "./types";

// Example values from docs/DOMAIN.md §5. Fictional by design: they keep the structure of the
// real rates (three equal rates, a lower fourth, the four summing exactly to the cap) and
// nothing else.
const RIETER: BonusPosition = { id: "rieter", bonusEligible: true, triggersEqualShare: false };
const ACM: BonusPosition = { id: "acm", bonusEligible: true, triggersEqualShare: false };
const ENCAJADOR_ACM: BonusPosition = {
  id: "encajador-acm",
  bonusEligible: true,
  triggersEqualShare: false,
};
const ALIMENTADOR_RIETER: BonusPosition = {
  id: "alimentador-rieter",
  bonusEligible: true,
  triggersEqualShare: false,
};
const PACKING_ACM: BonusPosition = {
  id: "packing-acm",
  bonusEligible: true,
  triggersEqualShare: true,
};
const BODEGA: BonusPosition = { id: "bodega", bonusEligible: false, triggersEqualShare: false };
const LICENCIA: BonusPosition = { id: "licencia", bonusEligible: false, triggersEqualShare: false };

const POSITIONS = [RIETER, ACM, ENCAJADOR_ACM, ALIMENTADOR_RIETER, PACKING_ACM, BODEGA, LICENCIA];

const SETTINGS: BonusSettings = {
  dailyCap: 15_000,
  maxAmountPerPerson: 2_500,
  positionRates: new Map([
    [RIETER.id, 4_000],
    [ACM.id, 4_000],
    [ENCAJADOR_ACM.id, 4_000],
    [ALIMENTADOR_RIETER.id, 3_000],
  ]),
};

let nextEmployee = 0;
function assign(position: BonusPosition): BonusAssignment {
  nextEmployee += 1;
  return { employeeId: `employee-${nextEmployee}`, positionId: position.id };
}

function calculate(assignments: BonusAssignment[], settings: BonusSettings = SETTINGS) {
  return calculateDailyBonus({ assignments, positions: POSITIONS, settings });
}

function amounts(result: ReturnType<typeof calculate>) {
  return result.perEmployee.map((entry) => entry.amount);
}

describe("POSITION_RATE: each filled position earns its own rate", () => {
  it("case 1 — all four rate-bearing positions filled pay their rates and total the cap", () => {
    const result = calculate([
      assign(RIETER),
      assign(ACM),
      assign(ENCAJADOR_ACM),
      assign(ALIMENTADOR_RIETER),
    ]);

    expect(result.scheme).toBe("POSITION_RATE");
    expect(amounts(result)).toEqual([4_000, 4_000, 4_000, 3_000]);
    expect(result.total).toBe(15_000);
    expect(result.anomalies).toEqual([]);
  });

  it("case 2 — an empty position lowers the total and its rate is not redistributed", () => {
    const result = calculate([assign(RIETER), assign(ENCAJADOR_ACM), assign(ALIMENTADOR_RIETER)]);

    expect(result.scheme).toBe("POSITION_RATE");
    expect(amounts(result)).toEqual([4_000, 4_000, 3_000]);
    expect(result.total).toBe(11_000);
    expect(result.anomalies).toEqual([]);
  });

  it("case 3 — a lone Rieter operator earns only the Rieter rate", () => {
    const result = calculate([assign(RIETER)]);

    expect(amounts(result)).toEqual([4_000]);
    expect(result.total).toBe(4_000);
    expect(result.anomalies).toEqual([]);
  });
});

describe("the daily cap constrains what is settled, not what is calculated", () => {
  it("case 13 — a duplicated rate-bearing position pays both occupants, unclamped and marked", () => {
    const result = calculate([
      assign(RIETER),
      assign(RIETER),
      assign(ACM),
      assign(ENCAJADOR_ACM),
      assign(ALIMENTADOR_RIETER),
    ]);

    expect(result.scheme).toBe("POSITION_RATE");
    expect(amounts(result)).toEqual([4_000, 4_000, 4_000, 4_000, 3_000]);
    expect(result.total).toBe(19_000);
    expect(result.anomalies).toEqual([
      { kind: "DUPLICATE_OCCUPANCY", positionId: RIETER.id, occupantCount: 2, affectsAmount: true },
      { kind: "ABOVE_DAILY_CAP", total: 19_000, dailyCap: 15_000 },
    ]);
  });

  it("case 14 — under equal share a duplicate only raises n: no cap mark, but still the quiet duplicate mark", () => {
    const result = calculate([
      assign(RIETER),
      assign(RIETER),
      assign(ACM),
      assign(ENCAJADOR_ACM),
      assign(ALIMENTADOR_RIETER),
      assign(PACKING_ACM),
    ]);

    expect(result.scheme).toBe("EQUAL_SHARE");
    expect(amounts(result)).toEqual(Array(6).fill(2_500));
    expect(result.total).toBe(15_000);
    expect(result.anomalies).toEqual([
      { kind: "DUPLICATE_OCCUPANCY", positionId: RIETER.id, occupantCount: 2, affectsAmount: false },
    ]);
  });
});

describe("EQUAL_SHARE: a scheme trigger on the date makes everyone on the line earn the same", () => {
  const FULL_LINE = [RIETER, ACM, ENCAJADOR_ACM, ALIMENTADOR_RIETER];

  it("case 4 — four line positions plus two inline packers share the cap at the per-person maximum", () => {
    const result = calculate([...FULL_LINE.map(assign), assign(PACKING_ACM), assign(PACKING_ACM)]);

    expect(result.scheme).toBe("EQUAL_SHARE");
    expect(amounts(result)).toEqual([2_500, 2_500, 2_500, 2_500, 2_500, 2_500]);
    expect(result.total).toBe(15_000);
    expect(result.anomalies).toEqual([]);
  });

  it("case 5 — a small crew is held to the per-person maximum, leaving the cap unspent", () => {
    const result = calculate([...FULL_LINE.map(assign), assign(PACKING_ACM)]);

    expect(result.scheme).toBe("EQUAL_SHARE");
    expect(amounts(result)).toEqual([2_500, 2_500, 2_500, 2_500, 2_500]);
    expect(result.total).toBe(12_500);
    expect(result.anomalies).toEqual([]);
  });

  it("case 6 — the share truncates down to the peso, so the total lands just under the cap", () => {
    const result = calculate([...FULL_LINE.map(assign), ...[1, 2, 3].map(() => assign(PACKING_ACM))]);

    expect(amounts(result)).toEqual(Array(7).fill(2_142));
    expect(result.total).toBe(14_994);
    expect(result.anomalies).toEqual([]);
  });

  it("case 7 — a large crew splits the cap evenly", () => {
    const packers = Array.from({ length: 26 }, () => assign(PACKING_ACM));
    const result = calculate([...FULL_LINE.map(assign), ...packers]);

    expect(amounts(result)).toEqual(Array(30).fill(500));
    expect(result.total).toBe(15_000);
    expect(result.anomalies).toEqual([]);
  });

  it("case 8 — an empty line position under equal share just lowers n", () => {
    const result = calculate([
      assign(RIETER),
      assign(ACM),
      assign(ENCAJADOR_ACM),
      assign(PACKING_ACM),
    ]);

    expect(amounts(result)).toEqual([2_500, 2_500, 2_500, 2_500]);
    expect(result.total).toBe(10_000);
    expect(result.anomalies).toEqual([]);
  });
});

describe("the scheme trigger is data, not a position code", () => {
  it("any position flagged as trigger switches the scheme, whatever its id", () => {
    const secondInlinePacking: BonusPosition = {
      id: "some-future-position",
      bonusEligible: true,
      triggersEqualShare: true,
    };
    const result = calculateDailyBonus({
      assignments: [assign(RIETER), assign(secondInlinePacking)],
      positions: [...POSITIONS, secondInlinePacking],
      settings: SETTINGS,
    });

    expect(result.scheme).toBe("EQUAL_SHARE");
    expect(amounts(result)).toEqual([2_500, 2_500]);
  });

  it("a scheme trigger with several occupants is never marked as a duplicate", () => {
    const result = calculate([assign(RIETER), assign(PACKING_ACM), assign(PACKING_ACM)]);

    expect(result.anomalies).toEqual([]);
  });

  it("the scheme trigger needs no rate, because it is never evaluated under POSITION_RATE", () => {
    expect(SETTINGS.positionRates.has(PACKING_ACM.id)).toBe(false);
    expect(() => calculate([assign(RIETER), assign(PACKING_ACM)])).not.toThrow();
  });

  it("a rate-bearing position with no rate in force is refused rather than paid zero", () => {
    const withoutAcmRate: BonusSettings = {
      ...SETTINGS,
      positionRates: new Map([[RIETER.id, 4_000]]),
    };

    expect(() => calculate([assign(RIETER), assign(ACM)], withoutAcmRate)).toThrow(/acm/);
  });
});

describe("only bonus-eligible positions earn", () => {
  it("case 9 — a date with no bonus-eligible assignment pays nobody", () => {
    const result = calculate([assign(BODEGA), assign(BODEGA), assign(LICENCIA)]);

    expect(result.perEmployee).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.anomalies).toEqual([]);
  });

  it("case 10 — someone on an absence position earns nothing and does not count toward n", () => {
    const absent = assign(LICENCIA);
    const result = calculate([
      assign(RIETER),
      assign(ACM),
      assign(ENCAJADOR_ACM),
      assign(ALIMENTADOR_RIETER),
      assign(PACKING_ACM),
      assign(PACKING_ACM),
      assign(PACKING_ACM),
      absent,
    ]);

    expect(result.perEmployee.map((entry) => entry.employeeId)).not.toContain(absent.employeeId);
    expect(amounts(result)).toEqual(Array(7).fill(2_142));
    expect(result.total).toBe(14_994);
  });
});
