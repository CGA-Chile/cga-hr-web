import type { Position } from "./queries";

export type PositionGroup = { key: "LINE" | "OTHER" | "ABSENCE"; positions: Position[] };

/**
 * The picker's groups, in display order. The carding line comes first and holds Packing ACM;
 * generic Packing sits in another group entirely, since confusing the two changes the bonus for
 * the whole line.
 */
export function groupPositionsForPicker(positions: readonly Position[]): PositionGroup[] {
  const sorted = [...positions].sort((a, b) => a.display_order - b.display_order);
  return [
    { key: "LINE" as const, positions: sorted.filter((position) => position.bonus_eligible) },
    {
      key: "OTHER" as const,
      positions: sorted.filter((position) => !position.bonus_eligible && position.type === "WORK"),
    },
    { key: "ABSENCE" as const, positions: sorted.filter((position) => position.type === "ABSENCE") },
  ].filter((group) => group.positions.length > 0);
}
