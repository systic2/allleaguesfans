import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFavorites } from '@/hooks/useFavorites';
import {
  FAVORITES_KEY,
  MAX_FAVORITES,
  parseFavorites,
  resetFavoritesCache,
  type Favorite,
} from '@/lib/favorites';

function favorite(index: number): Favorite {
  return {
    type: 'team',
    id: `team-${index}`,
    name: `팀 ${index}`,
    image: null,
    addedAt: '2026-11-18T00:00:00.000Z',
  };
}

beforeEach(() => {
  resetFavoritesCache();
});

describe('useFavorites', () => {
  it('hydrates, toggles, removes, and checks favorites through the shared store', () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([favorite(1)]));
    resetFavoritesCache();
    const { result } = renderHook(() => useFavorites());

    expect(result.current.persistent).toBe(true);
    expect(result.current.isFavorite('team', 'team-1')).toBe(true);

    let toggleResult: ReturnType<typeof result.current.toggle> | undefined;
    act(() => {
      toggleResult = result.current.toggle({
        type: 'player',
        id: 'player-1',
        name: '테스트 선수',
        image: '/player.png',
      });
    });
    expect(toggleResult).toBe('added');
    expect(result.current.favorites.map(({ id }) => id)).toEqual(['player-1', 'team-1']);
    expect(parseFavorites(localStorage.getItem(FAVORITES_KEY))).toEqual(result.current.favorites);

    act(() => {
      result.current.remove('team', 'team-1');
    });
    expect(result.current.isFavorite('team', 'team-1')).toBe(false);

    act(() => {
      toggleResult = result.current.toggle({
        type: 'player',
        id: 'player-1',
        name: '테스트 선수',
        image: '/player.png',
      });
    });
    expect(toggleResult).toBe('removed');
    expect(result.current.favorites).toEqual([]);
  });

  it('returns full without attempting a storage write', () => {
    const full = Array.from({ length: MAX_FAVORITES }, (_, index) => favorite(index));
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(full));
    resetFavoritesCache();
    const { result } = renderHook(() => useFavorites());
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    let toggleResult: ReturnType<typeof result.current.toggle> | undefined;

    try {
      act(() => {
        toggleResult = result.current.toggle({
          type: 'league',
          id: 'new-league',
          name: '새 리그',
          image: null,
        });
      });

      expect(toggleResult).toBe('full');
      expect(result.current.favorites).toEqual(full);
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });

  it('preserves newer storage changes when toggling and removing', () => {
    const initial = [favorite(1)];
    const fromAnotherTab = favorite(2);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(initial));
    const { result } = renderHook(() => useFavorites());

    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...initial, fromAnotherTab]));
    act(() => {
      result.current.toggle({
        type: 'league',
        id: 'k-league-1',
        name: 'K리그1',
        image: '/league.png',
      });
    });
    expect(result.current.favorites.map(({ id }) => id)).toEqual(['k-league-1', 'team-1', 'team-2']);

    const latest = favorite(3);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...result.current.favorites, latest]));
    act(() => {
      result.current.remove('team', 'team-1');
    });

    expect(result.current.favorites.map(({ id }) => id)).toEqual(['k-league-1', 'team-2', 'team-3']);
    expect(parseFavorites(localStorage.getItem(FAVORITES_KEY))).toEqual(result.current.favorites);
  });

  it('keeps a stale-render add intent when another tab already added the same item', () => {
    const item = favorite(1);
    const { result } = renderHook(() => useFavorites());

    expect(result.current.isFavorite(item.type, item.id)).toBe(false);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([item]));

    let toggleResult: ReturnType<typeof result.current.toggle> | undefined;
    act(() => {
      toggleResult = result.current.toggle({
        type: item.type,
        id: item.id,
        name: item.name,
        image: item.image,
      });
    });

    expect(toggleResult).toBe('added');
    expect(result.current.favorites).toEqual([item]);
    expect(parseFavorites(localStorage.getItem(FAVORITES_KEY))).toEqual([item]);
  });

  it('does not write when removing an item already missing from storage', () => {
    const item = favorite(1);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([item]));
    const { result } = renderHook(() => useFavorites());
    localStorage.removeItem(FAVORITES_KEY);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    try {
      act(() => {
        result.current.remove(item.type, item.id);
      });

      expect(setItem.mock.calls.some(([key]) => key === FAVORITES_KEY)).toBe(false);
      expect(result.current.favorites).toEqual([]);
      expect(localStorage.getItem(FAVORITES_KEY)).toBeNull();
    } finally {
      setItem.mockRestore();
    }
  });

  it('refreshes saved name and image without changing order or addedAt', () => {
    const first = favorite(1);
    const second = favorite(2);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([first, second]));
    const { result } = renderHook(() => useFavorites());

    act(() => {
      result.current.refreshMeta({
        type: first.type,
        id: first.id,
        name: '새 팀 이름',
        image: '/new-team.png',
      });
    });

    expect(result.current.favorites).toEqual([
      { ...first, name: '새 팀 이름', image: '/new-team.png' },
      second,
    ]);
    expect(result.current.favorites[0].addedAt).toBe(first.addedAt);
    expect(parseFavorites(localStorage.getItem(FAVORITES_KEY))).toEqual(result.current.favorites);
  });
});
