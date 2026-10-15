import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createEmployee, createPosition, service, signInAs, uniqueDate, unwrap, type Client } from "./support";

let editor: Client;

beforeAll(async () => {
  ({ client: editor } = await signInAs("editor"));
});

type Cell = { date: string; employeeId: string };
type Marks = { late?: boolean; lateNotified?: boolean; leftEarly?: boolean };

async function newCell(): Promise<Cell> {
  return { date: uniqueDate(), employeeId: await createEmployee() };
}

async function apply(cell: Cell, positionId: string, marks: Marks = {}) {
  const { error } = await editor.rpc("apply_assignment_operation", {
    p_op_id: randomUUID(),
    p_date: cell.date,
    p_employee_id: cell.employeeId,
    p_position_id: positionId,
    p_late: marks.late,
    p_late_notified: marks.lateNotified,
    p_left_early: marks.leftEarly,
  });
  if (error) throw error;
}

async function stored(cell: Cell) {
  return unwrap(
    await service
      .from("assignments")
      .select("late, late_notified, left_early")
      .eq("date", cell.date)
      .eq("employee_id", cell.employeeId)
      .is("deleted_at", null)
      .single(),
  );
}

describe("the notice on a late arrival", () => {
  it("is recorded with the mark, and cleared with it", async () => {
    const cell = await newCell();
    const rieter = await createPosition();

    await apply(cell, rieter, { late: true, lateNotified: true });
    expect(await stored(cell)).toEqual({ late: true, late_notified: true, left_early: false });

    await apply(cell, rieter, { late: false });
    expect(await stored(cell)).toEqual({ late: false, late_notified: null, left_early: false });
  });

  it("is kept by a write that does not mention it", async () => {
    const cell = await newCell();
    const [rieter, acm] = [await createPosition(), await createPosition()];

    await apply(cell, rieter, { late: true, lateNotified: false });
    await apply(cell, acm);

    expect(await stored(cell)).toEqual({ late: true, late_notified: false, left_early: false });
  });

  it("cannot be stored without the late mark", async () => {
    const rieter = await createPosition();

    const { error } = await service
      .from("assignments")
      .insert({ date: uniqueDate(), employee_id: await createEmployee(), position_id: rieter, late_notified: true });

    expect(error?.code).toBe("23514");
  });
});

describe("leaving early", () => {
  it("is set and cleared independently of lateness, and both can hold on one day", async () => {
    const cell = await newCell();
    const rieter = await createPosition();

    await apply(cell, rieter, { late: true, lateNotified: false });
    await apply(cell, rieter, { leftEarly: true });
    expect(await stored(cell)).toEqual({ late: true, late_notified: false, left_early: true });

    await apply(cell, rieter, { leftEarly: false });
    expect(await stored(cell)).toEqual({ late: true, late_notified: false, left_early: false });
  });

  it("is recorded in the history as a movement of its own", async () => {
    const cell = await newCell();
    const rieter = await createPosition();

    await apply(cell, rieter);
    await apply(cell, rieter, { leftEarly: true });

    const history = unwrap(
      await service
        .from("assignment_history")
        .select("previous_position_id, new_position_id, previous_left_early, new_left_early")
        .eq("date", cell.date)
        .eq("employee_id", cell.employeeId)
        .order("changed_at"),
    );
    expect(history).toEqual([
      { previous_position_id: null, new_position_id: rieter, previous_left_early: null, new_left_early: false },
      { previous_position_id: rieter, new_position_id: rieter, previous_left_early: false, new_left_early: true },
    ]);
  });
});

describe("an absence", () => {
  it("clears both marks: someone who did not come cannot have arrived late or left early", async () => {
    const cell = await newCell();
    const [rieter, falta] = [await createPosition(), await createPosition({ absence: true })];

    await apply(cell, rieter, { late: true, lateNotified: true, leftEarly: true });
    await apply(cell, falta);

    expect(await stored(cell)).toEqual({ late: false, late_notified: null, left_early: false });
  });

  it("refuses the marks even when the write asks for them", async () => {
    const cell = await newCell();
    const falta = await createPosition({ absence: true });

    await apply(cell, falta, { late: true, lateNotified: true, leftEarly: true });

    expect(await stored(cell)).toEqual({ late: false, late_notified: null, left_early: false });
  });
});
