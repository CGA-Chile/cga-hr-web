import { beforeAll, describe, expect, it } from "vitest";
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
} from "./support";

let admin: Client;
let editor: Client;

beforeAll(async () => {
  ({ client: admin } = await signInAs("admin"));
  ({ client: editor } = await signInAs("editor"));
});

async function calendarRow(date: string) {
  return unwrap(await service.from("calendar_dates").select("id, holiday, day_rate").eq("date", date).is("deleted_at", null));
}

async function calendarHistory(date: string) {
  return unwrap(
    await service
      .from("calendar_date_history")
      .select("previous_holiday, new_holiday, previous_day_rate, new_day_rate")
      .eq("date", date)
      .order("changed_at"),
  );
}

async function absencePosition(): Promise<string> {
  const id = await createPosition({ bonusEligible: false });
  unwrap(await service.from("positions").update({ type: "ABSENCE" }).eq("id", id).select("id"));
  return id;
}

async function assign(date: string, positionId: string) {
  return unwrap(
    await service
      .from("assignments")
      .insert({ date, employee_id: await createEmployee(), position_id: positionId })
      .select("id, position_id")
      .single(),
  );
}

describe("set_calendar_date", () => {
  it("lets an editor mark a holiday and set the date's amount, recording each change", async () => {
    const date = uniqueDate();

    expect((await editor.rpc("set_calendar_date", { p_date: date, p_holiday: true })).error).toBeNull();
    expect((await editor.rpc("set_calendar_date", { p_date: date, p_holiday: true, p_day_rate: 30_000 })).error).toBeNull();

    expect(await calendarRow(date)).toMatchObject([{ holiday: true, day_rate: 30_000 }]);
    expect(await calendarHistory(date)).toEqual([
      { previous_holiday: false, new_holiday: true, previous_day_rate: null, new_day_rate: null },
      { previous_holiday: true, new_holiday: true, previous_day_rate: null, new_day_rate: 30_000 },
    ]);
  });

  it("records nothing when the date is set to what it already is", async () => {
    const date = uniqueDate();
    await editor.rpc("set_calendar_date", { p_date: date, p_holiday: true });
    await editor.rpc("set_calendar_date", { p_date: date, p_holiday: true });

    expect(await calendarHistory(date)).toHaveLength(1);
  });

  it("refuses a signed-in user with no role", async () => {
    const { client: stranger } = await signInAs(null);

    expect((await stranger.rpc("set_calendar_date", { p_date: uniqueDate(), p_holiday: true })).error).not.toBeNull();
  });

  it("refuses an amount that is not positive", async () => {
    const result = await editor.rpc("set_calendar_date", { p_date: uniqueDate(), p_holiday: false, p_day_rate: 0 });

    expect(result.error?.code).toBe("23514");
  });

  it("does not let anyone rewrite the history", async () => {
    const date = uniqueDate();
    await editor.rpc("set_calendar_date", { p_date: date, p_holiday: true });

    const rewrite = await service.from("calendar_date_history").update({ new_holiday: false }).eq("date", date);
    expect(rewrite.error).not.toBeNull();
  });
});

describe("close_period on a day-rate date", () => {
  it("must settle every work assignment of the date, not only the line, and never an absence", async () => {
    const period = await appendPeriod("OPEN", 30);
    const date = period.dateInside;
    unwrap(await service.from("calendar_dates").insert({ date, day_rate: 10_000 }).select("id"));
    const line = await assign(date, await createPosition());
    const bodega = await assign(date, await createPosition({ bonusEligible: false }));
    await assign(date, await absencePosition());
    const next = { p_next_name: `Next ${period.endDate}`, p_next_end: addDays(period.endDate, 30) };

    const onlyLine = await admin.rpc("close_period", {
      p_period_id: period.id,
      p_settlements: [{ assignment_id: line.id, position_id: line.position_id, amount: 10_000 }],
      ...next,
    });
    expect(onlyLine.error?.code).toBe("40001");

    const everyone = await admin.rpc("close_period", {
      p_period_id: period.id,
      p_settlements: [line, bodega].map((a) => ({ assignment_id: a.id, position_id: a.position_id, amount: 10_000 })),
      ...next,
    });
    expect(everyone.error).toBeNull();
  });
});

describe("review_history on day-rate dates", () => {
  it("a new non-line assignment on a closed day-rate date is a review item", async () => {
    const period = await appendPeriod("CLOSED", 30);
    unwrap(await service.from("calendar_dates").insert({ date: period.dateInside, day_rate: 10_000 }).select("id"));

    const bodega = unwrap(
      await editor
        .from("assignments")
        .insert({
          date: period.dateInside,
          employee_id: await createEmployee(),
          position_id: await createPosition({ bonusEligible: false }),
        })
        .select("id")
        .single(),
    );

    const items = unwrap(await editor.from("review_items").select("kind, period_id").eq("assignment_id", bodega.id));
    expect(items).toEqual([{ kind: "ASSIGNMENT", period_id: period.id }]);
  });

  it("marking a holiday on a closed date is a review item, and acknowledging it leaves the tray", async () => {
    const period = await appendPeriod("CLOSED", 30);
    const date = addDays(period.dateInside, 1);

    expect((await editor.rpc("set_calendar_date", { p_date: date, p_holiday: true })).error).toBeNull();

    const items = unwrap(
      await editor
        .from("review_items")
        .select("history_id, kind, period_id")
        .eq("date", date)
        .eq("kind", "CALENDAR"),
    );
    expect(items).toMatchObject([{ kind: "CALENDAR", period_id: period.id }]);

    unwrap(
      await editor
        .from("calendar_date_history")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", items[0].history_id ?? "")
        .select("id"),
    );
    expect(unwrap(await editor.from("review_items").select("history_id").eq("date", date).eq("kind", "CALENDAR"))).toEqual([]);
  });

  it("marking a holiday on an open date is not a review item", async () => {
    const date = uniqueDate();
    await editor.rpc("set_calendar_date", { p_date: date, p_holiday: true });

    expect(unwrap(await editor.from("review_items").select("history_id").eq("date", date))).toEqual([]);
  });
});
