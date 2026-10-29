"use client";

import { useState } from "react";
import { dayCopy } from "@/copy/day";
import { sheetCopy } from "@/copy/sheet";
import { isFailure, useAssignmentWriter } from "@/hooks/useAssignmentWriter";
import type { BonusTask } from "../day/queries";
import { BonusTaskIcon } from "./MarkIcons";
import styles from "./SheetPanels.module.css";

type BonusTaskMarkProps = {
  date: string;
  employeeId: string;
  positionId: string;
  note: string | null;
  bonusTaskId: string | null;
  /** The tasks on offer: the active ones, plus the one stored here if it was retired since. */
  tasks: readonly BonusTask[];
};

/** Undefined means "not said"; null is a choice, no task. */
function firstGiven(...candidates: (string | null | undefined)[]): string | null {
  return candidates.find((candidate) => candidate !== undefined) ?? null;
}

/**
 * Marks a bonus task on top of the position: one at most, and pressing the chosen one again
 * clears it. That day the task is the person's only bonus (docs/adr/0021). Saves through the same
 * queue as a position change.
 */
export function BonusTaskMark({ date, employeeId, positionId, note, bonusTaskId, tasks }: BonusTaskMarkProps) {
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const { status, write, pendingCell } = useAssignmentWriter(date, employeeId);
  const shown = isFailure(status) ? bonusTaskId : firstGiven(picked, pendingCell?.bonusTaskId, bonusTaskId);

  const toggle = (id: string) => {
    const next = shown === id ? null : id;
    setPicked(next);
    void write({ positionId, note, bonusTaskId: next });
  };

  return (
    <section className={styles.marks}>
      <h3 className={styles.heading}>
        <span className={styles.markLabel}>
          <BonusTaskIcon size={13} />
          {sheetCopy.bonusTaskTitle}
        </span>
      </h3>
      <p className={styles.muted}>{sheetCopy.bonusTaskHint}</p>
      <div className={styles.options}>
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            aria-pressed={shown === task.id}
            onClick={() => toggle(task.id)}
            className={styles.option}
          >
            {task.name}
          </button>
        ))}
      </div>
      {status !== "IDLE" && (
        <p role="status" className={styles.status} data-status={status}>
          {dayCopy.writeStatus[status]}
        </p>
      )}
    </section>
  );
}
