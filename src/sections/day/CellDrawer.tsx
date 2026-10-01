import { Drawer } from "@/components/Drawer";
import { dayCopy } from "@/copy/day";
import type { IsoDate } from "@/domain/bonus/types";
import { formatLongDate } from "@/utils/chileDate";
import { CellHistoryList } from "./CellHistoryList";
import { CellNote } from "./CellNote";
import { dayPath } from "./paths";
import { fullName, type Assignment, type CellMovement, type Employee, type Position } from "./queries";
import styles from "./CellDrawer.module.css";

type CellDrawerProps = {
  date: IsoDate;
  editing: boolean;
  employee: Employee;
  assignment: Assignment | null;
  history: readonly CellMovement[];
  positionsById: ReadonlyMap<string, Position>;
};

/** Who changed this cell, when, and from what to what. Readable in both modes. */
export function CellDrawer({ date, editing, employee, assignment, history, positionsById }: CellDrawerProps) {
  return (
    <Drawer
      title={`${fullName(employee)} · ${formatLongDate(date)}`}
      closeHref={dayPath(date, { editing })}
      closeLabel={dayCopy.close}
    >
      <section className={styles.section}>
        <h3 className={styles.heading}>{dayCopy.note}</h3>
        <CellNote date={date} employeeId={employee.id} assignment={assignment} editing={editing} />
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>{dayCopy.history}</h3>
        <CellHistoryList history={history} positionsById={positionsById} />
      </section>
    </Drawer>
  );
}
