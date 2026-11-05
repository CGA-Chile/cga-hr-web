import { beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@/utils/chileDate";
import { service, signInAs, uniqueDate, unwrap, type Client } from "./support";

let admin: Client;
let editor: Client;
let supervisor: Client;
let noRole: Client;

beforeAll(async () => {
  ({ client: admin } = await signInAs("admin"));
  ({ client: editor } = await signInAs("editor"));
  ({ client: supervisor } = await signInAs("supervisor"));
  ({ client: noRole } = await signInAs(null));
});

const RUT = "12345678-5";

function clocking(date: string, time = "07:15:00", status = "ACTIVE") {
  return { national_id: RUT, clocked_at: `${date}T${time}`, workera_type: 0, status };
}

function schedule(date: string) {
  return { national_id: RUT, schedule_date: date, starts_at: `${date}T08:00:00`, ends_at: `${date}T17:30:00` };
}

function record(client: Client, from: string, to: string, clockings: object[], schedules: object[] = []) {
  return client.rpc("record_attendance_read", {
    p_from: from,
    p_to: to,
    p_clockings: clockings as never,
    p_schedules: schedules as never,
  });
}

function fail(client: Client, date: string) {
  return client.rpc("record_attendance_read_failure", {
    p_from: date,
    p_to: date,
    p_failure: "Workera answered 500",
  });
}

function ok(result: { error: unknown }): void {
  if (result.error) throw result.error;
}

async function clockingsOn(date: string) {
  return unwrap(
    await service
      .from("attendance_clockings")
      .select("clocked_at, status")
      .eq("clocking_date", date)
      .is("deleted_at", null),
  );
}

async function readOf(date: string) {
  return unwrap(await service.from("attendance_reads").select("succeeded, failure").eq("read_date", date).single());
}

describe("record_attendance_read", () => {
  it("stores what was read and marks the date as read", async () => {
    const date = uniqueDate();
    ok(await record(service, date, date, [clocking(date)], [schedule(date)]));

    expect(await clockingsOn(date)).toHaveLength(1);
    const schedules = unwrap(await service.from("attendance_schedules").select("id").eq("schedule_date", date));
    expect(schedules).toHaveLength(1);
    expect(await readOf(date)).toEqual({ succeeded: true, failure: null });
  });

  it("marks a date with no clockings as read, unlike a date never read", async () => {
    const date = uniqueDate();
    const never = uniqueDate();
    ok(await record(service, date, date, []));

    expect(await readOf(date)).toEqual({ succeeded: true, failure: null });
    expect(unwrap(await service.from("attendance_reads").select("id").eq("read_date", never))).toHaveLength(0);
  });

  it("drops a clocking removed in Workera, keeping the row soft-deleted", async () => {
    const date = uniqueDate();
    ok(await record(service, date, date, [clocking(date), clocking(date, "17:30:00")]));
    ok(await record(service, date, date, [clocking(date)]));

    expect(await clockingsOn(date)).toHaveLength(1);
    const all = unwrap(await service.from("attendance_clockings").select("id").eq("clocking_date", date));
    expect(all).toHaveLength(2);
  });

  it("picks up a status changed in Workera without adding a row", async () => {
    const date = uniqueDate();
    ok(await record(service, date, date, [clocking(date)]));
    ok(await record(service, date, date, [clocking(date, "07:15:00", "INACTIVE")]));

    expect((await clockingsOn(date)).map((row) => row.status)).toEqual(["INACTIVE"]);
  });

  it("does not touch dates outside the range", async () => {
    const date = uniqueDate();
    const next = addDays(date, 1);
    ok(await record(service, date, next, [clocking(date), clocking(next)]));
    ok(await record(service, date, date, []));

    expect(await clockingsOn(next)).toHaveLength(1);
  });

  it("accepts the same clocking twice in one read", async () => {
    const date = uniqueDate();
    ok(await record(service, date, date, [clocking(date), clocking(date)]));

    expect(await clockingsOn(date)).toHaveLength(1);
  });

  it("refuses a clocking outside the range", async () => {
    const date = uniqueDate();
    const { error } = await record(service, date, date, [clocking(addDays(date, 1))]);

    expect(error?.code).toBe("22023");
  });

  it("lets an admin record, and no other role", async () => {
    const date = uniqueDate();
    expect((await record(admin, date, date, [])).error).toBeNull();
    expect((await record(editor, date, date, [])).error?.code).toBe("42501");
    expect((await record(supervisor, date, date, [])).error?.code).toBe("42501");
    expect((await record(noRole, date, date, [])).error?.code).toBe("42501");
  });
});

describe("record_attendance_read_failure", () => {
  it("marks an unread date as failed", async () => {
    const date = uniqueDate();
    ok(await fail(service, date));

    expect(await readOf(date)).toEqual({ succeeded: false, failure: "Workera answered 500" });
  });

  it("leaves a date already read as read, with its clockings", async () => {
    const date = uniqueDate();
    ok(await record(service, date, date, [clocking(date)]));
    ok(await fail(service, date));

    expect((await readOf(date)).succeeded).toBe(true);
    expect(await clockingsOn(date)).toHaveLength(1);
  });

  it("lets a later good read clear a failure", async () => {
    const date = uniqueDate();
    ok(await fail(service, date));
    ok(await record(service, date, date, []));

    expect(await readOf(date)).toEqual({ succeeded: true, failure: null });
  });

  it("is refused to anyone but an admin", async () => {
    expect((await fail(editor, uniqueDate())).error?.code).toBe("42501");
  });
});

describe("reading what was stored", () => {
  it("lets every member read, and nobody without a role", async () => {
    const date = uniqueDate();
    ok(await record(service, date, date, [clocking(date)], [schedule(date)]));

    for (const client of [admin, editor, supervisor]) {
      const rows = unwrap(await client.from("attendance_clockings").select("id").eq("clocking_date", date));
      expect(rows).toHaveLength(1);
    }
    const hidden = unwrap(await noRole.from("attendance_clockings").select("id").eq("clocking_date", date));
    expect(hidden).toHaveLength(0);
  });

  it("lets no member write directly", async () => {
    const { error } = await admin
      .from("attendance_clockings")
      .insert({ national_id: RUT, clocked_at: "2026-01-01T07:00:00", workera_type: 0, status: "ACTIVE" });

    expect(error).not.toBeNull();
  });
});
