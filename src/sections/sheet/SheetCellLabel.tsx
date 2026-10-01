"use client";

import { createContext, useContext, type ReactNode } from "react";
import { sheetCopy } from "@/copy/sheet";
import { usePendingWrites } from "@/hooks/usePendingWrites";
import styles from "./SheetGrid.module.css";

const AbbreviationsContext = createContext<ReadonlyMap<string, string>>(new Map());

/** Hands every cell the position abbreviations once, instead of once per cell. */
export function SheetAbbreviations({ entries, children }: { entries: [string, string][]; children: ReactNode }) {
  return <AbbreviationsContext.Provider value={new Map(entries)}>{children}</AbbreviationsContext.Provider>;
}

type SheetCellLabelProps = { date: string; employeeId: string; stored: string };

/**
 * What a cell shows: the stored position, unless a change to it is still queued on this device,
 * in which case the queued one, marked, so an edit made without signal is never invisible.
 */
export function SheetCellLabel({ date, employeeId, stored }: SheetCellLabelProps) {
  const abbreviations = useContext(AbbreviationsContext);
  const queued = usePendingWrites().pending.findLast(
    (operation) => operation.date === date && operation.employeeId === employeeId,
  );
  if (!queued) return stored;

  return (
    <span className={styles.pending} title={sheetCopy.pending}>
      {queued.positionId ? (abbreviations.get(queued.positionId) ?? "") : ""}
    </span>
  );
}
