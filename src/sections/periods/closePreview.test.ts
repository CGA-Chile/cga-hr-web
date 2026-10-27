import { describe, expect, it } from "vitest";
import type { PeriodBonusSettlement } from "@/domain/periodBonus/types";
import type { SettlementEntry } from "@/domain/settlement/types";
import { closePreview } from "./closePreview";

const OCTOBER = "october";
const SEPTEMBER = "september";

const names = {
  person: (id: string) => ({ ana: { name: "Ana Fuentes", nationalId: "1-9" }, bruno: { name: "Bruno Díaz", nationalId: null } })[id] ?? { name: "", nationalId: null },
  position: () => "Rieter",
  period: (id: string) => (id === OCTOBER ? "Octubre 2026" : "Septiembre 2026"),
};

function entry(extra: Partial<SettlementEntry>): SettlementEntry {
  return { date: "2026-10-05", employeeId: "ana", positionId: "rieter", amount: 4_000, kind: "PERIOD", ...extra };
}

function periodBonus(extra: Partial<PeriodBonusSettlement>): PeriodBonusSettlement {
  return { originPeriodId: OCTOBER, employeeId: "ana", bonus: "PRODUCTION", days: 20, strikes: 0, reprimanded: false, amount: 20_000, ...extra };
}

describe("the close preview", () => {
  it("puts each settlement in its bonus column and adds up to what the close pays", () => {
    const report = closePreview(
      {
        toSettle: [
          entry({}),
          entry({ date: "2026-10-10", amount: 25_000 }),
          entry({ employeeId: "bruno", amount: 3_000 }),
        ],
        periodBonusSettlements: [periodBonus({}), periodBonus({ bonus: "COMPLIANCE", amount: 10_500 })],
        schemes: new Map([
          ["2026-10-05", "POSITION_RATE"],
          ["2026-10-10", "DAY_RATE"],
        ]),
      },
      OCTOBER,
      names,
    );

    expect(report.rows.map((row) => [row.name, row.nationalId, row.amounts, row.total])).toEqual([
      ["Ana Fuentes", "1-9", { carding: 4_000, dayRate: 25_000, production: 20_000, compliance: 10_500 }, 59_500],
      ["Bruno Díaz", null, { carding: 3_000, dayRate: 0, production: 0, compliance: 0 }, 3_000],
    ]);
    expect(report.total).toBe(62_500);
  });

  it("marks carry-over within the column of the bonus it belongs to", () => {
    const report = closePreview(
      {
        toSettle: [entry({}), entry({ date: "2026-09-20", amount: 3_000, kind: "CARRY_OVER" })],
        periodBonusSettlements: [periodBonus({ originPeriodId: SEPTEMBER, bonus: "COMPLIANCE", days: 1, amount: 2_000 })],
        schemes: new Map([
          ["2026-10-05", "EQUAL_SHARE"],
          ["2026-09-20", "POSITION_RATE"],
        ]),
      },
      OCTOBER,
      names,
    );

    expect(report.rows[0]).toMatchObject({
      amounts: { carding: 7_000, dayRate: 0, production: 0, compliance: 2_000 },
      carryOver: { carding: 3_000, dayRate: 0, production: 0, compliance: 2_000 },
    });
    expect(report.rows[0].periodBonusLines[0].originName).toBe("Septiembre 2026");
  });
});
