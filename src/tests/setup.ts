import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Global mock for TheSportsDB API to prevent network calls in all tests
vi.mock("../lib/thesportsdb-api", () => ({
  fetchLeagueFixtures: vi.fn().mockResolvedValue({
    recent: [],
    upcoming: []
  }),
  fetchKLeague1UpcomingFixtures: vi.fn().mockResolvedValue([]),
  fetchKLeague2UpcomingFixtures: vi.fn().mockResolvedValue([]),
  K_LEAGUE_IDS: {
    K_LEAGUE_1: "4689",
    K_LEAGUE_2: "4822"
  }
}));

// Global mock for Enhanced Standings API to prevent Highlightly API calls
vi.mock("../lib/enhanced-standings-api", () => ({
  fetchEnhancedLeagueStandings: vi.fn().mockResolvedValue([
    {
      team_id: 1,
      team_name: "Ulsan Hyundai FC",
      short_name: "ULS",
      crest_url: "https://example.com/ulsan.png",
      rank: 1,
      points: 65,
      played: 30,
      win: 20,
      draw: 5,
      lose: 5,
      goals_for: 58,
      goals_against: 25,
      goals_diff: 33,
      form: "WWWDW",
    },
    {
      team_id: 2,
      team_name: "Jeonbuk Hyundai Motors",
      short_name: "JBH",
      crest_url: "https://example.com/jeonbuk.png", 
      rank: 2,
      points: 62,
      played: 30,
      win: 19,
      draw: 5,
      lose: 6,
      goals_for: 55,
      goals_against: 28,
      goals_diff: 27,
      form: "LWWWW",
    },
  ])
}));
