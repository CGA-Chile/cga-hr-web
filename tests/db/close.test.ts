import { beforeAll, describe, expect, it } from "vitest";
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

beforeAll(async () => {
  ({ client: admin } = await signInAs("admin"));
  ({ client: editor } = await signInAs("editor"));
});

type Settlement = { assignment_id: string; position_id: string; amount: number };

/** What the app sends: every unsettled bonus-eligible assignment dated on or before the end. */
async function everythingToSettle(endDate: string): Promise<Settlement[]> {
  const rows = unwrap(
    await service
      .from("assignments")
      .select("id, position_id, positions!inner(bonus_eligible)")
      .is("settled_in_period_id", null)
      .is("deleted_at", null)
      .lte("date", endDate)
      .eq("positions.bonus_eligible", true),
  );
  return rows.map((row) => ({ assignment_id: row.id, position_id: row.position_id, amount: 1_000 }));
}

async function assign(date: string, positionId: string) {
  return unwrap(
    await service
      .from("assignments")
      .insert({ date, employee_id: await createEmployee(), position_id: positionId })
      .select("id")
      .single(),
  );
}

async function assignmentState(id: string) {
  return unwrap(
    await service.from("assignments").select("settled_in_period_id, settled_amount").eq("id", id).single(),
  );
}

/** The period close_period creates after this one: thirty days, named for the test. */
function nextAfter(period: TestPeriod) {
  return { p_next_name: `Next ${period.endDate}`, p_next_end: addDays(period.endDate, 30) };
}

async function periodStatus(id: string) {
  return unwrap(await service.from("periods").select("status, closed_by").eq("id", id).single());
}

describe("close_period", () => {
  it("stamps every unsettled bonus-eligible assignment up to the end, carry-over included, and closes", async () => {
    const earlier = await appendPeriod("CLOSED", 31);
    const late = await assign(earlier.dateInside, await createPosition());
    const period = await appendPeriod("OPEN", 31);
    const inPeriod = await assign(period.dateInside, await createPosition());
    const notEligible = await assign(period.dateInside, await createPosition({ bonusEligible: false }));

    const closed = await admin.rpc("close_period", {
      ...nextAfter(period),
      p_period_id: period.id,
      p_settlements: await everythingToSettle(period.endDate),
    });

    expect(closed.error).toBeNull();
    expect(await assignmentState(inPeriod.id)).toEqual({ settled_in_period_id: period.id, settled_amount: 1_000 });
    expect(await assignmentState(late.id)).toEqual({ settled_in_period_id: period.id, settled_amount: 1_000 });
    expect(await assignmentState(notEligible.id)).toEqual({ settled_in_period_id: null, settled_amount: null });
    expect((await periodStatus(period.id)).status).toBe("CLOSED");
  });

  it("refuses a settlement list that misses an assignment, and stamps nothing", async () => {
    const period = await appendPeriod("OPEN", 31);
    const kept = await assign(period.dateInside, await createPosition());
    await assign(addDays(period.dateInside, 1), await createPosition());
    const incomplete = (await everythingToSettle(period.endDate)).slice(1);

    const closed = await admin.rpc("close_period", { ...nextAfter(period), p_period_id: period.id, p_settlements: incomplete });

    expect(closed.error?.code).toBe("40001");
    expect((await assignmentState(kept.id)).settled_in_period_id).toBeNull();
    expect((await periodStatus(period.id)).status).toBe("OPEN");
    await admin.rpc("close_period", { ...nextAfter(period), p_period_id: period.id, p_settlements: await everythingToSettle(period.endDate) });
  });

  it("refuses a settlement list prepared before an assignment changed position", async () => {
    const period = await appendPeriod("OPEN", 31);
    const moved = await assign(period.dateInside, await createPosition());
    const prepared = await everythingToSettle(period.endDate);
    unwrap(
      await service.from("assignments").update({ position_id: await createPosition() }).eq("id", moved.id).select("id"),
    );

    const closed = await admin.rpc("close_period", { ...nextAfter(period), p_period_id: period.id, p_settlements: prepared });

    expect(closed.error?.code).toBe("40001");
    await admin.rpc("close_period", { ...nextAfter(period), p_period_id: period.id, p_settlements: await everythingToSettle(period.endDate) });
  });

  it("is admin-only", async () => {
    const period = await appendPeriod("OPEN", 31);

    const closed = await editor.rpc("close_period", {
      ...nextAfter(period),
      p_period_id: period.id,
      p_settlements: await everythingToSettle(period.endDate),
    });

    expect(closed.error?.code).toBe("42501");
    await admin.rpc("close_period", { ...nextAfter(period), p_period_id: period.id, p_settlements: await everythingToSettle(period.endDate) });
  });

  it("does not close a period twice", async () => {
    const period = await appendPeriod("CLOSED", 31);

    const closed = await admin.rpc("close_period", { ...nextAfter(period), p_period_id: period.id, p_settlements: [] });

    expect(closed.error).not.toBeNull();
  });
});

describe("the next period", () => {
  it("is created at close, open, starting the day after", async () => {
    const period = await appendPeriod("OPEN", 31);

    const closed = await admin.rpc("close_period", {
      ...nextAfter(period),
      p_period_id: period.id,
      p_settlements: await everythingToSettle(period.endDate),
    });

    expect(closed.error).toBeNull();
    const next = unwrap(
      await service
        .from("periods")
        .select("name, start_date, end_date, status")
        .eq("start_date", addDays(period.endDate, 1))
        .is("deleted_at", null)
        .single(),
    );
    expect(next).toEqual({
      name: `Next ${period.endDate}`,
      start_date: addDays(period.endDate, 1),
      end_date: addDays(period.endDate, 30),
      status: "OPEN",
    });
  });

  it("is not created when a later period already exists", async () => {
    const period = await appendPeriod("OPEN", 31);
    const later = await appendPeriod("OPEN", 31);

    const closed = await admin.rpc("close_period", {
      ...nextAfter(period),
      p_period_id: period.id,
      p_settlements: await everythingToSettle(period.endDate),
    });

    expect(closed.error).toBeNull();
    const atNextStart = unwrap(
      await service.from("periods").select("id").eq("start_date", addDays(period.endDate, 1)).is("deleted_at", null),
    );
    expect(atNextStart.map((row) => row.id)).toEqual([later.id]);
  });
});

describe("set_period_end", () => {
  it("lets an editor move the end of the latest open period, earlier or later", async () => {
    const period = await appendPeriod("OPEN", 31);

    const later = await editor.rpc("set_period_end", { p_period_id: period.id, p_end_date: addDays(period.endDate, 4) });
    expect(later.error).toBeNull();
    const earlier = await editor.rpc("set_period_end", { p_period_id: period.id, p_end_date: addDays(period.endDate, -3) });
    expect(earlier.error).toBeNull();

    const row = unwrap(await service.from("periods").select("start_date, end_date").eq("id", period.id).single());
    expect(row).toEqual({ start_date: period.startDate, end_date: addDays(period.endDate, -3) });
  });

  it("refuses a closed period", async () => {
    const period = await appendPeriod("CLOSED", 31);

    const moved = await editor.rpc("set_period_end", { p_period_id: period.id, p_end_date: addDays(period.endDate, 1) });

    expect(moved.error?.code).toBe("23514");
  });

  it("refuses an open period that another period follows, so no gap or overlap appears", async () => {
    const period = await appendPeriod("OPEN", 31);
    await appendPeriod("OPEN", 31);

    const moved = await editor.rpc("set_period_end", { p_period_id: period.id, p_end_date: addDays(period.endDate, -1) });

    expect(moved.error?.code).toBe("23514");
  });

  it("refuses an end before the start", async () => {
    const period = await appendPeriod("OPEN", 31);

    const moved = await editor.rpc("set_period_end", { p_period_id: period.id, p_end_date: addDays(period.startDate, -1) });

    expect(moved.error?.code).toBe("23514");
  });

  it("refuses a signed-in user with no role", async () => {
    const period = await appendPeriod("OPEN", 31);
    const { client: stranger } = await signInAs(null);

    const moved = await stranger.rpc("set_period_end", { p_period_id: period.id, p_end_date: addDays(period.endDate, 1) });

    expect(moved.error?.code).toBe("42501");
  });

  it("leaves direct updates admin-only: an editor still cannot rename or move a period by hand", async () => {
    const period = await appendPeriod("OPEN", 31);

    await editor.from("periods").update({ name: "Renombrado", end_date: addDays(period.endDate, 1) }).eq("id", period.id);

    const row = unwrap(await service.from("periods").select("name, end_date").eq("id", period.id).single());
    expect(row).toEqual({ name: `Test ${period.startDate}`, end_date: period.endDate });
  });
});
