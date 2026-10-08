import Link from "next/link";
import { anomaliesCopy } from "@/copy/anomalies";
import { dayPath } from "@/sections/day/paths";
import { formatLongDate } from "@/utils/chileDate";
import type { AnomalyText } from "./anomalyText";
import styles from "./AnomalyList.module.css";

/** One date and its reasons, already in words: with amounts for HR, duplicates only otherwise. */
export type DescribedDate = { date: string; reasons: readonly AnomalyText[] };

type AnomalyListProps = { days: readonly DescribedDate[] };

/**
 * Dates carrying an anomaly, newest first, each with its reasons and a way there. There is no
 * acknowledge action: an anomaly is gone when it is corrected, and only then.
 */
export function AnomalyList({ days }: AnomalyListProps) {
  return (
    <main className="page">
      <h1 className={styles.title}>{anomaliesCopy.title}</h1>
      <p className={styles.intro}>{anomaliesCopy.intro}</p>
      {days.length === 0 ? (
        <p className={styles.empty}>{anomaliesCopy.empty}</p>
      ) : (
        <ul className={styles.list}>
          {[...days]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((day) => (
              <li key={day.date} className={styles.day}>
                <div className={styles.header}>
                  <span className={styles.date}>{formatLongDate(day.date)}</span>
                  <Link href={dayPath(day.date)}>{anomaliesCopy.goToDay}</Link>
                </div>
                <ul className={styles.reasons}>
                  {day.reasons.map(({ text, quiet }) => (
                    <li key={text} className={quiet ? styles.quiet : styles.loud}>
                      {text}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
        </ul>
      )}
    </main>
  );
}
