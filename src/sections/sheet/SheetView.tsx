import Link from "next/link";
import type { ReactNode } from "react";
import { anomaliesCopy } from "@/copy/anomalies";
import { sheetCopy } from "@/copy/sheet";
import { addDays, formatDayMonth } from "@/utils/chileDate";
import { sheetPath, type SheetParams } from "./paths";
import type { SheetRange, SheetRanges, SheetWeek } from "./sheetRange";
import styles from "./SheetView.module.css";

type SheetViewProps = {
  ranges: SheetRanges;
  week: SheetWeek;
  params: SheetParams;
  /** The period before an upcoming range, named in "created when … closes". */
  previousName: string | null;
  anomalousDateCount: number;
  grid: ReactNode;
};

/** Opens locked for every role, like the day view: a misclick here pays someone the wrong amount. */
export function SheetView({ ranges, week, params, previousName, anomalousDateCount, grid }: SheetViewProps) {
  const { current } = ranges;
  const editing = Boolean(params.editing);
  const atRange = (start: string) => sheetPath({ start, editing });

  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <div className={styles.period}>
          <StepLink href={ranges.previousStart ? atRange(ranges.previousStart) : null} label={sheetCopy.previousPeriod}>
            ←
          </StepLink>
          <div>
            <h1 className={styles.title}>{current.name}</h1>
            <p className={styles.subtitle}>
              {sheetCopy.range(formatDayMonth(current.start), formatDayMonth(current.end))} · {statusOf(current, previousName)}
              {current.endMovable && (
                <>
                  {" · "}
                  <Link href={sheetPath({ ...params, date: null, endPanel: true })} scroll={false}>
                    {sheetCopy.changeEnd}
                  </Link>
                </>
              )}
            </p>
          </div>
          <StepLink href={ranges.nextStart ? atRange(ranges.nextStart) : null} label={sheetCopy.nextPeriod}>
            →
          </StepLink>
        </div>
        <Link href="/avisos" className={styles.anomalies} data-some={anomalousDateCount > 0 || undefined}>
          {anomaliesCopy.link(anomalousDateCount)}
        </Link>
      </div>

      <div className={styles.modeBar} data-editing={editing || undefined}>
        <p className={styles.notice}>{editing ? sheetCopy.editModeNotice : sheetCopy.readModeNotice}</p>
        <Link href={sheetPath({ ...params, editing: !editing })} scroll={false} className={styles.edit}>
          {editing ? sheetCopy.finishEditing : sheetCopy.edit}
        </Link>
      </div>

      <ul className={styles.legend}>
        <li data-tone="LINE">{sheetCopy.legendLine}</li>
        <li data-tone="TRIGGER">{sheetCopy.legendTrigger}</li>
        <li data-tone="OTHER">{sheetCopy.legendOther}</li>
        <li data-tone="ABSENCE">{sheetCopy.legendAbsence}</li>
        <li data-tone="DUPLICATED">{sheetCopy.legendDuplicated}</li>
      </ul>

      <nav className={styles.weekNav}>
        <StepLink href={week.previous ? sheetPath({ ...params, week: week.previous }) : null} label={sheetCopy.previousWeek}>
          ←
        </StepLink>
        <span className={styles.weekLabel}>
          {sheetCopy.weekRange(formatDayMonth(week.start), formatDayMonth(addDays(week.start, 6)))}
        </span>
        <StepLink href={week.next ? sheetPath({ ...params, week: week.next }) : null} label={sheetCopy.nextWeek}>
          →
        </StepLink>
      </nav>

      {grid}
      <p className={styles.hint}>{sheetCopy.hint}</p>
    </main>
  );
}

function statusOf(range: SheetRange, previousName: string | null): string {
  if (range.period) return range.period.status === "CLOSED" ? sheetCopy.closed : sheetCopy.open;
  return previousName ? sheetCopy.upcoming(previousName) : sheetCopy.upcomingFirst;
}

function StepLink({ href, label, children }: { href: string | null; label: string; children: ReactNode }) {
  if (!href) return <span className={styles.step} aria-hidden="true" data-disabled />;
  return (
    <Link href={href} scroll={false} className={styles.step} aria-label={label}>
      {children}
    </Link>
  );
}
