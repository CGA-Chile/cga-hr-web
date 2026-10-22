import { Drawer } from "@/components/Drawer";
import { dayCopy } from "@/copy/day";
import type { IsoDate } from "@/domain/bonus/types";
import { formatMonth, formatShortDate } from "@/utils/chileDate";
import { dayPath } from "./paths";
import { fullName, type Assignment, type Employee, type Position } from "./queries";
import styles from "./EmployeeDrawer.module.css";

type EmployeeDrawerProps = {
  date: IsoDate;
  employee: Employee;
  assignments: readonly Assignment[];
  positionsById: ReadonlyMap<string, Position>;
};

export function EmployeeDrawer({ date, employee, assignments, positionsById }: EmployeeDrawerProps) {
  return (
    <Drawer title={fullName(employee)} closeHref={dayPath(date)} closeLabel={dayCopy.close}>
      <dl className={styles.facts}>
        <dt>{dayCopy.nationalId}</dt>
        <dd>{employee.national_id ?? "—"}</dd>
      </dl>

      <h3 className={styles.heading}>{dayCopy.assignmentsOfMonth(formatMonth(date))}</h3>
      {assignments.length === 0 ? (
        <p className={styles.empty}>{dayCopy.noAssignmentsInMonth}</p>
      ) : (
        <ul className={styles.list}>
          {assignments.map((assignment) => (
            <li key={assignment.id} className={styles.item} aria-current={assignment.date === date ? "date" : undefined}>
              <span className={styles.day}>{formatShortDate(assignment.date)}</span>
              <span>{positionsById.get(assignment.position_id)?.name}</span>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
