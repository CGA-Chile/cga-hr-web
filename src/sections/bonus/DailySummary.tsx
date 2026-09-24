import { summaryCopy } from "@/copy/summary";
import type { DailyBonusResult } from "@/domain/bonus/types";
import { formatPesos } from "@/utils/money";
import { describeAnomaly } from "./anomalyText";
import type { DailyBonus } from "./dailyBonuses";
import styles from "./DailySummary.module.css";

type SummaryPosition = { id: string; name: string; triggers_equal_share: boolean };

type DailySummaryProps = {
  /** Null when the date has no assignments at all. */
  dailyBonus: DailyBonus | null;
  positions: readonly SummaryPosition[];
  employeeName: (employeeId: string) => string;
};

/**
 * Which scheme applies and why, who earns what, the total, and the marks. It never blocks and
 * never scolds: a wrong total shows itself.
 */
export function DailySummary({ dailyBonus, positions, employeeName }: DailySummaryProps) {
  const positionName = (id: string) => positions.find((position) => position.id === id)?.name ?? "";

  return (
    <section className={styles.summary} aria-labelledby="daily-summary-title">
      <h2 id="daily-summary-title" className={styles.title}>
        {summaryCopy.title}
      </h2>
      {!dailyBonus || (dailyBonus.result && dailyBonus.result.perEmployee.length === 0) ? (
        <p className={styles.reason}>{summaryCopy.noLine}</p>
      ) : !dailyBonus.result ? (
        <p className={styles.mark}>{summaryCopy.noSettings}</p>
      ) : (
        <>
          <p className={styles.reason}>{schemeReason(dailyBonus.result, positions)}</p>
          <Marks result={dailyBonus.result} positionName={positionName} />
          <table className={styles.amounts}>
            <thead>
              <tr>
                <th scope="col">{summaryCopy.employeeColumn}</th>
                <th scope="col">{summaryCopy.positionColumn}</th>
                <th scope="col" className={styles.amount}>
                  {summaryCopy.amountColumn}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...dailyBonus.result.perEmployee]
                .sort((a, b) => employeeName(a.employeeId).localeCompare(employeeName(b.employeeId), "es"))
                .map((entry) => (
                <tr key={entry.employeeId}>
                  <td>{employeeName(entry.employeeId)}</td>
                  <td>{positionName(entry.positionId)}</td>
                  <td className={styles.amount}>{formatPesos(entry.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>
                  {summaryCopy.total}
                </th>
                <td className={styles.amount}>{formatPesos(dailyBonus.result.total)}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </section>
  );
}

function Marks({ result, positionName }: { result: DailyBonusResult; positionName: (id: string) => string }) {
  if (result.anomalies.length === 0) return null;
  return (
    <ul className={styles.marks}>
      {result.anomalies.map((anomaly) => {
        const { text, quiet } = describeAnomaly(anomaly, positionName);
        return (
          <li key={text} className={quiet ? styles.quietMark : styles.mark}>
            {text}
          </li>
        );
      })}
    </ul>
  );
}

/** Names the trigger, so the scheme is understood rather than just trusted. */
function schemeReason(result: DailyBonusResult, positions: readonly SummaryPosition[]): string {
  const triggers = positions.filter((position) => position.triggers_equal_share);
  if (result.scheme === "POSITION_RATE") {
    return summaryCopy.positionRate(triggers.map((trigger) => trigger.name).join(summaryCopy.or));
  }
  const presence = triggers
    .map((trigger) => ({
      name: trigger.name,
      count: result.perEmployee.filter((entry) => entry.positionId === trigger.id).length,
    }))
    .filter(({ count }) => count > 0)
    .map(({ name, count }) => summaryCopy.triggerPresence(count, name))
    .join(summaryCopy.and);
  return summaryCopy.equalShare(presence, formatPesos(result.perEmployee[0]?.amount ?? 0));
}
