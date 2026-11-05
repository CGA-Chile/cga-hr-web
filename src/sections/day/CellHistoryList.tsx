import { dayCopy } from "@/copy/day";
import { formatDateTimeInChile } from "@/utils/chileDate";
import { describeMovement } from "./movementText";
import type { BonusTask, CellMovement, Position } from "./queries";
import styles from "./CellDrawer.module.css";

type CellHistoryListProps = {
  history: readonly CellMovement[];
  positionsById: ReadonlyMap<string, Pick<Position, "name">>;
  bonusTasksById: ReadonlyMap<string, Pick<BonusTask, "name">>;
};

/** Who changed a cell, when, and from what to what, oldest first. */
export function CellHistoryList({ history, positionsById, bonusTasksById }: CellHistoryListProps) {
  const positionName = (id: string | null) => (id ? (positionsById.get(id)?.name ?? "") : dayCopy.emptyCell);
  const taskName = (id: string) => bonusTasksById.get(id)?.name ?? "";

  if (history.length === 0) return <p className={styles.muted}>{dayCopy.noHistory}</p>;
  return (
    <ol className={styles.history}>
      {history.map((movement) => (
        <li key={movement.id} className={styles.movement}>
          <span className={styles.meta}>
            {formatDateTimeInChile(movement.changed_at)} · {movement.changedBy ?? dayCopy.unknownUser}
          </span>
          <span>{describeMovement(movement, positionName, taskName)}</span>
        </li>
      ))}
    </ol>
  );
}
