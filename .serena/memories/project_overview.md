# AllLeaguesFans 프로젝트 개요

## 프로젝트 목적
전 세계 축구 리그, 팀, 선수 정보를 제공하는 React 웹 애플리케이션입니다. 한국어 UI를 지원하며 Supabase를 백엔드로 사용하는 스포츠 데이터 플랫폼입니다.

## 기술 스택
### 프론트엔드
- **React 19** with TypeScript (strict mode)
- **React Router DOM v7** - 클라이언트 사이드 라우팅 with lazy loading
- **TanStack React Query v5** - 서버 상태 관리
- **Tailwind CSS v4** - 스타일링
- **Lucide React** - 아이콘
- **Zod v4** - 스키마 검증

### 백엔드 & 데이터베이스
- **Supabase** - PostgreSQL 데이터베이스 및 백엔드 서비스

### 빌드 & 개발 도구
- **Vite** - 빌드 도구 with SWC for Fast Refresh
- **Vitest** - 테스트 프레임워크 with jsdom environment
- **pnpm** - 패키지 매니저
- **ESLint v9** (Flat Config) - 코드 품질
- **TypeScript** - 정적 타입 검사

## 주요 특징
- 한국어 UI 지원
- 축구 리그, 팀, 선수 검색 기능
- 반응형 디자인
- 코드 분할 및 lazy loading
- 타입 안전성 (TypeScript strict mode)
- 현대적인 React 패턴 (함수형 컴포넌트, hooks)