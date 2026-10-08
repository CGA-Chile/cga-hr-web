import { dayCopy } from "@/copy/day";

type Movement = {
  previous_position_id: string | null;
  new_position_id: string | null;
  previous_late: boolean | null;
  new_late: boolean | null;
};

/**
 * One history row in words: the position it moved from and to, or, when the position stayed and
 * only the late mark changed, that change. Rows from before late was recorded carry nulls.
 */
export function describeMovement(movement: Movement, positionName: (id: string | null) => string): string {
  const samePosition = movement.previous_position_id === movement.new_position_id;
  if (samePosition && movement.previous_late !== null && movement.new_late !== null) {
    return movement.new_late ? dayCopy.markedLate : dayCopy.unmarkedLate;
  }
  const arrow = `${positionName(movement.previous_position_id)} → ${positionName(movement.new_position_id)}`;
  return movement.new_late ? `${arrow} ${dayCopy.lateSuffix}` : arrow;
}
