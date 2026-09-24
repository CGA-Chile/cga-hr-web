import Link from "next/link";
import type { ReactNode } from "react";
import { dayCopy } from "@/copy/day";
import type { IsoDate } from "@/domain/bonus/types";
import { DayGrid } from "./DayGrid";
import { DayNavigation } from "./DayNavigation";
import { dayPath } from "./paths";
import type { PositionGroup } from "./positionGroups";
import type { DayRow, Position } from "./queries";
import styles from "./DayView.module.css";

type DayViewProps = {
  date: IsoDate;
  today: IsoDate;
  editing: boolean;
  rows: readonly DayRow[];
  positionsById: ReadonlyMap<string, Position>;
  positionGroups: readonly PositionGroup[];
  modifiedEmployeeIds: ReadonlySet<string>;
  summary: ReactNode;
};

/** Opens locked for every role: a misclick here pays someone the wrong amount. */
export function DayView({ editing, summary, ...grid }: DayViewProps) {
  return (
    <main className="page">
      <DayNavigation date={grid.date} today={grid.today} />
      <div className={styles.modeBar} data-editing={editing || undefined}>
        <p className={styles.notice}>{editing ? dayCopy.editModeNotice : dayCopy.readModeNotice}</p>
        <Link href={dayPath(grid.date, { editing: !editing })} className={styles.edit}>
          {editing ? dayCopy.finishEditing : dayCopy.edit}
        </Link>
      </div>
      {summary}
      <DayGrid editing={editing} {...grid} />
    </main>
  );
}
