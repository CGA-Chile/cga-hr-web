import type { BonusSettingsVersion, IsoDate } from "./types";

/**
 * The settings version in force on `date`, or null when none covers it. More than one match
 * means the versions overlap, which is a data error: guessing between them would pay someone
 * with the wrong rates.
 */
export function findSettingsInForce(
  date: IsoDate,
  versions: readonly BonusSettingsVersion[],
): BonusSettingsVersion | null {
  const matching = versions.filter(
    (version) =>
      version.effectiveFrom <= date && (version.effectiveTo === null || date <= version.effectiveTo),
  );

  if (matching.length > 1) {
    throw new Error(`Expected one bonus settings version in force on ${date}, found ${matching.length}`);
  }
  return matching[0] ?? null;
}

/** As findSettingsInForce, for callers that cannot proceed without parameters. */
export function settingsInForceOn(
  date: IsoDate,
  versions: readonly BonusSettingsVersion[],
): BonusSettingsVersion {
  const settings = findSettingsInForce(date, versions);
  if (!settings) {
    throw new Error(`Expected one bonus settings version in force on ${date}, found 0`);
  }
  return settings;
}
