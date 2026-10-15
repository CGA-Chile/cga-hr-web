import { dayCopy } from "@/copy/day";

type Movement = {
  previous_position_id: string | null;
  new_position_id: string | null;
  previous_late: boolean | null;
  new_late: boolean | null;
  previous_late_notified: boolean | null;
  new_late_notified: boolean | null;
  previous_left_early: boolean | null;
  new_left_early: boolean | null;
};

/**
 * One history row in words: the position it moved from and to, or, when the position stayed and
 * only a mark changed, that change. Rows from before a mark was recorded carry nulls for it.
 */
export function describeMovement(movement: Movement, positionName: (id: string | null) => string): string {
  if (movement.previous_position_id === movement.new_position_id) {
    const changes = markChanges(movement);
    if (changes.length > 0) return changes.join(" · ");
  }
  const arrow = `${positionName(movement.previous_position_id)} → ${positionName(movement.new_position_id)}`;
  const suffixes = [movement.new_late && dayCopy.lateSuffix, movement.new_left_early && dayCopy.leftEarlySuffix];
  return [arrow, ...suffixes.filter((suffix) => typeof suffix === "string")].join(" ");
}

function markChanges(movement: Movement): string[] {
  const changes: string[] = [];
  const { previous_late: wasLate, new_late: isLate } = movement;
  if (wasLate !== null && isLate !== null) {
    const noticeChanged = movement.previous_late_notified !== movement.new_late_notified;
    if (isLate && (!wasLate || noticeChanged)) changes.push(dayCopy.markedLate(movement.new_late_notified));
    if (wasLate && !isLate) changes.push(dayCopy.unmarkedLate);
  }
  const { previous_left_early: leftEarlyBefore, new_left_early: leftEarlyNow } = movement;
  if (leftEarlyBefore !== null && leftEarlyNow !== null && leftEarlyBefore !== leftEarlyNow) {
    changes.push(leftEarlyNow ? dayCopy.markedLeftEarly : dayCopy.unmarkedLeftEarly);
  }
  return changes;
}
