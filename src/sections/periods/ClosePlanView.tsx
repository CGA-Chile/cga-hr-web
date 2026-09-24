import Link from "next/link";
import type { ReactNode } from "react";
import { periodsCopy } from "@/copy/periods";
import { describeAnomaly } from "@/sections/bonus/anomalyText";
import { dayPath } from "@/sections/day/paths";
import { formatLongDate } from "@/utils/chileDate";
import { formatPesos } from "@/utils/money";
import type { LoadedClosePlan } from "./closePlan";
import styles from "./ClosePlanView.module.css";

type ClosePlanViewProps = {
  loaded: LoadedClosePlan;
  positionName: (id: string) => string;
  /** The close control, or the reason there is none. Only shown when the gate is clear. */
  closeControl: ReactNode;
  /** Validation controls for excesses, when the viewer may validate. */
  excessControl?: (date: string, settledTotal: number, dailyCap: number) => ReactNode;
};

/**
 * What closing would pay, split into period and carry-over, and what stands in the way. The gate
 * names each blocking date and links to it; it never corrects anything itself.
 */
export function ClosePlanView({ loaded, positionName, closeControl, excessControl }: ClosePlanViewProps) {
  const { plan, unpricedDates } = loaded;
  const blockingCount = plan.blockingDates.length + unpricedDates.length;

  return (
    <>
      <dl className={styles.totals}>
        <div>
          <dt>{periodsCopy.periodDays}</dt>
          <dd>{formatPesos(plan.periodTotal)}</dd>
        </div>
        <div>
          <dt>{periodsCopy.carryOver}</dt>
          <dd>{formatPesos(plan.carryOverTotal)}</dd>
          <p className={styles.hint}>{periodsCopy.carryOverHint}</p>
        </div>
        <div className={styles.grandTotal}>
          <dt>{periodsCopy.total}</dt>
          <dd>{formatPesos(plan.periodTotal + plan.carryOverTotal)}</dd>
        </div>
      </dl>

      {plan.toSettle.length === 0 && <p className={styles.hint}>{periodsCopy.nothingToSettle}</p>}

      {blockingCount > 0 && (
        <section className={styles.gate}>
          <h2 className={styles.gateTitle}>{periodsCopy.gateTitle}</h2>
          <p>{periodsCopy.gateIntro(blockingCount)}</p>
          <ul className={styles.dates}>
            {plan.blockingDates.map((blocking) => (
              <li key={blocking.date}>
                <DateHeading date={blocking.date} />
                <ul className={styles.reasons}>
                  {blocking.anomalies.map((anomaly) => {
                    const { text } = describeAnomaly(anomaly, positionName);
                    return <li key={text}>{text}</li>;
                  })}
                </ul>
              </li>
            ))}
            {unpricedDates.map((date) => (
              <li key={date}>
                <DateHeading date={date} />
                <ul className={styles.reasons}>
                  <li>{periodsCopy.unpriced}</li>
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.excessesRequiringValidation.length > 0 && (
        <section className={styles.excesses}>
          <h2 className={styles.sectionTitle}>{periodsCopy.excessTitle}</h2>
          <ul className={styles.dates}>
            {plan.excessesRequiringValidation.map((excess) => (
              <li key={excess.date}>
                <DateHeading date={excess.date} />
                {excess.validated ? (
                  <p className={styles.hint}>{periodsCopy.excessValidated}</p>
                ) : (
                  excessControl?.(excess.date, excess.settledTotal, excess.dailyCap)
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {blockingCount === 0 && <div className={styles.close}>{closeControl}</div>}
    </>
  );
}

function DateHeading({ date }: { date: string }) {
  return (
    <div className={styles.dateHeading}>
      <span className={styles.date}>{formatLongDate(date)}</span>
      <Link href={dayPath(date)}>{periodsCopy.goFix}</Link>
    </div>
  );
}
