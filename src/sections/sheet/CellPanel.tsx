"use client";

import { Drawer } from "@/components/Drawer";
import { dayCopy } from "@/copy/day";
import { sheetCopy } from "@/copy/sheet";
import { useCellHistory } from "@/hooks/useCellHistory";
import { formatLongDate } from "@/utils/chileDate";
import { formatPesos } from "@/utils/money";
import { CellHistoryList } from "../day/CellHistoryList";
import { CellNote } from "../day/CellNote";
import type { PositionGroup } from "../day/positionGroups";
import { fullName, type Employee, type Position } from "../day/queries";
import type { CellSelection } from "./cellSelection";
import { describeMarks } from "./incompleteDay";
import { IncompleteDayMarks } from "./IncompleteDayMarks";
import { PositionPicker } from "./PositionPicker";
import type { BonusBasis, CellBonus, PanelAssignment } from "./sheetModel";
import styles from "./SheetPanels.module.css";

type CellPanelProps = {
  selection: CellSelection;
  employee: Pick<Employee, "first_name" | "last_name">;
  assignment: PanelAssignment | null;
  /** Undefined for a role that never sees amounts: the bonus fact is left out. */
  bonus: CellBonus | null | undefined;
  positionsById: ReadonlyMap<string, Position>;
  positionGroups: readonly PositionGroup[];
  /** The arrows' targets along the row, or null at the edge of the range. */
  previousHref: string | null;
  nextHref: string | null;
  /** Opens the range panel from this cell. */
  rangeHref: string;
  /** Changes with every server render, so the history is read again after an edit lands. */
  freshness: unknown;
  onClose: () => void;
};

/**
 * One person on one date: what they did and earned, the picker, the note and the
 * history. Everything but the history comes with the sheet, so it opens without a server render.
 */
export function CellPanel(props: CellPanelProps) {
  const { selection, employee, assignment, bonus, positionsById, positionGroups } = props;
  const { date, employeeId } = selection;
  const marks = assignment ? describeMarks(assignment) : null;
  const incomplete = assignment !== null && (assignment.late || assignment.left_early);

  return (
    <Drawer title={`${fullName(employee)} · ${formatLongDate(date)}`} onClose={props.onClose} closeLabel={dayCopy.close}>
      <dl className={styles.facts}>
        <div>
          <dt>{sheetCopy.position}</dt>
          <dd>{assignment ? (positionsById.get(assignment.position_id)?.name ?? "") : sheetCopy.noPosition}</dd>
        </div>
        {bonus !== undefined && (
          <div>
            <dt>{sheetCopy.dayBonus}</dt>
            <dd>
              {incomplete
                ? sheetCopy.incompleteBonus(assignment.late, assignment.left_early)
                : bonus?.amount
                  ? formatPesos(bonus.amount)
                  : sheetCopy.noBonus}
            </dd>
          </div>
        )}
        {bonus?.amount ? (
          <div className={styles.factWide}>
            <dt>{sheetCopy.basisTitle}</dt>
            <dd>{describeBasis(bonus.basis)}</dd>
          </div>
        ) : null}
        {marks && (
          <div className={styles.factWide}>
            <dt>{sheetCopy.attendance}</dt>
            <dd className={styles.marked}>{marks}</dd>
          </div>
        )}
      </dl>

      <PositionPicker
        date={date}
        employeeId={employeeId}
        positionId={assignment?.position_id ?? null}
        note={assignment?.note ?? null}
        groups={positionGroups}
      />
      {assignment && positionsById.get(assignment.position_id)?.type === "WORK" && (
        <IncompleteDayMarks
          date={date}
          employeeId={employeeId}
          positionId={assignment.position_id}
          note={assignment.note}
          late={assignment.late}
          lateNotified={assignment.late_notified}
          leftEarly={assignment.left_early}
        />
      )}
      <section className={styles.fromCell}>
        <h3 className={styles.heading}>{sheetCopy.fromCellTitle}</h3>
        <p className={styles.muted}>{sheetCopy.fromCellHint}</p>
        <a href={props.rangeHref} data-cell-link className={styles.rangeLink}>
          {sheetCopy.fromCellButton}
        </a>
      </section>

      <nav className={styles.steps}>
        {props.previousHref ? (
          <a href={props.previousHref} data-cell-link className={styles.step}>
            {sheetCopy.previousDay}
          </a>
        ) : (
          <span />
        )}
        {props.nextHref && (
          <a href={props.nextHref} data-cell-link className={styles.step}>
            {sheetCopy.nextDay}
          </a>
        )}
      </nav>

      <section className={styles.section}>
        <h3 className={styles.heading}>{dayCopy.note}</h3>
        <CellNote date={date} employeeId={employeeId} assignment={assignment} />
      </section>
      <section className={styles.section}>
        <h3 className={styles.heading}>{dayCopy.history}</h3>
        <History selection={selection} positionsById={positionsById} freshness={props.freshness} />
      </section>
    </Drawer>
  );
}

function describeBasis(basis: BonusBasis): string {
  if (basis.scheme === "EQUAL_SHARE") return sheetCopy.basisEqualShare(basis.sharedBy);
  return basis.scheme === "DAY_RATE" ? sheetCopy.basisDayRate : sheetCopy.basisPositionRate;
}

type HistoryProps = Pick<CellPanelProps, "selection" | "positionsById" | "freshness">;

function History({ selection, positionsById, freshness }: HistoryProps) {
  const history = useCellHistory(selection, freshness);
  if (history.status === "LOADING") return <p className={styles.muted}>{sheetCopy.historyLoading}</p>;
  if (history.status === "FAILED") return <p className={styles.muted}>{sheetCopy.historyFailed}</p>;
  return <CellHistoryList history={history.data} positionsById={positionsById} />;
}
