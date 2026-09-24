"use client";

import { useRouter } from "next/navigation";
import { dayCopy } from "@/copy/day";
import { dayPath } from "./paths";
import styles from "./DayNavigation.module.css";

export function DatePicker({ date }: { date: string }) {
  const router = useRouter();

  return (
    <label className={styles.picker}>
      <span className={styles.visuallyHidden}>{dayCopy.goToDate}</span>
      <input
        type="date"
        value={date}
        onChange={(event) => {
          if (event.target.value) router.push(dayPath(event.target.value));
        }}
        className={styles.dateInput}
      />
    </label>
  );
}
