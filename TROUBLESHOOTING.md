# K League Data Sync Troubleshooting Guide

## 문제: GitHub Actions 워크플로우가 자동 실행되지 않음

### 진단 결과 (2025-10-10)

#### ✅ 정상 작동하는 부분
- `sync-kleague-final.ts` 스크립트가 완벽하게 작동
- 환경 변수 설정 정상 (Supabase, TheSportsDB API)
- 수동 실행 시 데이터 정상 업데이트
- 스크립트 로직 및 데이터베이스 연동 완벽

#### ⚠️ 문제가 있는 부분
- GitHub Actions scheduled workflows가 자동 실행되지 않음
- 마지막 자동 업데이트: 2025-10-02 (약 8일 전)
- 예상 스케줄: 매일 02:00 UTC, 매주 월요일 03:00 UTC

### 근본 원인 분석

GitHub Actions scheduled workflows가 실행되지 않는 일반적인 이유:

1. **리포지토리 비활성화**
   - GitHub는 60일 이상 활동이 없는 리포지토리의 scheduled workflows를 자동 비활성화
   - 해결: 최소 60일마다 커밋 또는 수동 워크플로우 실행 필요

2. **워크플로우 비활성화**
   - GitHub Actions 설정에서 워크플로우가 수동으로 비활성화됨
   - 확인: Settings → Actions → Workflows

3. **최근 커밋 부족**
   - Scheduled workflows는 default branch에 최근 활동이 있어야 실행
   - 해결: 정기적인 커밋으로 리포지토리 활성화 유지

4. **권한 문제**
   - Secrets 권한 또는 워크플로우 실행 권한 문제
   - 확인: Settings → Secrets and variables → Actions

### 해결 방안

#### 방법 1: 워크플로우 수동 트리거 활성화 (즉시)
```bash
# GitHub 웹사이트에서
1. Actions 탭 이동
2. "K League Official Data Sync" 워크플로우 선택
3. "Run workflow" 버튼 클릭
4. "Run workflow" 확인
```

#### 방법 2: 워크플로우 상태 확인 및 활성화
```bash
# GitHub CLI 사용
gh workflow list
gh workflow enable "K League Official Data Sync"
gh workflow run "K League Official Data Sync"
```

#### 방법 3: 로컬에서 수동 실행 (임시 해결)
```bash
# 환경 변수 설정 후 실행
SEASON_YEAR=2025 npx tsx scripts/sync-kleague-final.ts
```

#### 방법 4: Keepalive 워크플로우 추가 (영구 해결)
리포지토리에 주기적인 커밋을 생성하여 scheduled workflows 비활성화 방지:

```yaml
# .github/workflows/keepalive.yml
name: Keep Repository Active

on:
  schedule:
    - cron: '0 0 1 * *'  # 매월 1일 00:00 UTC
  workflow_dispatch:

jobs:
  keepalive:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Keep alive
        run: |
          echo "Last keepalive: $(date)" >> .github/keepalive.log
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add .github/keepalive.log
          git diff --quiet && git diff --staged --quiet || (git commit -m "chore: keepalive $(date +%Y-%m-%d)" && git push)
```

### 검증 방법

#### 1. 워크플로우 실행 로그 확인
```bash
# GitHub 웹사이트
Actions 탭 → "K League Official Data Sync" → 최근 실행 로그 확인
```

#### 2. 데이터베이스 최신 데이터 확인
```bash
npx tsx scripts/check-latest-data.ts
```

#### 3. 워크플로우 스케줄 다음 실행 시간 확인
- 매일 02:00 UTC (11:00 KST)
- 매주 월요일 03:00 UTC (12:00 KST)

### 모니터링 및 유지보수

#### 자동 알림 설정
GitHub Actions에서 워크플로우 실패 시 이메일 알림 활성화:
1. Settings → Notifications → Actions
2. "Send notifications for failed workflows" 체크

#### 정기 점검 체크리스트
- [ ] 매주 GitHub Actions 실행 로그 확인
- [ ] 매주 데이터베이스 최신 데이터 확인
- [ ] 매월 Supabase API 키 유효성 확인
- [ ] 매월 TheSportsDB API 키 유효성 확인

### 긴급 대응 절차

데이터가 오래된 경우 (24시간 이상 업데이트 안됨):

1. **즉시 수동 실행**
   ```bash
   SEASON_YEAR=2025 npx tsx scripts/sync-kleague-final.ts
   ```

2. **GitHub Actions 수동 트리거**
   - Actions → K League Official Data Sync → Run workflow

3. **워크플로우 로그 확인**
   - 실패 원인 파악 및 수정

4. **필요시 Secrets 재설정**
   - Settings → Secrets and variables → Actions
   - SUPABASE_URL, SUPABASE_SERVICE_ROLE 등 재입력

### 참고 자료

- [GitHub Actions Scheduled Workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [Disabling and enabling workflows](https://docs.github.com/en/actions/managing-workflow-runs/disabling-and-enabling-a-workflow)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [TheSportsDB API Documentation](https://www.thesportsdb.com/api.php)

### 업데이트 로그

- **2025-10-10**: 초기 진단 및 트러블슈팅 가이드 작성
  - 문제: GitHub Actions scheduled workflows 자동 실행 안됨
  - 원인: 리포지토리 비활성화 또는 워크플로우 비활성화 추정
  - 해결: 수동 트리거 및 keepalive 워크플로우 추가 권장
