"use client";

import { useState } from "react";
import { sheetCopy } from "@/copy/sheet";
import { usePendingWrites } from "@/hooks/usePendingWrites";
import { formatShortDate } from "@/utils/chileDate";
import type { ColumnCopy } from "./sheetModel";
import styles from "./SheetPanels.module.css";

/**
 * Fills the date's empty cells with the previous working date's positions, the column copy the
 * sheet was used for. Each cell is an ordinary queued edit, so it works offline and lands in the
 * history; a cell that already holds something is never touched.
 */
export function CopyPreviousDay({ date, copy: { from, cells } }: { date: string; copy: ColumnCopy }) {
  const { enqueue } = usePendingWrites();
  const [copied, setCopied] = useState(false);

  if (copied) return <p role="status" className={styles.muted}>{sheetCopy.copied}</p>;
  if (cells.length === 0) return <p className={styles.muted}>{sheetCopy.nothingToCopy}</p>;

  const fill = async () => {
    setCopied(true);
    for (const cell of cells) {
      await enqueue({ date, employeeId: cell.employeeId, positionId: cell.positionId, note: null });
    }
  };

  return (
    <div className={styles.copy}>
      <button type="button" className={styles.secondary} onClick={() => void fill()}>
        {sheetCopy.copyFrom(formatShortDate(from), cells.length)}
      </button>
      <p className={styles.muted}>{sheetCopy.copyPreviousHint}</p>
    </div>
  );
}
