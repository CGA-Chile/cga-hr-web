import { beforeAll, describe, expect, it } from "vitest";
import {
  createEmployee,
  createPosition,
  signInAs,
  uniqueDate,
  unwrap,
  type Client,
} from "./support";

let editor: Client;
let editorId: string;

beforeAll(async () => {
  ({ client: editor, userId: editorId } = await signInAs("editor"));
});

async function createAssignment(positionId: string) {
  return unwrap(
    await editor
      .from("assignments")
      .insert({ date: uniqueDate(), employee_id: await createEmployee(), position_id: positionId })
      .select("id")
      .single(),
  );
}

async function historyOf(assignmentId: string) {
  return unwrap(
    await editor
      .from("assignment_history")
      .select("id, previous_position_id, new_position_id, changed_by, acknowledged_at")
      .eq("assignment_id", assignmentId)
      .order("changed_at"),
  );
}

describe("assignment_history is written by trigger, for every movement", () => {
  it("an insert records the new position with no previous one", async () => {
    const positionId = await createPosition();
    const assignment = await createAssignment(positionId);

    expect(await historyOf(assignment.id)).toMatchObject([
      { previous_position_id: null, new_position_id: positionId, changed_by: editorId },
    ]);
  });

  it("a position change records the previous and the new position", async () => {
    const [from, to] = [await createPosition(), await createPosition()];
    const assignment = await createAssignment(from);

    unwrap(await editor.from("assignments").update({ position_id: to }).eq("id", assignment.id).select("id"));

    expect((await historyOf(assignment.id)).at(-1)).toMatchObject({
      previous_position_id: from,
      new_position_id: to,
    });
  });

  it("a soft delete records the previous position with no new one", async () => {
    const positionId = await createPosition();
    const assignment = await createAssignment(positionId);

    unwrap(
      await editor
        .from("assignments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", assignment.id)
        .select("id"),
    );

    expect((await historyOf(assignment.id)).at(-1)).toMatchObject({
      previous_position_id: positionId,
      new_position_id: null,
    });
  });

  it("a write that leaves the position unchanged records nothing", async () => {
    const positionId = await createPosition();
    const assignment = await createAssignment(positionId);

    unwrap(
      await editor
        .from("assignments")
        .update({ position_id: positionId, note: "same position" })
        .eq("id", assignment.id)
        .select("id"),
    );

    expect(await historyOf(assignment.id)).toHaveLength(1);
  });
});

describe("assignment_history is append-only, except for acknowledging", () => {
  it("nobody inserts history by hand", async () => {
    const assignment = await createAssignment(await createPosition());

    const forged = await editor.from("assignment_history").insert({
      assignment_id: assignment.id,
      date: uniqueDate(),
      employee_id: await createEmployee(),
      new_position_id: await createPosition(),
    });

    expect(forged.error?.code).toBe("42501");
  });

  it("an editor can acknowledge a row once, and the acknowledger is recorded", async () => {
    const assignment = await createAssignment(await createPosition());
    const [row] = await historyOf(assignment.id);

    const acknowledged = unwrap(
      await editor
        .from("assignment_history")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", row.id)
        .select("acknowledged_at, acknowledged_by")
        .single(),
    );
    expect(acknowledged.acknowledged_at).not.toBeNull();
    expect(acknowledged.acknowledged_by).toBe(editorId);

    const again = await editor
      .from("assignment_history")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", row.id);
    expect(again.error).not.toBeNull();
  });

  it("acknowledging cannot rewrite what the row says happened", async () => {
    const assignment = await createAssignment(await createPosition());
    const [row] = await historyOf(assignment.id);

    const rewritten = await editor
      .from("assignment_history")
      .update({ acknowledged_at: new Date().toISOString(), new_position_id: await createPosition() })
      .eq("id", row.id);

    expect(rewritten.error).not.toBeNull();
  });
});
