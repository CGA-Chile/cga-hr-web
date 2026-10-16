import { beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@/utils/chileDate";
import { appendPeriod, createEmployee, createPosition, service, signInAs, uniqueDate, unwrap, type Client } from "./support";

let editor: Client;
let admin: Client;
let supervisor: Client;

beforeAll(async () => {
  [{ client: editor }, { client: admin }, { client: supervisor }] = await Promise.all([
    signInAs("editor"),
    signInAs("admin"),
    signInAs("supervisor"),
  ]);
});

type Day = { position_id: string; note?: string | null; late?: boolean; late_notified?: boolean | null; left_early?: boolean };

/** Three consecutive dates for a new person, so nothing else in the database touches them. */
async function newRange() {
  const first = uniqueDate();
  return { employeeId: await createEmployee(), dates: [first, addDays(first, 1), addDays(first, 2)] };
}

async function arrange(employeeId: string, date: string, day: Day & { settled_in_period_id?: string }) {
  const settled = day.settled_in_period_id ? { settled_amount: 4_000 } : {};
  unwrap(await service.from("assignments").insert({ date, employee_id: employeeId, ...day, ...settled }).select("id"));
}

async function applyRange(client: Client, employeeId: string, dates: string[], positionId: string | null, note?: string) {
  return client.rpc("apply_assignment_range", {
    p_employee_id: employeeId,
    p_dates: dates,
    p_position_id: positionId ?? undefined,
    p_note: note,
  });
}

async function storedDays(employeeId: string) {
  return unwrap(
    await service
      .from("assignments")
      .select("date, position_id, note, late, late_notified, left_early")
      .eq("employee_id", employeeId)
      .is("deleted_at", null)
      .order("date"),
  );
}

describe("assigning one position to a range of dates", () => {
  it("replaces what each date held and fills the empty ones, answering how the changed dates were", async () => {
    const { employeeId, dates } = await newRange();
    const [acm, leave] = [await createPosition(), await createPosition({ absence: true })];
    await arrange(employeeId, dates[0], { position_id: acm, note: "Turno fijo" });
    await arrange(employeeId, dates[1], { position_id: acm });

    const previous = unwrap(await applyRange(editor, employeeId, dates, leave));

    expect((await storedDays(employeeId)).map((day) => day.position_id)).toEqual([leave, leave, leave]);
    expect(previous).toEqual([
      { changed_date: dates[0], previous_position_id: acm, previous_note: "Turno fijo", previous_late: false, previous_late_notified: null, previous_left_early: false },
      { changed_date: dates[1], previous_position_id: acm, previous_note: null, previous_late: false, previous_late_notified: null, previous_left_early: false },
      { changed_date: dates[2], previous_position_id: null, previous_note: null, previous_late: null, previous_late_notified: null, previous_left_early: null },
    ]);
  });

  it("clears the incomplete-day marks of a replaced date, and keeps its note unless a new one is given", async () => {
    const { employeeId, dates } = await newRange();
    const [acm, leave] = [await createPosition(), await createPosition({ absence: true })];
    await arrange(employeeId, dates[0], { position_id: acm, note: "Llegó 9:15", late: true, late_notified: true, left_early: true });
    await arrange(employeeId, dates[1], { position_id: acm, note: "Llegó 9:15", late: true, late_notified: false });

    unwrap(await applyRange(editor, employeeId, [dates[0]], leave));
    unwrap(await applyRange(editor, employeeId, [dates[1]], leave, "Licencia médica"));

    expect(await storedDays(employeeId)).toEqual([
      { date: dates[0], position_id: leave, note: "Llegó 9:15", late: false, late_notified: null, left_early: false },
      { date: dates[1], position_id: leave, note: "Licencia médica", late: false, late_notified: null, left_early: false },
    ]);
  });

  it("leaves a date that already holds the position as it is, marks included", async () => {
    const { employeeId, dates } = await newRange();
    const acm = await createPosition();
    await arrange(employeeId, dates[0], { position_id: acm, late: true, late_notified: true });

    const previous = unwrap(await applyRange(editor, employeeId, [dates[0]], acm));

    expect(previous).toEqual([]);
    expect(await storedDays(employeeId)).toEqual([
      { date: dates[0], position_id: acm, note: null, late: true, late_notified: true, left_early: false },
    ]);
  });

  it("empties the dates that held a position when no position is given", async () => {
    const { employeeId, dates } = await newRange();
    const acm = await createPosition();
    await arrange(employeeId, dates[0], { position_id: acm });

    const previous = unwrap(await applyRange(editor, employeeId, dates, null));

    expect(previous.map((day) => day.changed_date)).toEqual([dates[0]]);
    expect(await storedDays(employeeId)).toEqual([]);
  });

  it("records every changed date in the history, like any other edit", async () => {
    const { employeeId, dates } = await newRange();
    const leave = await createPosition({ absence: true });

    unwrap(await applyRange(editor, employeeId, dates, leave));

    const history = unwrap(
      await service.from("assignment_history").select("date, new_position_id").eq("employee_id", employeeId).order("date"),
    );
    expect(history).toEqual(dates.map((date) => ({ date, new_position_id: leave })));
  });

  it("may be used by the supervisor, who assigns people", async () => {
    const { employeeId, dates } = await newRange();
    const leave = await createPosition({ absence: true });

    unwrap(await applyRange(supervisor, employeeId, dates, leave));

    expect(await storedDays(employeeId)).toHaveLength(3);
  });
});

describe("a paid date inside the range", () => {
  async function rangeWithPaidMiddle() {
    const period = await appendPeriod("CLOSED");
    const { employeeId, dates } = await newRange();
    const [acm, leave] = [await createPosition(), await createPosition({ absence: true })];
    await arrange(employeeId, dates[1], { position_id: acm, settled_in_period_id: period.id });
    return { employeeId, dates, acm, leave };
  }

  it("is skipped for someone who may not change a paid date, and the rest still applies", async () => {
    const { employeeId, dates, acm, leave } = await rangeWithPaidMiddle();

    const previous = unwrap(await applyRange(editor, employeeId, dates, leave));

    expect(previous.map((day) => day.changed_date)).toEqual([dates[0], dates[2]]);
    expect((await storedDays(employeeId)).map((day) => day.position_id)).toEqual([leave, acm, leave]);
  });

  it("is never emptied, not even by the admin: its settlement would be lost and could not be undone", async () => {
    const { employeeId, dates, acm } = await rangeWithPaidMiddle();

    const previous = unwrap(await applyRange(admin, employeeId, dates, null));

    expect(previous).toEqual([]);
    expect((await storedDays(employeeId)).map((day) => day.position_id)).toEqual([acm]);
  });

  it("is replaced by the admin, as a single cell would be", async () => {
    const { employeeId, dates, leave } = await rangeWithPaidMiddle();

    unwrap(await applyRange(admin, employeeId, dates, leave));

    expect((await storedDays(employeeId)).map((day) => day.position_id)).toEqual([leave, leave, leave]);
  });
});

it("refuses a user without a role", async () => {
  const { client: stranger } = await signInAs(null);
  const { employeeId, dates } = await newRange();

  const { error } = await applyRange(stranger, employeeId, dates, await createPosition());

  expect(error).not.toBeNull();
  expect(await storedDays(employeeId)).toEqual([]);
});
