import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchRow } from '@/domain/types';
import { fetchTeamKoreanNames, searchByName } from '@/lib/api';
import { SEARCH_SCOPE_TEXT } from '@/lib/search';
import SearchPage from '@/pages/SearchPage';

vi.mock('@/lib/api', () => ({
  searchByName: vi.fn(),
  fetchTeamKoreanNames: vi.fn(),
}));

const mockSearchByName = vi.mocked(searchByName);
const mockFetchTeamKoreanNames = vi.mocked(fetchTeamKoreanNames);

function renderPage(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SearchPage', () => {
  beforeEach(() => {
    mockSearchByName.mockReset();
    mockFetchTeamKoreanNames.mockReset();
    mockFetchTeamKoreanNames.mockResolvedValue({ '138001': '울산 HD' });
  });

  it('shows guidance and does not query without q', () => {
    renderPage('/search');

    expect(screen.getByRole('heading', { level: 1, name: '검색' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(SEARCH_SCOPE_TEXT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    expect(mockSearchByName).not.toHaveBeenCalled();
  });

  it('shows the query title and loading state', () => {
    mockSearchByName.mockReturnValue(new Promise<SearchRow[]>(() => {}));
    renderPage('/search?q=Lee');

    expect(screen.getByRole('heading', { level: 1, name: "'Lee' 검색 결과" })).toBeInTheDocument();
    expect(screen.getByText('로딩중…')).toBeInTheDocument();
    expect(mockSearchByName).toHaveBeenCalledWith('Lee');
  });

  it('shows an error when the search request fails', async () => {
    mockSearchByName.mockRejectedValue(new Error('database unavailable'));
    renderPage('/search?q=실패');

    expect(await screen.findByText('검색하지 못했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
  });

  it('shows empty-result copy and the shared search scope', async () => {
    mockSearchByName.mockResolvedValue([]);
    renderPage('/search?q=없음');

    expect(await screen.findByText('검색 결과 없음')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(SEARCH_SCOPE_TEXT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
  });

  it('renders ordered result sections with detail links and player identity', async () => {
    const rows: SearchRow[] = [
      {
        type: 'player', entity_id: 3, name: 'Lee Player', team_id: '138001', team_name: 'Ulsan HD FC',
        nationality: 'South Korea', birth_date: '1997-09-20',
      },
      { type: 'team', entity_id: 2, team_id: '138106', name: '부산 아이파크', name_en: 'Busan IPark' },
      { type: 'league', entity_id: 1, name: '프리미어리그', slug: 'premier-league', country: 'England' },
    ];
    mockSearchByName.mockResolvedValue(rows);
    renderPage('/search?q=Lee');

    const leagueSection = await screen.findByRole('region', { name: '리그' });
    const teamSection = screen.getByRole('region', { name: '팀' });
    const playerSection = screen.getByRole('region', { name: '선수' });
    expect(screen.getAllByRole('region').map((section) => section.getAttribute('aria-label'))).toEqual([
      '리그', '팀', '선수',
    ]);
    expect(within(leagueSection).getByRole('link')).toHaveAttribute('href', '/leagues/premier-league');
    expect(within(teamSection).getByRole('link')).toHaveAttribute('href', '/teams/138106');
    expect(within(playerSection).getByRole('link')).toHaveAttribute('href', '/players/3');
    expect(within(teamSection).getByText('Busan IPark')).toBeInTheDocument();
    expect(await within(playerSection).findByText('울산 HD · South Korea · 1997년생')).toBeInTheDocument();
  });
});
