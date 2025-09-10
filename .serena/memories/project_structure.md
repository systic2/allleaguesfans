# 프로젝트 구조

## 디렉터리 구조
```
allleaguesfans/
├── src/
│   ├── app/           # 앱 핵심 설정
│   │   ├── components/    # 공유 컴포넌트
│   │   ├── layout/       # 레이아웃 컴포넌트
│   │   ├── router.tsx    # React Router v7 설정
│   │   └── queryClient.ts # React Query 클라이언트
│   ├── pages/         # 페이지 컴포넌트 (라우트)
│   ├── components/    # 재사용 가능한 UI 컴포넌트
│   ├── features/      # 기능별 코드와 API
│   ├── lib/          # 유틸리티 및 API 레이어
│   ├── domain/       # 핵심 엔티티 타입 정의
│   ├── data/         # 정적 데이터
│   ├── assets/       # 정적 자산
│   └── tests/        # 테스트 파일 및 설정
├── config/           # 설정 파일
├── scripts/          # 빌드/개발 스크립트
├── supabase/         # Supabase 설정 및 마이그레이션
├── seeds/            # 데이터베이스 시드 파일
├── public/           # 정적 파일
└── .github/          # GitHub Actions 워크플로우
```

## 핵심 설정 파일
- `package.json` - 의존성 및 스크립트
- `vite.config.ts` - Vite 빌드 설정
- `vitest.config.ts` - 테스트 설정
- `eslint.config.js` - ESLint v9 Flat Config
- `tailwind.config.ts` - Tailwind CSS 설정
- `tsconfig.json` (composite) - TypeScript 설정
- `CLAUDE.md` - Claude 개발 가이드

## 라우팅 구조
- `/` - 홈페이지
- `/leagues` - 리그 목록
- `/leagues/:slug` - 특정 리그 페이지
- `/teams/:id` - 팀 상세 페이지
- `/players/:id` - 선수 상세 페이지
- `/search` - 검색 결과 페이지

## 데이터 플로우
1. Supabase PostgreSQL 데이터베이스
2. `src/lib/api.ts` - API 유틸리티
3. React Query - 서버 상태 관리
4. React 컴포넌트 - UI 렌더링