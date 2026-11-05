import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadClosePlan, type LoadedClosePlan } from "@/sections/periods/closePlan";
import { loadPeriod } from "@/sections/periods/queries";
import { addDays } from "@/utils/chileDate";
import { appendPeriod, createEmployee, createPosition, service, unwrap, type TestPeriod } from "./support";

const FILLER_EMPLOYEES = 45;
const FILLER_DATES = 25;
const LINE_DATES = 3;

type Arranged = { period: TestPeriod; lineIds: string[]; settingsId: string };

/**
 * More unsettled rows than one PostgREST response carries, with the line's rows inserted last, so
 * a read that stops at the first response loses them: the plan then settles less than the
 * database counts as owed, and the close is refused every time.
 */
async function arrangePeriodAboveTheRowCap(): Promise<Arranged> {
  const period = await appendPeriod("OPEN", FILLER_DATES + LINE_DATES);
  const filler = await createPosition({ bonusEligible: false });
  const line = await createPosition();

  const settings = unwrap(
    await service
      .from("bonus_settings")
      .insert({
        effective_from: period.startDate,
        effective_to: period.endDate,
        daily_cap: 100_000,
        max_amount_per_person: 50_000,
      })
      .select("id")
      .single(),
  );
  unwrap(
    await service
      .from("bonus_position_rates")
      .insert({ bonus_settings_id: settings.id, position_id: line, amount: 10_000 })
      .select("id"),
  );

  const employees = await Promise.all(Array.from({ length: FILLER_EMPLOYEES }, createEmployee));
  const fillerRows = employees.flatMap((employee_id) =>
    Array.from({ length: FILLER_DATES }, (_, offset) => ({
      date: addDays(period.startDate, offset),
      employee_id,
      position_id: filler,
    })),
  );
  unwrap(await service.from("assignments").insert(fillerRows).select("id"));

  const lineRows = Array.from({ length: LINE_DATES }, (_, offset) => ({
    date: addDays(period.startDate, FILLER_DATES + offset),
    employee_id: employees[0],
    position_id: line,
  }));
  const inserted = unwrap(await service.from("assignments").insert(lineRows).select("id"));
  return { period, lineIds: inserted.map((row) => row.id), settingsId: settings.id };
}

describe("loadClosePlan above the API's row cap", () => {
  let arranged: Arranged;
  let loaded: LoadedClosePlan;

  beforeAll(async () => {
    arranged = await arrangePeriodAboveTheRowCap();
    const period = await loadPeriod(service, arranged.period.id);
    if (!period) throw new Error("The arranged period is missing");
    loaded = await loadClosePlan(service, period);
  });

  // The period chain and the settings ranges are shared by every test file.
  afterAll(async () => {
    const deletedAt = new Date().toISOString();
    unwrap(await service.from("bonus_settings").update({ deleted_at: deletedAt }).eq("id", arranged.settingsId).select("id"));
    unwrap(await service.from("periods").update({ status: "CLOSED" }).eq("id", arranged.period.id).select("id"));
  });

  it("settles every paid assignment, however many unsettled rows precede it", () => {
    const planned = new Set(loaded.settlements.map((settlement) => settlement.assignment_id));

    expect(arranged.lineIds.filter((id) => !planned.has(id))).toEqual([]);
  });
});
