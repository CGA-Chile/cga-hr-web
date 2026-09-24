"use client";

import { useState } from "react";
import { dayCopy } from "@/copy/day";
import { useAssignmentWriter } from "@/hooks/useAssignmentWriter";
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

/** A pick from the catalogue, never free text. Choosing saves; nothing asks for confirmation. */
export function EditableCell({ date, employeeId, employeeName, positionId, note, groups }: EditableCellProps) {
  const [selected, setSelected] = useState(positionId ?? "");
  const { status, write } = useAssignmentWriter(date, employeeId);

  return (
    <div className={styles.cell}>
      <select
        aria-label={dayCopy.positionFor(employeeName)}
        value={selected}
        onChange={async (event) => {
          setSelected(event.target.value);
          const landed = await write({ positionId: event.target.value || null, note });
          if (!landed) setSelected(positionId ?? "");
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
