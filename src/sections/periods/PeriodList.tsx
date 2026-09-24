import Link from "next/link";
import { periodsCopy } from "@/copy/periods";
import { formatLongDate } from "@/utils/chileDate";
import type { Period } from "./queries";
import styles from "./Periods.module.css";

export function PeriodList({ periods }: { periods: readonly Period[] }) {
  if (periods.length === 0) return <p className={styles.muted}>{periodsCopy.empty}</p>;

  return (
    <ul className={styles.list}>
      {periods.map((period) => (
        <li key={period.id} className={styles.item}>
          <div>
            <Link href={`/cierres/${period.id}`} className={styles.name}>
              {period.name}
            </Link>
            <div className={styles.muted}>
              {periodsCopy.range(formatLongDate(period.start_date), formatLongDate(period.end_date))}
            </div>
          </div>
          <span className={styles.status} data-status={period.status}>
            {period.status === "CLOSED" ? periodsCopy.closed : periodsCopy.open}
          </span>
        </li>
      ))}
    </ul>
  );
}
