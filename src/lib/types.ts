// src/lib/types.ts (또는 실제 타입 정의 파일)
export interface League {
  id: number;
  name: string;
  country?: string;
  logo?: string;        // logo_url 매핑해도 괜찮습니다
  slug?: string;
  tier?: number | null; // DB가 text면 string | null
}

export interface Team {
  id: number;
  name: string;
  shortName?: string;
  logo?: string;
  founded?: number | null;
}

export interface Player {
  id: number;
  name: string;
  nationality?: string;
  position?: string;
  photo?: string;
  // 페이지들이 기대하는 필드들(있으면 사용, 없으면 undefined)
  birth_date?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  foot?: string | null;
  market_value_eur?: number | null;
  team_name?: string | null;
}

export type SearchRow =
  | {
      type: "league";
      entity_id: number;
      name: string;
      slug: string;
      tier?: number | null;
      country?: string | null;
    }
  | {
      type: "team";
      entity_id: number;
      name: string;
      team_id: number;
      season_id?: number;
      short_name?: string | null;
      crest_url?: string | null;
    };
