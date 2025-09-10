# 코드 스타일 및 규칙

## TypeScript 설정
- **Strict mode** 활성화
- **Composite project** 구조 (tsconfig.json, tsconfig.app.json, tsconfig.node.json)
- **Path alias**: `@/` → `src/` 디렉터리
- 모든 컴포넌트는 함수형 컴포넌트로 작성

## ESLint 규칙 (v9 Flat Config)
- 미사용 import 자동 제거
- React Hooks 규칙 강제
- `@typescript-eslint/no-explicit-any` 규칙:
  - `src/pages/**`, `src/features/**`: 비활성화 (개발 단계)
  - `scripts/**`, `supabase/functions/**`: 비활성화
  - 테스트 파일: 비활성화

## 파일 및 디렉터리 명명 규칙
- 컴포넌트 파일: PascalCase (`LeaguePage.tsx`)
- 디렉터리: kebab-case 또는 camelCase
- 테스트 파일: `*.test.ts`, `*.test.tsx`

## React 패턴
- 함수형 컴포넌트 우선
- React Query를 통한 서버 상태 관리
- React Router v7 lazy loading 패턴
- Korean fallback 텍스트: "로딩중…"

## Import/Export 패턴
- Named exports 선호
- 절대 경로 import 사용 (`@/` alias)
- 미사용 import는 ESLint에 의해 자동 제거

## API 설계
- Supabase 클라이언트를 통한 데이터 액세스
- `getJson()`, `postJson()` 유틸리티 함수 사용
- 타입 안전한 API 응답 처리
- 한국어 UI 텍스트 지원