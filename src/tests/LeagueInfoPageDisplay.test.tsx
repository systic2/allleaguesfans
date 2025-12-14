import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LeaguePage from "@/pages/LeaguePage";
import * as api from "@/lib/api";
import * as theSportsDBApi from "@/lib/thesportsdb-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock API modules
vi.mock("@/lib/api");
vi.mock("@/lib/thesportsdb-api");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe("League Information Page Display Verification", () => {
  const mockLeague = {
    id: 4689,
    slug: "k-league-1",
    name: "K League 1",
    logo_url: "https://example.com/logo.png",
    current_season: "2025",
    country: "South Korea",
  };

  const mockStandings = [
    {
      team_id: 1,
      team_name: "Ulsan Hyundai FC",
      rank: 1,
      points: 30,
      played: 15,
      win: 10,
      draw: 0,
      lose: 5,
      goals_for: 25,
      goals_against: 15,
      goals_diff: 10,
      crest_url: "https://example.com/ulsan.png",
    },
  ];

  const mockFixtures = {
    upcoming: [],
    recent: [],
  };

  const mockHistory = [
    {
      season_year: 2024,
      champion_name: "Ulsan Hyundai",
    }
  ];

  const mockScorers = [
    { player_name: "Joo", team_name: "Ulsan", goals: 10, assists: 2, matches: 15 }
  ];

  const mockAssists = [
    { player_name: "Kim", team_name: "Seoul", assists: 5, goals: 1, matches: 15 }
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    (api.fetchLeagueBySlug as any).mockResolvedValue(mockLeague);
    (api.fetchLeagueStandings as any).mockResolvedValue(mockStandings);
    (theSportsDBApi.fetchLeagueFixtures as any).mockResolvedValue(mockFixtures);
    (api.fetchHistoricalChampions as any).mockResolvedValue(mockHistory);
    (api.fetchTopScorers as any).mockResolvedValue(mockScorers);
    (api.fetchTopAssists as any).mockResolvedValue(mockAssists);
  });

  const renderLeaguePage = (slug = "k-league-1") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/leagues/${slug}`]}>
          <Routes>
            <Route path="/leagues/:slug" element={<LeaguePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe("기본 리그 정보 표시 (Basic League Information Display)", () => {
    it("K League 1 정보가 올바르게 표시된다", async () => {
      renderLeaguePage();

      await waitFor(() => {
        expect(screen.getByText("K League 1")).toBeInTheDocument();
        expect(screen.getByText("2025")).toBeInTheDocument();
        expect(screen.getByText(/국가: South Korea/)).toBeInTheDocument();
      });
    });
  });

  describe("순위표 표시 검증 (Standings Display Verification)", () => {
    it("리그 순위 섹션이 표시된다", async () => {
      renderLeaguePage();

      await waitFor(() => {
        expect(screen.getByText("리그 순위 >")).toBeInTheDocument();
        expect(screen.getByText("Ulsan Hyundai FC")).toBeInTheDocument();
        expect(screen.getByText("30")).toBeInTheDocument(); // points
      });
    });
  });

  describe("경기 일정 표시 검증 (Fixtures Display Verification)", () => {
    it("경기/결과 섹션이 표시된다", async () => {
      renderLeaguePage();

      await waitFor(() => {
        expect(screen.getByText("경기/결과 >")).toBeInTheDocument();
      });
    });
  });

  describe("역대 우승팀 표시 검증 (Historical Champions Display)", () => {
    it("지난 우승팀 섹션이 표시된다", async () => {
      renderLeaguePage();

      await waitFor(() => {
        expect(screen.getByText("지난 우승팀 >")).toBeInTheDocument();
        expect(screen.getByText("Ulsan Hyundai")).toBeInTheDocument();
        expect(screen.getByText("2024")).toBeInTheDocument();
      });
    });
  });

  describe("선수 통계 표시 검증 (Player Statistics Display)", () => {
    it("득점 및 도움 순위가 표시된다", async () => {
      renderLeaguePage();

      await waitFor(() => {
        expect(screen.getByText("득점 >")).toBeInTheDocument();
        expect(screen.getAllByText("Joo").length).toBeGreaterThan(0);
        expect(screen.getAllByText("10").length).toBeGreaterThan(0); // goals might also appear multiple times

        expect(screen.getByText("도움 >")).toBeInTheDocument();
        expect(screen.getAllByText("Kim").length).toBeGreaterThan(0);
        expect(screen.getAllByText("5").length).toBeGreaterThan(0); // assists
      });
    });
  });

  describe("에러 처리 검증 (Error Handling Verification)", () => {
    it("리그 데이터 로딩 실패시 에러 메시지를 표시한다", async () => {
      (api.fetchLeagueBySlug as any).mockResolvedValue(null);
      renderLeaguePage("invalid-league");

      await waitFor(() => {
        expect(screen.getByText("League not found.")).toBeInTheDocument();
      });
    });
  });
});
