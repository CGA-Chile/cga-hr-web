import { matchEmployees, type EmployeeMatching } from "@/domain/attendance/employeeMatch";
import { createWorkeraClient } from "@/utils/workera/client";
import { workeraCredentials } from "@/utils/workera/env";
import type { AdminEmployee } from "./queries";

/** The app's active employees against Workera's people, or null when Workera cannot be read. */
export async function loadEmployeeMatching(employees: readonly AdminEmployee[]): Promise<EmployeeMatching | null> {
  try {
    const people = await createWorkeraClient(workeraCredentials()).readPeople();
    const active = employees
      .filter((employee) => employee.active)
      .map((employee) => ({
        id: employee.id,
        firstName: employee.first_name,
        lastName: employee.last_name,
        nationalId: employee.national_id,
      }));
    return matchEmployees(active, people);
  } catch {
    return null;
  }
}
