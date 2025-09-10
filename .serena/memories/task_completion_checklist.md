# 작업 완료 체크리스트

## 코드 변경 후 필수 단계

### 1. 타입 검사
```bash
pnpm typecheck
```
- TypeScript 컴파일 에러 확인
- 모든 타입 문제 해결 필요

### 2. 코드 품질 검사
```bash
pnpm lint:unused
```
- ESLint 규칙 준수 확인
- 미사용 import 자동 정리
- React Hooks 규칙 검증

### 3. 테스트 실행
```bash
vitest
```
- 모든 테스트 통과 확인
- 새로운 기능에 대한 테스트 작성

### 4. 빌드 검증 (선택)
```bash
pnpm build
```
- 프로덕션 빌드 성공 확인
- 번들 크기 및 최적화 검토

## 주기적 품질 관리

### 의존성 정리 (주간)
```bash
pnpm deps:check     # 미사용 의존성
pnpm exports:check  # 미사용 export
pnpm files:check    # 데드 코드
```

### 성능 모니터링 (월간)
```bash
pnpm analyze:bundle
```
- 번들 크기 분석
- 코드 분할 최적화 검토

## Git 커밋 전 체크리스트
1. ✅ `pnpm typecheck` 통과
2. ✅ `pnpm lint:unused` 통과  
3. ✅ `vitest` 모든 테스트 통과
4. ✅ 한국어 UI 텍스트 일관성 확인
5. ✅ 의미있는 커밋 메시지 작성

## 특별 고려사항
- **한국어 UI**: 모든 사용자 대면 텍스트는 한국어로 작성
- **타입 안전성**: any 타입 사용 지양, 적절한 타입 정의
- **성능**: React Query 캐싱 활용, lazy loading 적용
- **접근성**: 시맨틱 HTML 및 ARIA 속성 고려