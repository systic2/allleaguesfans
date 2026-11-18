import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPlayerDetail, fetchTeamKoreanNames, type PlayerDetail } from '@/lib/api';
import PlayerPage from '@/pages/PlayerPage';

vi.mock('@/lib/api', () => ({
  fetchPlayerDetail: vi.fn(),
  fetchTeamKoreanNames: vi.fn(),
}));

vi.mock('@/app/components/CrestImg', () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="crest-img">{alt}</span>,
}));

const mockFetchPlayerDetail = vi.mocked(fetchPlayerDetail);
const mockFetchTeamKoreanNames = vi.mocked(fetchTeamKoreanNames);

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
    mockFetchTeamKoreanNames.mockReset();
    mockFetchTeamKoreanNames.mockResolvedValue({});
  });

  it('shows a loading message while the player request is pending', () => {
    mockFetchPlayerDetail.mockImplementation(() => new Promise(() => {}));

    renderPlayerPage();

    expect(screen.getByText('로딩중…')).toBeInTheDocument();
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

  it('shows the shared not-found links when the player does not exist', async () => {
    mockFetchPlayerDetail.mockResolvedValue(null);

    renderPlayerPage();

    expect(await screen.findByRole('heading', { name: '선수를 찾을 수 없습니다.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '리그 목록' })).toHaveAttribute('href', '/leagues');
  });

  it('renders nullable statistics as dashes while preserving genuine zeroes', async () => {
    mockFetchPlayerDetail.mockResolvedValue({
      ...player,
      stats: {
        ...player.stats!,
        appearances: null,
        minutesPlayed: 0,
        goals: null,
        assists: 0,
        yellowCards: null,
        redCards: 0,
        penaltiesScored: 0,
        penaltiesMissed: null,
      },
    });

    renderPlayerPage();
    await screen.findByText('2026 Season Statistics');

    const expectValue = (label: string, value: string) => {
      const labelNode = screen.getAllByText(label)[0];
      expect(within(labelNode.parentElement!).getByText(value)).toBeInTheDocument();
    };
    expectValue('Appearances', '-');
    expectValue('Minutes Played', '0');
    expectValue('Goals', '-');
    expectValue('Assists', '0');
    expectValue('Yellow Cards', '-');
    expectValue('Red Cards', '0');
    expectValue('Penalties Scored', '-');
  });

  it('renders zero penalty attempts as 0 / 0', async () => {
    mockFetchPlayerDetail.mockResolvedValue({
      ...player,
      stats: {
        ...player.stats!,
        penaltiesScored: 0,
        penaltiesMissed: 0,
      },
    });

    renderPlayerPage();

    const label = await screen.findByText('Penalties Scored');
    expect(within(label.parentElement!).getByText('0 / 0')).toBeInTheDocument();
  });
});
