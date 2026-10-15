"use client";

import { useEffect, useState } from "react";
import { loadCellHistory, type CellMovement } from "@/sections/day/queries";
import type { CellSelection } from "@/sections/sheet/cellSelection";
import { cellKey } from "@/sections/sheet/sheetModel";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export type CellHistory = { status: "LOADING" } | { status: "FAILED" } | { status: "LOADED"; movements: CellMovement[] };

/**
 * One cell's history, read straight from the browser under the same RLS as the server read.
 * It is read again whenever `freshness` changes, which the sheet passes as its latest server
 * data, so an edit that lands shows up in the history too. While a new read is in flight, or
 * if it fails, a history already shown for the same cell stays on screen; a response for another
 * cell is never shown.
 */
export function useCellHistory({ date, employeeId }: CellSelection, freshness: unknown): CellHistory {
  const key = cellKey(date, employeeId);
  const [result, setResult] = useState<{ key: string; history: CellHistory } | null>(null);

  useEffect(() => {
    let current = true;
    loadCellHistory(createSupabaseBrowserClient(), date, employeeId).then(
      (movements) => current && setResult({ key, history: { status: "LOADED", movements } }),
      () =>
        current &&
        setResult((previous) =>
          previous?.key === key && previous.history.status === "LOADED" ? previous : { key, history: { status: "FAILED" } },
        ),
    );
    return () => {
      current = false;
    };
  }, [key, date, employeeId, freshness]);

  return result?.key === key ? result.history : { status: "LOADING" };
}
