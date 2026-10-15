"use client";

import { useState } from "react";
import { sheetCopy } from "@/copy/sheet";
import { usePendingWrites } from "@/hooks/usePendingWrites";
import type { RangeDone } from "./RangePanel";
import { undoCells } from "./rangePlan";
import styles from "./SheetPanels.module.css";

/**
 * Says what a range just did and offers to put it back. Undoing writes each changed date back as
 * an ordinary cell edit, through the device's queue, so it works and shows like any other edit.
 */
export function RangeDoneNotice({ done, onDismiss }: { done: RangeDone; onDismiss: () => void }) {
  const { enqueueMany } = usePendingWrites();
  const [undone, setUndone] = useState(false);

  const undo = async () => {
    await enqueueMany(undoCells(done.previous).map((cell) => ({ employeeId: done.employeeId, ...cell })));
    setUndone(true);
  };

  return (
    <div role="status" className={styles.notice}>
      <p>{undone ? sheetCopy.rangeUndone : done.message}</p>
      {!undone && done.previous.length > 0 && (
        <button type="button" onClick={undo}>
          {sheetCopy.rangeUndo}
        </button>
      )}
      <button type="button" onClick={onDismiss} aria-label={sheetCopy.rangeDismiss}>
        ×
      </button>
    </div>
  );
}
