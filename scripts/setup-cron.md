# 로컬 Cron Job 설정 가이드

## 1. Cron 설정 방법

### macOS/Linux에서 cron 설정:

```bash
# crontab 편집기 열기
crontab -e

# 다음 라인들 추가:

# 매일 오전 9시 - 경기 결과 및 순위 업데이트
0 9 * * * /Users/systic/Desktop/allleaguesfans/scripts/cron-sync.sh daily

# 매주 월요일 오전 10시 - 선수 및 스쿼드 업데이트
0 10 * * 1 /Users/systic/Desktop/allleaguesfans/scripts/cron-sync.sh weekly

# 매월 1일 오전 11시 - 전체 데이터 동기화
0 11 1 * * /Users/systic/Desktop/allleaguesfans/scripts/cron-sync.sh full
```

### Windows Task Scheduler:
1. `작업 스케줄러` 열기
2. `기본 작업 만들기` 클릭
3. 트리거: 매일/매주 설정
4. 작업: `cmd /c "cd /d C:\path\to\project && npm run sync-daily"`

## 2. Node.js 환경 설정

cron에서 Node.js를 사용하려면 PATH 설정이 필요합니다:

```bash
# ~/.bash_profile 또는 ~/.zshrc에 추가
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# nvm 사용시
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

## 3. 로그 확인

```bash
# 최근 로그 확인
tail -f logs/sync_*.log

# 모든 로그 목록
ls -la logs/

# 특정 날짜 로그
cat logs/sync_2025-01-15_09-00-00.log
```

## 4. 수동 실행 테스트

```bash
# 일일 동기화 테스트
./scripts/cron-sync.sh daily

# 주간 동기화 테스트
./scripts/cron-sync.sh weekly

# 전체 동기화 테스트
./scripts/cron-sync.sh full
```

## 5. 설정 전 체크리스트

- [ ] 프로젝트 경로 수정 (`scripts/cron-sync.sh`의 PROJECT_DIR)
- [ ] .env 파일 존재 확인
- [ ] Node.js 및 pnpm 설치 확인
- [ ] 실행 권한 확인 (`chmod +x scripts/cron-sync.sh`)
- [ ] 수동 실행 테스트 완료

## 6. 문제 해결

### cron 작업이 실행되지 않는 경우:
```bash
# cron 서비스 상태 확인 (Linux)
sudo systemctl status crond

# cron 로그 확인 (macOS)
tail -f /var/log/system.log | grep cron

# 환경 변수 확인
crontab -l
```

### Node.js를 찾을 수 없는 경우:
```bash
# Node.js 경로 확인
which node
which npx

# cron에서 절대 경로 사용
0 9 * * * /usr/local/bin/node /path/to/project/scripts/sync.js
```