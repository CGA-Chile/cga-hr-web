"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export type CellState = { positionId: string | null; note: string | null };
export type WriteFailure = "SETTLED" | "ONE_POSITION_PER_DAY" | "UNAVAILABLE";
export type WriteStatus = "IDLE" | "SAVING" | "SAVED" | WriteFailure;

/**
 * Writes one cell of the day grid through apply_assignment_operation, sending its full new
 * state with a fresh operation id, then re-renders the server data so marks and totals follow.
 */
export function useAssignmentWriter(date: string, employeeId: string) {
  const router = useRouter();
  const [status, setStatus] = useState<WriteStatus>("IDLE");
  const [, startTransition] = useTransition();

  /** Resolves to whether the write landed, so the caller can undo what it showed optimistically. */
  async function write(cell: CellState): Promise<boolean> {
    setStatus("SAVING");
    const { error } = await createSupabaseBrowserClient().rpc("apply_assignment_operation", {
      p_op_id: crypto.randomUUID(),
      p_date: date,
      p_employee_id: employeeId,
      p_position_id: cell.positionId ?? undefined,
      p_note: cell.note ?? undefined,
    });
    if (error) {
      setStatus(failureOf(error.code));
      return false;
    }
    setStatus("SAVED");
    startTransition(() => router.refresh());
    return true;
  }

  return { status, write };
}

function failureOf(code: string): WriteFailure {
  if (code === "42501") return "SETTLED";
  if (code === "23505") return "ONE_POSITION_PER_DAY";
  return "UNAVAILABLE";
}
