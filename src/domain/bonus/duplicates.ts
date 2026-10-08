import type { BonusAssignment, BonusPosition } from "./types";

export type DuplicatedPosition = { positionId: string; occupantCount: number };

/**
 * Rate-bearing positions held by more than one person on a date. Scheme triggers and positions off
 * the line legitimately hold several people, and a late arrival is not an occupant. Needs no
 * settings, so it serves the roles that never see an amount.
 */
export function findDuplicatedPositions(
  assignments: readonly BonusAssignment[],
  positions: readonly BonusPosition[],
): DuplicatedPosition[] {
  const positionsById = new Map(positions.map((position) => [position.id, position]));
  const occupantsByPosition = new Map<string, number>();
  for (const assignment of assignments) {
    const position = positionsById.get(assignment.positionId);
    if (!position?.bonusEligible || position.triggersEqualShare || assignment.late) continue;
    occupantsByPosition.set(assignment.positionId, (occupantsByPosition.get(assignment.positionId) ?? 0) + 1);
  }
  return [...occupantsByPosition]
    .filter(([, occupantCount]) => occupantCount > 1)
    .map(([positionId, occupantCount]) => ({ positionId, occupantCount }));
}
