import Link from "next/link";
import { anomaliesCopy } from "@/copy/anomalies";
import { dayPath } from "@/sections/day/paths";
import { formatLongDate } from "@/utils/chileDate";
import { describeAnomaly } from "./anomalyText";
import type { AnomalousDate } from "./anomalousDates";
import styles from "./AnomalyList.module.css";

type AnomalyListProps = {
  days: readonly AnomalousDate[];
  positionName: (id: string) => string;
};

/**
 * Dates carrying an anomaly, newest first, each with its reasons and a way there. There is no
 * acknowledge action: an anomaly is gone when it is corrected, and only then.
 */
export function AnomalyList({ days, positionName }: AnomalyListProps) {
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
                  {day.result.anomalies.map((anomaly) => {
                    const { text, quiet } = describeAnomaly(anomaly, positionName);
                    return (
                      <li key={text} className={quiet ? styles.quiet : styles.loud}>
                        {text}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
        </ul>
      )}
    </main>
  );
}
