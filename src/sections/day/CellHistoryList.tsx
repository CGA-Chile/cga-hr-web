import { dayCopy } from "@/copy/day";
import { formatDateTimeInChile } from "@/utils/chileDate";
import { describeMovement } from "./movementText";
import type { CellMovement, Position } from "./queries";
import styles from "./CellDrawer.module.css";

type CellHistoryListProps = {
  history: readonly CellMovement[];
  positionsById: ReadonlyMap<string, Pick<Position, "name">>;
};

/** Who changed a cell, when, and from what to what, oldest first. */
export function CellHistoryList({ history, positionsById }: CellHistoryListProps) {
  const positionName = (id: string | null) => (id ? (positionsById.get(id)?.name ?? "") : dayCopy.emptyCell);

  if (history.length === 0) return <p className={styles.muted}>{dayCopy.noHistory}</p>;
  return (
    <ol className={styles.history}>
      {history.map((movement) => (
        <li key={movement.id} className={styles.movement}>
          <span className={styles.meta}>
            {formatDateTimeInChile(movement.changed_at)} · {movement.changedBy ?? dayCopy.unknownUser}
          </span>
          <span>{describeMovement(movement, positionName)}</span>
        </li>
      ))}
    </ol>
  );
}
