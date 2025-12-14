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
  | { type: 'team'; entity_id: number; name: string; team_id: number; season_id?: number; short_name?: string | null; crest_url?: string | null }
  | { type: 'player'; entity_id: number; name: string; team_name?: string | null; crest_url?: string | null };

// TheSportsDB Teams 테이블 타입
export interface TeamFromDB {
  idTeam: string;
  idLeague: string;
  strTeam: string;
  strTeamShort: string | null;
  strTeamAlternate: string | null;
  strBadge: string | null;
  strStadium: string | null;
  strStadiumThumb: string | null;
  strStadiumLocation: string | null;
  intStadiumCapacity: number | null;
  strDescriptionKR: string | null;
  strFacebook: string | null;
  strTwitter: string | null;
  strInstagram: string | null;
  strYoutube: string | null;
  strWebsite: string | null;
  strRSS: string | null;
  strColour1: string | null;
  strColour2: string | null;
  strColour3: string | null;
  strGender: string | null;
  strCountry: string | null;
  strKeywords: string | null;
}

// Standings 테이블 타입
export interface TeamStandings {
  idLeague: string;
  season: string;
  strTeam: string;
  intRank: number | null;
  intPlayed: number | null;
  intWin: number | null;
  intDraw: number | null;
  intLoss: number | null;
  intGoalsFor: number | null;
  intGoalsAgainst: number | null;
  intGoalDifference: number | null;
  intPoints: number | null;
  strForm: string | null;
  // 홈 전적
  intPlayedHome: number | null;
  intWinHome: number | null;
  intDrawHome: number | null;
  intLossHome: number | null;
  intGoalsForHome: number | null;
  intGoalsAgainstHome: number | null;
  // 원정 전적
  intPlayedAway: number | null;
  intWinAway: number | null;
  intDrawAway: number | null;
  intLossAway: number | null;
  intGoalsForAway: number | null;
  intGoalsAgainstAway: number | null;
}

// Events 테이블 타입 (경기 일정/결과)
export interface EventFromDB {
  idEvent: string;
  idLeague: string;
  strLeague: string;
  strSeason: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: number | null;
  intAwayScore: number | null;
  intRound: number | null;
  dateEvent: string;
  strTime: string | null;
  strTimestamp: string | null;
  strStatus: string | null;
  strPostponed: string | null;
  strVenue: string | null;
  idHomeTeam: string | null;
  idAwayTeam: string | null;
}

// Events Highlightly Enhanced 테이블 타입 (실시간 라이브 데이터)
export interface EventLiveData {
  idEvent: string;
  live_status: string | null;
  live_minute: number | null;
  live_period: string | null;
  live_score_home: number | null;
  live_score_away: number | null;
  live_ht_score_home: number | null;
  live_ht_score_away: number | null;
  possession_home: number | null;
  possession_away: number | null;
  shots_home: number | null;
  shots_away: number | null;
  shots_on_target_home: number | null;
  shots_on_target_away: number | null;
  corners_home: number | null;
  corners_away: number | null;
  fouls_home: number | null;
  fouls_away: number | null;
  yellow_cards_home: number | null;
  yellow_cards_away: number | null;
  red_cards_home: number | null;
  red_cards_away: number | null;
  highlightly_match_id: string | null;
  last_updated: string | null;
}

// 폼 가이드 타입 (W/D/L)
export type FormResult = 'W' | 'D' | 'L';
