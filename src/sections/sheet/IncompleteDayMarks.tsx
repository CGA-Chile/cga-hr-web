"use client";

import { useState } from "react";
import { dayCopy } from "@/copy/day";
import { sheetCopy } from "@/copy/sheet";
import { isFailure, useAssignmentWriter } from "@/hooks/useAssignmentWriter";
import { LateIcon, LeftEarlyIcon } from "./MarkIcons";
import styles from "./SheetPanels.module.css";

type Marks = { late: boolean; lateNotified: boolean | null; leftEarly: boolean };

type IncompleteDayMarksProps = {
  date: string;
  employeeId: string;
  positionId: string;
  note: string | null;
  /** Stage 2's start: from this date on, Workera decides the marks and the buttons go away. */
  appliesFrom: string | null;
} & Marks;

/**
 * Marks an incomplete day: a late arrival, with or without notice, and leaving early. Before stage 2
 * these are buttons; the person keeps their position and the bonus treats them as not there. From
 * stage 2 on (appliesFrom), the marks come from Workera and show read-only, and only the late's
 * notice stays a manual choice. Saves through the same queue as a position change.
 */
export function IncompleteDayMarks({ date, appliesFrom, ...rest }: IncompleteDayMarksProps) {
  const byWorkera = appliesFrom !== null && date >= appliesFrom;
  return byWorkera ? (
    <WorkeraMarks date={date} {...rest} />
  ) : (
    <ManualMarks date={date} {...rest} />
  );
}

type MarksProps = Omit<IncompleteDayMarksProps, "appliesFrom">;

function ManualMarks({ date, employeeId, positionId, note, ...stored }: MarksProps) {
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

/**
 * Stage 2: Workera decides the late and the early departure, so they show read-only. The late's
 * notice is still the editor's to add, so its two buttons stay; no one can add a late Workera did
 * not read.
 */
function WorkeraMarks({ date, employeeId, positionId, note, ...stored }: MarksProps) {
  const { status, write, pendingCell } = useAssignmentWriter(date, employeeId);
  const notified = pendingCell?.lateNotified ?? stored.lateNotified;

  const pickNotice = (value: boolean) => {
    void write({ positionId, note, lateNotified: value });
  };

  return (
    <section className={styles.marks}>
      <h3 className={styles.heading}>{sheetCopy.incompleteTitle}</h3>
      <p className={styles.muted}>{sheetCopy.workeraMarksHint}</p>
      {!stored.late && !stored.leftEarly && <p className={styles.muted}>{sheetCopy.workeraFullDay}</p>}
      {stored.late && (
        <fieldset className={styles.group}>
          <legend className={styles.markLabel}>
            <LateIcon size={13} />
            {sheetCopy.workeraLateLabel}
          </legend>
          <div className={styles.options}>
            {[true, false].map((value) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={notified === value}
                onClick={() => pickNotice(value)}
                className={styles.option}
              >
                {value ? sheetCopy.withNotice : sheetCopy.withoutNotice}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {stored.leftEarly && (
        <p className={styles.markLabel}>
          <LeftEarlyIcon size={13} />
          {sheetCopy.workeraLeftEarlyLabel}
        </p>
      )}
      {status !== "IDLE" && (
        <p role="status" className={styles.status} data-status={status}>
          {dayCopy.writeStatus[status]}
        </p>
      )}
    </section>
  );
}
