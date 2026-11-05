import { findMismatch, summarizeClockings, type MismatchReason, type StoredClocking } from "@/domain/attendance/mismatch";
import type { IsoDate } from "@/domain/bonus/types";
import { fetchAllRows, orThrow, type ServerSupabase } from "@/utils/supabase/query";
import { normalizeRut } from "@/utils/rut";
import type { Assignment, Employee, Position } from "../day/queries";

/** Gives a cell's mismatch, or null. Never one before Stage 1's date, on a date not read, or without a RUT. */
export type MismatchOf = (date: IsoDate, employee: Employee, assignment: Assignment | null) => MismatchReason | null;

const NO_MISMATCHES: MismatchOf = () => null;

export async function loadMismatchOf(
  supabase: ServerSupabase,
  from: IsoDate,
  to: IsoDate,
  positionsById: ReadonlyMap<string, Pick<Position, "type">>,
): Promise<MismatchOf> {
  const settings = await supabase.from("attendance_settings").select("mismatches_from").is("deleted_at", null).maybeSingle();
  if (settings.error) throw settings.error;
  const start = settings.data?.mismatches_from;
  if (!start || start > to) return NO_MISMATCHES;
  const first = start > from ? start : from;

  const [reads, clockings] = await Promise.all([
    supabase
      .from("attendance_reads")
      .select("read_date")
      .is("deleted_at", null)
      .eq("succeeded", true)
      .gte("read_date", first)
      .lte("read_date", to),
    fetchAllRows((low, high) =>
      supabase
        .from("attendance_clockings")
        .select("id, national_id, clocking_date, workera_type, status")
        .is("deleted_at", null)
        .gte("clocking_date", first)
        .lte("clocking_date", to)
        .order("id")
        .range(low, high),
    ),
  ]);
  const readDates = new Set(orThrow(reads).map((row) => row.read_date));
  const byPersonAndDate: ReadonlyMap<string, StoredClocking[]> = Map.groupBy(
    clockings,
    (row) => `${row.national_id}|${row.clocking_date}`,
  );

  return (date, employee, assignment) => {
    if (!readDates.has(date) || !employee.national_id) return null;
    const type = assignment ? positionsById.get(assignment.position_id)?.type : undefined;
    const cell = !assignment ? "EMPTY" : type === "ABSENCE" ? "ABSENCE" : "WORK";
    const day = summarizeClockings(byPersonAndDate.get(`${normalizeRut(employee.national_id)}|${date}`) ?? []);
    return findMismatch(cell, day);
  };
}
