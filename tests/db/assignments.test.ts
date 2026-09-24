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

beforeAll(async () => {
  ({ client: editor } = await signInAs("editor"));
});

describe("one employee, one position, one date", () => {
  it("soft-deleting an assignment frees its (date, employee) for a new one", async () => {
    const [employeeId, positionId, date] = [await createEmployee(), await createPosition(), uniqueDate()];

    const first = unwrap(
      await editor
        .from("assignments")
        .insert({ date, employee_id: employeeId, position_id: positionId })
        .select("id")
        .single(),
    );
    unwrap(
      await editor
        .from("assignments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", first.id)
        .select("id")
        .single(),
    );

    const recreated = await editor
      .from("assignments")
      .insert({ date, employee_id: employeeId, position_id: positionId });

    expect(recreated.error).toBeNull();
  });

  it("two employees on the same position on one date is accepted — the app shows it, it does not refuse it", async () => {
    const [positionId, date] = [await createPosition(), uniqueDate()];

    const result = await editor.from("assignments").insert([
      { date, employee_id: await createEmployee(), position_id: positionId },
      { date, employee_id: await createEmployee(), position_id: positionId },
    ]);

    expect(result.error).toBeNull();
  });

  it("one employee on two positions on one date is rejected, so nobody earns two bonuses in a day", async () => {
    const [employeeId, date] = [await createEmployee(), uniqueDate()];
    unwrap(
      await editor
        .from("assignments")
        .insert({ date, employee_id: employeeId, position_id: await createPosition() })
        .select("id")
        .single(),
    );

    const second = await editor
      .from("assignments")
      .insert({ date, employee_id: employeeId, position_id: await createPosition() });

    expect(second.error?.code).toBe("23505");
  });

  it("updated_at moves on update without the application setting it", async () => {
    const created = unwrap(
      await editor
        .from("assignments")
        .insert({ date: uniqueDate(), employee_id: await createEmployee(), position_id: await createPosition() })
        .select("id, updated_at")
        .single(),
    );

    const updated = unwrap(
      await editor
        .from("assignments")
        .update({ note: "changed" })
        .eq("id", created.id)
        .select("updated_at")
        .single(),
    );

    expect(Date.parse(updated.updated_at)).toBeGreaterThan(Date.parse(created.updated_at));
  });
});
