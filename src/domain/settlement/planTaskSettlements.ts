import { findSettingsInForce } from "@/domain/bonus/settingsInForce";
import { taskRate } from "@/domain/bonus/taskRate";
import type { BonusSettingsVersion, IsoDate } from "@/domain/bonus/types";
import type { OwedTask, TaskSettlementEntry, TaskSettlementPlan } from "./types";

type TaskCloseCandidate = {
  startDate: IsoDate;
  endDate: IsoDate;
  owed: readonly OwedTask[];
  versions: readonly BonusSettingsVersion[];
};

/**
 * The bonus tasks a close pays: every task owed on or before the period's end, at the amount in
 * force on its date. A task is the person's only bonus that day, so what the line or the day rate
 * already froze for that date is deducted, never below zero: a task marked late tops the day up to
 * its own amount and never pays the day twice.
 */
export function planTaskSettlements(candidate: TaskCloseCandidate): TaskSettlementPlan {
  const due = candidate.owed.filter((day) => day.date <= candidate.endDate);
  const unpricedDates = new Set<IsoDate>();
  const toSettle = due.flatMap((day): TaskSettlementEntry[] => {
    const settings = findSettingsInForce(day.date, candidate.versions);
    if (!settings) {
      unpricedDates.add(day.date);
      return [];
    }
    const { paidAmount, ...task } = day;
    return [
      {
        ...task,
        amount: Math.max(0, taskRate(settings, day.bonusTaskId) - paidAmount),
        kind: day.date < candidate.startDate ? "CARRY_OVER" : "PERIOD",
      },
    ];
  });
  return { toSettle, unpricedDates: [...unpricedDates].sort() };
}
