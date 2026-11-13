// src/hooks/useTeamName.ts
// 화면에 보이는 팀 이름을 한글(teams_v2.nameKorean)로 바꿔 준다.
// 순위·경기·선수 기록은 출처마다 영문 팀 이름을 갖고 있어, 팀 ID 로 한글 이름을 찾아 덮어쓴다.
// 한글 이름이 없거나 아직 불러오지 못했으면 원래 이름을 그대로 쓴다.
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTeamKoreanNames } from "@/lib/api";

export function useTeamName(): (teamId: string | number | null | undefined, fallback: string) => string {
  const { data } = useQuery({
    queryKey: ["team-korean-names"],
    queryFn: fetchTeamKoreanNames,
    staleTime: Infinity,
  });
  return useCallback(
    (teamId, fallback) => (teamId != null && data?.[String(teamId)]) || fallback,
    [data],
  );
}
