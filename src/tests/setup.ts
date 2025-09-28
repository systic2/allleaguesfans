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
