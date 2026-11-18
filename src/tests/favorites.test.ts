import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FAVORITES_KEY,
  MAX_FAVORITES,
  favoriteHref,
  getFavorites,
  isFavoritesPersistent,
  parseFavorites,
  resetFavoritesCache,
  setFavorites,
  subscribeFavorites,
  toggleFavorite,
  updateFavoriteMeta,
  updateFavorites,
  type Favorite,
} from '@/lib/favorites';

function favorite(overrides: Partial<Favorite> = {}): Favorite {
  return {
    type: 'team',
    id: 'team-1',
    name: '서울 테스트 FC',
    image: null,
    addedAt: '2026-11-18T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  resetFavoritesCache();
});

describe('favorites utilities', () => {
  it('builds the detail URL for every favorite type', () => {
    expect(favoriteHref({ type: 'league', id: 'k-league-1' })).toBe('/leagues/k-league-1');
    expect(favoriteHref({ type: 'team', id: '133604' })).toBe('/teams/133604');
    expect(favoriteHref({ type: 'player', id: '34145937' })).toBe('/players/34145937');
  });

  it('returns an empty list for absent, broken, or non-array JSON', () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites('{broken')).toEqual([]);
    expect(parseFavorites(JSON.stringify({ id: 'not-an-array' }))).toEqual([]);
  });

  it('drops malformed and duplicate entries, keeping the first duplicate', () => {
    const first = favorite({ name: '처음 이름' });
    const duplicate = favorite({ name: '나중 이름', addedAt: '2026-11-18T01:00:00.000Z' });
    const otherType = favorite({ type: 'player', name: '같은 ID의 선수' });
    const malformed = [
      { ...favorite({ id: 'bad-type' }), type: 'coach' },
      { ...favorite({ id: 'bad-image' }), image: 42 },
      { ...favorite({ id: '' }) },
      { ...favorite({ id: 'missing-date' }), addedAt: undefined },
    ];

    expect(parseFavorites(JSON.stringify([first, duplicate, otherType, ...malformed]))).toEqual([
      first,
      otherType,
    ]);
  });

  it(`limits parsed favorites to ${MAX_FAVORITES}`, () => {
    const stored = Array.from({ length: MAX_FAVORITES + 5 }, (_, index) => favorite({
      id: `team-${index}`,
      name: `팀 ${index}`,
    }));

    const parsed = parseFavorites(JSON.stringify(stored));

    expect(parsed).toHaveLength(MAX_FAVORITES);
    expect(parsed[0].id).toBe('team-0');
    expect(parsed.at(-1)?.id).toBe(`team-${MAX_FAVORITES - 1}`);
  });

  it('adds at the front with the supplied time and removes an existing item', () => {
    const existing = favorite({ id: 'existing' });
    const item = { type: 'player' as const, id: 'player-1', name: '테스트 선수', image: '/player.png' };

    const added = toggleFavorite([existing], item, '2026-11-18T09:00:00.000Z');
    expect(added).toEqual({
      result: 'added',
      favorites: [{ ...item, addedAt: '2026-11-18T09:00:00.000Z' }, existing],
    });

    expect(toggleFavorite(added.favorites, item)).toEqual({
      result: 'removed',
      favorites: [existing],
    });
  });

  it('honors an explicit target state without changing an already-matching list', () => {
    const existing = favorite();
    const list = [existing];
    const item = {
      type: existing.type,
      id: existing.id,
      name: existing.name,
      image: existing.image,
    };

    const keptAdded = toggleFavorite(list, item, undefined, true);
    expect(keptAdded.result).toBe('added');
    expect(keptAdded.favorites).toBe(list);

    const empty: Favorite[] = [];
    const keptRemoved = toggleFavorite(empty, item, undefined, false);
    expect(keptRemoved.result).toBe('removed');
    expect(keptRemoved.favorites).toBe(empty);
  });

  it('does not replace an older item when the list is full', () => {
    const full = Array.from({ length: MAX_FAVORITES }, (_, index) => favorite({ id: `team-${index}` }));

    const result = toggleFavorite(full, {
      type: 'league',
      id: 'new-league',
      name: '새 리그',
      image: null,
    });

    expect(result.result).toBe('full');
    expect(result.favorites).toBe(full);
  });

  it('updates only existing metadata while preserving order and addedAt', () => {
    const before = [
      favorite({ id: 'first', name: '이전 이름', image: '/old.png' }),
      favorite({ id: 'second', name: '두 번째', addedAt: '2026-11-17T00:00:00.000Z' }),
    ];

    const updated = updateFavoriteMeta(before, {
      type: 'team',
      id: 'first',
      name: '새 이름',
      image: '/new.png',
    });

    expect(updated).not.toBe(before);
    expect(updated).toEqual([
      { ...before[0], name: '새 이름', image: '/new.png' },
      before[1],
    ]);
    expect(updated[0].addedAt).toBe(before[0].addedAt);
    expect(updated[1]).toBe(before[1]);
  });

  it('returns the same list when metadata is unchanged or the item is absent', () => {
    const list = [favorite()];

    expect(updateFavoriteMeta(list, {
      type: list[0].type,
      id: list[0].id,
      name: list[0].name,
      image: list[0].image,
    })).toBe(list);
    expect(updateFavoriteMeta(list, {
      type: 'player',
      id: 'missing',
      name: '없는 선수',
      image: null,
    })).toBe(list);
  });
});

describe('favorites storage', () => {
  it('probes setItem and removeItem exactly once before reporting persistence', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const probeKey = `${FAVORITES_KEY}:probe`;

    try {
      expect(isFavoritesPersistent()).toBe(true);
      expect(isFavoritesPersistent()).toBe(true);

      expect(setItem.mock.calls.filter(([key]) => key === probeKey)).toEqual([[probeKey, '1']]);
      expect(removeItem.mock.calls.filter(([key]) => key === probeKey)).toEqual([[probeKey]]);
    } finally {
      setItem.mockRestore();
      removeItem.mockRestore();
    }
  });

  it('detects storage that can be read but rejects the persistence probe', () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([favorite({ id: 'readable' })]));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage is read-only');
    });

    try {
      expect(getFavorites()).toEqual([favorite({ id: 'readable' })]);
      expect(isFavoritesPersistent()).toBe(false);
      expect(setItem).toHaveBeenCalledWith(`${FAVORITES_KEY}:probe`, '1');
    } finally {
      setItem.mockRestore();
    }
  });

  it('reports non-persistence and retries cleanup when the first probe removal throws', () => {
    const probeKey = `${FAVORITES_KEY}:probe`;
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
      .mockImplementationOnce(() => {
        throw new Error('first cleanup failed');
      })
      .mockImplementation(() => undefined);

    try {
      expect(isFavoritesPersistent()).toBe(false);
      expect(removeItem.mock.calls.filter(([key]) => key === probeKey)).toEqual([
        [probeKey],
        [probeKey],
      ]);
    } finally {
      removeItem.mockRestore();
    }
  });

  it('resetFavoritesCache clears both the cached list and persistence result', () => {
    const initial = [favorite({ id: 'initial' })];
    const changed = [favorite({ id: 'changed' })];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(initial));
    expect(getFavorites()).toEqual(initial);
    expect(isFavoritesPersistent()).toBe(true);

    localStorage.setItem(FAVORITES_KEY, JSON.stringify(changed));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage became read-only');
    });

    try {
      resetFavoritesCache();
      expect(getFavorites()).toEqual(changed);
      expect(isFavoritesPersistent()).toBe(false);
    } finally {
      setItem.mockRestore();
    }
  });

  it('reads once into the cache and persists subsequent writes', () => {
    const initial = [favorite({ id: 'initial' })];
    const changedBehindCache = [favorite({ id: 'changed' })];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(initial));

    expect(getFavorites()).toEqual(initial);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(changedBehindCache));
    expect(getFavorites()).toEqual(initial);

    setFavorites(changedBehindCache);
    expect(getFavorites()).toEqual(changedBehindCache);
    expect(parseFavorites(localStorage.getItem(FAVORITES_KEY))).toEqual(changedBehindCache);
    expect(isFavoritesPersistent()).toBe(true);
  });

  it('keeps the new value in memory and reports non-persistence when setItem throws', () => {
    const next = [favorite({ id: 'memory-only' })];
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    try {
      setFavorites(next);

      expect(getFavorites()).toEqual(next);
      expect(isFavoritesPersistent()).toBe(false);
      expect(localStorage.getItem(FAVORITES_KEY)).toBeNull();
    } finally {
      setItem.mockRestore();
    }
  });

  it('applies updates to the latest stored list so another tab changes are preserved', () => {
    const cached = [favorite({ id: 'cached' })];
    const fromAnotherTab = [favorite({ id: 'other-tab' })];
    const newItem = favorite({ id: 'new-item' });
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(cached));
    expect(getFavorites()).toEqual(cached);

    localStorage.setItem(FAVORITES_KEY, JSON.stringify(fromAnotherTab));
    updateFavorites((current) => [newItem, ...current]);

    expect(getFavorites()).toEqual([newItem, ...fromAnotherTab]);
    expect(parseFavorites(localStorage.getItem(FAVORITES_KEY))).toEqual([newItem, ...fromAnotherTab]);
  });

  it('does not write a same-reference update and only synchronizes the cache', () => {
    const cached = [favorite({ id: 'cached' })];
    const latest = [favorite({ id: 'latest' })];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(cached));
    expect(getFavorites()).toEqual(cached);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(latest));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const listener = vi.fn();
    const unsubscribe = subscribeFavorites(listener);

    try {
      updateFavorites((current) => current);

      expect(setItem.mock.calls.some(([key]) => key === FAVORITES_KEY)).toBe(false);
      expect(getFavorites()).toEqual(latest);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      setItem.mockRestore();
    }
  });

  it('attaches one window storage listener for all subscribers and removes it after the last one', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const unsubscribeFirst = subscribeFavorites(vi.fn());
    const unsubscribeSecond = subscribeFavorites(vi.fn());

    try {
      expect(addEventListener.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(1);
      unsubscribeFirst();
      expect(removeEventListener.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(0);
      unsubscribeSecond();
      expect(removeEventListener.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(1);
    } finally {
      unsubscribeFirst();
      unsubscribeSecond();
      addEventListener.mockRestore();
      removeEventListener.mockRestore();
    }
  });

  it('reads a storage event once and notifies every subscriber once', () => {
    const fromAnotherTab = [favorite({ id: 'other-tab' })];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(fromAnotherTab));
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeFavorites(first);
    const unsubscribeSecond = subscribeFavorites(second);

    try {
      window.dispatchEvent(new StorageEvent('storage', { key: FAVORITES_KEY }));

      expect(getItem.mock.calls.filter(([key]) => key === FAVORITES_KEY)).toHaveLength(1);
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
      expect(getFavorites()).toEqual(fromAnotherTab);
    } finally {
      unsubscribeFirst();
      unsubscribeSecond();
      getItem.mockRestore();
    }
  });

  it('ignores storage events after persistence fails and keeps the memory list', () => {
    const memoryOnly = [favorite({ id: 'memory-only' })];
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    setFavorites(memoryOnly);
    expect(isFavoritesPersistent()).toBe(false);
    setItem.mockRestore();

    const listener = vi.fn();
    const unsubscribe = subscribeFavorites(listener);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([favorite({ id: 'other-tab' })]));
      window.dispatchEvent(new StorageEvent('storage', { key: FAVORITES_KEY }));

      expect(listener).not.toHaveBeenCalled();
      expect(getFavorites()).toEqual(memoryOnly);
    } finally {
      unsubscribe();
    }
  });

  it('follows matching and clear storage events while ignoring unrelated keys', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFavorites(listener);
    const fromAnotherTab = [favorite({ id: 'other-tab' })];

    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(fromAnotherTab));
      window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
      expect(listener).not.toHaveBeenCalled();

      window.dispatchEvent(new StorageEvent('storage', { key: FAVORITES_KEY }));
      expect(listener).toHaveBeenCalledTimes(1);
      expect(getFavorites()).toEqual(fromAnotherTab);

      localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
      expect(listener).toHaveBeenCalledTimes(2);
      expect(getFavorites()).toEqual([]);

      unsubscribe();
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([favorite({ id: 'after-unsubscribe' })]));
      window.dispatchEvent(new StorageEvent('storage', { key: FAVORITES_KEY }));
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      unsubscribe();
      resetFavoritesCache();
    }
  });
});
