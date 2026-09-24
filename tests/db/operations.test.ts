import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createEmployee,
  createPosition,
  service,
  signInAs,
  uniqueDate,
  unwrap,
  type Client,
} from "./support";

let editor: Client;

beforeAll(async () => {
  ({ client: editor } = await signInAs("editor"));
});

type Cell = { date: string; employeeId: string };

async function newCell(): Promise<Cell> {
  return { date: uniqueDate(), employeeId: await createEmployee() };
}

function apply(cell: Cell, positionId: string | null, opId: string = randomUUID()) {
  return editor.rpc("apply_assignment_operation", {
    p_op_id: opId,
    p_date: cell.date,
    p_employee_id: cell.employeeId,
    p_position_id: positionId ?? undefined,
  });
}

async function liveAssignments(cell: Cell) {
  return unwrap(
    await service
      .from("assignments")
      .select("id, position_id")
      .eq("date", cell.date)
      .eq("employee_id", cell.employeeId)
      .is("deleted_at", null),
  );
}

async function historyCount(cell: Cell) {
  const rows = unwrap(
    await service
      .from("assignment_history")
      .select("id")
      .eq("date", cell.date)
      .eq("employee_id", cell.employeeId),
  );
  return rows.length;
}

describe("apply_assignment_operation is idempotent on op_id", () => {
  it("replaying the same op_id is a no-op that succeeds — no error, no double write", async () => {
    const cell = await newCell();
    const [first, second] = [await createPosition(), await createPosition()];
    const opId = randomUUID();
    expect((await apply(cell, first, opId)).error).toBeNull();

    const replay = await apply(cell, second, opId);

    expect(replay.error).toBeNull();
    expect(await liveAssignments(cell)).toMatchObject([{ position_id: first }]);
    expect(await historyCount(cell)).toBe(1);
  });

  it("two devices sending the same value is a silent no-op: nothing is recorded twice", async () => {
    const cell = await newCell();
    const positionId = await createPosition();

    await apply(cell, positionId);
    await apply(cell, positionId);

    expect(await historyCount(cell)).toBe(1);
  });

  it("two devices sending different values: the last one wins and both are in history", async () => {
    const cell = await newCell();
    const [first, last] = [await createPosition(), await createPosition()];

    await apply(cell, first);
    await apply(cell, last);

    expect(await liveAssignments(cell)).toMatchObject([{ position_id: last }]);
    expect(await historyCount(cell)).toBe(2);
  });

  it("a null position clears the cell with a soft delete", async () => {
    const cell = await newCell();
    await apply(cell, await createPosition());

    expect((await apply(cell, null)).error).toBeNull();

    expect(await liveAssignments(cell)).toEqual([]);
    expect(await historyCount(cell)).toBe(2);
  });
});
