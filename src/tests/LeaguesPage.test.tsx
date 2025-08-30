// src/tests/LeaguesPage.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";

import * as api from "../lib/api";
import type { League } from "../lib/types";
import LeaguesPage from "../pages/LeaguesPage";

describe("LeaguesPage", () => {
  it("리그 목록을 렌더링한다", async () => {
    // 👍 any 대신 정확한 타입 명시
    const mockLeagues: League[] = [
      { id: "1", name: "K League 1", country: "KOR", tier: 1, logo_url: null },
      {
        id: "2",
        name: "Premier League",
        country: "ENG",
        tier: 1,
        logo_url: null,
      },
    ];

    // fetchLeagues의 반환 타입과 일치하므로 타입 오류/any 경고 없음
    const spy = vi.spyOn(api, "fetchLeagues").mockResolvedValue(mockLeagues);

    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <LeaguesPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText("K League 1")).toBeInTheDocument();
    expect(await screen.findByText("Premier League")).toBeInTheDocument();

    spy.mockRestore(); // (선택) 다른 테스트에 영향 방지
  });
});
