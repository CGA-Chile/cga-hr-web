"use client";

import { useState } from "react";
import { dayCopy } from "@/copy/day";
import { sheetCopy } from "@/copy/sheet";
import { isFailure, useAssignmentWriter } from "@/hooks/useAssignmentWriter";
import { LateIcon, LeftEarlyIcon } from "./MarkIcons";
import styles from "./SheetPanels.module.css";

type Marks = { late: boolean; lateNotified: boolean | null; leftEarly: boolean };

type IncompleteDayMarksProps = { date: string; employeeId: string; positionId: string; note: string | null } & Marks;

/**
 * Marks an incomplete day: a late arrival, with or without notice, and leaving early. Nothing
 * pressed means a full day; pressing the chosen option again clears it. The person keeps their
 * position; the bonus treats them as not there. Saves through the same queue as a position change.
 */
export function IncompleteDayMarks({ date, employeeId, positionId, note, ...stored }: IncompleteDayMarksProps) {
  const [picked, setPicked] = useState<Marks | null>(null);
  const { status, write, pendingCell } = useAssignmentWriter(date, employeeId);
  const queued: Marks | null = pendingCell
    ? {
        late: pendingCell.late ?? stored.late,
        lateNotified: pendingCell.late === false ? null : (pendingCell.lateNotified ?? stored.lateNotified),
        leftEarly: pendingCell.leftEarly ?? stored.leftEarly,
      }
    : null;
  const shown = isFailure(status) ? stored : (picked ?? queued ?? stored);

  const toggleLate = (notified: boolean) => {
    const pressed = shown.late && shown.lateNotified === notified;
    setPicked({ ...shown, late: !pressed, lateNotified: pressed ? null : notified });
    void write({ positionId, note, late: !pressed, lateNotified: pressed ? undefined : notified });
  };
  const toggleLeftEarly = () => {
    setPicked({ ...shown, leftEarly: !shown.leftEarly });
    void write({ positionId, note, leftEarly: !shown.leftEarly });
  };

  return (
    <section className={styles.marks}>
      <h3 className={styles.heading}>{sheetCopy.incompleteTitle}</h3>
      <p className={styles.muted}>{sheetCopy.incompleteHint}</p>
      <fieldset className={styles.group}>
        <legend className={styles.markLabel}>
          <LateIcon size={13} />
          {sheetCopy.lateGroup}
        </legend>
        <div className={styles.options}>
          {[true, false].map((notified) => (
            <button
              key={String(notified)}
              type="button"
              aria-pressed={shown.late && shown.lateNotified === notified}
              onClick={() => toggleLate(notified)}
              className={styles.option}
            >
              {notified ? sheetCopy.withNotice : sheetCopy.withoutNotice}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.group}>
        <legend className={styles.markLabel}>
          <LeftEarlyIcon size={13} />
          {sheetCopy.leftEarlyGroup}
        </legend>
        <div className={styles.options}>
          <button type="button" aria-pressed={shown.leftEarly} onClick={toggleLeftEarly} className={styles.option}>
            {sheetCopy.leftEarly}
          </button>
        </div>
      </fieldset>
      {status !== "IDLE" && (
        <p role="status" className={styles.status} data-status={status}>
          {dayCopy.writeStatus[status]}
        </p>
      )}
    </section>
  );
}
