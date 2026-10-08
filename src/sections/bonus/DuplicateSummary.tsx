import { summaryCopy } from "@/copy/summary";
import type { DuplicatedPosition } from "@/domain/bonus/duplicates";
import styles from "./DailySummary.module.css";

type DuplicateSummaryProps = {
  duplicates: readonly DuplicatedPosition[];
  positionName: (id: string) => string;
};

/** The daily summary for a role that never sees amounts: only what it can see and fix. */
export function DuplicateSummary({ duplicates, positionName }: DuplicateSummaryProps) {
  return (
    <section className={styles.summary} aria-labelledby="daily-summary-title">
      <h2 id="daily-summary-title" className={styles.title}>
        {summaryCopy.title}
      </h2>
      {duplicates.length === 0 ? (
        <p className={styles.reason}>{summaryCopy.noDuplicates}</p>
      ) : (
        <ul className={styles.marks}>
          {duplicates.map((duplicate) => (
            <li key={duplicate.positionId} className={styles.mark}>
              {summaryCopy.duplicate(positionName(duplicate.positionId), duplicate.occupantCount)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
