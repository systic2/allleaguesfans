import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPlayerDetail, type PlayerDetail } from '@/lib/api';
import PlayerPage from '@/pages/PlayerPage';

vi.mock('@/lib/api', () => ({
  fetchPlayerDetail: vi.fn(),
}));

vi.mock('@/components/FMSubNav', () => ({
  default: () => <nav data-testid="fm-sub-nav" />,
}));

vi.mock('@/app/components/CrestImg', () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="crest-img">{alt}</span>,
}));

const mockFetchPlayerDetail = vi.mocked(fetchPlayerDetail);

const player: PlayerDetail = {
  id: '1',
  name: 'Test Striker',
  teamName: 'Test FC',
  teamId: '99',
  position: 'FW',
  jerseyNumber: '9',
  photoUrl: null,
  nationality: 'South Korea',
  height: '185 cm',
  weight: '80 kg',
  age: 26,
  birthDate: '2000-01-01',
  stats: {
    season: '2026',
    appearances: 12,
    minutesPlayed: 900,
    goals: 7,
    assists: 3,
    yellowCards: 1,
    redCards: 0,
    penaltiesScored: 1,
    penaltiesMissed: 0,
    ownGoals: 0,
  },
};

function renderPlayerPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/players/1']}>
        <Routes>
          <Route path="/players/:id" element={<PlayerPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PlayerPage', () => {
  beforeEach(() => {
    mockFetchPlayerDetail.mockReset();
  });

  it('shows real season statistics without fabricated player details', async () => {
    mockFetchPlayerDetail.mockResolvedValue(player);

    renderPlayerPage();

    expect(await screen.findByText('2026 Season Statistics')).toBeInTheDocument();
    expect(screen.getAllByText('Goals').length).toBeGreaterThan(0);
    expect(screen.getAllByText('7').length).toBeGreaterThan(0);

    for (const fabricatedText of [
      'Weekly Wage',
      '₩',
      'Expires',
      'Condition',
      'Sharpness',
      'Scout Report',
      'Avg Rating',
      'Preferred Foot',
      'Global Ranking',
    ]) {
      expect(document.body).not.toHaveTextContent(fabricatedText);
    }
  });

  it('shows an empty-state message when no season statistics exist', async () => {
    mockFetchPlayerDetail.mockResolvedValue({ ...player, stats: null });

    renderPlayerPage();

    expect(await screen.findByText('아직 이 선수의 시즌 기록이 없습니다.')).toBeInTheDocument();
  });
});
