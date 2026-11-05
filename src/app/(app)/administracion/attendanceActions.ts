"use server";

import { revalidatePath } from "next/cache";
import { adminCopy } from "@/copy/admin";
import {
  mismatchesFromSchema,
  rereadSchema,
  type MismatchesFromValues,
  type RereadValues,
} from "@/schemas/attendance";
import { todayInChile } from "@/utils/chileDate";
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
