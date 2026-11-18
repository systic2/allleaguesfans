import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPlayerDetail,
  fetchTeamKoreanNames,
  type PlayerDetail,
  type PlayerSeasonStats,
} from '@/lib/api';
import PlayerPage from '@/pages/PlayerPage';
import { getFavorites } from '@/lib/favorites';
import { RECORD_SCOPE } from '@/lib/squad';

vi.mock('@/lib/api', () => ({
  fetchPlayerDetail: vi.fn(),
  fetchTeamKoreanNames: vi.fn(),
}));

const mockFetchPlayerDetail = vi.mocked(fetchPlayerDetail);
const mockFetchTeamKoreanNames = vi.mocked(fetchTeamKoreanNames);

const season: PlayerSeasonStats = {
  season: '2026',
  leagueId: '4689',
  teamId: '99',
  teamName: 'Test FC',
  appearances: 12,
  minutesPlayed: 900,
  goals: 7,
  assists: 3,
  yellowCards: 1,
  redCards: 0,
  penaltiesScored: 1,
  penaltiesMissed: 0,
  ownGoals: 0,
};

const player: PlayerDetail = {
  id: '1',
  name: 'Test Striker',
  teamName: 'Test FC',
  teamId: '99',
  position: 'Forward',
  jerseyNumber: '9',
  photoUrl: null,
  nationality: 'South Korea',
  height: '185 cm',
  weight: '80 kg',
  birthDate: '2000-01-01',
  seasons: [season],
  teamLeagueId: '4689',
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

function expectTableCell(row: HTMLElement, header: string, text: string) {
  const table = row.closest('table')!;
  const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent?.trim());
  const cells = Array.from(row.querySelectorAll('th, td'));
  expect(cells[headers.indexOf(header)]).toHaveTextContent(text);
}

describe('PlayerPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    mockFetchPlayerDetail.mockReset();
    mockFetchTeamKoreanNames.mockReset();
    mockFetchTeamKoreanNames.mockResolvedValue({ '99': '테스트 FC' });
  });

  it('shows a loading message while the player request is pending', () => {
    mockFetchPlayerDetail.mockImplementation(() => new Promise(() => {}));

    renderPlayerPage();

    expect(screen.getByText('로딩중…')).toBeInTheDocument();
  });

  it('shows the real header, profile, and season table without fabricated details', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T00:00:00Z'));
    mockFetchPlayerDetail.mockResolvedValue(player);

    renderPlayerPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Test Striker' })).toBeInTheDocument();
    expect(screen.getByText('#9')).toBeInTheDocument();
    expect(screen.getAllByText('공격수 (Forward)').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: '테스트 FC' })[0]).toHaveAttribute('href', '/teams/99');

    const birthDate = screen.getByText('생년월일');
    expect(within(birthDate.parentElement!).getByText('2000-01-01 (만 26세)')).toBeInTheDocument();
    expect(within(screen.getByText('국적').parentElement!).getByText('South Korea')).toBeInTheDocument();
    expect(within(screen.getByText('키').parentElement!).getByText('185 cm')).toBeInTheDocument();
    expect(within(screen.getByText('체중').parentElement!).getByText('80 kg')).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: '시즌 기록' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '득점' })).toBeInTheDocument();
    const row = screen.getByRole('rowheader', { name: '2026' }).parentElement!;
    expectTableCell(row, '리그', 'K리그1');
    expectTableCell(row, '팀', '테스트 FC');
    expectTableCell(row, '득점', '7');
    expect(screen.getByText(RECORD_SCOPE.kleague)).toBeInTheDocument();
    expect(screen.getByText(RECORD_SCOPE.transfer).closest('li')).not.toBeNull();

    for (const fabricatedText of [
      'Weekly Wage',
      'Scout Report',
      'Avg Rating',
      'Preferred Foot',
      'Global Ranking',
      'Natural',
      'Quick Summary',
    ]) {
      expect(document.body).not.toHaveTextContent(fabricatedText);
    }
  });

  it('favorites the player using the detail id, name, and photo', async () => {
    mockFetchPlayerDetail.mockResolvedValue({ ...player, photoUrl: '/test-player.png' });

    renderPlayerPage();

    expect(await screen.findByRole('img', { name: 'Test Striker' })).toHaveAttribute('src', '/test-player.png');
    fireEvent.click(screen.getByRole('button', { name: '즐겨찾기' }));
    expect(getFavorites()).toEqual([
      expect.objectContaining({
        type: 'player',
        id: '1',
        name: 'Test Striker',
        image: '/test-player.png',
      }),
    ]);
  });

  it('shows missing profile values and the empty season state without inventing fallbacks', async () => {
    mockFetchPlayerDetail.mockResolvedValue({
      ...player,
      teamName: null,
      teamId: null,
      position: null,
      jerseyNumber: null,
      photoUrl: null,
      nationality: null,
      height: null,
      weight: null,
      birthDate: null,
      seasons: [],
      teamLeagueId: null,
    });

    renderPlayerPage();

    expect(await screen.findByText('수집된 시즌 기록이 없습니다.')).toBeInTheDocument();
    const profile = screen.getByRole('heading', { name: '프로필' }).parentElement!;
    expect(within(profile).getAllByText('미제공')).toHaveLength(7);
    expect(document.body).not.toHaveTextContent(' - ');
  });

  it.each(['4689', '4822'])('shows the K League scope for an empty %s player record', async (teamLeagueId) => {
    mockFetchPlayerDetail.mockResolvedValue({ ...player, seasons: [], teamLeagueId });

    renderPlayerPage();

    expect(await screen.findByText(/K리그 개인 기록은 kleague\.com 선수 ID로 모으고 있어 아직 이 선수와 연결되지 않았습니다\./)).toBeInTheDocument();
    expect(screen.getByText(RECORD_SCOPE.kleague).closest('li')).not.toBeNull();
  });

  it('shows the European scope for an empty player record in a European league', async () => {
    mockFetchPlayerDetail.mockResolvedValue({ ...player, seasons: [], teamLeagueId: '4328' });

    renderPlayerPage();

    expect(await screen.findByText('수집된 시즌 기록이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText(RECORD_SCOPE.europe).closest('li')).not.toBeNull();
    expect(screen.queryByText(/K리그 개인 기록은 kleague\.com/)).not.toBeInTheDocument();
  });

  it('shows the shared not-found links when the player does not exist', async () => {
    mockFetchPlayerDetail.mockResolvedValue(null);

    renderPlayerPage();

    expect(await screen.findByRole('heading', { name: '선수를 찾을 수 없습니다.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '리그 목록' })).toHaveAttribute('href', '/leagues');
  });

  it('renders both transfer-team rows and preserves nullable statistics separately from zeroes', async () => {
    mockFetchTeamKoreanNames.mockResolvedValue({
      current: '현재 FC',
      former: '이전 FC',
    });
    mockFetchPlayerDetail.mockResolvedValue({
      ...player,
      teamId: 'current',
      teamName: 'Current FC',
      teamLeagueId: '4328',
      seasons: [
        {
          ...season,
          leagueId: '4328',
          teamId: 'current',
          teamName: 'Current FC',
          appearances: null,
          minutesPlayed: 0,
          goals: null,
          assists: 0,
          yellowCards: null,
          redCards: 0,
          penaltiesScored: null,
          penaltiesMissed: 0,
          ownGoals: null,
        },
        {
          ...season,
          leagueId: '4328',
          teamId: 'former',
          teamName: 'Former FC',
          appearances: 0,
          minutesPlayed: null,
          goals: 0,
          assists: null,
          yellowCards: 0,
          redCards: null,
          penaltiesScored: 0,
          penaltiesMissed: 0,
          ownGoals: 0,
        },
      ],
    });

    renderPlayerPage();

    expect(await screen.findAllByRole('rowheader', { name: '2026/27' })).toHaveLength(2);
    const table = screen.getByRole('table');
    const currentRow = within(table).getByRole('link', { name: '현재 FC' }).closest('tr')!;
    const formerRow = within(table).getByRole('link', { name: '이전 FC' }).closest('tr')!;
    expect(Array.from(table.querySelectorAll('tbody tr'))).toEqual([currentRow, formerRow]);
    expectTableCell(currentRow, '출전', '—');
    expectTableCell(currentRow, '출전 시간', '0');
    expectTableCell(currentRow, '득점', '—');
    expectTableCell(currentRow, '도움', '0');
    expectTableCell(formerRow, '출전', '0');
    expectTableCell(formerRow, '출전 시간', '—');
    expectTableCell(formerRow, '득점', '0');
    expectTableCell(formerRow, '도움', '—');
    expect(within(currentRow).getAllByTitle('미제공').length).toBeGreaterThan(0);
    expect(screen.getByText(RECORD_SCOPE.europe)).toBeInTheDocument();
    expect(screen.getByText(RECORD_SCOPE.transfer).closest('li')).not.toBeNull();
    expect(screen.getByText('—는 그 리그에서 수집하지 않는 항목입니다.')).toBeInTheDocument();
  });

  it('renders zero penalty attempts as 0 / 0', async () => {
    mockFetchPlayerDetail.mockResolvedValue({
      ...player,
      seasons: [{ ...season, penaltiesScored: 0, penaltiesMissed: 0 }],
    });

    renderPlayerPage();

    const row = (await screen.findByRole('rowheader', { name: '2026' })).parentElement!;
    expectTableCell(row, 'PK 성공/시도', '0 / 0');
  });
});
