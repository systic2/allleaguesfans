import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,     // 60s 동안 신선
      gcTime: 5 * 60_000,    // 5분 캐시 보관
      retry: 1,              // 실패 재시도 1회
      refetchOnWindowFocus: false,
    },
  },
});
