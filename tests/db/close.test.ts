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

    const closed = await admin.rpc("close_period", { p_period_id: period.id, p_settlements: incomplete });

    expect(closed.error?.code).toBe("40001");
    expect((await assignmentState(kept.id)).settled_in_period_id).toBeNull();
    expect((await periodStatus(period.id)).status).toBe("OPEN");
    await admin.rpc("close_period", { p_period_id: period.id, p_settlements: await everythingToSettle(period.endDate) });
  });

  it("refuses a settlement list prepared before an assignment changed position", async () => {
    const period = await appendPeriod("OPEN", 31);
    const moved = await assign(period.dateInside, await createPosition());
    const prepared = await everythingToSettle(period.endDate);
    unwrap(
      await service.from("assignments").update({ position_id: await createPosition() }).eq("id", moved.id).select("id"),
    );

    const closed = await admin.rpc("close_period", { p_period_id: period.id, p_settlements: prepared });

    expect(closed.error?.code).toBe("40001");
    await admin.rpc("close_period", { p_period_id: period.id, p_settlements: await everythingToSettle(period.endDate) });
  });

  it("is admin-only", async () => {
    const period = await appendPeriod("OPEN", 31);

    const closed = await editor.rpc("close_period", {
      p_period_id: period.id,
      p_settlements: await everythingToSettle(period.endDate),
    });

    expect(closed.error?.code).toBe("42501");
    await admin.rpc("close_period", { p_period_id: period.id, p_settlements: await everythingToSettle(period.endDate) });
  });

  it("does not close a period twice", async () => {
    const period = await appendPeriod("CLOSED", 31);

    const closed = await admin.rpc("close_period", { p_period_id: period.id, p_settlements: [] });

    expect(closed.error).not.toBeNull();
  });
});
