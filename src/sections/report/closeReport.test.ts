import { describe, expect, it } from "vitest";
import { aggregateReport, type DailyEntry, type PeriodBonusEntry } from "./closeReport";
import { exportTable } from "./exportTable";

const ANA = { name: "Ana Fuentes", nationalId: "1-9" };
const BRUNO = { name: "Bruno Díaz", nationalId: "2-7" };

function daily(employeeId: string, person: typeof ANA, extra: Partial<DailyEntry>): DailyEntry {
  return {
    employeeId,
    person,
    date: "2026-10-05",
    positionName: "Rieter",
    scheme: "POSITION_RATE",
    amount: 4_000,
    carryOver: false,
    ...extra,
  };
}

function periodBonus(employeeId: string, person: typeof ANA, extra: Partial<PeriodBonusEntry>): PeriodBonusEntry {
  return {
    employeeId,
    person,
    bonus: "PRODUCTION",
    originName: "Octubre 2026",
    carryOver: false,
    days: 20,
    workingDays: 21,
    strikes: 0,
    reprimanded: false,
    amount: 20_000,
    ...extra,
  };
}

describe("the close report", () => {
  it("splits each person's amounts by bonus, and the carry-over within each", () => {
    const report = aggregateReport(
      [
        daily("ana", ANA, {}),
        daily("ana", ANA, { date: "2026-10-10", scheme: "DAY_RATE", amount: 25_000 }),
        daily("ana", ANA, { date: "2026-09-20", amount: 3_000, carryOver: true }),
      ],
      [
        periodBonus("ana", ANA, {}),
        periodBonus("ana", ANA, { bonus: "COMPLIANCE", amount: 10_500 }),
        periodBonus("ana", ANA, { originName: "Septiembre 2026", carryOver: true, days: 1, amount: 3_500 }),
      ],
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      amounts: { carding: 7_000, dayRate: 25_000, production: 23_500, compliance: 10_500 },
      carryOver: { carding: 3_000, dayRate: 0, production: 3_500, compliance: 0 },
      total: 66_000,
    });
  });

  it("lists someone paid only a period bonus, sorted by name", () => {
    const report = aggregateReport([daily("ana", ANA, {})], [periodBonus("bruno", BRUNO, { bonus: "COMPLIANCE", amount: 12_600 })]);

    expect(report.rows.map((row) => row.name)).toEqual(["Ana Fuentes", "Bruno Díaz"]);
    expect(report.amounts).toEqual({ carding: 4_000, dayRate: 0, production: 0, compliance: 12_600 });
    expect(report.total).toBe(16_600);
  });

  it("exports the person, each bonus and the total, and nothing about carry-over", () => {
    const report = aggregateReport(
      [daily("ana", ANA, { carryOver: true })],
      [periodBonus("ana", ANA, {})],
    );

    expect(exportTable(report)).toEqual([
      ["Trabajador", "RUT", "Bono cardas", "Bono día no hábil", "Bono de producción", "Bono de cumplimiento", "Total"],
      ["Ana Fuentes", "1-9", 4_000, 0, 20_000, 0, 24_000],
      ["Totales", "", 4_000, 0, 20_000, 0, 24_000],
    ]);
  });
});
