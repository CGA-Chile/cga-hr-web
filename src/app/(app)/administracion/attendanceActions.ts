"use server";

import { revalidatePath } from "next/cache";
import { adminCopy } from "@/copy/admin";
import {
  appliesFromSchema,
  mismatchesFromSchema,
  rereadSchema,
  toleranceSchema,
  type AppliesFromValues,
  type MismatchesFromValues,
  type RereadValues,
  type ToleranceValues,
} from "@/schemas/attendance";
import { todayInChile } from "@/utils/chileDate";
import type { ServerSupabase } from "@/utils/supabase/query";
import { normalizeRut } from "@/utils/rut";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { createWorkeraClient } from "@/utils/workera/client";
import { workeraCredentials } from "@/utils/workera/env";
import { readWorkeraRange } from "@/utils/workera/read";
import type { AdminResult } from "./actions";

const ADMIN_PATH = "/administracion";

/** The database refuses anyone but an admin, so a non-admin never reaches Workera's data here. */
export async function rereadWorkera(values: RereadValues): Promise<AdminResult> {
  const parsed = rereadSchema.safeParse(values);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? adminCopy.unavailable };
  if (parsed.data.to >= todayInChile()) return { message: adminCopy.sync.dayNotOver };

  const supabase = await createSupabaseServerClient();
  try {
    const workera = createWorkeraClient(workeraCredentials());
    await readWorkeraRange(workera, supabase, parsed.data.from, parsed.data.to);
  } catch {
    revalidatePath(ADMIN_PATH);
    return { message: adminCopy.sync.readFailed };
  }
  revalidatePath(ADMIN_PATH);
  return null;
}

export async function saveMismatchesFrom(values: MismatchesFromValues): Promise<AdminResult> {
  const parsed = mismatchesFromSchema.safeParse(values);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? adminCopy.unavailable };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("attendance_settings")
    .update({ mismatches_from: parsed.data.from || null })
    .is("deleted_at", null)
    .not("id", "is", null);
  if (error) return { message: error.code === "42501" ? adminCopy.onlyAdmin : adminCopy.unavailable };

  revalidatePath(ADMIN_PATH);
  revalidatePath("/planilla");
  return null;
}

export async function saveAppliesFrom(values: AppliesFromValues): Promise<AdminResult> {
  const parsed = appliesFromSchema.safeParse(values);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? adminCopy.unavailable };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("attendance_settings")
    .update({ applies_from: parsed.data.from || null })
    .is("deleted_at", null)
    .not("id", "is", null);
  if (error) return { message: error.code === "42501" ? adminCopy.onlyAdmin : adminCopy.unavailable };

  await recomputeOpenPeriods(supabase);
  revalidatePath(ADMIN_PATH);
  revalidatePath("/planilla");
  return null;
}

export async function saveTolerance(values: ToleranceValues): Promise<AdminResult> {
  const parsed = toleranceSchema.safeParse(values);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? adminCopy.unavailable };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("attendance_settings")
    .update({ tolerance_minutes: parsed.data.minutes })
    .is("deleted_at", null)
    .not("id", "is", null);
  if (error) return { message: error.code === "42501" ? adminCopy.onlyAdmin : adminCopy.unavailable };

  await recomputeOpenPeriods(supabase);
  revalidatePath(ADMIN_PATH);
  revalidatePath("/planilla");
  return null;
}

/**
 * After the stage date or the tolerance changes, re-derive the marks of the open periods. The
 * database skips the days that are settled or before the stage; here we only need the range, from
 * the earliest open period to today. Days after today have no clockings and derive to nothing.
 */
async function recomputeOpenPeriods(supabase: ServerSupabase): Promise<void> {
  const { data } = await supabase
    .from("periods")
    .select("start_date")
    .is("deleted_at", null)
    .eq("status", "OPEN")
    .order("start_date")
    .limit(1);
  const from = data?.[0]?.start_date;
  if (!from) return;
  await supabase.rpc("recompute_attendance_marks", { p_from: from, p_to: todayInChile() });
}

/** Only ever a RUT read from Workera, and only after an admin looked at the pair. */
export async function confirmEmployeeRut(employeeId: string, nationalId: string): Promise<AdminResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("employees")
    .update({ national_id: normalizeRut(nationalId) })
    .eq("id", employeeId);
  if (error) {
    if (error.code === "23505") return { message: adminCopy.employees.duplicateNationalId };
    return { message: error.code === "42501" ? adminCopy.onlyAdmin : adminCopy.unavailable };
  }
  revalidatePath(ADMIN_PATH);
  return null;
}
