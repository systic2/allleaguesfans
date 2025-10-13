# Highlightly API 통합 가이드

## 📋 목차
1. [개요](#개요)
2. [통합 아키텍처](#통합-아키텍처)
3. [설치 및 설정](#설치-및-설정)
4. [데이터베이스 스키마 적용](#데이터베이스-스키마-적용)
5. [사용 방법](#사용-방법)
6. [테스트](#테스트)
7. [문제 해결](#문제-해결)

---

## 개요

Highlightly API는 K League 경기에 대한 실시간 데이터와 고급 통계를 제공합니다. 이 통합은 기존 TheSportsDB 데이터를 보완하여 더 풍부한 경기 정보를 제공합니다.

### 주요 기능
- ✅ **실시간 라이브 데이터**: 경기 진행 시간, 실시간 스코어
- ✅ **고급 통계**: 점유율, 슈팅, 패스, 파울 등
- ✅ **자동 매칭**: Highlightly 데이터를 기존 TheSportsDB 이벤트와 자동 연결
- ✅ **Fuzzy Matching**: 팀 이름 유사도 검사로 정확한 매칭

---

## 통합 아키텍처

### 데이터 흐름
```
┌─────────────────┐
│ Highlightly API │
│  (실시간 데이터)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  sync-highlightly-matches   │
│  (동기화 스크립트)             │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  events_highlightly_        │
│     enhanced 테이블          │
│  (보완 데이터)                │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  events_enhanced VIEW       │
│  (통합 뷰)                    │
└─────────────────────────────┘
```

### 주요 컴포넌트

#### 1. API 클라이언트 ([src/lib/highlightly-api.ts](src/lib/highlightly-api.ts))
- Highlightly API 호출 함수
- 자동 pagination 처리
- Rate limiting 지원

#### 2. 팀 매칭 유틸리티 ([scripts/lib/team-matcher.ts](scripts/lib/team-matcher.ts))
- Levenshtein distance 알고리즘
- 팀 이름 정규화
- K League 특화 매핑

#### 3. 동기화 스크립트 ([scripts/sync-highlightly-matches.ts](scripts/sync-highlightly-matches.ts))
- 기존 이벤트와 Highlightly 매치 연결
- 고급 통계 데이터 동기화
- 매칭 신뢰도 평가

---

## 설치 및 설정

### 1. 환경 변수 설정

`.env` 파일에 다음 변수를 추가하세요:

```bash
# Highlightly API
HIGHLIGHTLY_API_KEY=097fcd07-9a95-4b4d-8ff0-08db3a387d0a
VITE_HIGHLIGHTLY_API_KEY=097fcd07-9a95-4b4d-8ff0-08db3a387d0a
```

### 2. 환경 변수 검증

```bash
npx tsx scripts/env-check.ts
```

예상 출력:
```
✅ HIGHLIGHTLY_API_KEY (Optional): 097fcd07...
✅ VITE_HIGHLIGHTLY_API_KEY (Optional): 097fcd07...
```

---

## 데이터베이스 스키마 적용

### 1. 스키마 파일 위치
[scripts/02-create-highlightly-enhanced-schema.sql](scripts/02-create-highlightly-enhanced-schema.sql)

### 2. 스키마 적용 방법

#### 옵션 A: Supabase Dashboard (권장)
1. Supabase Dashboard → SQL Editor
2. 스키마 파일 내용 복사
3. "Run" 클릭

#### 옵션 B: psql 명령줄
```bash
psql -h your-supabase-url -U postgres -d postgres -f scripts/02-create-highlightly-enhanced-schema.sql
```

### 3. 생성되는 주요 객체

#### 테이블: `events_highlightly_enhanced`
```sql
CREATE TABLE public.events_highlightly_enhanced (
    "idEvent" TEXT NOT NULL,  -- Foreign key to events
    highlightly_event_id TEXT,

    -- 실시간 데이터
    live_status TEXT,
    live_minute INTEGER,
    live_score_home INTEGER,
    live_score_away INTEGER,

    -- 고급 통계
    possession_home INTEGER,
    possession_away INTEGER,
    shots_home INTEGER,
    shots_away INTEGER,
    -- ... 등등
);
```

#### 뷰: `events_enhanced`
기존 `events` 테이블과 `events_highlightly_enhanced`를 결합한 통합 뷰

---

## 사용 방법

### 1. API 테스트

```bash
# Highlightly API 연결 테스트
npx tsx scripts/test-highlightly-api-direct.ts
```

예상 출력:
```
🧪 Highlightly API Integration Tests
===================================================
📡 Test 1: Fetching K League leagues...
✅ Leagues API test successful!
📊 Plan tier: PRO
📊 Total leagues: 5

📋 K League Leagues:
  - K League 1 (ID: 249276)
  - K League 2 (ID: 250127)
```

### 2. K League 기본 데이터 동기화 (필수 선행 작업)

```bash
# ⚠️ 중요: Highlightly 동기화 전에 먼저 K League 팀 데이터를 완전히 동기화해야 합니다
SEASON_YEAR=2025 npx tsx scripts/sync-kleague-final.ts
```

**왜 필요한가요?**
- Highlightly 매치를 기존 events 테이블과 연결하려면 **모든 팀 데이터**가 완전해야 합니다
- 현재 데이터베이스에 K League 1 팀이 5개만 있으면 대부분의 매치가 매칭되지 않습니다
- **K League 1**: 12개 팀 필요
- **K League 2**: 13개 팀 필요

### 3. Highlightly 데이터 동기화

```bash
# 주의: 1) 데이터베이스 스키마 적용 + 2) K League 기본 데이터 동기화 후 실행
npx tsx scripts/sync-highlightly-matches.ts
```

동기화 프로세스:
1. Highlightly API에서 매치 데이터 가져오기 (자동 pagination)
2. 데이터베이스의 기존 이벤트 조회
3. 팀 이름 스마트 매칭 (정규화 + fuzzy matching)
4. 고급 통계 데이터를 events_highlightly_enhanced 테이블에 업데이트

**예상 결과:**
```
✅ Total Highlightly matches fetched: 198
📊 Database events: 198
📊 Teams in database: 12

✓ Matched: Daegu FC vs Gangwon FC (high confidence)
✓ Matched: Jeonbuk Hyundai Motors vs Gwangju FC (high confidence)
...

📈 K League 1 Summary:
  - Total Highlightly matches: 198
  - Total database events: 198
  - Matched: 180+
  - Match rate: 90%+
```

### 3. 프론트엔드에서 사용

#### API 클라이언트 import
```typescript
import {
  fetchHighlightlyMatches,
  fetchLiveMatches,
  testHighlightlyConnection
} from '@/lib/highlightly-api';

// K League 1 전체 매치 가져오기
const matches = await fetchHighlightlyMatches('K League 1', 2025, true);

// 라이브 경기만 가져오기
const liveMatches = await fetchLiveMatches('K League 1', 2025);

// API 연결 테스트
const isConnected = await testHighlightlyConnection();
```

#### 통합 뷰에서 데이터 조회
```typescript
import { supabase } from '@/lib/supabaseClient';

// 라이브 데이터를 포함한 경기 조회
const { data: enhancedFixtures } = await supabase
  .from('events_enhanced')
  .select('*')
  .eq('idLeague', '4689')  // K League 1
  .order('dateEvent', { ascending: false });

// 실시간 경기만 필터링
const { data: liveFixtures } = await supabase
  .from('events_enhanced')
  .select('*')
  .eq('is_live', true);
```

---

## 테스트

### 1. API 직접 테스트
```bash
npx tsx scripts/test-highlightly-api-direct.ts
```

**테스트 항목:**
- ✅ Leagues API 연결
- ✅ Matches API 데이터 가져오기
- ✅ Pagination 처리
- ✅ Rate limiting 동작

### 2. 데이터베이스 통합 테스트
```bash
npx tsx scripts/test-highlightly-api.ts
```

**테스트 항목:**
- ✅ 통합 뷰 조회
- ✅ 라이브 경기 필터링
- ✅ 고급 통계 데이터 표시

### 3. 팀 매칭 테스트

```typescript
import { smartMatchTeam } from './scripts/lib/team-matcher';

const match = smartMatchTeam(
  'Jeonbuk FC',  // Highlightly 팀 이름
  ['Jeonbuk Hyundai Motors', 'Ulsan HD', 'FC Seoul']  // TheSportsDB 팀 목록
);

console.log(match);
// {
//   highlightlyName: 'Jeonbuk FC',
//   thesportsdbName: 'Jeonbuk Hyundai Motors',
//   similarity: 0.85,
//   confidence: 'high',
//   method: 'core'
// }
```

---

## 문제 해결

### API 연결 오류

**증상:**
```
❌ Highlightly API error: 401 Unauthorized
```

**해결:**
1. `.env` 파일에서 `HIGHLIGHTLY_API_KEY` 확인
2. API 키가 유효한지 확인
3. `npx tsx scripts/env-check.ts` 실행

---

### 팀 매칭 실패

**증상:**
```
⚠ No match: Team A vs Team B
```

**해결:**
1. 팀 이름이 데이터베이스에 존재하는지 확인
2. `scripts/lib/team-matcher.ts`의 `KNOWN_TEAM_MAPPINGS`에 수동 매핑 추가

```typescript
export const KNOWN_TEAM_MAPPINGS: Record<string, string[]> = {
  'Official Name': ['Variant 1', 'Variant 2'],
  // 예시:
  'Jeonbuk Hyundai Motors': ['Jeonbuk FC', 'Jeonbuk'],
};
```

---

### 데이터베이스 스키마 오류

**증상:**
```
ERROR: relation "events_highlightly_enhanced" does not exist
```

**해결:**
```bash
# Supabase Dashboard → SQL Editor에서 스키마 적용
# 또는 psql로 직접 적용
psql -h your-db-url -U postgres -f scripts/02-create-highlightly-enhanced-schema.sql
```

---

### Pagination 오류

**증상:**
```
❌ Highlightly matches fetch error (offset: 100)
```

**해결:**
1. API rate limiting 대기 시간 증가
2. `sync-highlightly-matches.ts`에서 delay 조정:

```typescript
// Rate limiting: 500ms → 1000ms로 증가
await new Promise(resolve => setTimeout(resolve, 1000));
```

---

## GitHub Actions 통합

### 워크플로우 설정

`.github/workflows/data-sync.yml`에 추가:

```yaml
- name: Sync Highlightly Data
  env:
    HIGHLIGHTLY_API_KEY: ${{ secrets.HIGHLIGHTLY_API_KEY }}
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE: ${{ secrets.SUPABASE_SERVICE_ROLE }}
  run: |
    npx tsx scripts/sync-highlightly-matches.ts
```

### 필요한 Secrets

GitHub Repository → Settings → Secrets에 추가:
- `HIGHLIGHTLY_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE`

---

## API 요금 및 제한

### Highlightly API Plan

- **Plan Tier**: PRO
- **Rate Limit**: 정확한 제한 불명 (safe하게 500ms 대기 권장)
- **Pagination Limit**: 100 matches per request

### 비용 최적화 팁

1. **필요한 경기만 가져오기**: 전체 데이터가 아닌 최근 또는 라이브 경기만
2. **캐싱 활용**: 동일 데이터 반복 요청 방지
3. **배치 처리**: 여러 요청을 하나로 통합

---

## 추가 리소스

- [Highlightly API 통합 계획](scripts/highlightly-integration-plan.md)
- [데이터베이스 스키마](scripts/02-create-highlightly-enhanced-schema.sql)
- [API 클라이언트 코드](src/lib/highlightly-api.ts)
- [팀 매칭 유틸리티](scripts/lib/team-matcher.ts)
- [동기화 스크립트](scripts/sync-highlightly-matches.ts)

---

## 요약

### 구현된 기능
✅ Highlightly API 클라이언트
✅ 팀 이름 fuzzy matching
✅ 자동 데이터 동기화
✅ 통합 뷰 (events_enhanced)
✅ 환경 변수 검증
✅ 테스트 스크립트

### 다음 단계
1. 데이터베이스 스키마 적용
2. API 연결 테스트 실행
3. 동기화 스크립트 실행
4. 프론트엔드에서 통합 뷰 사용
5. GitHub Actions에 자동 동기화 추가

---

**문의 사항이 있으시면 이슈를 등록해주세요!** 🚀
