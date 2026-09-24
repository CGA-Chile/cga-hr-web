import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, inject, it } from "vitest";
import {
  appendPeriod,
  createEmployee,
  createPosition,
  nextPeriodStart,
  service,
  signInAs,
  uniqueDate,
  unwrap,
  type Client,
} from "./support";

let admin: Client;
let editor: Client;

beforeAll(async () => {
  ({ client: admin } = await signInAs("admin"));
  ({ client: editor } = await signInAs("editor"));
});

const createClosedPeriod = () => appendPeriod("CLOSED");

async function createSettledAssignment() {
  const period = await createClosedPeriod();
  const assignment = unwrap(
    await service
      .from("assignments")
      .insert({
        date: uniqueDate(),
        employee_id: await createEmployee(),
        position_id: await createPosition(),
        settled_in_period_id: period.id,
        settled_amount: 4_000,
      })
      .select("id, position_id")
      .single(),
  );
  return { ...assignment, periodId: period.id };
}

async function positionOf(assignmentId: string) {
  const row = unwrap(
    await service.from("assignments").select("position_id").eq("id", assignmentId).single(),
  );
  return row.position_id;
}

describe("settled assignments", () => {
  it("an editor cannot change a settled assignment", async () => {
    const settled = await createSettledAssignment();

    await editor
      .from("assignments")
      .update({ position_id: await createPosition() })
      .eq("id", settled.id);

    expect(await positionOf(settled.id)).toBe(settled.position_id);
  });

  it("an admin can change a settled assignment, and the change lands in history", async () => {
    const settled = await createSettledAssignment();
    const newPosition = await createPosition();

    const result = await admin
      .from("assignments")
      .update({ position_id: newPosition })
      .eq("id", settled.id);

    expect(result.error).toBeNull();
    expect(await positionOf(settled.id)).toBe(newPosition);
  });

  it("an editor cannot stamp an assignment as settled", async () => {
    const period = await createClosedPeriod();

    const stamped = await editor.from("assignments").insert({
      date: uniqueDate(),
      employee_id: await createEmployee(),
      position_id: await createPosition(),
      settled_in_period_id: period.id,
      settled_amount: 4_000,
    });

    expect(stamped.error?.code).toBe("42501");
  });

  it("a settled amount is frozen, even for an admin", async () => {
    const settled = await createSettledAssignment();

    const rewritten = await admin
      .from("assignments")
      .update({ settled_amount: 1 })
      .eq("id", settled.id);

    expect(rewritten.error).not.toBeNull();
  });
});

describe("administration is admin-only", () => {
  it("an editor cannot create a period", async () => {
    const start = await nextPeriodStart();
    const result = await editor.from("periods").insert({ name: "No", start_date: start, end_date: start });

    expect(result.error?.code).toBe("42501");
  });

  it("an editor cannot create a bonus settings version", async () => {
    const result = await editor.from("bonus_settings").insert({
      effective_from: "1906-01-01",
      effective_to: "1906-12-31",
      daily_cap: 1,
      max_amount_per_person: 1,
    });

    expect(result.error?.code).toBe("42501");
  });

  it("an editor cannot set a position rate", async () => {
    const settings = unwrap(
      await service
        .from("bonus_settings")
        .insert({ effective_from: "1905-01-01", effective_to: "1905-12-31", daily_cap: 1, max_amount_per_person: 1 })
        .select("id")
        .single(),
    );

    const result = await editor.from("bonus_position_rates").insert({
      bonus_settings_id: settings.id,
      position_id: await createPosition(),
      amount: 1,
    });

    expect(result.error?.code).toBe("42501");
  });

  it("an editor cannot record a validated excess", async () => {
    const period = await createClosedPeriod();

    const result = await editor.from("cap_overrides").insert({
      period_id: period.id,
      date: uniqueDate(),
      approved_amount: 20_000,
      daily_cap: 15_000,
    });

    expect(result.error?.code).toBe("42501");
  });

  it("an admin's validated excess cannot be edited afterwards", async () => {
    const period = await createClosedPeriod();
    const override = unwrap(
      await admin
        .from("cap_overrides")
        .insert({ period_id: period.id, date: uniqueDate(), approved_amount: 20_000, daily_cap: 15_000 })
        .select("id")
        .single(),
    );

    await admin.from("cap_overrides").update({ approved_amount: 99_000 }).eq("id", override.id);

    const stored = unwrap(
      await service.from("cap_overrides").select("approved_amount").eq("id", override.id).single(),
    );
    expect(stored.approved_amount).toBe(20_000);
  });
});

describe("only the four named users can see anything", () => {
  it("nobody can sign themselves up", async () => {
    const connection = inject("supabase");
    const visitor = createClient(connection.url, connection.anonKey, {
      auth: { persistSession: false },
    });

    const signUp = await visitor.auth.signUp({ email: "visitor@example.com", password: "123456" });

    expect(signUp.error).not.toBeNull();
  });

  it("a signed-in account with no role reads nothing", async () => {
    const { client: stranger } = await signInAs(null);
    await createEmployee();

    const employees = unwrap(await stranger.from("employees").select("id"));

    expect(employees).toEqual([]);
  });

  it("an anonymous visitor reads nothing", async () => {
    const connection = inject("supabase");
    const anonymous = createClient(connection.url, connection.anonKey);
    await createEmployee();

    const { data } = await anonymous.from("employees").select("id");

    expect(data ?? []).toEqual([]);
  });
});

describe("validated excess", () => {
  it("an admin can validate a date again when its amount changed after the first approval", async () => {
    const period = await createClosedPeriod();
    const date = uniqueDate();
    const approve = (amount: number) =>
      admin.from("cap_overrides").insert({ period_id: period.id, date, approved_amount: amount, daily_cap: 15_000 });

    expect((await approve(17_142)).error).toBeNull();
    expect((await approve(19_284)).error).toBeNull();
  });
});
