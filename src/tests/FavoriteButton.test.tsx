import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FavoriteButton from '@/components/FavoriteButton';
import {
  FAVORITES_KEY,
  MAX_FAVORITES,
  getFavorites,
  parseFavorites,
  resetFavoritesCache,
  setFavorites,
  type Favorite,
} from '@/lib/favorites';

const item = {
  type: 'team' as const,
  id: 'team-1',
  name: '서울 테스트 FC',
  image: '/team.png',
};

function storedFavorite(index: number): Favorite {
  return {
    type: 'player',
    id: `player-${index}`,
    name: `선수 ${index}`,
    image: null,
    addedAt: '2026-11-18T00:00:00.000Z',
  };
}

describe('FavoriteButton', () => {
  it('exposes its pressed state and toggles the item in storage', () => {
    render(<FavoriteButton item={item} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: '즐겨찾기' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    const removeButton = screen.getByRole('button', { name: '즐겨찾기 해제' });
    expect(removeButton).toHaveAttribute('aria-pressed', 'true');
    expect(parseFavorites(localStorage.getItem(FAVORITES_KEY))).toEqual([
      expect.objectContaining(item),
    ]);

    fireEvent.click(removeButton);
    expect(screen.getByRole('button', { name: '즐겨찾기' })).toHaveAttribute('aria-pressed', 'false');
    expect(parseFavorites(localStorage.getItem(FAVORITES_KEY))).toEqual([]);
  });

  it(`announces the ${MAX_FAVORITES}-item limit only for the current item`, () => {
    const full = Array.from({ length: MAX_FAVORITES }, (_, index) => storedFavorite(index));
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(full));
    resetFavoritesCache();
    const { rerender } = render(<FavoriteButton item={item} />);

    fireEvent.click(screen.getByRole('button', { name: '즐겨찾기' }));

    expect(screen.getByRole('status')).toHaveTextContent(`즐겨찾기는 최대 ${MAX_FAVORITES}개까지입니다.`);
    expect(screen.getByRole('button', { name: '즐겨찾기' })).toHaveAttribute('aria-pressed', 'false');
    expect(getFavorites()).toEqual(full);

    rerender(<FavoriteButton item={{ ...item, id: 'team-2', name: '다른 팀' }} />);
    expect(screen.getByRole('status')).not.toHaveTextContent(`즐겨찾기는 최대 ${MAX_FAVORITES}개까지입니다.`);
  });

  it('keeps changes in memory and shows the exact warning even after removing the item', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    try {
      render(<FavoriteButton item={item} />);
      fireEvent.click(screen.getByRole('button', { name: '즐겨찾기' }));

      expect(screen.getByRole('button', { name: '즐겨찾기 해제' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('status')).toHaveTextContent('이 브라우저에서는 저장할 수 없어 이 탭을 닫으면 바뀐 내용이 사라집니다.');
      expect(getFavorites()).toEqual([expect.objectContaining(item)]);
      expect(localStorage.getItem(FAVORITES_KEY)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: '즐겨찾기 해제' }));
      expect(screen.getByRole('button', { name: '즐겨찾기' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('status')).toHaveTextContent('이 브라우저에서는 저장할 수 없어 이 탭을 닫으면 바뀐 내용이 사라집니다.');
    } finally {
      setItem.mockRestore();
    }
  });

  it('shows the storage warning for an existing memory-only favorite before any click', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    try {
      setFavorites([{ ...item, addedAt: '2026-11-18T00:00:00.000Z' }]);
      render(<FavoriteButton item={item} />);

      expect(screen.getByRole('button', { name: '즐겨찾기 해제' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('이 브라우저에서는 저장할 수 없어 이 탭을 닫으면 바뀐 내용이 사라집니다.');
    } finally {
      setItem.mockRestore();
    }
  });

  it('refreshes favorite metadata on mount and when the item changes', async () => {
    const first: Favorite = {
      ...item,
      name: '이전 팀 이름',
      image: '/old-team.png',
      addedAt: '2026-11-18T01:00:00.000Z',
    };
    const second: Favorite = {
      type: 'league',
      id: 'k-league-1',
      name: '이전 리그 이름',
      image: null,
      addedAt: '2026-11-18T02:00:00.000Z',
    };
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([first, second]));
    resetFavoritesCache();

    const { rerender } = render(<FavoriteButton item={item} />);
    await waitFor(() => {
      expect(getFavorites()[0]).toEqual({ ...first, name: item.name, image: item.image });
    });

    const currentLeague = {
      type: 'league' as const,
      id: 'k-league-1',
      name: 'K리그1',
      image: '/league.png',
    };
    rerender(<FavoriteButton item={currentLeague} />);

    await waitFor(() => {
      expect(getFavorites()).toEqual([
        { ...first, name: item.name, image: item.image },
        { ...second, name: currentLeague.name, image: currentLeague.image },
      ]);
    });
  });
});
