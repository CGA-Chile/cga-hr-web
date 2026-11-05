import type * as z from "zod";
import type { IsoDate } from "@/domain/bonus/types";
import {
  clockingSchema,
  employeeScheduleSchema,
  organizationUnitSchema,
  pageSchema,
  workeraEmployeeSchema,
} from "@/schemas/workera";
import { addDays, daysInRange } from "@/utils/chileDate";
import type { WorkeraPerson } from "@/domain/attendance/employeeMatch";
import { normalizeRut } from "@/utils/rut";

const BASE_URL = "https://workera.com/apiClient/v1";
/** Workera refuses a schedule query longer than this. */
const SCHEDULE_WINDOW_DAYS = 60;

export type WorkeraCredentials = { user: string; key: string };

export type WorkeraClocking = {
  national_id: string;
  clocked_at: string;
  workera_type: number;
  status: "ACTIVE" | "INACTIVE" | "MODIFIED";
};

export type WorkeraSchedule = {
  national_id: string;
  schedule_date: string;
  starts_at: string;
  ends_at: string;
};

/**
 * Reads Workera. It only ever issues GET: the app does not write to the legal attendance record,
 * and the same key could, since a PUT on an employee erases every field left out of its body.
 */
export function createWorkeraClient(credentials: WorkeraCredentials, fetchImpl: typeof fetch = fetch) {
  async function readAllPages<Schema extends z.ZodType>(
    path: string,
    schema: Schema,
    params: Record<string, string> = {},
  ): Promise<z.output<Schema>[]> {
    const rows: z.output<Schema>[] = [];
    for (let page = 1; ; page++) {
      const query = new URLSearchParams({ ...params, page: String(page) });
      const response = await fetchImpl(`${BASE_URL}${path}?${query}`, {
        method: "GET",
        headers: { API_USER: credentials.user, API_KEY: credentials.key },
      });
      if (!response.ok) throw new Error(`Workera answered ${response.status} on ${path}`);

      const body = pageSchema.parse(await response.json());
      rows.push(...body.data.map((row) => schema.parse(row)));
      if (page >= body.totalPages) return rows;
    }
  }

  async function readClockings(from: IsoDate, to: IsoDate): Promise<WorkeraClocking[]> {
    const rows = await readAllPages("/attendanceData", clockingSchema, { start: from, end: to });
    return rows.map((row) => ({
      national_id: normalizeRut(row.employee.identification),
      clocked_at: row.attendanceDate,
      workera_type: row.attendanceType,
      status: row.attendanceStatus,
    }));
  }

  /** Some reads need a branch and a department, so every pair of them is asked for. */
  async function organizationPairs(): Promise<{ branch: string; department: string }[]> {
    const branches = await readAllPages("/branchOffice", organizationUnitSchema);
    const departments = await readAllPages("/department", organizationUnitSchema);
    return branches.flatMap((branch) => departments.map((department) => ({ branch: branch.code, department: department.code })));
  }

  async function readSchedules(from: IsoDate, to: IsoDate): Promise<WorkeraSchedule[]> {
    const pairs = await organizationPairs();
    const schedules: WorkeraSchedule[] = [];
    for (const window of splitIntoWindows(from, to, SCHEDULE_WINDOW_DAYS)) {
      for (const { branch, department } of pairs) {
        const rows = await readAllPages("/workshift/schedules", employeeScheduleSchema, {
          start: window.from,
          end: window.to,
          branchOffice: branch,
          department,
        });
        schedules.push(...rows.flatMap(toSchedules));
      }
    }
    return schedules;
  }

  /**
   * Everyone in Workera, active or not. The department filter is required and yet ignored, so the
   * same people come back for every pair; the RUT makes them one.
   */
  async function readPeople(): Promise<WorkeraPerson[]> {
    const people = new Map<string, WorkeraPerson>();
    for (const { branch, department } of await organizationPairs()) {
      const rows = await readAllPages("/employee", workeraEmployeeSchema, { branchOffice: branch, department });
      for (const row of rows) {
        const nationalId = normalizeRut(row.identification);
        people.set(nationalId, {
          nationalId,
          fullName: [row.name, row.secondName, row.lastName, row.secondLastName].filter(Boolean).join(" "),
          active: row.employeeStatus.toUpperCase() === "ACTIVO",
        });
      }
    }
    return [...people.values()];
  }

  return { readClockings, readSchedules, readPeople };
}

export type WorkeraClient = ReturnType<typeof createWorkeraClient>;

function toSchedules(row: z.output<typeof employeeScheduleSchema>): WorkeraSchedule[] {
  return row.schedules.map((schedule) => ({
    national_id: normalizeRut(row.employee.identification),
    schedule_date: schedule.date,
    starts_at: schedule.start,
    ends_at: schedule.end,
  }));
}

export function splitIntoWindows(
  from: IsoDate,
  to: IsoDate,
  size: number,
): { from: IsoDate; to: IsoDate }[] {
  const windows: { from: IsoDate; to: IsoDate }[] = [];
  for (let start = from; start <= to; start = addDays(start, size)) {
    const end = addDays(start, size - 1);
    windows.push({ from: start, to: daysInRange(end, to) > 0 ? end : to });
  }
  return windows;
}
