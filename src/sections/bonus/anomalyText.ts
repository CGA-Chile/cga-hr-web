import { summaryCopy } from "@/copy/summary";
import type { DailyBonusAnomaly } from "@/domain/bonus/types";
import { formatPesos } from "@/utils/money";

export type AnomalyText = { text: string; quiet: boolean };

/**
 * The words for an anomaly. Loud or quiet comes from `affectsAmount`, never from re-deriving the
 * scheme: the calculation already decided whether the duplicate costs money today.
 */
export function describeAnomaly(anomaly: DailyBonusAnomaly, positionName: (id: string) => string): AnomalyText {
  if (anomaly.kind === "ABOVE_DAILY_CAP") {
    return { text: summaryCopy.aboveCap(formatPesos(anomaly.total), formatPesos(anomaly.dailyCap)), quiet: false };
  }
  const name = positionName(anomaly.positionId);
  return anomaly.affectsAmount
    ? { text: summaryCopy.duplicateAffectsAmount(name, anomaly.occupantCount), quiet: false }
    : { text: summaryCopy.duplicateHarmlessToday(name, anomaly.occupantCount), quiet: true };
}
