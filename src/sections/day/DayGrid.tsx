import Link from "next/link";
import { dayCopy } from "@/copy/day";
import type { IsoDate } from "@/domain/bonus/types";
import { dayPath } from "./paths";
import { fullName, type DayRow, type Position } from "./queries";
import styles from "./DayGrid.module.css";

type DayGridProps = {
  date: IsoDate;
  rows: readonly DayRow[];
  positionsById: ReadonlyMap<string, Position>;
};

/** One row per person, the position in the cell: it reads like the sheet it replaces. */
export function DayGrid({ date, rows, positionsById }: DayGridProps) {
  if (rows.length === 0) return <p className={styles.empty}>{dayCopy.noEmployees}</p>;

  return (
    <table className={styles.grid}>
      <thead>
        <tr>
          <th scope="col">{dayCopy.employeeColumn}</th>
          <th scope="col">{dayCopy.positionColumn}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ employee, assignment }) => (
          <tr key={employee.id}>
            <th scope="row" className={styles.employee}>
              <Link href={dayPath(date, { persona: employee.id })} scroll={false}>
                {fullName(employee)}
              </Link>
              {!employee.active && <span className={styles.tag}>{dayCopy.inactive}</span>}
            </th>
            <td className={styles.position}>
              {assignment ? positionsById.get(assignment.position_id)?.name : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
