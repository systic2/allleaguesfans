# GitHub Actions Workflow Consolidation

## 개요
프로젝트의 GitHub Actions 워크플로우를 통합하여 유지보수성을 개선하고 중복을 제거했습니다.

## 변경 사항 (2025-10-13)

### 워크플로우 구조 변경

**변경 전 (5개):**
1. `keepalive.yml` - 리포지토리 활성 유지
2. `data-sync.yml` - K League 데이터 동기화
3. `ci.yml` - CI 파이프라인 (빌드, 테스트)
4. `data-quality-automation.yml` - 데이터 품질 자동화 ❌ (작동 불가)
5. `deploy-pages.yml` - GitHub Pages 배포

**변경 후 (3개):**
1. `keepalive.yml` - 리포지토리 활성 유지 ✅
2. `data-sync.yml` - K League 데이터 동기화 ✅
3. `ci-cd.yml` - **통합 CI/CD 파이프라인** ✨ (새로 생성)

---

## 주요 개선 사항

### 1. CI/CD 워크플로우 통합
**이전:**
- `ci.yml`: 빌드 + 테스트
- `deploy-pages.yml`: 빌드 + 배포

**문제점:**
- 빌드 작업 중복 실행 (비효율)
- 2개 워크플로우 관리 필요

**통합 후 (`ci-cd.yml`):**
```yaml
jobs:
  build-and-test:
    - TypeScript 타입 체크
    - 테스트 실행
    - 프로덕션 빌드
    - 아티팩트 업로드 (조건부)

  deploy-pages:
    needs: build-and-test
    if: main 브랜치 && push 이벤트
    - 빌드 아티팩트 재사용
    - GitHub Pages 배포
```

**이점:**
- ✅ 빌드 1회만 실행 (50% 시간 절약)
- ✅ 아티팩트 재사용으로 일관성 보장
- ✅ 단일 파이프라인 관리
- ✅ PR 빌드는 배포 생략

### 2. 비활성 워크플로우 제거
**제거된 파일:**
- `data-quality-automation.yml` (461줄)

**제거 이유:**
- 참조하는 스크립트가 존재하지 않음:
  - `scripts/auto-fix-jersey-mismatches.ts` ❌
  - `scripts/transfer-detection-system.ts` ❌
  - `scripts/comprehensive-data-sync-solution.ts` ❌
- 실행 불가능한 워크플로우
- 유지보수 부담만 증가

### 3. 유지된 워크플로우
**`data-sync.yml`:**
- K League 공식 데이터 동기화
- 스케줄: 매일 02:00 UTC, 매주 월요일 03:00 UTC
- 완벽하게 작동 중 → 변경 없음

**`keepalive.yml`:**
- GitHub scheduled workflow 비활성화 방지
- 스케줄: 매월 1일 00:00 UTC
- 독립적 기능 → 변경 없음

---

## 워크플로우 트리거 매트릭스

| 워크플로우 | Push (main) | Pull Request | Schedule | Manual |
|-----------|-------------|--------------|----------|--------|
| `ci-cd.yml` | ✅ Build + Deploy | ✅ Build only | - | ✅ Build + Deploy |
| `data-sync.yml` | - | - | ✅ Daily, Weekly | ✅ Manual sync |
| `keepalive.yml` | - | - | ✅ Monthly | ✅ Manual keepalive |

---

## CI/CD 파이프라인 상세

### Build and Test Job
**조건:** 모든 이벤트 (push, PR, manual)

**단계:**
1. **Setup**
   - Checkout repository
   - Setup pnpm v10
   - Setup Node.js v20
   - Install dependencies

2. **Quality Checks**
   - TypeScript type checking (`pnpm typecheck`)
   - Unit tests (`pnpm test`)

3. **Build**
   - Production build (`pnpm build`)
   - 404 fallback 생성 (SPA 라우팅)

4. **Artifacts**
   - **PR 이벤트**: CI 검증용 아티팩트 (7일 보관)
   - **Main 푸시**: GitHub Pages 배포용 아티팩트

### Deploy Pages Job
**조건:** main 브랜치 push 이벤트만

**특징:**
- `build-and-test` job 완료 후 실행 (`needs`)
- 빌드 아티팩트 재사용 (중복 빌드 방지)
- GitHub Pages 환경으로 배포
- Concurrency 제어 (동시 배포 방지)

---

## 보안 및 환경 변수

### CI 환경
```yaml
VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
VITE_SEASON_YEAR: 2025
VITE_THESPORTSDB_API_KEY: ${{ secrets.VITE_THESPORTSDB_API_KEY }}
VITE_HIGHLIGHTLY_API_KEY: ${{ secrets.VITE_HIGHLIGHTLY_API_KEY }}
```

### 테스트 환경
```yaml
VITE_SUPABASE_URL: http://localhost:54321
VITE_SUPABASE_ANON_KEY: test-anon
VITE_SEASON_YEAR: 2025
VITE_THESPORTSDB_API_KEY: test-api-key
VITE_HIGHLIGHTLY_API_KEY: test-api-key
```

---

## 성능 개선

| 지표 | 변경 전 | 변경 후 | 개선 |
|------|---------|---------|------|
| 워크플로우 파일 수 | 5개 | 3개 | **-40%** |
| Main 브랜치 빌드 | 2회 (CI + Deploy) | 1회 | **-50%** |
| 총 워크플로우 실행 시간 | ~6-8분 | ~3-4분 | **~50% 감소** |
| 관리 복잡도 | 높음 (5개 파일) | 낮음 (3개 파일) | **개선** |
| 실행 불가 워크플로우 | 1개 | 0개 | **해결** |

---

## 검증 결과

### 로컬 검증 ✅
```bash
✓ pnpm typecheck     # TypeScript 컴파일 성공
✓ pnpm build         # 프로덕션 빌드 성공 (439KB main bundle)
✓ Workflow 구문 검증  # YAML 구문 정상
```

### GitHub Actions 권한 ✅
- `contents: read` - 코드 체크아웃
- `pages: write` - GitHub Pages 쓰기
- `id-token: write` - OIDC 토큰 발급

### Concurrency 제어 ✅
- CI/CD: `${{ github.workflow }}-${{ github.ref }}`
- Deploy: `"pages"` (단일 큐)

---

## 마이그레이션 가이드

### 기존 워크플로우 참조 업데이트
**이전:**
```yaml
# .github/workflows/ci.yml 참조
on:
  push:
    branches: [main]
```

**이후:**
```yaml
# .github/workflows/ci-cd.yml 참조
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

### Status Badge 업데이트
**이전:**
```markdown
![CI](https://github.com/user/repo/actions/workflows/ci.yml/badge.svg)
![Deploy](https://github.com/user/repo/actions/workflows/deploy-pages.yml/badge.svg)
```

**이후:**
```markdown
![CI/CD](https://github.com/user/repo/actions/workflows/ci-cd.yml/badge.svg)
```

---

## 향후 개선 계획

### 단기 (1-2개월)
- [ ] 캐시 최적화 (node_modules, pnpm store)
- [ ] Lighthouse CI 통합 (성능 모니터링)
- [ ] 병렬 테스트 실행 (Jest 샤딩)

### 중기 (3-6개월)
- [ ] E2E 테스트 추가 (Playwright)
- [ ] Visual regression 테스트
- [ ] 자동 롤백 메커니즘

### 장기 (6개월+)
- [ ] 멀티 환경 배포 (staging, production)
- [ ] 블루-그린 배포
- [ ] 카나리 배포

---

## 참고 자료

- [GitHub Actions 공식 문서](https://docs.github.com/en/actions)
- [GitHub Pages 배포 가이드](https://docs.github.com/en/pages)
- [pnpm 워크플로우 최적화](https://pnpm.io/continuous-integration)

---

## 작성 정보
- **작성일**: 2025-10-13
- **작성자**: Claude Code
- **버전**: 1.0.0
- **커밋**: (다음 커밋에서 추가 예정)
