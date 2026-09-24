import type { BonusSettingsVersion, IsoDate } from "./types";

/**
 * The settings version in force on `date`. Exactly one must match: none means the date has no
 * parameters to be paid with, and more than one means the versions overlap. Either is a data
 * error, and guessing between versions would pay someone with the wrong rates.
 */
export function settingsInForceOn(
  date: IsoDate,
  versions: readonly BonusSettingsVersion[],
): BonusSettingsVersion {
  const matching = versions.filter(
    (version) =>
      version.effectiveFrom <= date && (version.effectiveTo === null || date <= version.effectiveTo),
  );

  if (matching.length !== 1) {
    throw new Error(`Expected one bonus settings version in force on ${date}, found ${matching.length}`);
  }
  return matching[0];
}
