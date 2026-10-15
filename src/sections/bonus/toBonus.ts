import type { BonusAssignment, BonusPosition } from "@/domain/bonus/types";

type PositionFlags = { id: string; bonus_eligible: boolean; triggers_equal_share: boolean; type: string };
type AssignmentMarks = { employee_id: string; position_id: string; late: boolean; left_early: boolean };

export function toBonusPosition(row: PositionFlags): BonusPosition {
  return {
    id: row.id,
    bonusEligible: row.bonus_eligible,
    triggersEqualShare: row.triggers_equal_share,
    absence: row.type === "ABSENCE",
  };
}

/** An assignment row as the calculation sees it: who, where, and whether the day was complete. */
export function toBonusAssignment(row: AssignmentMarks): BonusAssignment {
  return { employeeId: row.employee_id, positionId: row.position_id, late: row.late, leftEarly: row.left_early };
}
