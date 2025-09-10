# AllLeaguesFans 개발 명령어

## 필수 개발 명령어
```bash
# 개발 서버 시작 (Vite)
pnpm dev

# 프로덕션 빌드 (타입 체크 포함)
pnpm build

# 타입 체크만 실행
pnpm typecheck

# 린팅 (미사용 import 정리 포함)
pnpm lint:unused

# 테스트 실행 (Vitest)
vitest
```

## 코드 품질 & 분석 명령어
```bash
# 미사용 의존성 체크
pnpm deps:check

# 미사용 export 분석
pnpm exports:check

# 데드 코드 감지
pnpm files:check

# 번들 크기 분석
pnpm analyze:bundle

# 미리보기 서버
pnpm preview
```

## 시스템 명령어 (macOS)
```bash
# 파일 탐색
find . -name "*.tsx" -type f
ls -la
grep -r "pattern" src/

# Git 작업
git status
git log --oneline
git diff

# 프로세스 관리
ps aux | grep node
kill -9 <PID>
```

## 작업 완료 후 체크리스트
1. `pnpm typecheck` - 타입 에러 확인
2. `pnpm lint:unused` - 린팅 및 미사용 import 정리
3. `vitest` - 테스트 통과 확인
4. `pnpm deps:check` (선택) - 의존성 정리
5. 한국어 UI 텍스트 일관성 확인