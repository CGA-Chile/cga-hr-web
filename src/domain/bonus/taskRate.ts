import type { BonusSettings } from "./types";

/** A task without an amount in force is a configuration gap; paying zero would hide it. */
export function taskRate(settings: Pick<BonusSettings, "taskRates">, bonusTaskId: string): number {
  const rate = settings.taskRates.get(bonusTaskId);
  if (rate === undefined) {
    throw new Error(`No rate in force for bonus task ${bonusTaskId}`);
  }
  return rate;
}
