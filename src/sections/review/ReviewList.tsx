import Link from "next/link";
import { reviewCopy } from "@/copy/review";
import { describeMovement as describeAssignmentMovement } from "@/sections/day/movementText";
import { dayPath } from "@/sections/day/paths";
import { formatDateTimeInChile, formatLongDate } from "@/utils/chileDate";
import { formatPesos } from "@/utils/money";
import { AcknowledgeButton } from "./AcknowledgeButton";
import type { ReviewEntry } from "./queries";
import styles from "./ReviewList.module.css";

type ReviewListProps = {
  entries: readonly ReviewEntry[];
  acknowledged: boolean;
  employeeName: (id: string | null) => string;
  positionName: (id: string | null) => string;
  username: (id: string | null) => string;
  periodName: (id: string | null) => string;
};

/**
 * Review items: recorded events on dates already paid. They are acknowledged, not corrected, and
 * nothing here deducts or recalculates; a person decides what to do.
 */
export function ReviewList({ entries, acknowledged, employeeName, positionName, username, periodName }: ReviewListProps) {
  return (
    <main className="page">
      <h1 className={styles.title}>{reviewCopy.title}</h1>
      <p className={styles.intro}>{reviewCopy.intro}</p>
      <nav className={styles.tabs}>
        <Link href="/revision" aria-current={!acknowledged ? "page" : undefined}>
          {reviewCopy.pending}
        </Link>
        <Link href="/revision?ver=revisados" aria-current={acknowledged ? "page" : undefined}>
          {reviewCopy.acknowledged}
        </Link>
      </nav>

      {entries.length === 0 ? (
        <p className={styles.muted}>{acknowledged ? reviewCopy.emptyAcknowledged : reviewCopy.emptyPending}</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={entry.history_id} className={styles.item}>
              <div className={styles.body}>
                <div className={styles.headline}>
                  {entry.date && <Link href={dayPath(entry.date)}>{formatLongDate(entry.date)}</Link>}
                  <span> · {entry.kind === "CALENDAR" ? reviewCopy.calendarHeadline : employeeName(entry.employee_id)}</span>
                </div>
                <div className={styles.movement}>{describeMovement(entry, positionName)}</div>
                <div className={styles.meta}>
                  {entry.changed_at && reviewCopy.changedBy(formatDateTimeInChile(entry.changed_at), username(entry.changed_by))}
                  {" · "}
                  {reviewCopy.paidIn(periodName(entry.period_id))}
                </div>
                {entry.acknowledged_at && (
                  <div className={styles.meta}>
                    {reviewCopy.acknowledgedBy(formatDateTimeInChile(entry.acknowledged_at), username(entry.acknowledged_by))}
                  </div>
                )}
              </div>
              {!acknowledged && entry.history_id && (
                <AcknowledgeButton historyId={entry.history_id} kind={entry.kind === "CALENDAR" ? "CALENDAR" : "ASSIGNMENT"} />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function describeMovement(entry: ReviewEntry, positionName: (id: string | null) => string): string {
  if (entry.kind === "CALENDAR") {
    const state = (holiday: boolean | null, dayRate: number | null) =>
      `${holiday ? reviewCopy.holiday : reviewCopy.notHoliday}, ${dayRate === null ? reviewCopy.defaultDayRate : formatPesos(dayRate)}`;
    return reviewCopy.movement(state(entry.previous_holiday, entry.previous_day_rate), state(entry.new_holiday, entry.new_day_rate));
  }
  return describeAssignmentMovement(entry, (id) => (id ? positionName(id) : reviewCopy.emptyCell));
}
