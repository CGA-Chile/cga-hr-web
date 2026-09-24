import type { IsoDate } from "@/domain/bonus/types";
import type { Database } from "@/types/database";
import { monthRange } from "@/utils/chileDate";
import { orThrow, type ServerSupabase } from "@/utils/supabase/query";

type Tables = Database["public"]["Tables"];
export type Employee = Pick<Tables["employees"]["Row"], "id" | "first_name" | "last_name" | "national_id" | "active">;
export type Position = Pick<Tables["positions"]["Row"], "id" | "code" | "name" | "bonus_eligible" | "triggers_equal_share" | "type" | "display_order">;
export type Assignment = Pick<Tables["assignments"]["Row"], "id" | "date" | "employee_id" | "position_id" | "note" | "settled_in_period_id">;

export type DayRow = { employee: Employee; assignment: Assignment | null };

export async function loadPositions(supabase: ServerSupabase): Promise<Position[]> {
  return orThrow(
    await supabase
      .from("positions")
      .select("id, code, name, bonus_eligible, triggers_equal_share, type, display_order")
      .is("deleted_at", null)
      .order("display_order"),
  );
}

/**
 * The grid for one date: every active employee, plus anyone inactive who still has an assignment
 * that day — someone let go mid-month still earned their bonus. Sorted by name.
 */
export async function loadDayRows(supabase: ServerSupabase, date: IsoDate): Promise<DayRow[]> {
  const [employees, assignments] = await Promise.all([
    supabase
      .from("employees")
      .select("id, first_name, last_name, national_id, active")
      .is("deleted_at", null),
    supabase
      .from("assignments")
      .select("id, date, employee_id, position_id, note, settled_in_period_id")
      .eq("date", date)
      .is("deleted_at", null),
  ]);
  const byEmployee = new Map(orThrow(assignments).map((assignment) => [assignment.employee_id, assignment]));

  return orThrow(employees)
    .filter((employee) => employee.active || byEmployee.has(employee.id))
    .sort(compareByName)
    .map((employee) => ({ employee, assignment: byEmployee.get(employee.id) ?? null }));
}

export async function loadEmployeeMonth(
  supabase: ServerSupabase,
  employeeId: string,
  date: IsoDate,
): Promise<{ employee: Employee; assignments: Assignment[] } | null> {
  const { first, last } = monthRange(date);
  const [employee, assignments] = await Promise.all([
    supabase
      .from("employees")
      .select("id, first_name, last_name, national_id, active")
      .eq("id", employeeId)
      .maybeSingle(),
    supabase
      .from("assignments")
      .select("id, date, employee_id, position_id, note, settled_in_period_id")
      .eq("employee_id", employeeId)
      .gte("date", first)
      .lte("date", last)
      .is("deleted_at", null)
      .order("date"),
  ]);
  if (employee.error) throw employee.error;
  if (!employee.data) return null;
  return { employee: employee.data, assignments: orThrow(assignments) };
}

export function fullName(employee: Pick<Employee, "first_name" | "last_name">): string {
  return `${employee.first_name} ${employee.last_name}`;
}

function compareByName(a: Employee, b: Employee): number {
  return fullName(a).localeCompare(fullName(b), "es");
}

export type CellMovement = Pick<
  Tables["assignment_history"]["Row"],
  "id" | "previous_position_id" | "new_position_id" | "changed_at"
> & { changedBy: string | null };

/** Employees whose cell on this date moved more than once: created, then changed or cleared. */
export async function loadModifiedEmployeeIds(supabase: ServerSupabase, date: IsoDate): Promise<Set<string>> {
  const movements = orThrow(
    await supabase.from("assignment_history").select("employee_id").eq("date", date).is("deleted_at", null),
  );
  const counts = new Map<string, number>();
  for (const { employee_id: employeeId } of movements) {
    counts.set(employeeId, (counts.get(employeeId) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([employeeId]) => employeeId));
}

/** Every movement of one cell, oldest first, with the username of whoever made it. */
export async function loadCellHistory(
  supabase: ServerSupabase,
  date: IsoDate,
  employeeId: string,
): Promise<CellMovement[]> {
  const [movements, profiles] = await Promise.all([
    supabase
      .from("assignment_history")
      .select("id, previous_position_id, new_position_id, changed_at, changed_by")
      .eq("date", date)
      .eq("employee_id", employeeId)
      .is("deleted_at", null)
      .order("changed_at"),
    supabase.from("profiles").select("id, username"),
  ]);
  const usernames = new Map(orThrow(profiles).map((profile) => [profile.id, profile.username]));

  return orThrow(movements).map(({ changed_by: changedBy, ...movement }) => ({
    ...movement,
    changedBy: changedBy ? (usernames.get(changedBy) ?? null) : null,
  }));
}
