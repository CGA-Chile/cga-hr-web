"use client";

import { useState } from "react";
import { dayCopy } from "@/copy/day";
import { isFailure, useAssignmentWriter } from "@/hooks/useAssignmentWriter";
import type { PositionGroup } from "./positionGroups";
import styles from "./EditableCell.module.css";

type EditableCellProps = {
  date: string;
  employeeId: string;
  employeeName: string;
  positionId: string | null;
  note: string | null;
  groups: readonly PositionGroup[];
};

/**
 * A pick from the catalogue, never free text. Choosing saves; nothing asks for confirmation.
 * Shows what was just picked, else what is still queued on this device, else what is stored;
 * after a refusal it goes back to what is stored, so it never shows something that was not saved.
 */
export function EditableCell({ date, employeeId, employeeName, positionId, note, groups }: EditableCellProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const { status, write, pendingCell } = useAssignmentWriter(date, employeeId);
  const stored = positionId ?? "";
  const shown = isFailure(status) ? stored : (picked ?? (pendingCell ? (pendingCell.positionId ?? "") : stored));

  return (
    <div className={styles.cell}>
      <select
        aria-label={dayCopy.positionFor(employeeName)}
        value={shown}
        onChange={(event) => {
          setPicked(event.target.value);
          void write({ positionId: event.target.value || null, note });
        }}
        className={styles.select}
      >
        <option value="">{dayCopy.noPosition}</option>
        {groups.map((group) => (
          <optgroup key={group.key} label={dayCopy.positionGroups[group.key]}>
            {group.positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {status !== "IDLE" && (
        <span role="status" className={styles.status} data-status={status}>
          {dayCopy.writeStatus[status]}
        </span>
      )}
    </div>
  );
}
