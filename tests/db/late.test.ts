import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { appendPeriod, createEmployee, createPosition, service, signInAs, uniqueDate, unwrap, type Client } from "./support";

let editor: Client;

beforeAll(async () => {
  ({ client: editor } = await signInAs("editor"));
});

type Cell = { date: string; employeeId: string };

async function newCell(date: string = uniqueDate()): Promise<Cell> {
  return { date, employeeId: await createEmployee() };
}

function apply(cell: Cell, positionId: string, late?: boolean) {
  return editor.rpc("apply_assignment_operation", {
    p_op_id: randomUUID(),
    p_date: cell.date,
    p_employee_id: cell.employeeId,
    p_position_id: positionId,
    p_late: late,
  });
}

async function stored(cell: Cell) {
  return unwrap(
    await service
      .from("assignments")
      .select("position_id, late")
      .eq("date", cell.date)
      .eq("employee_id", cell.employeeId)
      .is("deleted_at", null)
      .single(),
  );
}

async function history(cell: Cell) {
  return unwrap(
    await service
      .from("assignment_history")
      .select("previous_position_id, new_position_id, previous_late, new_late")
      .eq("date", cell.date)
      .eq("employee_id", cell.employeeId)
      .order("changed_at"),
  );
}

describe("the late mark through apply_assignment_operation", () => {
  it("is set and cleared by the write, and each change is recorded in the history", async () => {
    const cell = await newCell();
    const rieter = await createPosition();

    await apply(cell, rieter);
    await apply(cell, rieter, true);
    expect(await stored(cell)).toEqual({ position_id: rieter, late: true });
    await apply(cell, rieter, false);

    expect(await history(cell)).toEqual([
      { previous_position_id: null, new_position_id: rieter, previous_late: null, new_late: false },
      { previous_position_id: rieter, new_position_id: rieter, previous_late: false, new_late: true },
      { previous_position_id: rieter, new_position_id: rieter, previous_late: true, new_late: false },
    ]);
  });

  it("is kept by a write that does not mention it, such as a position change", async () => {
    const cell = await newCell();
    const [rieter, acm] = [await createPosition(), await createPosition()];

    await apply(cell, rieter, true);
    await apply(cell, acm);

    expect(await stored(cell)).toEqual({ position_id: acm, late: true });
  });

  it("cannot be changed by an editor on a settled assignment", async () => {
    const period = await appendPeriod("CLOSED");
    const cell = await newCell(period.dateInside);
    const rieter = await createPosition();
    unwrap(
      await service
        .from("assignments")
        .insert({
          date: cell.date,
          employee_id: cell.employeeId,
          position_id: rieter,
          settled_in_period_id: period.id,
          settled_amount: 4_000,
        })
        .select("id"),
    );

    const result = await apply(cell, rieter, true);

    expect(result.error?.code).toBe("42501");
    expect(await stored(cell)).toEqual({ position_id: rieter, late: false });
  });

  it("marked on a settled assignment by the admin is a review item", async () => {
    const { client: admin } = await signInAs("admin");
    const period = await appendPeriod("CLOSED");
    const rieter = await createPosition();
    const settled = unwrap(
      await service
        .from("assignments")
        .insert({
          date: period.dateInside,
          employee_id: await createEmployee(),
          position_id: rieter,
          settled_in_period_id: period.id,
          settled_amount: 4_000,
        })
        .select("id")
        .single(),
    );

    unwrap(await admin.from("assignments").update({ late: true }).eq("id", settled.id).select("id"));

    const items = unwrap(
      await admin.from("review_items").select("previous_position_id, new_position_id").eq("assignment_id", settled.id),
    );
    expect(items).toContainEqual({ previous_position_id: rieter, new_position_id: rieter });
  });
});
