"use client";

import { useState } from "react";
import { Drawer } from "@/components/Drawer";
import type { IsoDate } from "@/domain/bonus/types";
import { dayCopy } from "@/copy/day";
import { sheetCopy } from "@/copy/sheet";
import { useBrowserRead } from "@/hooks/useBrowserRead";
import { addDays, daysInRange, formatDayMonth, isIsoDate, todayInChile, weekdayOf } from "@/utils/chileDate";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import type { PositionGroup } from "../day/positionGroups";
import { fullName, loadStoredDays, type Employee, type Position } from "../day/queries";
import type { RangeOpening } from "./cellSelection";
import { PositionOptions } from "./PositionPicker";
import {
  planRange,
  rangeDates,
  summarizePlan,
  type PlannedDay,
  type PlanSummary,
  type PreviousDay,
  type RangeDays,
} from "./rangePlan";
import { cellKey, toneOf } from "./sheetModel";
import styles from "./SheetPanels.module.css";

/** apply_assignment_range refuses more; a year covers any leave the plant has seen. */
const MAX_DAYS = 366;
const LENGTHS = [7, 15, 21, 30];
const DAYS: readonly RangeDays[] = ["ALL", "MON_FRI", "MON_SAT"];

export type RangeDone = { employeeId: string; message: string; previous: PreviousDay[] };

type RangePanelProps = {
  opening: RangeOpening;
  employees: readonly Pick<Employee, "id" | "first_name" | "last_name">[];
  positionsById: ReadonlyMap<string, Position>;
  positionGroups: readonly PositionGroup[];
  /** The admin may replace a paid date, as with a single cell. */
  mayChangePaid: boolean;
  /** The last date on screen; changed dates after it belong to the next period. */
  end: IsoDate;
  /** Changes with every server render, so the preview is read again after an edit lands. */
  freshness: unknown;
  onClose: () => void;
  onApplied: (done: RangeDone) => void;
};

type SaveStatus = "IDLE" | "SAVING" | "OFFLINE" | "FAILED" | "NO_PERMISSION";

/**
 * One position for one person over a range of dates. The preview reads what those dates hold and
 * says, date by date, what the database will do; applying writes the whole range in one call or
 * nothing. It needs signal: unlike a single cell, it does not wait in the device's queue.
 */
export function RangePanel(props: RangePanelProps) {
  const { opening, employees, positionsById, positionGroups, mayChangePaid } = props;
  const start = opening.from ?? todayInChile();
  const [employeeId, setEmployeeId] = useState(
    employees.some((employee) => employee.id === opening.employeeId) ? (opening.employeeId ?? "") : "",
  );
  const [positionId, setPositionId] = useState<string | null | undefined>(undefined);
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(start);
  const [days, setDays] = useState<RangeDays>("ALL");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<SaveStatus>("IDLE");

  const datesProblem = !isIsoDate(from) || !isIsoDate(to)
    ? null
    : to < from
      ? sheetCopy.rangeEndBeforeStart
      : daysInRange(from, to) > MAX_DAYS
        ? sheetCopy.rangeTooLong
        : null;
  const dates = isIsoDate(from) && isIsoDate(to) && !datesProblem ? rangeDates({ from, to, days }) : [];
  const stored = useBrowserRead(
    `${employeeId}|${from}|${to}`,
    () =>
      employeeId && dates.length > 0
        ? loadStoredDays(createSupabaseBrowserClient(), employeeId, from, to)
        : Promise.resolve([]),
    props.freshness,
  );

  const noteToWrite = note.trim() || null;
  const plan =
    employeeId && positionId !== undefined && stored.status === "LOADED"
      ? planRange({ dates, stored: stored.data, positionId, note: noteToWrite, mayChangePaid })
      : null;
  const summary = plan && summarizePlan(plan, props.end);
  const employee = employees.find((candidate) => candidate.id === employeeId);
  const position = positionId ? positionsById.get(positionId) : undefined;

  const change = (update: () => void) => {
    update();
    setStatus("IDLE");
  };

  async function apply() {
    if (!summary?.changing || !employee || positionId === undefined) return;
    if (!navigator.onLine) return setStatus("OFFLINE");
    setStatus("SAVING");
    const { data, error } = await createSupabaseBrowserClient().rpc("apply_assignment_range", {
      p_employee_id: employee.id,
      p_dates: dates,
      p_position_id: positionId ?? undefined,
      p_note: noteToWrite ?? undefined,
    });
    if (error) return setStatus(error.code === "42501" ? "NO_PERMISSION" : "FAILED");

    const name = fullName(employee);
    const [first, last] = [formatDayMonth(from), formatDayMonth(to)];
    props.onApplied({
      employeeId: employee.id,
      previous: data,
      message: position
        ? sheetCopy.rangeDone(name, position.name, first, last, data.length)
        : sheetCopy.rangeDoneCleared(name, first, last, data.length),
    });
  }

  return (
    <Drawer title={sheetCopy.assignRange} onClose={props.onClose} closeLabel={dayCopy.close}>
      {plan && employeeId && <style>{planCss(plan, employeeId)}</style>}
      <div className={styles.form}>
        <p className={styles.muted}>{sheetCopy.rangeIntro}</p>

        <label className={styles.field}>
          <span className={styles.label}>{sheetCopy.rangeEmployee}</span>
          <select
            value={employeeId}
            onChange={(event) => change(() => setEmployeeId(event.target.value))}
            className={styles.input}
          >
            <option value="" disabled>
              {sheetCopy.rangeChooseEmployee}
            </option>
            {employees.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {fullName(candidate)}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.field}>
          <span className={styles.label}>{sheetCopy.rangePosition}</span>
          <div className={styles.picker}>
            <PositionOptions
              groups={positionGroups}
              selected={positionId}
              onChoose={(id) => change(() => setPositionId(id))}
            />
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.dates}>
            <label className={styles.field}>
              <span className={styles.label}>{sheetCopy.rangeFrom}</span>
              <input type="date" value={from} onChange={(event) => change(() => setFrom(event.target.value))} className={styles.input} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{sheetCopy.rangeTo}</span>
              <input type="date" value={to} onChange={(event) => change(() => setTo(event.target.value))} className={styles.input} />
            </label>
          </div>
          {isIsoDate(from) && (
            <div className={styles.lengths}>
              <span>{sheetCopy.rangeLengths}</span>
              {LENGTHS.map((length) => (
                <button key={length} type="button" onClick={() => change(() => setTo(addDays(from, length - 1)))} className={styles.chip}>
                  {sheetCopy.rangeLength(length)}
                </button>
              ))}
            </div>
          )}
        </div>

        <fieldset className={styles.group}>
          <legend className={styles.label}>{sheetCopy.rangeDaysLabel}</legend>
          <div className={styles.modes}>
            {DAYS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={days === option}
                onClick={() => change(() => setDays(option))}
                className={styles.option}
              >
                {sheetCopy.rangeDays[option]}
              </button>
            ))}
          </div>
        </fieldset>

        <label className={styles.field}>
          <span className={styles.label}>{sheetCopy.rangeNote}</span>
          <span className={styles.muted}>{sheetCopy.rangeNoteHint}</span>
          <textarea rows={2} value={note} onChange={(event) => change(() => setNote(event.target.value))} className={styles.input} />
        </label>

        {datesProblem ? (
          <p className={styles.alert}>{datesProblem}</p>
        ) : (
          <Preview
            plan={plan}
            summary={summary}
            loading={stored.status === "LOADING"}
            failed={stored.status === "FAILED"}
            span={
              isIsoDate(from) && isIsoDate(to)
                ? sheetCopy.rangeSpan(dates.length, days, formatDayMonth(from), formatDayMonth(to))
                : null
            }
            positionsById={positionsById}
          />
        )}

        <div className={styles.copy}>
          <button type="button" onClick={apply} disabled={status === "SAVING"} className={styles.primary}>
            {status === "SAVING" ? sheetCopy.rangeSaving : applyLabel(summary, positionId, position)}
          </button>
          <button type="button" onClick={props.onClose} className={styles.cancel}>
            {sheetCopy.rangeCancel}
          </button>
          {status !== "IDLE" && status !== "SAVING" && (
            <p role="status" className={styles.status} data-status="SETTLED">
              {status === "OFFLINE"
                ? sheetCopy.rangeOffline
                : status === "NO_PERMISSION"
                  ? sheetCopy.rangeNoPermission
                  : sheetCopy.unavailable}
            </p>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function applyLabel(summary: PlanSummary | null, positionId: string | null | undefined, position: Position | undefined) {
  if (!summary || positionId === undefined) return sheetCopy.rangeChoose;
  if (summary.changing === 0) return sheetCopy.rangeNothingToChange;
  return position ? sheetCopy.rangeApply(position.name, summary.changing) : sheetCopy.rangeApplyClear(summary.changing);
}

type PreviewProps = {
  plan: PlannedDay[] | null;
  summary: PlanSummary | null;
  loading: boolean;
  failed: boolean;
  span: string | null;
  positionsById: ReadonlyMap<string, Position>;
};

function Preview({ plan, summary, loading, failed, span, positionsById }: PreviewProps) {
  return (
    <section className={styles.preview} aria-live="polite">
      <div>
        <h3 className={styles.heading}>{sheetCopy.rangePreviewTitle}</h3>
        {span && <p className={styles.muted}>{span}</p>}
      </div>
      {failed ? (
        <p className={styles.muted}>{sheetCopy.rangeLoadFailed}</p>
      ) : !plan || !summary ? (
        <p className={styles.muted}>{loading ? sheetCopy.rangeLoading : sheetCopy.rangeChoose}</p>
      ) : (
        <>
          <ul className={styles.summary}>
            {summary.replace > 0 && <li data-strong>{sheetCopy.rangeReplace(summary.replace)}</li>}
            {summary.clear > 0 && <li data-strong>{sheetCopy.rangeClear(summary.clear)}</li>}
            {summary.fill > 0 && <li>{sheetCopy.rangeFill(summary.fill)}</li>}
            {summary.note > 0 && <li>{sheetCopy.rangeNoteOnly(summary.note)}</li>}
            {summary.same > 0 && <li data-muted>{sheetCopy.rangeSame(summary.same)}</li>}
            {summary.paid > 0 && <li data-strong>{sheetCopy.rangePaid(summary.paid)}</li>}
            {summary.firstAfterEnd && (
              <li data-muted>{sheetCopy.rangeAfterEnd(summary.afterEnd, formatDayMonth(summary.firstAfterEnd))}</li>
            )}
          </ul>
          <ol className={styles.tiles}>
            {plan.map((day) => (
              <Tile key={day.date} day={day} positionsById={positionsById} afterEnd={summary.firstAfterEnd !== null && day.date >= summary.firstAfterEnd} />
            ))}
          </ol>
          <p className={styles.muted}>{sheetCopy.rangeTilesHint}</p>
        </>
      )}
    </section>
  );
}

function Tile({ day, positionsById, afterEnd }: { day: PlannedDay; positionsById: ReadonlyMap<string, Position>; afterEnd: boolean }) {
  const before = day.before ? positionsById.get(day.before) : undefined;
  const after = day.after ? positionsById.get(day.after) : undefined;
  return (
    <li className={styles.tile} data-change={day.change} data-after-end={afterEnd || undefined}>
      <span className={styles.tileWeekday}>{sheetCopy.weekdayInitials[weekdayOf(day.date)]}</span>
      <span className={styles.tileDay}>{Number(day.date.slice(8))}</span>
      <span className={styles.tileBefore}>{before?.abbreviation ?? "—"}</span>
      <span className={styles.tileAfter} data-tone={after ? toneOf(after) : undefined}>
        {after?.abbreviation ?? "—"}
      </span>
    </li>
  );
}

/**
 * Outlines on the grid the cells the range will change, under the drawer. The values are a known
 * employee id and dates the range computed, never raw URL text.
 */
function planCss(plan: readonly PlannedDay[], employeeId: string): string {
  const outline = (change: PlannedDay["change"]) =>
    change === "REPLACE" || change === "CLEAR" ? "var(--color-warning)" : change === "FILL" || change === "NOTE" ? "var(--color-accent)" : null;
  return plan
    .map((day) => {
      const color = outline(day.change);
      return color
        ? `[data-cell-panel] td[data-cell="${cellKey(day.date, employeeId)}"] > a { outline: 2px dashed ${color}; outline-offset: -3px; }`
        : "";
    })
    .join("\n");
}
