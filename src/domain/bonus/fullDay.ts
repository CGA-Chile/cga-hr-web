import type { BonusAssignment } from "./types";

/**
 * The bonus is for a whole day. Someone who arrived late or left early keeps their position on the
 * sheet but, for the bonus, was not there: they earn nothing, are not counted in the equal share,
 * and are not an occupant when looking for duplicates.
 */
export function workedFullDay(assignment: Pick<BonusAssignment, "late" | "leftEarly">): boolean {
  return !assignment.late && !assignment.leftEarly;
}

/**
 * Whether the line or the day rate pays this assignment. A bonus task is the person's only bonus
 * that day, so for the line they are treated exactly like an incomplete day.
 */
export function earnsDailyBonus(assignment: Pick<BonusAssignment, "late" | "leftEarly" | "bonusTaskId">): boolean {
  return workedFullDay(assignment) && assignment.bonusTaskId === null;
}
