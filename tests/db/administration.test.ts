import { beforeAll, describe, expect, it } from "vitest";
import { createEmployee, createPosition, service, signInAs, unwrap, type Client } from "./support";

let admin: Client;
let editor: Client;

beforeAll(async () => {
  ({ client: admin } = await signInAs("admin"));
  ({ client: editor } = await signInAs("editor"));
});

describe("employees and positions are admin-only to write", () => {
  it("an editor cannot create an employee", async () => {
    const result = await editor.from("employees").insert({ first_name: "No", last_name: "Permitido" });

    expect(result.error?.code).toBe("42501");
  });

  it("an editor cannot deactivate an employee", async () => {
    const employeeId = await createEmployee();

    await editor.from("employees").update({ active: false }).eq("id", employeeId);

    const stored = unwrap(await service.from("employees").select("active").eq("id", employeeId).single());
    expect(stored.active).toBe(true);
  });

  it("an editor cannot create or change a position", async () => {
    const positionId = await createPosition({ bonusEligible: false });

    const created = await editor
      .from("positions")
      .insert({ code: "EDITOR_POSITION", name: "No", type: "WORK", display_order: 1 });
    await editor.from("positions").update({ bonus_eligible: true }).eq("id", positionId);

    expect(created.error?.code).toBe("42501");
    const stored = unwrap(await service.from("positions").select("bonus_eligible").eq("id", positionId).single());
    expect(stored.bonus_eligible).toBe(false);
  });

  it("an admin can deactivate an employee, who is never deleted", async () => {
    const employeeId = await createEmployee();

    const result = await admin.from("employees").update({ active: false }).eq("id", employeeId);

    expect(result.error).toBeNull();
    const stored = unwrap(await service.from("employees").select("active, deleted_at").eq("id", employeeId).single());
    expect(stored).toEqual({ active: false, deleted_at: null });
  });
});

describe("create_bonus_settings_version", () => {
  async function currentVersion() {
    return unwrap(
      await service
        .from("bonus_settings")
        .select("id, effective_from, effective_to")
        .is("effective_to", null)
        .is("deleted_at", null)
        .single(),
    );
  }

  it("creates the new version with its rates and ends the current one the day before", async () => {
    const previous = await currentVersion();
    const rieter = await createPosition();

    const created = await admin.rpc("create_bonus_settings_version", {
      p_effective_from: "2030-01-01",
      p_daily_cap: 20_000,
      p_max_amount_per_person: 3_000,
      p_rates: [{ position_id: rieter, amount: 6_000 }],
    });

    expect(created.error).toBeNull();
    const ended = unwrap(await service.from("bonus_settings").select("effective_to").eq("id", previous.id).single());
    expect(ended.effective_to).toBe("2029-12-31");
    const current = await currentVersion();
    expect(current.effective_from).toBe("2030-01-01");
    const rates = unwrap(
      await service.from("bonus_position_rates").select("position_id, amount").eq("bonus_settings_id", current.id),
    );
    expect(rates).toEqual([{ position_id: rieter, amount: 6_000 }]);
  });

  it("refuses a version that does not start after the current one", async () => {
    const current = await currentVersion();

    const created = await admin.rpc("create_bonus_settings_version", {
      p_effective_from: current.effective_from,
      p_daily_cap: 1,
      p_max_amount_per_person: 1,
      p_rates: [],
    });

    expect(created.error?.code).toBe("23514");
  });

  it("is admin-only", async () => {
    const created = await editor.rpc("create_bonus_settings_version", {
      p_effective_from: "2099-01-01",
      p_daily_cap: 1,
      p_max_amount_per_person: 1,
      p_rates: [],
    });

    expect(created.error?.code).toBe("42501");
  });
});
