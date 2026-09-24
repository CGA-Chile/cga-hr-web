"use client";

import { useState } from "react";
import { usePendingWrites, type Outcome } from "./usePendingWrites";

export type CellState = { positionId: string | null; note: string | null };
export type WriteStatus = "IDLE" | "SAVING" | "QUEUED" | Outcome;

/**
 * Writes one cell of the day grid through the pending-writes queue: saved on the device first,
 * then sent. `pendingCell` is the newest queued state of this cell, so an edit made without
 * signal is still shown after a reload.
 */
export function useAssignmentWriter(date: string, employeeId: string) {
  const { enqueue, pending, outcomes, sending } = usePendingWrites();
  const [opId, setOpId] = useState<string | null>(null);

  const queued = pending.filter((operation) => operation.date === date && operation.employeeId === employeeId);
  const pendingCell: CellState | null = queued.at(-1) ?? null;

  const status: WriteStatus = !opId
    ? "IDLE"
    : (outcomes.get(opId) ??
      (pending.some((operation) => operation.opId === opId) && !sending ? "QUEUED" : "SAVING"));

  async function write(cell: CellState): Promise<void> {
    setOpId(await enqueue({ date, employeeId, ...cell }));
  }

  return { status, write, pendingCell };
}

export function isFailure(status: WriteStatus): boolean {
  return status === "SETTLED" || status === "ONE_POSITION_PER_DAY";
}
