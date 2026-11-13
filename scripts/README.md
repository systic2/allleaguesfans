# Scripts 디렉토리 개요

이 디렉토리는 애플리케이션의 데이터 동기화, 마이그레이션, 유틸리티 기능 등을 담당하는 다양한 스크립트들을 포함합니다. 스크립트의 목적과 사용 패턴에 따라 다음과 같이 분류됩니다.

---

## 📁 `sync/`
애플리케이션의 핵심 데이터 동기화 로직을 포함하는 디렉토리입니다. 외부 API (TheSportsDB, Highlightly, K League API 등)로부터 데이터를 가져와 Supabase 데이터베이스에 저장하는 스크립트들이 위치합니다.

### 주요 스크립트:
*   `orchestrator.ts`: 메인 동기화 스크립트입니다 (`pnpm sync:full`, GitHub Actions `data-sync.yml`). 리그 순위·팀·경기(`standings_v2`, `teams_v2`, `events_v2`)와 선수 통계(`player_statistics`)를 동기화합니다.
    *   `lib/kleague-player-stats.ts`: K리그 1·2 득점/도움 순위 (K리그 공식 사이트 `/record/rankSort.do`).
    *   `lib/europe-player-stats.ts`: 유럽 5대 리그 선수 통계 (TheSportsDB v2 경기 타임라인, `event_timelines` 캐시).
*   `sync-highlightly-correct.ts`: Highlightly API로부터 데이터를 가져와 처리하는 스크립트 (추정).
*   `02-thesportsdb-api-integration.ts`, `03-highlightly-api-sync.ts`, `3api-data-import.ts`: API 통합 및 데이터 임포트 관련 스크립트.
*   `import-historical-standings.ts`, `import-team-players.ts`: 과거 데이터 및 팀/선수 데이터 임포트 관련 스크립트.
*   `cron-sync.sh`: 동기화 스크립트들을 주기적으로 실행하기 위한 쉘 스크립트.
*   `lib/`: 동기화 스크립트들에서 공유하는 라이브러리 및 유틸리티 코드.

### 실행 방법 (예시):
```bash
# 새로운 조율자 스크립트 실행
npx tsx scripts/sync/orchestrator.ts
```

---

## 📁 `migrations/`
데이터베이스 스키마 정의, 변경 및 마이그레이션과 관련된 SQL 스크립트들이 위치합니다.

### 주요 스크립트:
*   `01-create-league-id-mapping.sql`, `01-create-thesportsdb-foundation-schema.sql`, `02-create-highlightly-enhanced-schema.sql`, `03-create-player-statistics-schema.sql`: 초기 스키마 생성 및 기초 테이블 설정.
*   `04-create-standings-v2-schema.sql`: 새로운 표준화된 순위 정보를 저장하기 위한 `standings_v2` 테이블을 생성합니다.
*   `05-drop-old-standings-table.sql`: 더 이상 사용되지 않는 `standings` 테이블을 삭제합니다.
*   `08-recreate-highlightly-dependencies.sql`: 오래된 events 관련 객체들을 정리하고, events_v2에 맞춰 의존성을 다시 생성합니다.
*   `add-highlightly-column-to-events.sql`: 이벤트 테이블에 Highlightly 관련 컬럼 추가.
*   `create-upsert-player-stats-function.sql`: 플레이어 통계 upsert 함수 생성.
*   `force-recreate-player-stats.sql`: 플레이어 통계 테이블 강제 재구성.
*   `reload-postgrest-schema.sql`: PostgREST 스키마 재로딩.
*   `reset-and-setup-player-stats.sql`: 플레이어 통계 재설정 및 설정.
*   `update-player-stats-rls.sql`: Row Level Security (RLS) 업데이트.

### 사용 방법 (예시):
Supabase CLI 또는 다른 데이터베이스 관리 도구를 사용하여 스크립트를 실행합니다.
```bash
# Supabase CLI를 통해 마이그레이션 실행
supabase migration up
# 또는 수동으로 SQL 스크립트 실행
psql -f scripts/migrations/07-drop-old-events-table.sql
```

---

## 📁 `one-off/`
특정 조건 확인, 디버깅, 일회성 데이터 조정, 또는 특정 분석을 위한 스크립트들이 위치합니다. 일반적으로 주기적으로 실행되거나 핵심적인 애플리케이션 로직의 일부는 아닙니다.

### 주요 스크립트 (예시):
*   `check-*`: 데이터 유효성, 스키마 일치 여부 등 다양한 검사를 수행합니다.
*   `debug-*`: 특정 데이터 문제나 로직을 디버깅하기 위해 사용됩니다.
*   `fetch-*`: 특정 데이터를 일회성으로 가져오는 스크립트.
*   `test-*`: 특정 기능의 동작을 테스트합니다.
*   `verify-*`: 데이터의 정확성을 검증합니다.
*   `git-branch-cleanup.ts`, `git-manual-cleanup.sh`: Git 브랜치 정리 유틸리티.
*   `highlightly-integration-plan.md`: Highlightly 통합 관련 계획 문서.

### 사용 방법 (예시):
```bash
# 특정 데이터 확인
npx tsx scripts/one-off/check-k1-data.ts
# 디버깅 스크립트 실행
npx tsx scripts/one-off/debug-yago-assist.ts
```

---

## 📁 `archive/`
현재 프로젝트에서 더 이상 사용되지 않거나, 기능이 대체된 레거시 스크립트들이 보관되는 디렉토리입니다. 향후 참조를 위해 보관하지만, 직접 실행되지 않아야 합니다.

### 주요 스크립트 (예시):
*   `03-thesportsdb-integration-fixed.ts`: 이전 버전의 TheSportsDB 통합 스크립트.

---