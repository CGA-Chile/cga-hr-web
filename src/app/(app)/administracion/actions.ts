"use server";

import { revalidatePath } from "next/cache";
import { adminCopy } from "@/copy/admin";
import {
  employeeSchema,
  positionSchema,
  rateVersionSchema,
  type EmployeeInput,
  type PositionValues,
  type RateVersionValues,
} from "@/schemas/admin";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export type AdminResult = { message: string } | null;

const ADMIN_PATH = "/administracion";

/** Every write here is decided by RLS; these checks only turn refusals into plain Spanish. */
function messageFor(code: string, duplicate: string): string {
  if (code === "23505") return duplicate;
  if (code === "42501") return adminCopy.onlyAdmin;
  return adminCopy.unavailable;
}

export async function saveEmployee(id: string | null, input: EmployeeInput): Promise<AdminResult> {
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? adminCopy.unavailable };

  const row = {
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    national_id: parsed.data.nationalId || null,
  };
  const supabase = await createSupabaseServerClient();
  const { error } = id
    ? await supabase.from("employees").update(row).eq("id", id)
    : await supabase.from("employees").insert(row);
  if (error) return { message: messageFor(error.code, adminCopy.employees.duplicateNationalId) };

  revalidatePath(ADMIN_PATH);
  return null;
}

/** Deactivating is how someone leaves: never a delete, so their days and payments survive. */
export async function setEmployeeActive(id: string, active: boolean): Promise<AdminResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("employees").update({ active }).eq("id", id);
  if (error) return { message: messageFor(error.code, adminCopy.unavailable) };

  revalidatePath(ADMIN_PATH);
  return null;
}

export async function savePosition(id: string | null, input: PositionValues): Promise<AdminResult> {
  const parsed = positionSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? adminCopy.unavailable };

  const row = {
    code: parsed.data.code,
    name: parsed.data.name,
    type: parsed.data.type,
    bonus_eligible: parsed.data.bonusEligible,
    triggers_equal_share: parsed.data.triggersEqualShare,
    display_order: parsed.data.displayOrder,
    active: parsed.data.active,
  };
  const supabase = await createSupabaseServerClient();
  const { error } = id
    ? await supabase.from("positions").update(row).eq("id", id)
    : await supabase.from("positions").insert(row);
  if (error?.code === "23514") return { message: adminCopy.positions.triggerNeedsBonus };
  if (error) return { message: messageFor(error.code, adminCopy.positions.duplicateCode) };

  revalidatePath(ADMIN_PATH);
  return null;
}

export async function createRateVersion(input: RateVersionValues): Promise<AdminResult> {
  const parsed = rateVersionSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? adminCopy.unavailable };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_bonus_settings_version", {
    p_effective_from: parsed.data.effectiveFrom,
    p_daily_cap: parsed.data.dailyCap,
    p_max_amount_per_person: parsed.data.maxAmountPerPerson,
    p_rates: Object.entries(parsed.data.rates).map(([position_id, amount]) => ({ position_id, amount })),
  });
  if (error?.code === "23514") return { message: adminCopy.rates.mustStartLater };
  if (error) return { message: messageFor(error.code, adminCopy.unavailable) };

  revalidatePath(ADMIN_PATH);
  return null;
}
