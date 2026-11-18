// src/lib/positions.ts
// players_v2.strPosition(TheSportsDB 자유 문자열)을 GK·DF·MF·FW 로 묶는다.

export type PositionGroup = "GK" | "DF" | "MF" | "FW";

export const POSITION_GROUPS: { key: PositionGroup; label: string; positions: string[] }[] = [
  { key: "GK", label: "골키퍼", positions: ["Goalkeeper"] },
  { key: "DF", label: "수비수", positions: ["Defender", "Centre-Back", "Left-Back", "Right-Back"] },
  {
    key: "MF", label: "미드필더",
    positions: ["Midfielder", "Central Midfield", "Attacking Midfield", "Defensive Midfield", "Left Midfield", "Right Midfield"],
  },
  {
    key: "FW", label: "공격수",
    positions: ["Attacker", "Forward", "Centre-Forward", "Second Striker", "Left Wing", "Right Wing", "Left Winger", "Right Winger", "Winger"],
  },
];

// 선수 목록에서 뺄 스태프 포지션
export const STAFF_POSITIONS = ["Manager", "Coach", "Assistant Manager", "Goalkeeping Coach"];

export function positionGroupOf(position: string | null | undefined): PositionGroup | null {
  if (!position) return null;
  return POSITION_GROUPS.find((group) => group.positions.includes(position))?.key ?? null;
}

export function isPositionGroup(value: string | null | undefined): value is PositionGroup {
  return POSITION_GROUPS.some((group) => group.key === value);
}
