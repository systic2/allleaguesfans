import { describe, expect, it } from 'vitest';
import {
  LEAGUE_SLUGS,
  compareLeagueSlugs,
  leagueNameKo,
  leagueSlugFor,
} from '@/lib/leagues';

const supportedLeagues = [
  ['4689', 'k-league-1', 'K리그1'],
  ['4822', 'k-league-2', 'K리그2'],
  ['4328', 'premier-league', '프리미어리그'],
  ['4335', 'la-liga', '라리가'],
  ['4332', 'serie-a', '세리에 A'],
  ['4331', 'bundesliga', '분데스리가'],
  ['4334', 'ligue-1', '리그 1'],
] as const;

describe('league metadata', () => {
  it('maps every supported TheSportsDB id to its route slug', () => {
    expect(LEAGUE_SLUGS).toEqual(
      Object.fromEntries(supportedLeagues.map(([id, slug]) => [id, slug])),
    );

    for (const [id, slug] of supportedLeagues) {
      expect(leagueSlugFor(id)).toBe(slug);
    }
    expect(leagueSlugFor('9999')).toBe('league-9999');
  });

  it('returns the Korean display name for supported slugs and null otherwise', () => {
    for (const [, slug, koreanName] of supportedLeagues) {
      expect(leagueNameKo(slug)).toBe(koreanName);
    }
    expect(leagueNameKo('unknown-league')).toBeNull();
  });

  it('sorts supported slugs in display order and leaves unknown slugs at the end', () => {
    const slugs = [
      'custom-first',
      'ligue-1',
      'premier-league',
      'k-league-2',
      'bundesliga',
      'k-league-1',
      'serie-a',
      'la-liga',
      'custom-second',
    ];

    expect(slugs.sort(compareLeagueSlugs)).toEqual([
      'k-league-1',
      'k-league-2',
      'premier-league',
      'la-liga',
      'serie-a',
      'bundesliga',
      'ligue-1',
      'custom-first',
      'custom-second',
    ]);
    expect(compareLeagueSlugs('custom-first', 'custom-second')).toBe(0);
  });
});
