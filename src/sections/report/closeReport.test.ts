import { describe, expect, it } from "vitest";
import { aggregateReport, type DailyEntry, type PeriodBonusEntry, type TaskEntry } from "./closeReport";
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

function task(employeeId: string, person: typeof ANA, extra: Partial<TaskEntry>): TaskEntry {
  return { employeeId, person, date: "2026-10-12", taskName: "Descarga de camión", amount: 3_000, carryOver: false, ...extra };
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
      [],
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      amounts: { carding: 7_000, dayRate: 25_000, production: 23_500, compliance: 10_500 },
      carryOver: { carding: 3_000, dayRate: 0, production: 3_500, compliance: 0 },
      total: 66_000,
    });
  });

  it("lists someone paid only a period bonus, sorted by name", () => {
    const report = aggregateReport([daily("ana", ANA, {})], [periodBonus("bruno", BRUNO, { bonus: "COMPLIANCE", amount: 12_600 })], []);

    expect(report.rows.map((row) => row.name)).toEqual(["Ana Fuentes", "Bruno Díaz"]);
    expect(report.amounts).toEqual({ carding: 4_000, dayRate: 0, production: 0, compliance: 12_600 });
    expect(report.total).toBe(16_600);
  });

  it("gives each bonus task its own column, adding up per person and overall", () => {
    const report = aggregateReport(
      [daily("ana", ANA, {})],
      [],
      [
        task("ana", ANA, {}),
        task("ana", ANA, { date: "2026-10-13" }),
        task("ana", ANA, { date: "2026-09-20", amount: 1_000, carryOver: true }),
        task("bruno", BRUNO, { taskName: "Armado de pallets", amount: 2_000 }),
      ],
    );

    expect(report.taskColumns).toEqual(["Armado de pallets", "Descarga de camión"]);
    expect(report.taskAmounts).toEqual(new Map([["Descarga de camión", 7_000], ["Armado de pallets", 2_000]]));
    expect(report.rows[0]).toMatchObject({
      taskAmounts: new Map([["Descarga de camión", 7_000]]),
      taskCarryOver: new Map([["Descarga de camión", 1_000]]),
      total: 11_000,
    });
    expect(report.total).toBe(13_000);
  });

  it("has no task column when the period paid no task", () => {
    const report = aggregateReport([daily("ana", ANA, {})], [], []);

    expect(report.taskColumns).toEqual([]);
  });

  it("has no column for a task that paid nothing, like a top-up on a day already paid in full", () => {
    const report = aggregateReport(
      [daily("ana", ANA, {})],
      [],
      [task("ana", ANA, { amount: 0 }), task("ana", ANA, { taskName: "Armado de pallets", date: "2026-10-13", amount: 2_000 })],
    );

    expect(report.taskColumns).toEqual(["Armado de pallets"]);
  });

  it("exports the person, each bonus, each task paid and the total, and nothing about carry-over", () => {
    const report = aggregateReport([daily("ana", ANA, { carryOver: true })], [periodBonus("ana", ANA, {})], [task("ana", ANA, {})]);

    expect(exportTable(report)).toEqual([
      ["Trabajador", "RUT", "Bono cardas", "Bono día no hábil", "Bono de producción", "Bono de cumplimiento", "Descarga de camión", "Total"],
      ["Ana Fuentes", "1-9", 4_000, 0, 20_000, 0, 3_000, 27_000],
      ["Totales", "", 4_000, 0, 20_000, 0, 3_000, 27_000],
    ]);
  });

  it("exports a zero for someone who did not do a task another person did", () => {
    const report = aggregateReport([daily("ana", ANA, {})], [], [task("bruno", BRUNO, {})]);

    expect(exportTable(report).slice(1, 3)).toEqual([
      ["Ana Fuentes", "1-9", 4_000, 0, 0, 0, 0, 4_000],
      ["Bruno Díaz", "2-7", 0, 0, 0, 0, 3_000, 3_000],
    ]);
  });

  it("exports only the fixed bonuses when the period paid no task", () => {
    const report = aggregateReport([daily("ana", ANA, {})], [], []);

    expect(exportTable(report)[0]).toEqual([
      "Trabajador", "RUT", "Bono cardas", "Bono día no hábil", "Bono de producción", "Bono de cumplimiento", "Total",
    ]);
  });
});
