# Highlightly API와 Events 테이블 통합 계획

## 🎯 통합 목표
- 기존 TheSportsDB events 테이블과 Highlightly API 데이터 연결
- 실시간 라이브 매치 데이터 제공
- 향상된 경기 통계 및 이벤트 정보 추가

## 📊 현재 상황 분석

### 기존 Events 테이블 (TheSportsDB 기반)
```sql
-- Primary Key: idEvent (TheSportsDB)
-- League IDs: 4689 (K League 1), 4822 (K League 2)
-- 구조: 순수 TheSportsDB JSON 스키마
```

### Highlightly API 매핑
```
K League 1: TheSportsDB 4689 ↔ Highlightly 249276
K League 2: TheSportsDB 4822 ↔ Highlightly 250127
```

## 🏗️ 통합 아키텍처

### 1단계: ID 매핑 테이블 생성
```sql
-- League ID 매핑 테이블
CREATE TABLE public.league_id_mapping (
    thesportsdb_league_id TEXT,
    highlightly_league_id TEXT,
    league_name TEXT,
    PRIMARY KEY (thesportsdb_league_id, highlightly_league_id)
);

-- 팀 ID 매핑 테이블 (추후 필요시)
CREATE TABLE public.team_id_mapping (
    thesportsdb_team_id TEXT,
    highlightly_team_id TEXT,
    team_name TEXT,
    league_id TEXT,
    PRIMARY KEY (thesportsdb_team_id, highlightly_team_id)
);
```

### 2단계: Highlightly 보완 데이터 테이블
```sql
-- Highlightly API에서 가져온 추가 이벤트 정보
CREATE TABLE public.events_highlightly_enhanced (
    idEvent TEXT, -- TheSportsDB events 테이블과 연결
    highlightly_event_id TEXT,
    highlightly_league_id TEXT,
    
    -- 실시간 라이브 데이터
    live_status TEXT,
    live_minute INTEGER,
    live_score_home INTEGER,
    live_score_away INTEGER,
    
    -- 향상된 경기 통계
    possession_home INTEGER,
    possession_away INTEGER,
    shots_home INTEGER,
    shots_away INTEGER,
    shots_on_target_home INTEGER,
    shots_on_target_away INTEGER,
    corners_home INTEGER,
    corners_away INTEGER,
    fouls_home INTEGER,
    fouls_away INTEGER,
    yellow_cards_home INTEGER,
    yellow_cards_away INTEGER,
    red_cards_home INTEGER,
    red_cards_away INTEGER,
    
    -- 메타데이터
    data_source TEXT DEFAULT 'highlightly',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign Key
    FOREIGN KEY (idEvent) REFERENCES public.events(idEvent)
);
```

### 3단계: 통합 뷰 생성
```sql
-- events와 highlightly 데이터를 결합한 통합 뷰
CREATE VIEW public.events_enhanced AS
SELECT 
    e.*,
    eh.live_status,
    eh.live_minute,
    eh.live_score_home,
    eh.live_score_away,
    eh.possession_home,
    eh.possession_away,
    eh.shots_home,
    eh.shots_away,
    eh.last_updated as highlightly_last_updated
FROM public.events e
LEFT JOIN public.events_highlightly_enhanced eh ON e."idEvent" = eh.idEvent;
```

## 🔄 데이터 동기화 전략

### API 통합 접근법
1. **Primary Source**: TheSportsDB (기본 경기 정보)
2. **Enhancement Source**: Highlightly API (실시간 + 고급 통계)
3. **Sync Strategy**: 
   - 기본 경기 정보: TheSportsDB에서 가져오기
   - 실시간 데이터: Highlightly API에서 실시간 업데이트
   - 고급 통계: 경기 후 Highlightly에서 보완

### 동기화 스크립트 구조
```typescript
// scripts/sync-highlightly-enhanced.ts
export async function syncHighlightlyEnhancedData() {
  // 1. 기존 events 테이블에서 활성 경기 찾기
  const activeMatches = await getActiveMatches();
  
  // 2. 각 경기에 대해 Highlightly API 호출
  for (const match of activeMatches) {
    const highlightlyData = await fetchHighlightlyMatchData(
      mapLeagueId(match.idLeague),
      match.idEvent
    );
    
    // 3. events_highlightly_enhanced 테이블에 upsert
    await upsertHighlightlyData(match.idEvent, highlightlyData);
  }
}

function mapLeagueId(thesportsdbId: string): string {
  const mapping = {
    '4689': '249276', // K League 1
    '4822': '250127'  // K League 2
  };
  return mapping[thesportsdbId] || '';
}
```

## 📱 프론트엔드 통합

### 기존 컴포넌트 확장
```typescript
// src/lib/enhanced-fixtures-api.ts
export interface EnhancedFixture extends DatabaseFixture {
  // Highlightly 추가 데이터
  liveStatus?: string;
  liveMinute?: number;
  liveScoreHome?: number;
  liveScoreAway?: number;
  possession?: {
    home: number;
    away: number;
  };
  shots?: {
    home: number;
    away: number;
  };
  // ... 기타 고급 통계
}

export async function fetchEnhancedFixtures(
  leagueSlug: string
): Promise<EnhancedFixture[]> {
  // events_enhanced 뷰에서 데이터 가져오기
  const { data, error } = await supabase
    .from('events_enhanced')
    .select('*')
    .eq('idLeague', getTheSportsDBLeagueId(leagueSlug));
    
  if (error) throw error;
  return data || [];
}
```

## 🚀 구현 단계

### Phase 1: 기본 통합 (즉시 시작 가능)
- [x] 현재 events 테이블 구조 분석
- [ ] League ID 매핑 테이블 생성
- [ ] 기본 Highlightly API 연결 테스트

### Phase 2: 고급 기능 (2주차)
- [ ] events_highlightly_enhanced 테이블 생성
- [ ] 실시간 데이터 동기화 스크립트 개발
- [ ] 통합 뷰 및 API 엔드포인트 구현

### Phase 3: 프론트엔드 통합 (3주차)
- [ ] 기존 컴포넌트에 실시간 데이터 표시
- [ ] 고급 통계 UI 컴포넌트 개발
- [ ] 라이브 스코어 업데이트 기능

## 🔒 고려사항

### 데이터 무결성
- TheSportsDB를 primary source로 유지
- Highlightly 데이터는 enhancement로만 사용
- 데이터 충돌 시 TheSportsDB 우선

### 성능 최적화
- 실시간 데이터는 캐싱 적용
- 불필요한 API 호출 최소화
- 배치 업데이트로 성능 향상

### 에러 처리
- Highlightly API 장애 시 기본 기능 유지
- Graceful degradation 적용
- 로그 및 모니터링 강화