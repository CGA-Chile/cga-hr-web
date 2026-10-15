"use client";

import { useState } from "react";
import { dayCopy } from "@/copy/day";
import { sheetCopy } from "@/copy/sheet";
import { isFailure, useAssignmentWriter } from "@/hooks/useAssignmentWriter";
import type { PositionGroup } from "../day/positionGroups";
import styles from "./SheetPanels.module.css";

type PositionPickerProps = {
  date: string;
  employeeId: string;
  positionId: string | null;
  note: string | null;
  groups: readonly PositionGroup[];
};

/**
 * The catalogue as buttons, grouped like the day view's picker. Choosing saves through the same
 * queue as every other edit; nothing asks for confirmation.
 */
export function PositionPicker({ date, employeeId, positionId, note, groups }: PositionPickerProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const { status, write, pendingCell } = useAssignmentWriter(date, employeeId);
  const stored = positionId ?? "";
  const shown = isFailure(status) ? stored : (picked ?? (pendingCell ? (pendingCell.positionId ?? "") : stored));

  const choose = (id: string) => {
    setPicked(id);
    void write({ positionId: id || null, note });
  };

  return (
    <div className={styles.picker}>
      <PositionOptions groups={groups} selected={shown || null} onChoose={(id) => choose(id ?? "")} />
      {status !== "IDLE" && (
        <p role="status" className={styles.status} data-status={status}>
          {dayCopy.writeStatus[status]}
        </p>
      )}
    </div>
  );
}

type PositionOptionsProps = {
  groups: readonly PositionGroup[];
  /** Null is «Vaciar»; undefined is nothing chosen yet. */
  selected: string | null | undefined;
  onChoose: (positionId: string | null) => void;
};

/** The catalogue as buttons, grouped, with «Vaciar» last. Shared by a single cell and a range. */
export function PositionOptions({ groups, selected, onChoose }: PositionOptionsProps) {
  return (
    <>
      {groups.map((group) => (
        <fieldset key={group.key} className={styles.group}>
          <legend className={styles.groupLabel}>{dayCopy.positionGroups[group.key]}</legend>
          <div className={styles.options}>
            {group.positions.map((position) => (
              <button
                key={position.id}
                type="button"
                aria-pressed={selected === position.id}
                onClick={() => onChoose(position.id)}
                className={styles.option}
              >
                {position.name}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className={styles.options}>
        <button type="button" aria-pressed={selected === null} onClick={() => onChoose(null)} className={styles.option}>
          {sheetCopy.clearPosition}
        </button>
      </div>
    </>
  );
}
