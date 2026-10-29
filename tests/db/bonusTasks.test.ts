import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isWorkingDay } from "@/domain/bonus/dayRate";
import { addDays } from "@/utils/chileDate";
import {
  appendPeriod,
  createEmployee,
  createPosition,
  service,
  signInAs,
  uniqueDate,
  unwrap,
  type Client,
  type TestPeriod,
} from "./support";

let admin: Client;
let editor: Client;
let supervisor: Client;

beforeAll(async () => {
  ({ client: admin } = await signInAs("admin"));
  ({ client: editor } = await signInAs("editor"));
  ({ client: supervisor } = await signInAs("supervisor"));
});

// Every other file closes periods without task settlements, so no task may be left owed.
afterAll(async () => {
  const owed = unwrap(await service.from("bonus_task_owed_days").select("assignment_id"));
  if (owed.length === 0) return;
  await service
    .from("assignments")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", owed.flatMap((day) => (day.assignment_id ? [day.assignment_id] : [])));
});

async function createTask(): Promise<string> {
  return unwrap(await admin.rpc("create_bonus_task", { p_name: `Tarea ${randomUUID().slice(0, 8)}`, p_amount: 3_000 }));
}

async function assign(date: string, positionId: string, bonusTaskId: string | null = null, employeeId?: string) {
  return unwrap(
    await service
      .from("assignments")
      .insert({
        date,
        employee_id: employeeId ?? (await createEmployee()),
        position_id: positionId,
        bonus_task_id: bonusTaskId,
      })
      .select("id, employee_id, position_id, bonus_task_id")
      .single(),
  );
}

async function taskOf(assignmentId: string) {
  return unwrap(await service.from("assignments").select("bonus_task_id").eq("id", assignmentId).single()).bonus_task_id;
}

async function cellTask(date: string, employeeId: string) {
  const row = unwrap(
    await service
      .from("assignments")
      .select("bonus_task_id")
      .eq("date", date)
      .eq("employee_id", employeeId)
      .is("deleted_at", null)
      .single(),
  );
  return row.bonus_task_id;
}

/**
 * A working day inside the period. A weekend would be a day-rate date under any version another
 * file created, and an unsettled paid day left there would block every later close.
 */
function workingDayIn(period: TestPeriod): string {
  let date = period.dateInside;
  while (!isWorkingDay(date, undefined)) date = addDays(date, 1);
  return date;
}

function nextAfter(period: TestPeriod) {
  return { p_next_name: `Next ${period.endDate}`, p_next_end: addDays(period.endDate, 30) };
}

/** Closes with the carding settlements the database expects, at zero, and the given tasks. */
async function closeWith(period: TestPeriod, taskSettlements: { assignment_id: string; bonus_task_id: string; amount: number }[]) {
  const unsettled = unwrap(
    await service
      .from("assignments")
      .select("id, position_id, positions!inner(bonus_eligible)")
      .is("settled_in_period_id", null)
      .is("deleted_at", null)
      .lte("date", period.endDate)
      .eq("positions.bonus_eligible", true),
  );
  return admin.rpc("close_period", {
    ...nextAfter(period),
    p_period_id: period.id,
    p_settlements: unsettled.map((row) => ({ assignment_id: row.id, position_id: row.position_id, amount: 0 })),
    p_task_settlements: taskSettlements,
  });
}

describe("the bonus task catalogue", () => {
  it("lets the admin create a task with its amount in every settings version", async () => {
    const task = await createTask();
    const versions = unwrap(await service.from("bonus_settings").select("id").is("deleted_at", null));
    const rates = unwrap(await service.from("bonus_task_rates").select("amount").eq("bonus_task_id", task));
    expect(rates).toHaveLength(versions.length);
    expect(new Set(rates.map((rate) => rate.amount))).toEqual(new Set(versions.length ? [3_000] : []));
  });

  it("is admin-only to create", async () => {
    const attempt = await editor.rpc("create_bonus_task", { p_name: `Tarea ${randomUUID()}`, p_amount: 1 });
    expect(attempt.error?.code).toBe("42501");
  });

  it("shows the supervisor the task's name and never its amount", async () => {
    const task = await createTask();
    expect(unwrap(await supervisor.from("bonus_tasks").select("id").eq("id", task))).toHaveLength(1);
    expect(unwrap(await supervisor.from("bonus_task_rates").select("id").eq("bonus_task_id", task))).toEqual([]);
  });
});

describe("a task on a cell", () => {
  it("is written, kept by a write about anything else, and cleared on request", async () => {
    const task = await createTask();
    const position = await createPosition({ bonusEligible: false });
    const employee = await createEmployee();
    const date = uniqueDate();
    const write = (extra: object) =>
      editor.rpc("apply_assignment_operation", {
        p_op_id: randomUUID(),
        p_date: date,
        p_employee_id: employee,
        p_position_id: position,
        ...extra,
      });

    expect((await write({ p_bonus_task_id: task })).error).toBeNull();
    expect(await cellTask(date, employee)).toBe(task);

    expect((await write({ p_note: "Llegó el camión" })).error).toBeNull();
    expect(await cellTask(date, employee)).toBe(task);

    expect((await write({ p_clear_bonus_task: true })).error).toBeNull();
    expect(await cellTask(date, employee)).toBeNull();
  });

  it("is cleared by the database when the cell becomes an absence", async () => {
    const task = await createTask();
    const absence = await createPosition({ absence: true });
    const day = await assign(uniqueDate(), await createPosition(), task);

    await service.from("assignments").update({ position_id: absence }).eq("id", day.id);
    expect(await taskOf(day.id)).toBeNull();

    const straightToAbsence = await assign(uniqueDate(), absence, task);
    expect(straightToAbsence.bonus_task_id).toBeNull();
  });

  it("is recorded in the history when it changes", async () => {
    const task = await createTask();
    const day = await assign(uniqueDate(), await createPosition());
    await service.from("assignments").update({ bonus_task_id: task }).eq("id", day.id);

    const history = unwrap(
      await service
        .from("assignment_history")
        .select("previous_bonus_task_id, new_bonus_task_id")
        .eq("assignment_id", day.id)
        .order("changed_at"),
    );
    expect(history.at(-1)).toEqual({ previous_bonus_task_id: null, new_bonus_task_id: task });
  });

  it("goes with a date a range replaces, and the range says which task it held", async () => {
    const task = await createTask();
    const day = await assign(uniqueDate(), await createPosition(), task);

    const changed = unwrap(
      await editor.rpc("apply_assignment_range", {
        p_employee_id: day.employee_id,
        p_dates: [unwrap(await service.from("assignments").select("date").eq("id", day.id).single()).date],
        p_position_id: await createPosition(),
      }),
    );
    expect(changed[0].previous_bonus_task_id).toBe(task);
    expect(await taskOf(day.id)).toBeNull();
  });
});

describe("close_period with bonus tasks", () => {
  it("settles each owed task once, carry-over included, and refuses a plan that misses one", async () => {
    const task = await createTask();
    const position = await createPosition({ bonusEligible: false });
    const earlier = await appendPeriod("CLOSED", 31);
    const period = await appendPeriod("OPEN", 31);
    const carriedOver = await assign(workingDayIn(earlier), position, task);
    const own = await assign(workingDayIn(period), position, task);

    expect((await closeWith(period, [{ assignment_id: own.id, bonus_task_id: task, amount: 3_000 }])).error?.code).toBe("CG001");

    const closed = await closeWith(period, [
      { assignment_id: own.id, bonus_task_id: task, amount: 3_000 },
      { assignment_id: carriedOver.id, bonus_task_id: task, amount: 3_000 },
    ]);
    expect(closed.error).toBeNull();

    const settled = unwrap(
      await service.from("bonus_task_settlements").select("assignment_id, period_id, amount").in("assignment_id", [own.id, carriedOver.id]),
    );
    expect(settled).toHaveLength(2);
    expect(settled.every((row) => row.period_id === period.id && row.amount === 3_000)).toBe(true);
    expect(unwrap(await service.from("bonus_task_owed_days").select("assignment_id").in("assignment_id", [own.id, carriedOver.id]))).toEqual([]);
  });

  it("refuses a plan made before a task changed", async () => {
    const task = await createTask();
    const other = await createTask();
    const period = await appendPeriod("OPEN", 31);
    const day = await assign(workingDayIn(period), await createPosition({ bonusEligible: false }), task);
    await service.from("assignments").update({ bonus_task_id: other }).eq("id", day.id);

    expect((await closeWith(period, [{ assignment_id: day.id, bonus_task_id: task, amount: 3_000 }])).error?.code).toBe("CG001");
    await service.from("assignments").update({ deleted_at: new Date().toISOString() }).eq("id", day.id);
  });

  it("owes a task marked on a day whose carding amount was frozen, with what that day already paid", async () => {
    const task = await createTask();
    const earlier = await appendPeriod("CLOSED", 31);
    const day = await assign(workingDayIn(earlier), await createPosition({ bonusEligible: true }));
    await service.from("assignments").update({ settled_in_period_id: earlier.id, settled_amount: 4_000 }).eq("id", day.id);
    await service.from("assignments").update({ bonus_task_id: task }).eq("id", day.id);

    const owed = unwrap(await service.from("bonus_task_owed_days").select("paid_amount").eq("assignment_id", day.id).single());
    expect(owed.paid_amount).toBe(4_000);

    const review = unwrap(await service.from("review_items").select("history_id").eq("assignment_id", day.id));
    expect(review.length).toBeGreaterThan(0);
  });

  it("is a review item when a task changes on a closed date that pays no carding bonus", async () => {
    const task = await createTask();
    const earlier = await appendPeriod("CLOSED", 31);
    const day = await assign(workingDayIn(earlier), await createPosition({ bonusEligible: false }));
    await service.from("assignments").update({ bonus_task_id: task }).eq("id", day.id);

    const review = unwrap(await service.from("review_items").select("period_id").eq("assignment_id", day.id));
    expect(review).toEqual([{ period_id: earlier.id }]);
  });

  it("hides the settlements from the supervisor", async () => {
    const rows = unwrap(await supervisor.from("bonus_task_settlements").select("id"));
    expect(rows).toEqual([]);
  });
});
