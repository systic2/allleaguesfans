import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import FavoritesPage from '@/pages/FavoritesPage';
import {
  FAVORITES_KEY,
  getFavorites,
  resetFavoritesCache,
  setFavorites,
  type Favorite,
} from '@/lib/favorites';

const favorites: Favorite[] = [
  {
    type: 'league',
    id: 'k-league-1',
    name: 'K리그1',
    image: '/league.png',
    addedAt: '2026-11-18T03:00:00.000Z',
  },
  {
    type: 'team',
    id: 'team-1',
    name: '서울 테스트 FC',
    image: null,
    addedAt: '2026-11-18T02:00:00.000Z',
  },
  {
    type: 'player',
    id: 'player-1',
    name: '테스트 선수',
    image: '/player.png',
    addedAt: '2026-11-18T01:00:00.000Z',
  },
];

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="현재 주소">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(initialEntry = '/favorites') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/favorites" element={<><FavoritesPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

function seedFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  resetFavoritesCache();
}

describe('FavoritesPage', () => {
  it('shows the saved count, grouped detail links, and labeled remove controls', () => {
    seedFavorites();

    renderPage();

    expect(screen.getByText(/지금 3개/)).toHaveAttribute('role', 'status');
    const leagues = screen.getByRole('region', { name: '리그' });
    const teams = screen.getByRole('region', { name: '팀' });
    const players = screen.getByRole('region', { name: '선수' });
    expect(within(leagues).getByRole('link', { name: 'K리그1' })).toHaveAttribute('href', '/leagues/k-league-1');
    expect(within(teams).getByRole('link', { name: '서울 테스트 FC' })).toHaveAttribute('href', '/teams/team-1');
    expect(within(players).getByRole('link', { name: '테스트 선수' })).toHaveAttribute('href', '/players/player-1');
    expect(screen.getByRole('button', { name: '서울 테스트 FC 즐겨찾기 해제' })).toBeInTheDocument();
  });

  it('announces removal and moves focus to the next item after updating storage', async () => {
    seedFavorites();
    renderPage();
    let runFrame: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      runFrame = callback;
      return 1;
    });

    try {
      fireEvent.click(screen.getByRole('button', { name: '서울 테스트 FC 즐겨찾기 해제' }));

      expect(screen.queryByRole('region', { name: '팀' })).not.toBeInTheDocument();
      expect(screen.getByText(/지금 2개/)).toBeInTheDocument();
      expect(getFavorites().map(({ id }) => id)).toEqual(['k-league-1', 'player-1']);
      const announcement = screen.getByText('서울 테스트 FC 즐겨찾기를 해제했습니다.');
      expect(announcement).toHaveAttribute('role', 'status');
      expect(announcement).toHaveClass('sr-only');
      const nextButton = screen.getByRole('button', { name: '테스트 선수 즐겨찾기 해제' });
      expect(nextButton).toHaveAttribute('data-fav-remove', 'player:player-1');
      expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
      expect(nextButton).not.toHaveFocus();

      act(() => runFrame?.(performance.now()));
      expect(nextButton).toHaveFocus();
    } finally {
      requestAnimationFrame.mockRestore();
    }
  });

  it('moves focus to the previous remove button when the removed item was last', async () => {
    seedFavorites();
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '테스트 선수 즐겨찾기 해제' }));

    const previousButton = screen.getByRole('button', { name: '서울 테스트 FC 즐겨찾기 해제' });
    expect(previousButton).toHaveAttribute('data-fav-remove', 'team:team-1');
    await waitFor(() => expect(previousButton).toHaveFocus());
  });

  it('moves focus to the heading when no favorite remains', async () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([favorites[0]]));
    resetFavoritesCache();
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'K리그1 즐겨찾기 해제' }));

    const heading = screen.getByRole('heading', { level: 1, name: '즐겨찾기' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('filters by type and preserves unrelated search parameters with functional updates', () => {
    seedFavorites();
    renderPage('/favorites?type=team&from=sidebar');

    const typeControls = screen.getByRole('group', { name: '종류' });
    expect(within(typeControls).getByRole('button', { name: '팀' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: '서울 테스트 FC' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'K리그1' })).not.toBeInTheDocument();

    fireEvent.click(within(typeControls).getByRole('button', { name: '선수' }));
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('/favorites?type=player&from=sidebar');
    expect(screen.getByRole('link', { name: '테스트 선수' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '서울 테스트 FC' })).not.toBeInTheDocument();

    fireEvent.click(within(typeControls).getByRole('button', { name: '전체' }));
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('/favorites?from=sidebar');
    expect(screen.getByRole('link', { name: 'K리그1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '서울 테스트 FC' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '테스트 선수' })).toBeInTheDocument();
  });

  it('treats an unsupported type parameter as the all view', () => {
    seedFavorites();

    renderPage('/favorites?type=coach');

    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'K리그1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '서울 테스트 FC' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '테스트 선수' })).toBeInTheDocument();
  });

  it('shows the empty state when there are no favorites or no matches for the filter', () => {
    renderPage();
    expect(screen.getByText('즐겨찾기가 없습니다.')).toBeInTheDocument();

    seedFavorites();
    renderPage('/favorites?type=team');
    fireEvent.click(screen.getByRole('button', { name: '서울 테스트 FC 즐겨찾기 해제' }));
    expect(screen.getByText('즐겨찾기가 없습니다.')).toBeInTheDocument();
  });

  it('shows the tab-only warning when storage is unavailable', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    try {
      setFavorites([favorites[0]]);
      renderPage();

      expect(screen.getByText(/이 탭을 닫으면 사라집니다/)).toHaveAttribute('role', 'status');
      expect(screen.queryByText(/지금 1개/)).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'K리그1' })).toBeInTheDocument();
    } finally {
      setItem.mockRestore();
    }
  });
});
