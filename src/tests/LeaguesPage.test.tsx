// src/tests/LeaguesPage.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";

// ✅ fetchLeagues만 단일 모킹 (spyOn과 동시 사용 금지)
vi.mock("../lib/api", () => {
  return {
    fetchLeagues: vi.fn().mockResolvedValue([
      {
        id: 1,
        name: "K League 1",
        country: "Korea Republic",
        slug: "k-league-1",
        // League 타입에 맞춰 logo/tier(optional)
        logo: "",
        tier: 1,
      },
      {
        id: 2,
        name: "Premier League",
        country: "England",
        slug: "premier-league",
        logo: "",
        tier: 1,
      },
    ]),
  };
});

// ⚠️ 모킹 선언 이후에 페이지를 import (Vitest가 hoist 해주지만, 명시적으로 안전)
import LeaguesPage from "../pages/LeagueListPage";

describe("LeaguesPage", () => {
  it("리그 목록을 렌더링한다", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } }, // 테스트 속도/안정
    });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <LeaguesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("K League 1")).toBeInTheDocument();
    expect(await screen.findByText("Premier League")).toBeInTheDocument();
  });
});
