import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLeagues } from '@/lib/api';
import Sidebar from '@/app/components/Sidebar';

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
      { id: 4334, slug: 'ligue-1', name: 'Ligue 1', name_korean: '리그 1', tier: null },
      { id: 9999, slug: 'league-9999', name: 'Custom League', name_korean: null, tier: null },
      { id: 4328, slug: 'premier-league', name: 'Premier League', name_korean: '프리미어리그', tier: null },
      { id: 4822, slug: 'k-league-2', name: 'K League 2', name_korean: 'K리그2', tier: null },
      { id: 4689, slug: 'k-league-1', name: 'K League 1', name_korean: 'K리그1', tier: null },
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
});
