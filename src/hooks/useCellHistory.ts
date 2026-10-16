"use client";

import { loadCellHistory, type CellMovement } from "@/sections/day/queries";
import type { CellSelection } from "@/sections/sheet/cellSelection";
import { cellKey } from "@/sections/sheet/sheetModel";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useBrowserRead, type BrowserRead } from "./useBrowserRead";

/** One cell's history, read from the browser and again after an edit lands. */
export function useCellHistory({ date, employeeId }: CellSelection, freshness: unknown): BrowserRead<CellMovement[]> {
  return useBrowserRead(
    cellKey(date, employeeId),
    () => loadCellHistory(createSupabaseBrowserClient(), date, employeeId),
    freshness,
  );
}
