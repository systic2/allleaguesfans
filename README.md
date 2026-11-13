# AllLeaguesFans

K리그 1·2와 유럽 5대 리그(EPL, 라리가, 세리에 A, 분데스리가, 리그 1)의 순위, 경기 일정·결과, 득점·도움 순위, 팀·선수 정보를 보여 주는 웹사이트입니다.

- **프론트엔드**: React 19 + Vite + TanStack Query, Vercel 배포
- **데이터**: Supabase(PostgreSQL). GitHub Actions가 매시간 TheSportsDB와 K리그 공식 사이트에서 데이터를 받아 갱신합니다.

```bash
pnpm install
pnpm dev        # 개발 서버
pnpm test       # 테스트
pnpm build      # 타입 검사 + 프로덕션 빌드
```

로컬 실행에는 `.env.local`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 필요합니다. 구조와 데이터 동기화는 [CLAUDE.md](CLAUDE.md)를 참고하세요.
