import { describe, expect, it } from "vitest";
import { createWorkeraClient, splitIntoWindows } from "./client";

const CREDENTIALS = { user: "user@test.local", key: "test-key" };

function respondingWith(routes: Record<string, unknown[]>) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    const path = url.pathname.replace("/apiClient/v1", "");
    const pages = routes[path] ?? [{ totalPages: 1, data: [] }];
    return new Response(JSON.stringify(pages[Number(url.searchParams.get("page")) - 1]), { status: 200 });
  };
  return { fetchImpl, calls };
}

const clocking = (attendanceType: number, attendanceStatus = "Activo") => ({
  employee: { identification: "12.345.678-k", name: "not stored" },
  attendanceDate: "2026-10-26T07:16:43",
  attendanceType,
  attendanceStatus,
  address: "not stored",
});

describe("createWorkeraClient", () => {
  it("reads every page, with only GET and the credential headers", async () => {
    const { fetchImpl, calls } = respondingWith({
      "/attendanceData": [
        { totalPages: 2, data: [clocking(0)] },
        { totalPages: 2, data: [clocking(1)] },
      ],
    });

    const rows = await createWorkeraClient(CREDENTIALS, fetchImpl).readClockings("2026-10-26", "2026-10-26");

    expect(rows.map((row) => row.workera_type)).toEqual([0, 1]);
    expect(calls).toHaveLength(2);
    for (const { init } of calls) {
      expect(init?.method).toBe("GET");
      expect(init?.headers).toEqual({ API_USER: "user@test.local", API_KEY: "test-key" });
    }
  });

  it("keeps only the needed fields and normalises the RUT", async () => {
    const { fetchImpl } = respondingWith({
      "/attendanceData": [{ totalPages: 1, data: [clocking(0)] }],
    });

    const [row] = await createWorkeraClient(CREDENTIALS, fetchImpl).readClockings("2026-10-26", "2026-10-26");

    expect(row).toEqual({
      national_id: "12345678-K",
      clocked_at: "2026-10-26T07:16:43",
      workera_type: 0,
      status: "ACTIVE",
    });
  });

  it.each([
    ["Activo", "ACTIVE"],
    ["ACTIVO", "ACTIVE"],
    ["Inactivo", "INACTIVE"],
    ["MODIFICADO", "MODIFIED"],
  ])("reads the status %s as %s", async (sent, stored) => {
    const { fetchImpl } = respondingWith({
      "/attendanceData": [{ totalPages: 1, data: [clocking(0, sent)] }],
    });

    const [row] = await createWorkeraClient(CREDENTIALS, fetchImpl).readClockings("2026-10-26", "2026-10-26");

    expect(row.status).toBe(stored);
  });

  it("refuses a status it does not know, rather than guessing", async () => {
    const { fetchImpl } = respondingWith({
      "/attendanceData": [{ totalPages: 1, data: [clocking(0, "Otro")] }],
    });

    await expect(
      createWorkeraClient(CREDENTIALS, fetchImpl).readClockings("2026-10-26", "2026-10-26"),
    ).rejects.toThrow();
  });

  it("fails when Workera answers with an error, so the date is not read as empty", async () => {
    const fetchImpl: typeof fetch = async () => new Response("{}", { status: 500 });

    await expect(
      createWorkeraClient(CREDENTIALS, fetchImpl).readClockings("2026-10-26", "2026-10-26"),
    ).rejects.toThrow("Workera answered 500");
  });

  it("asks for schedules per branch and department", async () => {
    const { fetchImpl, calls } = respondingWith({
      "/branchOffice": [{ totalPages: 1, data: [{ code: "B1" }] }],
      "/department": [{ totalPages: 1, data: [{ code: "D1" }, { code: "D2" }] }],
      "/workshift/schedules": [
        {
          totalPages: 1,
          data: [
            {
              employee: { identification: "12.345.678-5" },
              schedules: [{ date: "2026-10-26", start: "2026-10-26T08:00:00", end: "2026-10-26T17:30:00" }],
            },
          ],
        },
      ],
    });

    const rows = await createWorkeraClient(CREDENTIALS, fetchImpl).readSchedules("2026-10-26", "2026-10-26");

    const asked = calls.filter(({ url }) => url.pathname.endsWith("/schedules"));
    expect(asked.map(({ url }) => url.searchParams.get("department"))).toEqual(["D1", "D2"]);
    expect(rows[0]).toEqual({
      national_id: "12345678-5",
      schedule_date: "2026-10-26",
      starts_at: "2026-10-26T08:00:00",
      ends_at: "2026-10-26T17:30:00",
    });
  });
});

describe("readPeople", () => {
  it("makes one person of the same RUT returned for every department", async () => {
    const row = {
      identification: "12.345.678-5",
      name: "ANA",
      secondName: null,
      lastName: "ROJAS",
      secondLastName: "DIAZ",
      employeeStatus: "ACTIVO",
    };
    const { fetchImpl } = respondingWith({
      "/branchOffice": [{ totalPages: 1, data: [{ code: "B1" }] }],
      "/department": [{ totalPages: 1, data: [{ code: "D1" }, { code: "D2" }] }],
      "/employee": [{ totalPages: 1, data: [row] }],
    });

    const people = await createWorkeraClient(CREDENTIALS, fetchImpl).readPeople();

    expect(people).toEqual([{ nationalId: "12345678-5", fullName: "ANA ROJAS DIAZ", active: true }]);
  });
});

describe("splitIntoWindows", () => {
  it("leaves a short range whole", () => {
    expect(splitIntoWindows("2026-10-01", "2026-10-07", 60)).toEqual([{ from: "2026-10-01", to: "2026-10-07" }]);
  });

  it("covers a long range with no gap and no overlap", () => {
    expect(splitIntoWindows("2026-10-01", "2026-10-05", 2)).toEqual([
      { from: "2026-10-01", to: "2026-10-02" },
      { from: "2026-10-03", to: "2026-10-04" },
      { from: "2026-10-05", to: "2026-10-05" },
    ]);
  });
});
