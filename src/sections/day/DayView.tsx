import { dayCopy } from "@/copy/day";
import type { IsoDate } from "@/domain/bonus/types";
import { DayGrid } from "./DayGrid";
import { DayNavigation } from "./DayNavigation";
import type { DayRow, Position } from "./queries";
import styles from "./DayView.module.css";

type DayViewProps = {
  date: IsoDate;
  today: IsoDate;
  rows: readonly DayRow[];
  positionsById: ReadonlyMap<string, Position>;
};

/** Opens locked for every role: a misclick here pays someone the wrong amount. */
export function DayView({ date, today, rows, positionsById }: DayViewProps) {
  return (
    <main className="page">
      <DayNavigation date={date} today={today} />
      <div className={styles.modeBar}>
        <p className={styles.notice}>{dayCopy.readModeNotice}</p>
        <button type="button" className={styles.edit}>
          {dayCopy.edit}
        </button>
      </div>
      <DayGrid date={date} rows={rows} positionsById={positionsById} />
    </main>
  );
}
