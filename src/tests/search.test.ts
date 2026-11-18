import { describe, expect, it } from 'vitest';
import type { SearchRow } from '@/domain/types';
import {
  MAX_RESULTS_PER_TYPE,
  MIN_AUTO_SEARCH_LENGTH,
  SEARCH_DEBOUNCE_MS,
  SEARCH_SCOPE_TEXT,
  groupSearchRows,
  playerIdentity,
  searchResultHref,
} from '@/lib/search';

const league = (name: string, entityId: number, nameEn: string | null = null): SearchRow => ({
  type: 'league', entity_id: entityId, name, name_en: nameEn, slug: `league-${entityId}`, country: null,
});

const team = (name: string, entityId: number, nameEn: string | null = null): SearchRow => ({
  type: 'team', entity_id: entityId, team_id: String(entityId), name, name_en: nameEn,
});

const player = (name: string, entityId: number): SearchRow => ({
  type: 'player', entity_id: entityId, name,
});

describe('search helpers', () => {
  it('exposes the shared search limits and scope copy', () => {
    expect(MIN_AUTO_SEARCH_LENGTH).toBe(2);
    expect(SEARCH_DEBOUNCE_MS).toBe(300);
    expect(MAX_RESULTS_PER_TYPE).toBe(10);
    expect(SEARCH_SCOPE_TEXT).toBe('리그·팀 이름(한글·영문)과 선수 영문 이름에서 찾습니다.');
  });

  it('groups in league, team, player order and omits empty groups', () => {
    const groups = groupSearchRows([
      player('Kim One', 31),
      team('김천 상무', 21),
      league('K리그1', 11),
    ], '김');

    expect(groups.map(({ type, label }) => ({ type, label }))).toEqual([
      { type: 'league', label: '리그' },
      { type: 'team', label: '팀' },
      { type: 'player', label: '선수' },
    ]);
    expect(groupSearchRows([team('김천 상무', 21)], '김')).toHaveLength(1);
  });

  it('ranks exact then prefix then other matches, normalizing case and spaces stably', () => {
    const exactByEnglishName = team('맨체스터 유나이티드', 1, 'Man United');
    const exactByDisplayName = team('MAN UNITED', 2, 'Manchester United');
    const prefixFirst = team('Man United City', 3);
    const prefixSecond = team('Man United Town', 4);
    const contains = team('FC Man United', 5);

    const [group] = groupSearchRows([
      contains,
      prefixFirst,
      exactByEnglishName,
      prefixSecond,
      exactByDisplayName,
    ], 'mAn UnItEd');

    expect(group.rows).toEqual([
      exactByEnglishName,
      exactByDisplayName,
      prefixFirst,
      prefixSecond,
      contains,
    ]);
  });

  it('also ranks leagues by their English name', () => {
    const exactByEnglishName = league('프리미어리그', 1, 'Premier League');
    const prefix = league('Premier League Two', 2);
    const contains = league('English Premier League', 3);

    const [group] = groupSearchRows([contains, prefix, exactByEnglishName], 'premier league');

    expect(group.rows).toEqual([exactByEnglishName, prefix, contains]);
  });

  it('keeps at most ten rows in each group after ranking', () => {
    const rows = Array.from({ length: 12 }, (_, index) => league(`리그 ${index}`, index));
    rows.push(league('리그', 99));

    const [group] = groupSearchRows(rows, '리그');

    expect(group.rows).toHaveLength(10);
    expect(group.rows[0]).toEqual(league('리그', 99));
    expect(group.rows.slice(1).map((row) => row.entity_id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('builds detail links for every result type', () => {
    expect(searchResultHref({ type: 'league', entity_id: 1, name: '리그', slug: 'premier-league' })).toBe('/leagues/premier-league');
    expect(searchResultHref({ type: 'team', entity_id: 2, team_id: 'hist_team', name: '팀' })).toBe('/teams/hist_team');
    expect(searchResultHref({ type: 'player', entity_id: 3, name: 'Player' })).toBe('/players/3');
  });

  it('joins only available player identity fields', () => {
    const row: Extract<SearchRow, { type: 'player' }> = {
      type: 'player', entity_id: 1, name: 'Player', nationality: '대한민국', birth_date: '1997-09-20',
    };

    expect(playerIdentity(row, '울산 HD')).toBe('울산 HD · 대한민국 · 1997년생');
    expect(playerIdentity({ ...row, nationality: null }, null)).toBe('1997년생');
    expect(playerIdentity({ ...row, nationality: null, birth_date: null }, null)).toBe('');
  });
});
