"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import {
  listOperations,
  removeOperation,
  saveOperation,
  type PendingOperation,
} from "@/utils/pendingWrites/store";

export type WriteFailure = "SETTLED" | "ONE_POSITION_PER_DAY";
export type Outcome = "SAVED" | WriteFailure;

type PendingWrites = {
  pending: readonly PendingOperation[];
  sending: boolean;
  online: boolean;
  outcomes: ReadonlyMap<string, Outcome>;
  enqueue: (operation: Omit<PendingOperation, "opId" | "queuedAt">) => Promise<string>;
};

const PendingWritesContext = createContext<PendingWrites | null>(null);
const RETRY_EVERY_MS = 15_000;

/** Codes the database answers with when an edit can never succeed; retrying would not help. */
const REFUSALS: Record<string, WriteFailure> = { "42501": "SETTLED", "23505": "ONE_POSITION_PER_DAY" };

/**
 * Every edit is saved on the device first, then sent. Sending replays the queue oldest first,
 * each operation with its own op_id, which the server treats as an idempotency key: a resend
 * after a lost response has no effect and no error. A network failure stops the replay and
 * leaves the rest queued for the next attempt; a refusal drops the operation and says why.
 */
export function PendingWritesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingOperation[]>([]);
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(true);
  const [outcomes, setOutcomes] = useState<Map<string, Outcome>>(new Map());
  const flushing = useRef(false);

  const record = (opId: string, outcome: Outcome) =>
    setOutcomes((previous) => new Map(previous).set(opId, outcome));

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    setSending(true);
    const supabase = createSupabaseBrowserClient();
    let delivered = false;

    for (const operation of await listOperations()) {
      const { error } = await supabase.rpc("apply_assignment_operation", {
        p_op_id: operation.opId,
        p_date: operation.date,
        p_employee_id: operation.employeeId,
        p_position_id: operation.positionId ?? undefined,
        p_note: operation.note ?? undefined,
      });
      const refusal = error ? REFUSALS[error.code] : undefined;
      if (error && !refusal) break;

      await removeOperation(operation.opId);
      record(operation.opId, refusal ?? "SAVED");
      delivered = true;
    }

    setPending(await listOperations());
    setSending(false);
    flushing.current = false;
    if (delivered) router.refresh();
  }, [router]);

  const enqueue = useCallback<PendingWrites["enqueue"]>(
    async (operation) => {
      const queued = { ...operation, opId: crypto.randomUUID(), queuedAt: Date.now() };
      await saveOperation(queued);
      setPending(await listOperations());
      void flush();
      return queued.opId;
    },
    [flush],
  );

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void flush();
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const retry = window.setInterval(() => void flush(), RETRY_EVERY_MS);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.clearInterval(retry);
    };
  }, [flush]);

  return (
    <PendingWritesContext.Provider value={{ pending, sending, online, outcomes, enqueue }}>
      {children}
    </PendingWritesContext.Provider>
  );
}

export function usePendingWrites(): PendingWrites {
  const context = useContext(PendingWritesContext);
  if (!context) throw new Error("usePendingWrites must be used inside PendingWritesProvider");
  return context;
}
