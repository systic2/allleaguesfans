import { describe, expect, it } from 'vitest';
import { findTeamIdsByAlias } from '@/lib/team-aliases';

describe('findTeamIdsByAlias', () => {
  it('finds Manchester United by its Korean alias', () => {
    expect(findTeamIdsByAlias('맨유')).toEqual(['133612']);
  });

  it.each(['PSG', 'psg'])('matches aliases case-insensitively: %s', query => {
    expect(findTeamIdsByAlias(query)).toEqual(['133714']);
  });

  it.each(['울산현대', '울산 현대'])('matches aliases ignoring spaces: %s', query => {
    expect(findTeamIdsByAlias(query)).toEqual(['138117']);
  });

  it('returns every alias containing a partial query', () => {
    expect(findTeamIdsByAlias('맨')).toEqual(['133612', '133613']);
  });

  it.each(['', '   '])('returns no matches for an empty query: %j', query => {
    expect(findTeamIdsByAlias(query)).toEqual([]);
  });

  it('returns no matches for an unknown alias', () => {
    expect(findTeamIdsByAlias('없는별칭')).toEqual([]);
  });
});
