// src/domain/types.ts
export interface League {
  id: number;
  name: string;
  country?: string;
  logo?: string;
  slug?: string;   // 추가
  tier?: string;   // 선택: UI에서 쓰는 경우 대비
}

export interface Team {
  id: number;
  name: string;
  shortName?: string;
  logo?: string;
  founded?: number;
}

export interface Player {
  id: number;
  name: string;
  position?: string;
  nationality?: string;
  photo?: string;
  team_name?: string; // TeamPage가 기대한다면 임시로 보강(뷰/쿼리에서 alias로 채움)
}

// 검색 통합 행: 라우팅을 위해 통일된 키 사용
export type SearchRow =
  | { type: 'league'; entity_id: number; name: string; slug: string; tier?: number | null; country?: string | null }
  | { type: 'team'; entity_id: number; name: string; team_id: number; season_id?: number; short_name?: string | null; crest_url?: string | null };
