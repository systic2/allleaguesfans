# 🚀 GitHub Actions 자동화 설정 가이드

## ⚡ 즉시 시작하기

### 1단계: Repository Secrets 설정

**GitHub Repository → Settings → Secrets and variables → Actions**에서 다음 Secrets를 추가하세요:

#### 🔒 필수 Secrets
```
SUPABASE_URL
Value: [현재 .env 파일의 SUPABASE_URL 값]

SUPABASE_SERVICE_ROLE  
Value: [현재 .env 파일의 SUPABASE_SERVICE_ROLE 값]

API_FOOTBALL_KEY
Value: [현재 .env 파일의 API_FOOTBALL_KEY 값]
```

> ⚠️ **보안 주의**: 실제 키값은 .env 파일에서 복사하여 GitHub Secrets에 직접 입력하세요.

#### 📢 선택적 Secrets (알림 기능)
```
SLACK_WEBHOOK
Value: https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

SENDGRID_API_KEY
Value: your_sendgrid_api_key (이메일 알림용)
```

### 2단계: 즉시 테스트 실행

1. **수동 실행 테스트:**
   - GitHub Repository → Actions 탭
   - "API Football Data Sync" workflow 선택
   - "Run workflow" 버튼 클릭
   - "Manual Full Sync" 실행

2. **로그 확인:**
   - 실행된 workflow 클릭
   - 각 step의 로그 확인
   - 에러 발생시 Details 확인

## 📅 자동 실행 스케줄

### 현재 설정된 스케줄
```yaml
# 매일 오전 2시 (UTC) = 한국시간 오전 11시
- cron: '0 2 * * *'  # 일일 동기화 (경기 결과, 순위)

# 매주 월요일 오전 3시 (UTC) = 한국시간 오후 12시  
- cron: '0 3 * * 1'  # 주간 동기화 (선수 이적)
```

### 스케줄 수정 방법
`.github/workflows/data-sync.yml` 파일의 cron 표현식을 수정:

```yaml
# 예시: 매일 오후 2시 한국시간
- cron: '0 5 * * *'  # UTC는 9시간 빼기

# 예시: 매일 오전 6시 한국시간  
- cron: '0 21 * * *' # 전날 UTC 21시
```

## 🛠️ 로컬에서 사용할 수 있는 명령어

### 동기화 명령어
```bash
# 전체 데이터 동기화
pnpm sync:full

# 일일 동기화 (경기 결과 + 순위)
pnpm sync:daily

# 주간 동기화 (선수 이적)
pnpm sync:weekly

# 데이터 상태 확인
pnpm sync:check

# 시스템 모니터링
pnpm sync:monitor

# API 응답 디버깅
pnpm sync:debug

# 데이터베이스 테스트
pnpm sync:test-db
```

### 시즌별 동기화
```bash
# 2024년 시즌 데이터
SEASON_YEAR=2024 pnpm sync:daily

# 2025년 시즌 데이터 (기본값)
SEASON_YEAR=2025 pnpm sync:daily
```

## 📊 모니터링 및 알림

### 자동 모니터링 기능
- ✅ API Football 연결 상태 확인
- ✅ Supabase 연결 상태 확인  
- ✅ 데이터 테이블별 레코드 수 검증
- ✅ 데이터 연결성 테스트
- ✅ 실패시 자동 알림

### 알림 설정 (선택사항)

#### Slack 알림
1. Slack에서 Incoming Webhook 생성
2. GitHub Secrets에 `SLACK_WEBHOOK` 추가
3. 자동으로 실패시 알림 전송

#### 이메일 알림 (SendGrid)
1. SendGrid 계정 생성 및 API 키 발급
2. GitHub Secrets에 다음 추가:
   ```
   SENDGRID_API_KEY: your_api_key
   FROM_EMAIL: noreply@yourdomain.com
   ALERT_EMAIL: admin@yourdomain.com
   ```

## 🔧 문제 해결

### 자주 발생하는 문제

#### 1. Secrets 설정 오류
```
Error: Missing API_FOOTBALL_KEY
```
**해결:** Repository Settings → Secrets에서 환경변수 확인

#### 2. API 요청 한도 초과
```
Error: API-FOOTBALL 429 Too Many Requests
```
**해결:** 자동 재시도 로직이 있지만, 과도한 요청시 24시간 후 재시도

#### 3. Supabase 연결 실패
```
Error: Invalid API key
```
**해결:** SUPABASE_SERVICE_ROLE 키 확인 및 재설정

### 디버깅 단계
1. **로컬 테스트:** `pnpm sync:check`
2. **API 테스트:** `pnpm sync:debug`  
3. **수동 실행:** GitHub Actions에서 "Run workflow"
4. **로그 확인:** Actions 탭에서 실행 로그 검토

## ✅ 설정 완료 체크리스트

- [ ] GitHub Secrets 설정 완료
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_SERVICE_ROLE  
  - [ ] API_FOOTBALL_KEY
- [ ] 첫 수동 실행 테스트 성공
- [ ] 로컬 동기화 명령어 테스트
- [ ] 모니터링 시스템 확인
- [ ] 알림 설정 (선택)
- [ ] 자동 스케줄 확인

## 🎯 다음 단계

1. **24시간 모니터링:** 첫 자동 실행 확인
2. **데이터 검증:** 정기적으로 `pnpm sync:check` 실행
3. **성능 최적화:** 필요시 스케줄 조정
4. **알림 설정:** Slack/이메일 알림 활성화

---

💡 **팁:** 처음 설정 후 24-48시간은 모니터링하여 안정성을 확인하세요!

## 🔐 보안 참고사항

- 실제 API 키와 토큰은 절대 코드에 하드코딩하지 마세요
- GitHub Secrets를 통해서만 민감한 정보를 관리하세요
- .env 파일은 절대 Git에 커밋하지 마세요
- 정기적으로 API 키를 로테이션하세요