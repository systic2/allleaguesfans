import { describe, expect, it } from 'vitest';
import {
  LEAGUE_SLUGS,
  compareLeagueSlugs,
  leagueIdsByKoreanName,
  leagueNameKo,
  leagueSlugFor,
  seasonLabelForSlug,
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

  it('finds league IDs by partial Korean name while ignoring spaces', () => {
    expect(leagueIdsByKoreanName('프리미어')).toEqual(['4328']);
    expect(leagueIdsByKoreanName('K리그')).toEqual(['4689', '4822']);
    expect(leagueIdsByKoreanName('세리에A')).toEqual(['4332']);
    // '리그1'은 '리그 1'뿐 아니라 'K리그1'에도 포함된다.
    expect(leagueIdsByKoreanName('리 그 1')).toEqual(['4334', '4689']);
    expect(leagueIdsByKoreanName('없는 리그')).toEqual([]);
    expect(leagueIdsByKoreanName('   ')).toEqual([]);
  });
});

describe('seasonLabelForSlug', () => {
  it('K리그는 단일 연도를 그대로 보여 준다', () => {
    expect(seasonLabelForSlug('k-league-1', '2026')).toBe('2026');
    expect(seasonLabelForSlug('k-league-2', '2026')).toBe('2026');
  });

  it('유럽 리그는 시작 연도를 시작/끝 연도로 보여 준다', () => {
    expect(seasonLabelForSlug('premier-league', '2026')).toBe('2026/27');
    expect(seasonLabelForSlug('ligue-1', '2099')).toBe('2099/00');
  });

  it('지원하지 않는 리그와 연도 형식이 아닌 값은 그대로 둔다', () => {
    expect(seasonLabelForSlug('league-9999', '2026')).toBe('2026');
    expect(seasonLabelForSlug('premier-league', '2025-2026')).toBe('2025-2026');
  });
});
