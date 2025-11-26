#!/bin/bash
# scripts/cron-sync.sh - 로컬 cron 작업용 동기화 스크립트

# 설정
PROJECT_DIR="/Users/systic/Desktop/allleaguesfans"  # 프로젝트 경로 수정 필요
LOG_DIR="$PROJECT_DIR/logs"
CURRENT_DATE=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="$LOG_DIR/sync_$CURRENT_DATE.log"

# 로그 디렉토리 생성
mkdir -p "$LOG_DIR"

# 로그 함수
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 에러 처리
handle_error() {
    log "ERROR: $1"
    # 슬랙 알림 (옵션)
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"AllLeaguesFans 동기화 실패: $1\"}" \
    #   "$SLACK_WEBHOOK_URL"
    exit 1
}

log "=== 데이터 동기화 시작 ==="

# 프로젝트 디렉토리로 이동
cd "$PROJECT_DIR" || handle_error "프로젝트 디렉토리로 이동 실패"

# Node.js 환경 설정 (nvm 사용시)
# source ~/.nvm/nvm.sh
# nvm use 20

# 의존성 확인
if [ ! -f "package.json" ]; then
    handle_error "package.json 파일을 찾을 수 없음"
fi

# 환경 변수 확인
if [ ! -f ".env" ]; then
    handle_error ".env 파일을 찾을 수 없음"
fi

# 동기화 유형에 따른 실행
case "${1:-daily}" in
    "daily")
        log "일일 동기화 실행: K League 데이터"
        SEASON_YEAR=2025 npx tsx scripts/sync-kleague-final.ts >> "$LOG_FILE" 2>&1 || handle_error "K League 데이터 동기화 실패"
        ;;
    "weekly")
        log "주간 동기화 실행: K League 데이터"
        SEASON_YEAR=2025 npx tsx scripts/sync-kleague-final.ts >> "$LOG_FILE" 2>&1 || handle_error "K League 데이터 동기화 실패"
        ;;
    "full")
        log "전체 동기화 실행: K League 데이터"
        SEASON_YEAR=2025 npx tsx scripts/sync-kleague-final.ts >> "$LOG_FILE" 2>&1 || handle_error "전체 K League 데이터 동기화 실패"
        ;;
    *)
        handle_error "알 수 없는 동기화 유형: $1"
        ;;
esac

# 데이터 검증
log "데이터 검증 중..."
npx tsx scripts/final-verification.ts >> "$LOG_FILE" 2>&1 || handle_error "데이터 검증 실패"

# 오래된 로그 파일 정리 (30일 이상)
find "$LOG_DIR" -name "sync_*.log" -mtime +30 -delete 2>/dev/null

log "=== 동기화 완료 ==="

# 성공 알림 (옵션)
# curl -X POST -H 'Content-type: application/json' \
#   --data "{\"text\":\"AllLeaguesFans 데이터 동기화 완료\"}" \
#   "$SLACK_WEBHOOK_URL"