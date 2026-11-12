import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@/utils/chileDate";
import { appendPeriod, createPosition, service, signInAs, unwrap, uniqueDate, type Client } from "./support";

let editor: Client;
let workPosition: string;

beforeAll(async () => {
  ({ client: editor } = await signInAs("editor"));
  workPosition = await createPosition({ bonusEligible: true });
});

// Stage 2 lives in one global row; reset it so other files see it off.
afterAll(async () => {
  await setStage(null, 0);
});

const BEFORE_ALL_DATES = "2999-01-01";

function ok(result: { error: unknown }): void {
  if (result.error) throw result.error;
}

async function makeEmployee(): Promise<{ id: string; rut: string }> {
  const suffix = randomUUID().slice(0, 8);
  const rut = `${suffix}-0`;
  const row = unwrap(
    await service.from("employees").insert({ first_name: "Test", last_name: suffix, national_id: rut }).select("id").single(),
  );
  return { id: row.id, rut };
}

async function setStage(appliesFrom: string | null, toleranceMinutes: number): Promise<void> {
  unwrap(
    await service
      .from("attendance_settings")
      .update({ applies_from: appliesFrom, tolerance_minutes: toleranceMinutes })
      .not("id", "is", null)
      .select("id"),
  );
}

type Clocking = { national_id: string; clocked_at: string; workera_type: number; status: string };

/** Stores a day's clockings and schedule the way a Workera read would, through its own RPC. */
async function store(rut: string, date: string, options: { entry?: string; exit?: string; schedule?: boolean }): Promise<void> {
  const clockings: Clocking[] = [];
  if (options.entry) clockings.push({ national_id: rut, clocked_at: `${date}T${options.entry}`, workera_type: 0, status: "ACTIVE" });
  if (options.exit) clockings.push({ national_id: rut, clocked_at: `${date}T${options.exit}`, workera_type: 1, status: "ACTIVE" });
  const schedules =
    options.schedule === false ? [] : [{ national_id: rut, schedule_date: date, starts_at: `${date}T08:00:00`, ends_at: `${date}T17:30:00` }];
  ok(
    await service.rpc("record_attendance_read", {
      p_from: date,
      p_to: date,
      p_clockings: clockings as never,
      p_schedules: schedules as never,
    }),
  );
}

function recompute(from: string, to: string) {
  return service.rpc("recompute_attendance_marks", { p_from: from, p_to: to });
}

function assign(client: Client, date: string, employeeId: string, extra: Record<string, unknown> = {}) {
  return client.rpc("apply_assignment_operation", {
    p_op_id: randomUUID(),
    p_date: date,
    p_employee_id: employeeId,
    p_position_id: workPosition,
    ...extra,
  });
}

async function marksOf(employeeId: string, date: string) {
  return unwrap(
    await service
      .from("assignments")
      .select("id, late, left_early, late_notified")
      .eq("employee_id", employeeId)
      .eq("date", date)
      .is("deleted_at", null)
      .single(),
  );
}

async function historyOf(assignmentId: string) {
  return unwrap(
    await service
      .from("assignment_history")
      .select("source, previous_late, new_late, changed_at")
      .eq("assignment_id", assignmentId)
      .order("changed_at"),
  );
}

describe("marks derived at assignment time", () => {
  it("writes a late read from Workera on a work day the stage covers", async () => {
    const date = uniqueDate();
    const { id, rut } = await makeEmployee();
    await setStage(BEFORE_ALL_DATES, 0);
    await store(rut, date, { entry: "08:10:00", exit: "17:30:00" });

    expect((await assign(editor, date, id)).error).toBeNull();

    const marks = await marksOf(id, date);
    expect(marks.late).toBe(true);
    expect(marks.left_early).toBe(false);
  });

  it("writes a left-early, and no late, when the exit is before the end", async () => {
    const date = uniqueDate();
    const { id, rut } = await makeEmployee();
    await setStage(BEFORE_ALL_DATES, 0);
    await store(rut, date, { entry: "08:00:00", exit: "16:00:00" });

    await assign(editor, date, id);

    const marks = await marksOf(id, date);
    expect(marks).toMatchObject({ late: false, left_early: true });
  });

  it("marks nothing when the clocking is incomplete or the day has no schedule", async () => {
    const incomplete = uniqueDate();
    const noShift = uniqueDate();
    const employee = await makeEmployee();
    await setStage(BEFORE_ALL_DATES, 0);
    await store(employee.rut, incomplete, { entry: "09:00:00" }); // no exit
    await store(employee.rut, noShift, { entry: "09:00:00", exit: "16:00:00", schedule: false });

    await assign(editor, incomplete, employee.id);
    await assign(editor, noShift, employee.id);

    expect(await marksOf(employee.id, incomplete)).toMatchObject({ late: false, left_early: false });
    expect(await marksOf(employee.id, noShift)).toMatchObject({ late: false, left_early: false });
  });

  it("ignores the client's marks on a stage day: Workera decides", async () => {
    const date = uniqueDate();
    const { id, rut } = await makeEmployee();
    await setStage(BEFORE_ALL_DATES, 0);
    await store(rut, date, { entry: "08:00:00", exit: "17:30:00" }); // on time

    await assign(editor, date, id, { p_late: true, p_left_early: true });

    expect(await marksOf(id, date)).toMatchObject({ late: false, left_early: false });
  });

  it("keeps the manual marks on a day before the stage", async () => {
    const date = uniqueDate();
    const { id, rut } = await makeEmployee();
    await setStage(addDays(date, 1), 0); // the stage starts after this date
    await store(rut, date, { entry: "08:00:00", exit: "17:30:00" }); // on time in Workera

    await assign(editor, date, id, { p_late: true, p_late_notified: true });

    expect(await marksOf(id, date)).toMatchObject({ late: true, late_notified: true });
  });
});

describe("recompute_attendance_marks", () => {
  it("moves a mark on its own and records the system as its author", async () => {
    const date = uniqueDate();
    const { id, rut } = await makeEmployee();
    await setStage(BEFORE_ALL_DATES, 0);
    await assign(editor, date, id); // no clocking yet: a full day, written by the editor

    const before = await marksOf(id, date);
    expect(before.late).toBe(false);

    await store(rut, date, { entry: "08:20:00", exit: "17:30:00" }); // the read now shows a late
    ok(await recompute(date, date));

    expect((await marksOf(id, date)).late).toBe(true);
    const history = await historyOf(before.id);
    expect(history.map((row) => row.source)).toEqual(["MANUAL", "WORKERA"]);
    expect(history.at(-1)).toMatchObject({ previous_late: false, new_late: true });
  });

  it("re-prices the late when the tolerance changes", async () => {
    const date = uniqueDate();
    const { id, rut } = await makeEmployee();
    await setStage(BEFORE_ALL_DATES, 0);
    await store(rut, date, { entry: "08:05:00", exit: "17:30:00" }); // five minutes late
    await assign(editor, date, id);
    expect((await marksOf(id, date)).late).toBe(true);

    await setStage(BEFORE_ALL_DATES, 5); // forgive up to five minutes
    ok(await recompute(date, date));
    expect((await marksOf(id, date)).late).toBe(false);

    await setStage(BEFORE_ALL_DATES, 4);
    ok(await recompute(date, date));
    expect((await marksOf(id, date)).late).toBe(true);
  });

  it("leaves a settled day untouched", async () => {
    const period = await appendPeriod("CLOSED");
    const date = uniqueDate();
    const { id, rut } = await makeEmployee();
    // A settled assignment: its marks are frozen, so recompute must not move them.
    unwrap(
      await service
        .from("assignments")
        .insert({
          employee_id: id,
          date,
          position_id: workPosition,
          late: false,
          left_early: false,
          settled_in_period_id: period.id,
          settled_amount: 4000,
        })
        .select("id")
        .single(),
    );
    await setStage(BEFORE_ALL_DATES, 0);
    await store(rut, date, { entry: "09:30:00", exit: "17:30:00" }); // plainly late

    ok(await recompute(date, date));

    expect((await marksOf(id, date)).late).toBe(false);
  });
});
