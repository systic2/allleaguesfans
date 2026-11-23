import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLeagues } from '@/lib/api';
import Sidebar from '@/app/components/Sidebar';
import { setFavorites, type Favorite } from '@/lib/favorites';

vi.mock('@/lib/api', () => ({
  fetchLeagues: vi.fn(),
}));

const mockFetchLeagues = vi.mocked(fetchLeagues);

function renderSidebar(initialEntry = '/teams/team-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Sidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    mockFetchLeagues.mockReset();
  });

  it('shows Korean labels and orders leagues by the shared slug order', async () => {
    mockFetchLeagues.mockResolvedValue([
      { id: 4334, slug: 'ligue-1', name: 'Ligue 1', name_korean: '리그 1', tier: null, current_season: '2026' },
      { id: 9999, slug: 'league-9999', name: 'Custom League', name_korean: null, tier: null, current_season: '2026' },
      { id: 4328, slug: 'premier-league', name: 'Premier League', name_korean: '프리미어리그', tier: null, current_season: '2026' },
      { id: 4822, slug: 'k-league-2', name: 'K League 2', name_korean: 'K리그2', tier: null, current_season: '2026' },
      { id: 4689, slug: 'k-league-1', name: 'K League 1', name_korean: 'K리그1', tier: null, current_season: '2026' },
    ]);

    renderSidebar();

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });
    expect(within(nav).getByRole('link', { name: '홈' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: '리그 전체' })).toHaveAttribute('href', '/leagues');

    await within(nav).findByRole('link', { name: 'K리그1' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      '홈',
      '경기',
      '팀',
      '선수',
      '즐겨찾기',
      '리그 전체',
      'K리그1',
      'K리그2',
      '프리미어리그',
      '리그 1',
      'Custom League',
    ]);
    expect(screen.queryByText('Team Menu')).not.toBeInTheDocument();
    expect(screen.queryByText('개요 (Overview)')).not.toBeInTheDocument();
  });

  it('uses the Korean loading label', () => {
    mockFetchLeagues.mockReturnValue(new Promise(() => {}));

    renderSidebar('/');

    expect(screen.getByText('로딩중…')).toBeInTheDocument();
    expect(screen.queryByText('Loading leagues...')).not.toBeInTheDocument();
  });

  it('shows up to ten favorite shortcuts and links to the rest', async () => {
    mockFetchLeagues.mockResolvedValue([]);
    const favorites: Favorite[] = Array.from({ length: 12 }, (_, index) => ({
      type: index % 3 === 0 ? 'league' : index % 3 === 1 ? 'team' : 'player',
      id: `favorite-${index + 1}`,
      name: `즐겨찾기 ${index + 1}`,
      image: null,
      addedAt: `2026-11-18T00:00:${String(index).padStart(2, '0')}.000Z`,
    }));
    setFavorites(favorites);

    renderSidebar();

    const shortcuts = screen.getByRole('group', { name: '즐겨찾기 바로가기' });
    expect(within(shortcuts).getByRole('link', { name: '즐겨찾기 1' })).toHaveAttribute(
      'href',
      '/leagues/favorite-1',
    );
    expect(within(shortcuts).getByRole('link', { name: '즐겨찾기 10' })).toHaveAttribute(
      'href',
      '/leagues/favorite-10',
    );
    expect(within(shortcuts).queryByRole('link', { name: '즐겨찾기 11' })).not.toBeInTheDocument();
    expect(within(shortcuts).getByRole('link', { name: '2개 더 보기' })).toHaveAttribute('href', '/favorites');
  });
});
