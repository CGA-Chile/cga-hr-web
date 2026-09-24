"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { periodsCopy } from "@/copy/periods";
import { loadClosePlan } from "@/sections/periods/closePlan";
import { loadPeriod, loadPeriods, nextPeriodStart, periodNameFor } from "@/sections/periods/queries";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export type ActionState = { message: string } | null;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Creates the next period. Its start is taken from the previous period's end, never from the
 * form, so periods stay contiguous; only the very first period chooses its own start.
 */
export async function createPeriod(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const fixedStart = nextPeriodStart(await loadPeriods(supabase));
  const parsed = z
    .object({ start: isoDate, end: isoDate, name: z.string().trim().max(60) })
    .safeParse({ start: fixedStart ?? formData.get("start"), end: formData.get("end"), name: formData.get("name") });
  if (!parsed.success || parsed.data.end < parsed.data.start) return { message: periodsCopy.invalidRange };

  const { start, end, name } = parsed.data;
  const { data, error } = await supabase
    .from("periods")
    .insert({ start_date: start, end_date: end, name: name || periodNameFor(end) })
    .select("id")
    .single();
  if (error) return { message: messageFor(error.code) };

  revalidatePath("/cierres");
  redirect(`/cierres/${data.id}`);
}

/**
 * Closes a period. The plan is recomputed here, on the server, from the data as it is now; the
 * database then refuses the close if anything moved between this plan and the stamp.
 */
export async function closePeriod(periodId: string): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const period = await loadPeriod(supabase, periodId);
  if (!period) return { message: periodsCopy.unavailable };

  const { canClose, settlements } = await loadClosePlan(supabase, period);
  if (!canClose) return { message: periodsCopy.gateBlocks };

  const { error } = await supabase.rpc("close_period", { p_period_id: periodId, p_settlements: settlements });
  if (error) return { message: messageFor(error.code) };

  revalidatePath(`/cierres/${periodId}`);
  return null;
}

/**
 * Records the admin's approval to settle one date above the cap. Only reachable for an excess the
 * settlement rules classify as not correctable; the plan is recomputed here to make sure it still
 * is, and the approval records exactly the amount it covers.
 */
export async function validateExcess(periodId: string, date: string, formData: FormData): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const period = await loadPeriod(supabase, periodId);
  if (!period) return { message: periodsCopy.unavailable };

  const { plan } = await loadClosePlan(supabase, period);
  const excess = plan.excessesRequiringValidation.find((candidate) => candidate.date === date && !candidate.validated);
  if (!excess) return { message: periodsCopy.notValidatable };

  const note = z.string().trim().max(500).safeParse(formData.get("note"));
  const { error } = await supabase.from("cap_overrides").insert({
    period_id: periodId,
    date,
    approved_amount: excess.settledTotal,
    daily_cap: excess.dailyCap,
    note: note.success && note.data ? note.data : null,
  });
  if (error) return { message: messageFor(error.code) };

  revalidatePath(`/cierres/${periodId}`);
  redirect(`/cierres/${periodId}`);
}

function messageFor(code: string): string {
  if (code === "40001") return periodsCopy.changedMeanwhile;
  if (code === "42501") return periodsCopy.onlyAdminCloses;
  if (code === "23514" || code === "23P01") return periodsCopy.notContiguous;
  return periodsCopy.unavailable;
}
