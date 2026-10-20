import Link from "next/link";
import { Drawer } from "@/components/Drawer";
import { dayCopy } from "@/copy/day";
import { sheetCopy } from "@/copy/sheet";
import type { Period } from "@/sections/periods/queries";
import { formatDayMonth } from "@/utils/chileDate";
import { formatPesos } from "@/utils/money";
import { sheetPath, type SheetParams } from "./paths";
import type { PersonBonuses } from "./personBonuses";
import { ReprimandForm } from "./ReprimandForm";
import styles from "./SheetPanels.module.css";

type PersonPanelProps = {
  employeeId: string;
  name: string;
  params: SheetParams;
  /** The period the sheet shows; null for the days after the last one. */
  period: Period | null;
  bonuses: PersonBonuses;
  reprimand: { note: string | null } | null;
};

/**
 * One person's bonuses in the period on screen, each kept apart, and their reprimand. The period
 * bonuses depend on the end date until the close, so they are labelled as estimates; a closed
 * period points to the report, where the frozen amounts are.
 */
export function PersonPanel({ employeeId, name, params, period, bonuses, reprimand }: PersonPanelProps) {
  const copy = sheetCopy.person;
  const closeHref = sheetPath({ ...params, person: null });

  return (
    <Drawer title={name} closeHref={closeHref} closeLabel={dayCopy.close}>
      {!period ? (
        <p className={styles.muted}>{copy.noPeriod}</p>
      ) : period.status === "CLOSED" ? (
        <section className={styles.section}>
          <p className={styles.muted}>{copy.closed}</p>
          <Link href={`/reporte?cierre=${period.id}&vista=detalle`} className={styles.link}>
            {copy.openReport}
          </Link>
        </section>
      ) : (
        <section className={styles.section}>
          <h3 className={styles.heading}>{copy.bonusesTitle}</h3>
          <dl className={styles.facts}>
            <div>
              <dt>{copy.carding}</dt>
              <dd>{formatPesos(bonuses.carding)}</dd>
            </div>
            <div>
              <dt>{copy.dayRate}</dt>
              <dd>{formatPesos(bonuses.dayRate)}</dd>
            </div>
            {bonuses.period && (
              <>
                <div>
                  <dt>
                    {copy.production} · {copy.estimated}
                  </dt>
                  <dd>{formatPesos(bonuses.period.production)}</dd>
                  <dd className={styles.factHint}>
                    {copy.days(bonuses.period.productionDays, bonuses.period.workingDays)}
                  </dd>
                </div>
                <div>
                  <dt>
                    {copy.compliance} · {copy.estimated}
                  </dt>
                  <dd>{formatPesos(bonuses.period.compliance)}</dd>
                  <dd className={styles.factHint}>
                    {copy.days(bonuses.period.complianceDays, bonuses.period.workingDays)}
                  </dd>
                </div>
                <div className={styles.factWide}>
                  <dt>{copy.strikesTitle}</dt>
                  <dd>{copy.strikes(bonuses.period.strikes)}</dd>
                </div>
              </>
            )}
          </dl>
          <p className={styles.muted}>
            {bonuses.period ? copy.estimatedHint(formatDayMonth(period.end_date)) : copy.noPeriodBonuses}
          </p>
        </section>
      )}

      {period && (
        <section className={styles.section}>
          <h3 className={styles.heading}>{copy.reprimandTitle}</h3>
          {params.editing && period.status === "OPEN" ? (
            <ReprimandForm
              key={employeeId}
              periodId={period.id}
              employeeId={employeeId}
              reprimanded={reprimand !== null}
              note={reprimand?.note ?? null}
              doneHref={sheetPath(params)}
            />
          ) : (
            <p className={reprimand ? styles.alert : styles.muted}>
              {reprimand ? `${copy.reprimanded}${reprimand.note ? `: ${reprimand.note}` : "."}` : copy.reprimandNone}
            </p>
          )}
        </section>
      )}
    </Drawer>
  );
}
