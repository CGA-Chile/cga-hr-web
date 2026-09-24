import Link from "next/link";
import { adminCopy } from "@/copy/admin";
import { formatLongDate } from "@/utils/chileDate";
import { formatPesos } from "@/utils/money";
import { EmployeeActiveToggle } from "./EmployeeActiveToggle";
import type { AdminEmployee, AdminPosition, RateVersion } from "./queries";
import styles from "./Admin.module.css";

export function EmployeesTable({ employees, editHref }: { employees: readonly AdminEmployee[]; editHref: (id: string) => string }) {
  const copy = adminCopy.employees;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">{copy.firstName}</th>
          <th scope="col">{copy.nationalId}</th>
          <th scope="col">{copy.active}</th>
          <th scope="col" />
        </tr>
      </thead>
      <tbody>
        {employees.map((employee) => {
          const name = `${employee.first_name} ${employee.last_name}`;
          return (
            <tr key={employee.id}>
              <td>{name}</td>
              <td>{employee.national_id ?? "—"}</td>
              <td className={employee.active ? undefined : styles.muted}>{employee.active ? copy.active : copy.inactive}</td>
              <td>
                <div className={styles.actions}>
                  <Link href={editHref(employee.id)} scroll={false} className={styles.link}>
                    {adminCopy.edit}
                  </Link>
                  <EmployeeActiveToggle id={employee.id} name={name} active={employee.active} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function PositionsTable({ positions, editHref }: { positions: readonly AdminPosition[]; editHref: (id: string) => string }) {
  const copy = adminCopy.positions;
  const yesNo = (value: boolean) => (value ? copy.yes : copy.no);
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">{copy.displayOrder}</th>
          <th scope="col">{copy.name}</th>
          <th scope="col">{copy.code}</th>
          <th scope="col">{copy.type}</th>
          <th scope="col">{copy.bonusEligible}</th>
          <th scope="col">{copy.triggersEqualShare}</th>
          <th scope="col">{copy.active}</th>
          <th scope="col" />
        </tr>
      </thead>
      <tbody>
        {positions.map((position) => (
          <tr key={position.id} className={position.active ? undefined : styles.muted}>
            <td>{position.display_order}</td>
            <td>{position.name}</td>
            <td>{position.code}</td>
            <td>{position.type === "ABSENCE" ? copy.types.ABSENCE : copy.types.WORK}</td>
            <td>{yesNo(position.bonus_eligible)}</td>
            <td>{yesNo(position.triggers_equal_share)}</td>
            <td>{yesNo(position.active)}</td>
            <td className={styles.actions}>
              <Link href={editHref(position.id)} scroll={false} className={styles.link}>
                {adminCopy.edit}
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RateVersions({ versions, positionName }: { versions: readonly RateVersion[]; positionName: (id: string) => string }) {
  const copy = adminCopy.rates;
  return (
    <>
      {versions.map((version) => (
        <section key={version.id} className={styles.version} data-current={version.effective_to === null || undefined}>
          <div className={styles.versionHeader}>
            <span>
              {copy.range(
                formatLongDate(version.effective_from),
                version.effective_to ? formatLongDate(version.effective_to) : null,
              )}
            </span>
            {version.effective_to === null && <span className={styles.tag}>{copy.current}</span>}
          </div>
          <table className={styles.table}>
            <tbody>
              {version.rates.map((rate) => (
                <tr key={rate.position_id}>
                  <td>{positionName(rate.position_id)}</td>
                  <td>{formatPesos(rate.amount)}</td>
                </tr>
              ))}
              <tr>
                <td>{copy.dailyCap}</td>
                <td>{formatPesos(version.daily_cap)}</td>
              </tr>
              <tr>
                <td>{copy.maxAmountPerPerson}</td>
                <td>{formatPesos(version.max_amount_per_person)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}
