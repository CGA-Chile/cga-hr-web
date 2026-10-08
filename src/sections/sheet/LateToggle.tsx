"use client";

import { useState } from "react";
import { dayCopy } from "@/copy/day";
import { sheetCopy } from "@/copy/sheet";
import { isFailure, useAssignmentWriter } from "@/hooks/useAssignmentWriter";
import styles from "./SheetPanels.module.css";

type LateToggleProps = { date: string; employeeId: string; positionId: string; note: string | null; late: boolean };

/**
 * Marks or unmarks a late arrival. The person keeps their position; the bonus treats them as not
 * there. Saves through the same queue as a position change.
 */
export function LateToggle({ date, employeeId, positionId, note, late }: LateToggleProps) {
  const [picked, setPicked] = useState<boolean | null>(null);
  const { status, write, pendingCell } = useAssignmentWriter(date, employeeId);
  const shown = isFailure(status) ? late : (picked ?? pendingCell?.late ?? late);

  const toggle = () => {
    setPicked(!shown);
    void write({ positionId, note, late: !shown });
  };

  return (
    <div className={styles.lateToggle}>
      <button type="button" aria-pressed={shown} onClick={toggle} className={styles.option}>
        {shown ? sheetCopy.unmarkLate : sheetCopy.markLate}
      </button>
      <p className={styles.muted}>{sheetCopy.lateHint}</p>
      {status !== "IDLE" && (
        <p role="status" className={styles.status} data-status={status}>
          {dayCopy.writeStatus[status]}
        </p>
      )}
    </div>
  );
}
