import { describe, expect, it } from "vitest";
import { calculateDailyBonus } from "@/domain/bonus/calculateDailyBonus";
import type { BonusPosition, BonusSettings } from "@/domain/bonus/types";
import { planClose } from "./planClose";
import type { CloseCandidate, SettlementDay } from "./types";

// Example values from docs/DOMAIN.md §5, built here as fixtures.
const RIETER: BonusPosition = { id: "rieter", bonusEligible: true, triggersEqualShare: false };
const ACM: BonusPosition = { id: "acm", bonusEligible: true, triggersEqualShare: false };
const ENCAJADOR_ACM: BonusPosition = { id: "encajador-acm", bonusEligible: true, triggersEqualShare: false };
const ALIMENTADOR_RIETER: BonusPosition = {
  id: "alimentador-rieter",
  bonusEligible: true,
  triggersEqualShare: false,
};
const PACKING_ACM: BonusPosition = { id: "packing-acm", bonusEligible: true, triggersEqualShare: true };
const POSITIONS = [RIETER, ACM, ENCAJADOR_ACM, ALIMENTADOR_RIETER, PACKING_ACM];

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

const PERIOD = { startDate: "2026-08-25", endDate: "2026-09-24" };

type Seat = { position: BonusPosition; settledAmount?: number };

/** One date as the close would see it: its live assignments, calculated at the real n. */
function day(date: string, seats: Seat[], settings: BonusSettings = SETTINGS): SettlementDay {
  const assignments = seats.map((seat, index) => ({
    employeeId: `${date}-employee-${index + 1}`,
    positionId: seat.position.id,
    settledAmount: seat.settledAmount ?? null,
  }));
  return {
    date,
    dailyCap: settings.dailyCap,
    assignments,
    calculation: calculateDailyBonus({ assignments, positions: POSITIONS, settings }),
  };
}

function candidate(days: SettlementDay[], overrides: Partial<CloseCandidate> = {}): CloseCandidate {
  return { ...PERIOD, days, validatedExcesses: [], ...overrides };
}

const FULL_LINE: Seat[] = [
  { position: RIETER },
  { position: ACM },
  { position: ENCAJADOR_ACM },
  { position: ALIMENTADOR_RIETER },
];

describe("what a close settles", () => {
  it("settles every unsettled assignment of a period date at its calculated amount", () => {
    const plan = planClose(candidate([day("2026-09-01", FULL_LINE)]));

    expect(plan.toSettle.map((entry) => [entry.date, entry.amount, entry.kind])).toEqual([
      ["2026-09-01", 4_000, "PERIOD"],
      ["2026-09-01", 4_000, "PERIOD"],
      ["2026-09-01", 4_000, "PERIOD"],
      ["2026-09-01", 3_000, "PERIOD"],
    ]);
    expect(plan.periodTotal).toBe(15_000);
    expect(plan.carryOverTotal).toBe(0);
    expect(plan.canClose).toBe(true);
  });

  it("picks up a date recorded late, before the period start, as carry-over with its own subtotal", () => {
    const plan = planClose(
      candidate([day("2026-08-10", [{ position: RIETER }]), day("2026-09-01", [{ position: ACM }])]),
    );

    expect(plan.toSettle.map((entry) => [entry.date, entry.kind])).toEqual([
      ["2026-08-10", "CARRY_OVER"],
      ["2026-09-01", "PERIOD"],
    ]);
    expect(plan.carryOverTotal).toBe(4_000);
    expect(plan.periodTotal).toBe(4_000);
  });

  it("leaves dates after the period end for a later close", () => {
    const plan = planClose(candidate([day("2026-09-25", FULL_LINE)]));

    expect(plan.toSettle).toEqual([]);
  });

  it("ignores a date with nothing left to settle, even if it carries an anomaly — that is a review item now", () => {
    const allFrozen: Seat[] = [
      { position: RIETER, settledAmount: 4_000 },
      { position: RIETER, settledAmount: 4_000 },
    ];

    const plan = planClose(candidate([day("2026-08-05", allFrozen)]));

    expect(plan.toSettle).toEqual([]);
    expect(plan.blockingDates).toEqual([]);
    expect(plan.canClose).toBe(true);
  });

  it("refuses an assignment the calculation did not price, rather than settling it at zero", () => {
    const priced = day("2026-09-05", [{ position: RIETER }]);
    const unpriced: SettlementDay = {
      ...priced,
      assignments: [...priced.assignments, { employeeId: "unpriced", positionId: ACM.id, settledAmount: null }],
    };

    expect(() => planClose(candidate([unpriced]))).toThrow(/unpriced/);
  });
});

describe("the close gate: a correctable anomaly blocks the close", () => {
  const DUPLICATED_RIETER: Seat[] = [{ position: RIETER }, ...FULL_LINE];

  it("a duplicated rate-bearing position on a period date blocks, naming the date and why", () => {
    const plan = planClose(candidate([day("2026-09-01", FULL_LINE), day("2026-09-02", DUPLICATED_RIETER)]));

    expect(plan.canClose).toBe(false);
    expect(plan.blockingDates).toEqual([
      {
        date: "2026-09-02",
        anomalies: [
          { kind: "DUPLICATE_OCCUPANCY", positionId: RIETER.id, occupantCount: 2, affectsAmount: true },
          { kind: "ABOVE_DAILY_CAP", total: 19_000, dailyCap: 15_000 },
        ],
      },
    ]);
    expect(plan.excessesRequiringValidation).toEqual([]);
  });

  it("covers carry-over dates too: they are being paid now, and this is their last chance", () => {
    const plan = planClose(candidate([day("2026-08-10", DUPLICATED_RIETER)]));

    expect(plan.canClose).toBe(false);
    expect(plan.blockingDates.map((blocking) => blocking.date)).toEqual(["2026-08-10"]);
  });

  it("blocks an over-cap total on a date with nothing frozen, and offers no validated excess", () => {
    const overRated: BonusSettings = { ...SETTINGS, positionRates: new Map([[RIETER.id, 20_000]]) };

    const plan = planClose(candidate([day("2026-09-04", [{ position: RIETER }], overRated)]));

    expect(plan.canClose).toBe(false);
    expect(plan.blockingDates.map((blocking) => blocking.date)).toEqual(["2026-09-04"]);
    expect(plan.excessesRequiringValidation).toEqual([]);
  });

  it("blocks a duplicate under equal share too, even though it does not affect today's amount", () => {
    const plan = planClose(candidate([day("2026-09-03", [...DUPLICATED_RIETER, { position: PACKING_ACM }])]));

    expect(plan.canClose).toBe(false);
    expect(plan.blockingDates.map((blocking) => blocking.date)).toEqual(["2026-09-03"]);
  });
});

describe("the excess the gate cannot fix: a late assignment on a date whose amounts are frozen", () => {
  // Closed under EQUAL_SHARE: six people at the per-person maximum, the whole cap spent and frozen.
  const FROZEN_EQUAL_SHARE: Seat[] = [
    { position: RIETER, settledAmount: 2_500 },
    { position: ACM, settledAmount: 2_500 },
    { position: ENCAJADOR_ACM, settledAmount: 2_500 },
    { position: ALIMENTADOR_RIETER, settledAmount: 2_500 },
    { position: PACKING_ACM, settledAmount: 2_500 },
    { position: PACKING_ACM, settledAmount: 2_500 },
  ];
  const LATE_PACKER: Seat = { position: PACKING_ACM };

  it("pays the late assignment at the real n, leaves frozen amounts alone, and asks for validation instead of blocking", () => {
    const plan = planClose(candidate([day("2026-08-12", [...FROZEN_EQUAL_SHARE, LATE_PACKER])]));

    expect(plan.toSettle).toMatchObject([{ date: "2026-08-12", amount: 2_142, kind: "CARRY_OVER" }]);
    expect(plan.blockingDates).toEqual([]);
    expect(plan.excessesRequiringValidation).toEqual([
      { date: "2026-08-12", settledTotal: 17_142, dailyCap: 15_000, validated: false },
    ]);
    expect(plan.canClose).toBe(false);
  });

  it("lets the close proceed once the admin has validated exactly that amount", () => {
    const plan = planClose(
      candidate([day("2026-08-12", [...FROZEN_EQUAL_SHARE, LATE_PACKER])], {
        validatedExcesses: [{ date: "2026-08-12", approvedAmount: 17_142 }],
      }),
    );

    expect(plan.excessesRequiringValidation).toMatchObject([{ date: "2026-08-12", validated: true }]);
    expect(plan.canClose).toBe(true);
  });

  it("does not accept a validation for a different amount — the date changed after it was approved", () => {
    const plan = planClose(
      candidate([day("2026-08-12", [...FROZEN_EQUAL_SHARE, LATE_PACKER])], {
        validatedExcesses: [{ date: "2026-08-12", approvedAmount: 16_000 }],
      }),
    );

    expect(plan.excessesRequiringValidation).toMatchObject([{ validated: false }]);
    expect(plan.canClose).toBe(false);
  });

  it("covers a late scheme trigger turning a date paid by rate into an equal-share date", () => {
    const frozenByRate: Seat[] = [
      { position: RIETER, settledAmount: 4_000 },
      { position: ACM, settledAmount: 4_000 },
      { position: ENCAJADOR_ACM, settledAmount: 4_000 },
      { position: ALIMENTADOR_RIETER, settledAmount: 3_000 },
    ];

    const plan = planClose(candidate([day("2026-08-13", [...frozenByRate, LATE_PACKER])]));

    expect(plan.toSettle).toMatchObject([{ amount: 2_500 }]);
    expect(plan.excessesRequiringValidation).toMatchObject([{ date: "2026-08-13", settledTotal: 17_500 }]);
  });

  it("settles a late assignment that stays within the cap with no validation, never recomputing frozen amounts", () => {
    const frozenWithoutAcm: Seat[] = [
      { position: RIETER, settledAmount: 4_000 },
      { position: ENCAJADOR_ACM, settledAmount: 4_000 },
      { position: ALIMENTADOR_RIETER, settledAmount: 3_000 },
    ];

    const plan = planClose(candidate([day("2026-08-14", [...frozenWithoutAcm, { position: ACM }])]));

    expect(plan.toSettle).toMatchObject([{ positionId: ACM.id, amount: 4_000 }]);
    expect(plan.excessesRequiringValidation).toEqual([]);
    expect(plan.canClose).toBe(true);
  });

  it("still blocks when the late assignment creates a duplicate: that part is correctable", () => {
    const frozenFullLine: Seat[] = FULL_LINE.map((seat) => ({ ...seat, settledAmount: 1 }));

    const plan = planClose(candidate([day("2026-08-15", [...frozenFullLine, { position: RIETER }])]));

    expect(plan.blockingDates.map((blocking) => blocking.date)).toEqual(["2026-08-15"]);
    expect(plan.excessesRequiringValidation).toEqual([]);
  });
});
