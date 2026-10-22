import Link from "next/link";
import type { ReactNode } from "react";
import { anomaliesCopy } from "@/copy/anomalies";
import { dayCopy } from "@/copy/day";
import type { IsoDate } from "@/domain/bonus/types";
import { DayGrid } from "./DayGrid";
import { DayNavigation } from "./DayNavigation";
import type { PositionGroup } from "./positionGroups";
import type { DayRow } from "./queries";
import styles from "./DayView.module.css";

type DayViewProps = {
  date: IsoDate;
  today: IsoDate;
  rows: readonly DayRow[];
  positionGroups: readonly PositionGroup[];
  modifiedEmployeeIds: ReadonlySet<string>;
  summary: ReactNode;
  anomalousDateCount: number;
};

/** Editable on arrival: every change is recorded in the cell's history, so nothing is lost to a misclick. */
export function DayView({ summary, anomalousDateCount, ...grid }: DayViewProps) {
  return (
    <main className="page">
      <DayNavigation date={grid.date} today={grid.today} />
      <Link href="/avisos" className={styles.anomalies} data-some={anomalousDateCount > 0 || undefined}>
        {anomaliesCopy.link(anomalousDateCount)}
      </Link>
      <div className={styles.toolbar}>
        <p className={styles.notice}>{dayCopy.saveNotice}</p>
      </div>
      {summary}
      <DayGrid {...grid} />
    </main>
  );
}
