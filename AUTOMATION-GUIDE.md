# 🔄 주기적 업데이트 자동화 가이드

## 📋 추천 방법별 비교

| 방법 | 비용 | 설정 난이도 | 안정성 | 추천 상황 |
|------|------|-------------|--------|-----------|
| **GitHub Actions** | 무료 (제한있음) | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 오픈소스, 팀 협업 |
| **Supabase Edge Functions** | 유료 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 클라우드 우선, 확장성 |
| **로컬 Cron** | 무료 | ⭐⭐ | ⭐⭐⭐ | 개인 프로젝트, 서버 운영 |

## 🎯 추천 구성

### 🥇 1순위: GitHub Actions (추천)
```yaml
# 설정: .github/workflows/data-sync.yml
# 장점: 무료, 안정적, 버전 관리 통합
# 단점: public repo 필요 (또는 유료 plan)

매일 오전 2시: 경기 결과 + 순위
매주 월요일: 선수 이적 체크
수동 실행: 전체 동기화
```

### 🥈 2순위: 로컬 Cron + 모니터링
```bash
# 설정: scripts/cron-sync.sh + crontab
# 장점: 완전 무료, 빠른 실행
# 단점: 로컬 서버 필요, 유지보수

0 9 * * * ./scripts/cron-sync.sh daily
0 10 * * 1 ./scripts/cron-sync.sh weekly
```

### 🥉 3순위: Supabase Edge Functions
```typescript
// 설정: supabase/functions/sync-football-data/
// 장점: 서버리스, 확장성
// 단점: 유료, 복잡한 설정

// 외부 cron 서비스와 연동 필요
```

## ⚙️ 단계별 설정 가이드

### 1️⃣ GitHub Actions 설정 (추천)

1. **Repository Settings → Secrets 설정:**
```
SUPABASE_URL: https://whoszwxxwgmpdfckmcgh.supabase.co
SUPABASE_SERVICE_ROLE: eyJhbGciOiJIUzI1NiIs...
API_FOOTBALL_KEY: cf3c7f305e193b6d6fd3fa9c7160cb27
SLACK_WEBHOOK: https://hooks.slack.com/... (선택)
```

2. **파일 생성:** `.github/workflows/data-sync.yml` (이미 생성됨)

3. **테스트 실행:**
   - Actions 탭에서 "Run workflow" 클릭
   - 로그 확인

### 2️⃣ 로컬 Cron 설정

1. **스크립트 경로 수정:**
```bash
# scripts/cron-sync.sh에서 PROJECT_DIR 수정
PROJECT_DIR="/실제/프로젝트/경로"
```

2. **실행 권한 부여:**
```bash
chmod +x scripts/cron-sync.sh
```

3. **Cron 등록:**
```bash
crontab -e

# 다음 추가
0 9 * * * /실제/프로젝트/경로/scripts/cron-sync.sh daily
0 10 * * 1 /실제/프로젝트/경로/scripts/cron-sync.sh weekly
```

### 3️⃣ Supabase Edge Functions

1. **Edge Function 배포:**
```bash
supabase functions deploy sync-football-data
```

2. **환경 변수 설정:**
```bash
supabase secrets set API_FOOTBALL_KEY=your_key
```

3. **외부 Cron 서비스 설정:** (예: cron-job.org, EasyCron)

## 📊 모니터링 설정

### 1. 슬랙 알림 설정
```bash
# .env에 추가
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### 2. 이메일 알림 설정 (SendGrid)
```bash
# .env에 추가
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your_key
FROM_EMAIL=noreply@yourdomain.com
ALERT_EMAIL=admin@yourdomain.com
```

### 3. 모니터링 실행
```bash
# 수동 상태 확인
npx tsx scripts/monitoring.ts

# 정기 실행 (cron에 추가)
0 8 * * * npx tsx /path/to/scripts/monitoring.ts
```

## 🕐 권장 스케줄

### 데이터 특성별 업데이트 주기

```bash
# 매일 - 경기 결과 및 순위 (실시간성 중요)
0 9 * * * fixtures + standings

# 매주 월요일 - 선수 및 스쿼드 (이적 기간)
0 10 * * 1 squads + players

# 매월 1일 - 전체 동기화 (데이터 정합성)
0 11 1 * * full import

# 매일 오전 8시 - 시스템 상태 모니터링
0 8 * * * monitoring
```

### 시즌별 조정

```bash
# 시즌 중 (3월~11월): 매일 업데이트
# 휴시즌 (12월~2월): 주 1회 업데이트
# 이적 기간: 매일 스쿼드 체크
```

## 🚨 문제 해결

### 자주 발생하는 문제들

1. **API 요청 한도 초과**
   - 해결: 요청 간격 조정 (scripts에 delay 추가)
   - 예방: 필요한 데이터만 선별적 요청

2. **Cron 작업이 실행되지 않음**
   - 해결: 절대 경로 사용, 환경 변수 설정
   - 확인: `crontab -l`, 로그 파일 검토

3. **데이터베이스 연결 실패**
   - 해결: Supabase 연결 상태 확인
   - 백업: 재시도 로직 활용

4. **메모리 부족**
   - 해결: 배치 크기 줄이기, 페이지네이션 활용

### 디버깅 도구

```bash
# 1. API 연결 테스트
npx tsx scripts/debug-api-response.ts

# 2. 데이터베이스 상태 확인
npx tsx scripts/final-verification.ts

# 3. 전체 동기화 테스트
npx tsx scripts/master-import.ts

# 4. 모니터링 테스트
npx tsx scripts/monitoring.ts
```

## 📈 성능 최적화

### 권장 설정

1. **배치 크기 조정**
   - 한 번에 처리할 레코드 수 제한
   - API 요청 간 적절한 지연 시간

2. **선택적 업데이트**
   - 변경된 데이터만 업데이트
   - 타임스탬프 기반 증분 동기화

3. **에러 핸들링**
   - 재시도 로직 구현
   - 부분 실패시 롤백 메커니즘

## ✅ 완료 체크리스트

- [ ] 환경 변수 설정 완료
- [ ] 자동화 방법 선택 및 설정
- [ ] 테스트 실행 성공
- [ ] 모니터링 시스템 구축
- [ ] 알림 시스템 설정
- [ ] 백업 및 복구 계획 수립
- [ ] 문서화 완료

---

💡 **팁:** 처음에는 GitHub Actions로 시작해서 안정성을 확인한 후, 필요에 따라 다른 방법으로 전환하는 것을 추천합니다.