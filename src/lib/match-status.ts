// src/lib/match-status.ts
// events_v2.status(원천 코드)를 화면의 경기 상태로 묶는다 (docs/prd.md 8.2). 원천 코드는 DB 에 그대로 둔다.

export type MatchPhase = "scheduled" | "live" | "finished" | "postponed" | "cancelled" | "suspended" | "unknown";

const PHASE_BY_STATUS: Record<string, MatchPhase> = {
  // 매퍼가 'Time To Be Defined' 등 알 수 없는 상태를 UNKNOWN 으로 저장한다 (docs/prd.md 8.2 '시간 미정')
  SCHEDULED: "scheduled", NS: "scheduled", UNKNOWN: "scheduled",
  IN_PLAY: "live", LIVE: "live", "1H": "live", "2H": "live", HT: "live", ET: "live", BT: "live", P: "live",
  FINISHED: "finished", FT: "finished", AET: "finished", PEN: "finished",
  POSTPONED: "postponed",
  CANCELED: "cancelled",
  SUSP: "suspended", INT: "suspended",
};

export const STATUS_LABELS: Record<string, string> = {
  FINISHED: "경기 종료",
  FT: "경기 종료",
  AET: "연장 종료",
  PEN: "승부차기 종료",
  SCHEDULED: "경기 예정",
  NS: "경기 예정",
  UNKNOWN: "일정 미정",
  POSTPONED: "연기됨",
  SUSP: "중단",
  INT: "중단",
  IN_PLAY: "LIVE",
  LIVE: "LIVE",
  "1H": "전반",
  "2H": "후반",
  HT: "하프타임",
  ET: "연장",
  BT: "연장 휴식",
  P: "승부차기",
  CANCELED: "취소",
};

export function matchPhase(status: string | null | undefined): MatchPhase {
  return (status && PHASE_BY_STATUS[status]) || "unknown";
}

/** 킥오프 시각이 정해진 예정 경기인지 (UNKNOWN 은 매퍼가 임시 시각을 채워 두므로 시각을 보이지 않는다) */
export function hasKickoffTime(status: string | null | undefined): boolean {
  return status === "SCHEDULED" || status === "NS";
}

export function statusLabel(status: string | null | undefined): string {
  return (status && STATUS_LABELS[status]) || "상태 확인 중";
}

/** 한 단계(phase)에 속하는 원천 코드 — DB 필터용 */
export function statusesOf(phase: MatchPhase): string[] {
  return Object.keys(PHASE_BY_STATUS).filter((status) => PHASE_BY_STATUS[status] === phase);
}

/** 점수를 보여도 되는 상태 (진행·종료). 예정 경기에 0:0 을 미리 보이지 않는다 */
export function hasConfirmedScore(status: string | null | undefined, home: number | null | undefined, away: number | null | undefined): boolean {
  const phase = matchPhase(status);
  return (phase === "live" || phase === "finished") && home != null && away != null;
}
