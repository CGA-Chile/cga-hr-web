import { Drawer } from "@/components/Drawer";
import { dayCopy } from "@/copy/day";
import type { IsoDate } from "@/domain/bonus/types";
import { formatDateTimeInChile, formatLongDate } from "@/utils/chileDate";
import { NoteForm } from "./NoteForm";
import { dayPath } from "./paths";
import { fullName, type Assignment, type CellMovement, type Employee, type Position } from "./queries";
import styles from "./CellDrawer.module.css";

type CellDrawerProps = {
  date: IsoDate;
  editing: boolean;
  employee: Employee;
  assignment: Assignment | null;
  history: readonly CellMovement[];
  positionsById: ReadonlyMap<string, Position>;
};

/** Who changed this cell, when, and from what to what. Readable in both modes. */
export function CellDrawer({ date, editing, employee, assignment, history, positionsById }: CellDrawerProps) {
  const positionName = (id: string | null) => (id ? (positionsById.get(id)?.name ?? "") : dayCopy.emptyCell);

  return (
    <Drawer
      title={`${fullName(employee)} · ${formatLongDate(date)}`}
      closeHref={dayPath(date, { editing })}
      closeLabel={dayCopy.close}
    >
      <section className={styles.section}>
        <h3 className={styles.heading}>{dayCopy.note}</h3>
        {editing && assignment ? (
          <NoteForm date={date} employeeId={employee.id} positionId={assignment.position_id} note={assignment.note} />
        ) : editing ? (
          <p className={styles.muted}>{dayCopy.noteNeedsPosition}</p>
        ) : (
          <p className={assignment?.note ? undefined : styles.muted}>{assignment?.note ?? dayCopy.noNote}</p>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>{dayCopy.history}</h3>
        {history.length === 0 ? (
          <p className={styles.muted}>{dayCopy.noHistory}</p>
        ) : (
          <ol className={styles.history}>
            {history.map((movement) => (
              <li key={movement.id} className={styles.movement}>
                <span className={styles.meta}>
                  {formatDateTimeInChile(movement.changed_at)} · {movement.changedBy ?? dayCopy.unknownUser}
                </span>
                <span>
                  {positionName(movement.previous_position_id)} → {positionName(movement.new_position_id)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Drawer>
  );
}
