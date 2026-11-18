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
        id: 4334,
        name: "Ligue 1",
        country_code: "France",
        slug: "ligue-1",
        logo_url: "",
        tier: 1,
      },
      {
        id: 9999,
        name: "Custom League",
        country_code: "Global",
        slug: "league-9999",
        logo_url: "",
        tier: 1,
      },
      {
        id: 4328,
        name: "Premier League",
        country_code: "England",
        slug: "premier-league",
        logo_url: "",
        tier: 1,
      },
      {
        id: 4689,
        name: "K League 1",
        country_code: "Korea Republic",
        slug: "k-league-1",
        logo_url: "",
        tier: 1,
      },
    ]),
  };
});

vi.mock("../components/UpcomingFixtures", () => ({
  default: ({ title }: { title: string }) => <section>{title}</section>,
}));

// ⚠️ 모킹 선언 이후에 페이지를 import (Vitest가 hoist 해주지만, 명시적으로 안전)
import LeaguesPage from "../pages/LeagueListPage";

describe("LeaguesPage", () => {
  it("한글 제목과 공유 리그 순서로 목록을 렌더링한다", async () => {
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

    expect(await screen.findByRole("heading", { level: 1, name: "전체 리그" })).toBeInTheDocument();
    expect(screen.getByText("다가오는 경기")).toBeInTheDocument();

    const leagueCards = screen.getAllByRole("heading", { level: 3 });
    expect(leagueCards.map((heading) => heading.textContent)).toEqual([
      "K League 1",
      "Premier League",
      "Ligue 1",
      "Custom League",
    ]);
  });
});
