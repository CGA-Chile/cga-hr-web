import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { appendPeriod, createEmployee, createPosition, service, signInAs, uniqueDate, unwrap, type Client } from "./support";

let supervisor: Client;

beforeAll(async () => {
  ({ client: supervisor } = await signInAs("supervisor"));
});

describe("the supervisor assigns people and never sees an amount", () => {
  it("writes an assignment, late mark included, through the queued operation", async () => {
    const date = uniqueDate();
    const employeeId = await createEmployee();

    const result = await supervisor.rpc("apply_assignment_operation", {
      p_op_id: randomUUID(),
      p_date: date,
      p_employee_id: employeeId,
      p_position_id: await createPosition(),
      p_late: true,
    });

    expect(result.error).toBeNull();
    const stored = unwrap(await service.from("assignments").select("late").eq("date", date).eq("employee_id", employeeId));
    expect(stored).toEqual([{ late: true }]);
  });

  it("reads positions, employees and assignments", async () => {
    for (const table of ["positions", "employees", "assignments"] as const) {
      const rows = unwrap(await supervisor.from(table).select("id").limit(1));
      expect(rows.length).toBe(1);
    }
  });

  it("reads no settings, no rates and no validated excesses", async () => {
    for (const table of ["bonus_settings", "bonus_position_rates", "cap_overrides"] as const) {
      expect(unwrap(await supervisor.from(table).select("id"))).toEqual([]);
    }
  });

  it("cannot move a period's end", async () => {
    const period = await appendPeriod("OPEN", 30);

    const result = await supervisor.rpc("set_period_end", { p_period_id: period.id, p_end_date: period.endDate });

    expect(result.error?.code).toBe("42501");
  });

  it("cannot mark a holiday", async () => {
    const result = await supervisor.rpc("set_calendar_date", { p_date: uniqueDate(), p_holiday: true });

    expect(result.error?.code).toBe("42501");
  });

  it("cannot acknowledge a review item", async () => {
    const date = uniqueDate();
    const employeeId = await createEmployee();
    unwrap(await service.from("assignments").insert({ date, employee_id: employeeId, position_id: await createPosition() }).select("id"));
    const [row] = unwrap(await service.from("assignment_history").select("id").eq("date", date).eq("employee_id", employeeId));

    const updated = unwrap(
      await supervisor
        .from("assignment_history")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", row.id)
        .select("id"),
    );

    expect(updated).toEqual([]);
  });
});
