import Link from "next/link";
import { dayCopy } from "@/copy/day";
import type { IsoDate } from "@/domain/bonus/types";
import { EditableCell } from "./EditableCell";
import { dayPath } from "./paths";
import type { PositionGroup } from "./positionGroups";
import { fullName, type DayRow } from "./queries";
import styles from "./DayGrid.module.css";

type DayGridProps = {
  date: IsoDate;
  rows: readonly DayRow[];
  positionGroups: readonly PositionGroup[];
  modifiedEmployeeIds: ReadonlySet<string>;
};

/** One row per person, the position in the cell: it reads like the sheet it replaces. */
export function DayGrid({ date, rows, positionGroups, modifiedEmployeeIds }: DayGridProps) {
  if (rows.length === 0) return <p className={styles.empty}>{dayCopy.noEmployees}</p>;

  return (
    <table className={styles.grid}>
      <thead>
        <tr>
          <th scope="col">{dayCopy.employeeColumn}</th>
          <th scope="col">{dayCopy.positionColumn}</th>
          <th scope="col" className={styles.historyColumn}>
            <span className={styles.visuallyHidden}>{dayCopy.historyColumn}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ employee, assignment }) => {
          const modified = modifiedEmployeeIds.has(employee.id);
          return (
            <tr key={employee.id} data-modified={modified || undefined}>
              <th scope="row" className={styles.employee}>
                <Link href={dayPath(date, { employeeId: employee.id })} scroll={false}>
                  {fullName(employee)}
                </Link>
                {!employee.active && <span className={styles.tag}>{dayCopy.inactive}</span>}
              </th>
              <td className={styles.position}>
                <EditableCell
                  date={date}
                  employeeId={employee.id}
                  employeeName={fullName(employee)}
                  positionId={assignment?.position_id ?? null}
                  note={assignment?.note ?? null}
                  groups={positionGroups}
                />
                {modified && <span className={styles.modified}>{dayCopy.modified}</span>}
              </td>
              <td className={styles.historyColumn}>
                <Link href={dayPath(date, { cellEmployeeId: employee.id })} scroll={false}>
                  {dayCopy.historyLink}
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
