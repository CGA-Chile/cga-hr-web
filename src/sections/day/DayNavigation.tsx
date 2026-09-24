import Link from "next/link";
import { dayCopy } from "@/copy/day";
import type { IsoDate } from "@/domain/bonus/types";
import { addDays, formatLongDate } from "@/utils/chileDate";
import { DatePicker } from "./DatePicker";
import { dayPath } from "./paths";
import styles from "./DayNavigation.module.css";

type DayNavigationProps = { date: IsoDate; today: IsoDate };

export function DayNavigation({ date, today }: DayNavigationProps) {
  const yesterday = addDays(today, -1);

  return (
    <nav className={styles.nav}>
      <h1 className={styles.date}>{formatLongDate(date)}</h1>
      <div className={styles.controls}>
        <Link href={dayPath(addDays(date, -1))} className={styles.step} aria-label={dayCopy.previousDay}>
          ←
        </Link>
        <Link href={dayPath(today)} className={styles.quick} aria-current={date === today ? "date" : undefined}>
          {dayCopy.today}
        </Link>
        <Link href={dayPath(yesterday)} className={styles.quick} aria-current={date === yesterday ? "date" : undefined}>
          {dayCopy.yesterday}
        </Link>
        <Link href={dayPath(addDays(date, 1))} className={styles.step} aria-label={dayCopy.nextDay}>
          →
        </Link>
        <DatePicker date={date} />
      </div>
    </nav>
  );
}
