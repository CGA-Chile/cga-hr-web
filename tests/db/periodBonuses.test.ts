import { beforeAll, describe, expect, it } from "vitest";
import { isWorkingDay } from "@/domain/bonus/dayRate";
import { countWorkingDays } from "@/domain/periodBonus/calculatePeriodBonuses";
import type { Json } from "@/types/database";
import { addDays } from "@/utils/chileDate";
import {
  appendPeriod,
  createEmployee,
  createPosition,
  service,
  signInAs,
  unwrap,
  type Client,
  type TestPeriod,
} from "./support";

let admin: Client;
let editor: Client;
let supervisor: Client;

beforeAll(async () => {
  ({ client: admin } = await signInAs("admin"));
  ({ client: editor } = await signInAs("editor"));
  ({ client: supervisor } = await signInAs("supervisor"));
});

// Fictional amounts, never production's.
const AMOUNTS = { production_amount: 21_000, compliance_amount: 12_600, strike_deduction: 1_500, strike_limit: 3 };

function workingDayFrom(start: string): string {
  let date = start;
  while (!isWorkingDay(date, undefined)) date = addDays(date, 1);
  return date;
}

function firstWorkingDay(period: TestPeriod): string {
  return workingDayFrom(period.startDate);
}

function termsOf(period: TestPeriod) {
  return { ...AMOUNTS, working_days: countWorkingDays(period.startDate, period.endDate, new Map()) };
}

function nextAfter(period: TestPeriod) {
  return { p_next_name: `Next ${period.endDate}`, p_next_end: addDays(period.endDate, 30) };
}

/**
 * Closes the way the app does: the period's own plan plus every day closed periods still owe, so a
 * day one test enters late never blocks the next close. The carry-over rows themselves are not
 * checked by the database, so none are sent.
 */
async function closeWithBonuses(
  period: TestPeriod,
  settlements: readonly Json[],
  stamps: readonly { assignment_id: string; position_id: string; bonus: string }[],
  terms = termsOf(period),
) {
  const owed = unwrap(
    await service.from("period_bonus_owed_days").select("assignment_id, position_id, bonus").lte("date", period.endDate),
  );
  return admin.rpc("close_period", {
    ...nextAfter(period),
    p_period_id: period.id,
    p_settlements: [],
    p_period_bonuses: {
      terms,
      settlements: [...settlements],
      stamps: [
        ...stamps,
        ...owed.map((day) => ({ assignment_id: day.assignment_id, position_id: day.position_id, bonus: day.bonus })),
      ],
    },
  });
}

async function assign(date: string, positionId: string, employeeId?: string) {
  return unwrap(
    await service
      .from("assignments")
      .insert({ date, employee_id: employeeId ?? (await createEmployee()), position_id: positionId })
      .select("id, employee_id, position_id")
      .single(),
  );
}

async function stampsOf(id: string) {
  return unwrap(
    await service
      .from("assignments")
      .select("production_settled_in_period_id, compliance_settled_in_period_id")
      .eq("id", id)
      .single(),
  );
}

/** A period with one employee on a production position on its first working day, ready to close. */
async function periodWithOneDay() {
  const period = await appendPeriod("OPEN", 31);
  const position = await createPosition({ bonusEligible: false, productionBonus: true, complianceBonus: true });
  const day = await assign(firstWorkingDay(period), position);
  const settlements = (["PRODUCTION", "COMPLIANCE"] as const).map((bonus) => ({
    origin_period_id: period.id,
    employee_id: day.employee_id,
    bonus,
    days: 1,
    strikes: 0,
    reprimanded: false,
    amount: 1_000,
  }));
  const stamps = (["PRODUCTION", "COMPLIANCE"] as const).map((bonus) => ({
    assignment_id: day.id,
    position_id: day.position_id,
    bonus,
  }));
  return { period, day, settlements, stamps };
}

describe("the position catalogue", () => {
  it("flags the positions that earn each bonus, and the absence that is a strike", async () => {
    const rows = unwrap(
      await service
        .from("positions")
        .select("code, production_bonus, compliance_bonus, compliance_strike")
        .in("code", ["RIETER", "ASEO", "PACKING", "BODEGA", "MANTENCION", "SUPERVISOR", "FALTA_SIN_AVISO", "FALTA_CON_AVISO"]),
    );
    const byCode = Object.fromEntries(rows.map(({ code, ...flags }) => [code, flags]));

    expect(byCode).toEqual({
      RIETER: { production_bonus: true, compliance_bonus: true, compliance_strike: false },
      ASEO: { production_bonus: true, compliance_bonus: true, compliance_strike: false },
      PACKING: { production_bonus: true, compliance_bonus: true, compliance_strike: false },
      BODEGA: { production_bonus: false, compliance_bonus: true, compliance_strike: false },
      MANTENCION: { production_bonus: false, compliance_bonus: false, compliance_strike: false },
      SUPERVISOR: { production_bonus: false, compliance_bonus: false, compliance_strike: false },
      FALTA_SIN_AVISO: { production_bonus: false, compliance_bonus: false, compliance_strike: true },
      FALTA_CON_AVISO: { production_bonus: false, compliance_bonus: false, compliance_strike: false },
    });
  });

  it("refuses a strike flag on a work position", async () => {
    const position = await createPosition();
    const flagged = await service.from("positions").update({ compliance_strike: true }).eq("id", position);
    expect(flagged.error?.code).toBe("23514");
  });
});

describe("bonus_settings", () => {
  it("takes the four period-bonus amounts together or not at all", async () => {
    const partial = await service
      .from("bonus_settings")
      .insert({ effective_from: "0900-01-01", daily_cap: 1, max_amount_per_person: 1, production_amount: 21_000 });
    expect(partial.error?.code).toBe("23514");
  });
});

describe("set_reprimand", () => {
  it("lets HR record and remove a reprimand in an open period, keeping who removed it", async () => {
    const period = await appendPeriod("OPEN", 31);
    const employee = await createEmployee();

    const set = await editor.rpc("set_reprimand", {
      p_period_id: period.id,
      p_employee_id: employee,
      p_reprimanded: true,
      p_note: "Carta del 3",
    });
    expect(set.error).toBeNull();
    expect(unwrap(await editor.from("reprimands").select("note").eq("employee_id", employee))).toEqual([
      { note: "Carta del 3" },
    ]);

    expect((await editor.rpc("set_reprimand", { p_period_id: period.id, p_employee_id: employee, p_reprimanded: false })).error).toBeNull();
    const rows = unwrap(await service.from("reprimands").select("deleted_at, deleted_by").eq("employee_id", employee));
    expect(rows).toHaveLength(1);
    expect(rows[0].deleted_at).not.toBeNull();
    expect(rows[0].deleted_by).not.toBeNull();
  });

  it("is hidden from the supervisor, who cannot record one either", async () => {
    const period = await appendPeriod("OPEN", 31);
    const employee = await createEmployee();
    await editor.rpc("set_reprimand", { p_period_id: period.id, p_employee_id: employee, p_reprimanded: true });

    expect(unwrap(await supervisor.from("reprimands").select("id").eq("employee_id", employee))).toEqual([]);
    const attempt = await supervisor.rpc("set_reprimand", { p_period_id: period.id, p_employee_id: await createEmployee(), p_reprimanded: true });
    expect(attempt.error?.code).toBe("42501");
  });

  it("refuses a closed period", async () => {
    const period = await appendPeriod("CLOSED", 31);
    const attempt = await editor.rpc("set_reprimand", { p_period_id: period.id, p_employee_id: await createEmployee(), p_reprimanded: true });
    expect(attempt.error?.code).toBe("42501");
  });
});

describe("close_period with the period bonuses", () => {
  it("freezes the terms, writes the settlement rows and stamps each counted day", async () => {
    const { period, day, settlements, stamps } = await periodWithOneDay();

    const closed = await closeWithBonuses(period, settlements, stamps);

    expect(closed.error).toBeNull();
    expect(await stampsOf(day.id)).toEqual({
      production_settled_in_period_id: period.id,
      compliance_settled_in_period_id: period.id,
    });
    const frozen = unwrap(
      await service
        .from("periods")
        .select("status, working_days, production_amount, compliance_amount, strike_deduction, strike_limit")
        .eq("id", period.id)
        .single(),
    );
    expect(frozen).toEqual({ status: "CLOSED", ...termsOf(period) });
    const rows = unwrap(await admin.from("period_bonus_settlements").select("bonus, amount").eq("period_id", period.id));
    expect(rows.map((row) => row.bonus).sort()).toEqual(["COMPLIANCE", "PRODUCTION"]);
  });

  it("refuses a plan that misses a counted day, and writes nothing", async () => {
    const { period, day, settlements, stamps } = await periodWithOneDay();

    const closed = await closeWithBonuses(period, settlements, stamps.slice(1));

    expect(closed.error?.code).toBe("40001");
    expect(await stampsOf(day.id)).toEqual({ production_settled_in_period_id: null, compliance_settled_in_period_id: null });
    expect(unwrap(await service.from("period_bonus_settlements").select("id").eq("period_id", period.id))).toEqual([]);
    expect((await closeWithBonuses(period, settlements, stamps)).error).toBeNull();
  });

  it("refuses a divisor the database does not count the same way", async () => {
    const { period, settlements, stamps } = await periodWithOneDay();
    const wrong = { ...termsOf(period), working_days: termsOf(period).working_days + 1 };

    const closed = await closeWithBonuses(period, settlements, stamps, wrong);

    expect(closed.error?.code).toBe("40001");
    expect((await closeWithBonuses(period, settlements, stamps)).error).toBeNull();
  });

  it("keeps what it froze: terms, stamps and rows", async () => {
    const { period, day, settlements, stamps } = await periodWithOneDay();
    expect((await closeWithBonuses(period, settlements, stamps)).error).toBeNull();

    expect((await service.from("periods").update({ working_days: 1 }).eq("id", period.id)).error).not.toBeNull();
    expect(
      (await service.from("assignments").update({ production_settled_in_period_id: null }).eq("id", day.id)).error,
    ).not.toBeNull();
    expect(
      (await service.from("period_bonus_settlements").update({ amount: 0 }).eq("period_id", period.id)).error,
    ).not.toBeNull();
  });

  it("turns a later change to a day it counted into a review item", async () => {
    const { period, day, settlements, stamps } = await periodWithOneDay();
    expect((await closeWithBonuses(period, settlements, stamps)).error).toBeNull();

    unwrap(await service.from("assignments").update({ late: true }).eq("id", day.id).select("id"));

    const items = unwrap(await editor.from("review_items").select("period_id").eq("assignment_id", day.id));
    expect(items).toEqual([{ period_id: period.id }]);
  });
});

describe("period_bonus_owed_days", () => {
  it("lists a working day entered after its period closed, and not a weekend one", async () => {
    const { period, day, settlements, stamps } = await periodWithOneDay();
    expect((await closeWithBonuses(period, settlements, stamps)).error).toBeNull();
    let saturday = period.startDate;
    while (new Date(`${saturday}T00:00:00Z`).getUTCDay() !== 6) saturday = addDays(saturday, 1);
    const late = await assign(workingDayFrom(addDays(firstWorkingDay(period), 1)), day.position_id, day.employee_id);
    const weekend = await assign(saturday, day.position_id, day.employee_id);

    const owed = unwrap(
      await admin
        .from("period_bonus_owed_days")
        .select("assignment_id, origin_period_id, bonus")
        .in("assignment_id", [day.id, late.id, weekend.id]),
    );

    expect(owed.sort((a, b) => String(a.bonus).localeCompare(String(b.bonus)))).toEqual([
      { assignment_id: late.id, origin_period_id: period.id, bonus: "COMPLIANCE" },
      { assignment_id: late.id, origin_period_id: period.id, bonus: "PRODUCTION" },
    ]);
  });
});

describe("each day counts once per person", () => {
  it("does not owe a counted day again after its cell was cleared and entered anew", async () => {
    const { period, day, settlements, stamps } = await periodWithOneDay();
    expect((await closeWithBonuses(period, settlements, stamps)).error).toBeNull();
    unwrap(await service.from("assignments").update({ deleted_at: new Date().toISOString() }).eq("id", day.id).select("id"));
    const reentered = await assign(firstWorkingDay(period), day.position_id, day.employee_id);

    const owed = unwrap(await admin.from("period_bonus_owed_days").select("assignment_id").eq("assignment_id", reentered.id));

    expect(owed).toEqual([]);
  });

  it("turns a late mark on a closed Saturday into a review item", async () => {
    const { period, day, settlements, stamps } = await periodWithOneDay();
    let saturday = period.startDate;
    while (new Date(`${saturday}T00:00:00Z`).getUTCDay() !== 6) saturday = addDays(saturday, 1);
    const weekend = await assign(saturday, day.position_id, day.employee_id);
    expect((await closeWithBonuses(period, settlements, stamps)).error).toBeNull();

    unwrap(await service.from("assignments").update({ late: true }).eq("id", weekend.id).select("id"));

    const items = unwrap(await editor.from("review_items").select("period_id").eq("assignment_id", weekend.id));
    expect(items).toEqual([{ period_id: period.id }]);
  });
});
