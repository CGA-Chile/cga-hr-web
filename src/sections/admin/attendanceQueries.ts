import type { IsoDate } from "@/domain/bonus/types";
import { orThrow, type ServerSupabase } from "@/utils/supabase/query";

export type AttendanceStatus = {
  mismatchesFrom: IsoDate | null;
  appliesFrom: IsoDate | null;
  toleranceMinutes: number;
  lastReadAt: string | null;
  lastReadDate: IsoDate | null;
  failedDates: IsoDate[];
};

export async function loadAttendanceStatus(supabase: ServerSupabase): Promise<AttendanceStatus> {
  const [settings, latest, failed] = await Promise.all([
    supabase
      .from("attendance_settings")
      .select("mismatches_from, applies_from, tolerance_minutes")
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("attendance_reads")
      .select("read_at, read_date")
      .is("deleted_at", null)
      .eq("succeeded", true)
      .order("read_date", { ascending: false })
      .limit(1),
    supabase
      .from("attendance_reads")
      .select("read_date")
      .is("deleted_at", null)
      .eq("succeeded", false)
      .order("read_date"),
  ]);
  if (settings.error) throw settings.error;
  const last = orThrow(latest)[0];

  return {
    mismatchesFrom: settings.data?.mismatches_from ?? null,
    appliesFrom: settings.data?.applies_from ?? null,
    toleranceMinutes: settings.data?.tolerance_minutes ?? 0,
    lastReadAt: last?.read_at ?? null,
    lastReadDate: last?.read_date ?? null,
    failedDates: orThrow(failed).map((row) => row.read_date),
  };
}
