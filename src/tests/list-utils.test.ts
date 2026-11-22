import { describe, expect, it } from 'vitest';
import { ageOn, isDateString, kstDate, kstDateLabel, kstDayRange, kstMonthDay, kstTime, shiftDate } from '@/lib/dates';
import { leagueIdForSlug, seasonFormatFor, seasonLabel, supportedLeagueIds } from '@/lib/leagues';
import { hasConfirmedScore, hasKickoffTime, matchPhase, statusesOf, statusLabel, type MatchPhase } from '@/lib/match-status';
import { isPositionGroup, POSITION_GROUPS, positionGroupOf, STAFF_POSITIONS } from '@/lib/positions';

describe('match status helpers', () => {
  it.each<[string | null | undefined, MatchPhase]>([
    ['SCHEDULED', 'scheduled'], ['NS', 'scheduled'],
    ['IN_PLAY', 'live'], ['LIVE', 'live'], ['1H', 'live'], ['2H', 'live'], ['HT', 'live'], ['ET', 'live'], ['BT', 'live'], ['P', 'live'],
    ['FINISHED', 'finished'], ['FT', 'finished'], ['AET', 'finished'], ['PEN', 'finished'],
    ['POSTPONED', 'postponed'], ['CANCELED', 'cancelled'], ['SUSP', 'suspended'], ['INT', 'suspended'],
    ['UNKNOWN', 'scheduled'], ['UNMAPPED', 'unknown'], [null, 'unknown'], [undefined, 'unknown'],
  ])('maps %s to %s', (status, phase) => {
    expect(matchPhase(status)).toBe(phase);
  });

  it('returns labels and the raw statuses belonging to each phase', () => {
    expect(statusLabel('HT')).toBe('하프타임');
    expect(statusLabel('AET')).toBe('연장 종료');
    expect(statusLabel('UNKNOWN')).toBe('일정 미정');
    expect(statusLabel('UNMAPPED')).toBe('상태 확인 중');
    expect(statusLabel(null)).toBe('상태 확인 중');
    expect(statusesOf('scheduled')).toEqual(['SCHEDULED', 'NS', 'UNKNOWN']);
    expect(statusesOf('finished')).toEqual(['FINISHED', 'FT', 'AET', 'PEN']);
    expect(statusesOf('unknown')).toEqual([]);
  });

  it('confirms a score only for live or finished matches with both scores', () => {
    expect(hasConfirmedScore('LIVE', 0, 0)).toBe(true);
    expect(hasConfirmedScore('FT', 2, 1)).toBe(true);
    expect(hasConfirmedScore('SCHEDULED', 0, 0)).toBe(false);
    expect(hasConfirmedScore('LIVE', null, 1)).toBe(false);
    expect(hasConfirmedScore('FINISHED', 1, undefined)).toBe(false);
  });

  it.each([
    ['SCHEDULED', true], ['NS', true],
    ['UNKNOWN', false], ['IN_PLAY', false], ['LIVE', false], ['1H', false], ['2H', false], ['HT', false],
    ['ET', false], ['BT', false], ['P', false], ['FINISHED', false], ['FT', false], ['AET', false],
    ['PEN', false], ['POSTPONED', false], ['CANCELED', false], ['SUSP', false], ['INT', false],
    ['UNMAPPED', false], [null, false], [undefined, false],
  ] as const)('reports kickoff-time availability for %s', (status, expected) => {
    expect(hasKickoffTime(status)).toBe(expected);
  });
});

describe('position helpers', () => {
  it('defines the four groups and Korean labels', () => {
    expect(POSITION_GROUPS.map(({ key, label }) => [key, label])).toEqual([
      ['GK', '골키퍼'], ['DF', '수비수'], ['MF', '미드필더'], ['FW', '공격수'],
    ]);
    expect(positionGroupOf('Goalkeeper')).toBe('GK');
    expect(positionGroupOf('Centre-Back')).toBe('DF');
    expect(positionGroupOf('Attacking Midfield')).toBe('MF');
    expect(positionGroupOf('Right Winger')).toBe('FW');
    expect(positionGroupOf('Manager')).toBeNull();
    expect(positionGroupOf(null)).toBeNull();
  });

  it('recognizes only group keys and exposes staff positions', () => {
    expect(isPositionGroup('GK')).toBe(true);
    expect(isPositionGroup('Manager')).toBe(false);
    expect(isPositionGroup(undefined)).toBe(false);
    expect(STAFF_POSITIONS).toEqual(['Manager', 'Coach', 'Assistant Manager', 'Goalkeeping Coach']);
  });
});

describe('KST date helpers', () => {
  it('uses UTC+9 for dates, day ranges, times, and labels', () => {
    expect(kstDate(new Date('2026-11-17T15:30:00.000Z'))).toBe('2026-11-18');
    expect(kstDayRange('2026-11-18')).toEqual({
      from: '2026-11-17T15:00:00.000Z',
      to: '2026-11-18T15:00:00.000Z',
    });
    expect(kstTime('2026-11-17T15:30:00.000Z')).toBe('00:30');
    expect(kstDateLabel('2026-11-18')).toContain('11월 18일');
    expect(kstMonthDay('2026-11-21T15:30:00.000Z')).toBe('11월 22일');
  });

  it('validates the date format and shifts across month and year boundaries', () => {
    expect(isDateString('2026-01-31')).toBe(true);
    expect(isDateString('2026-02-31')).toBe(false);
    expect(isDateString('2026-13-01')).toBe(false);
    expect(isDateString('2025-02-29')).toBe(false);
    expect(isDateString('2024-02-29')).toBe(true);
    expect(isDateString('2026/01/31')).toBe(false);
    expect(isDateString(null)).toBe(false);
    expect(shiftDate('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('calculates international age immediately before and on a birthday', () => {
    expect(ageOn('2000-11-19', '2026-11-18')).toBe(25);
    expect(ageOn('2000-11-19', '2026-11-19')).toBe(26);
    expect(ageOn('not-a-date', '2026-11-19')).toBeNull();
    expect(ageOn(null, '2026-11-19')).toBeNull();
  });
});

describe('league list helpers', () => {
  it('keeps the supported league order and slug lookup', () => {
    expect(supportedLeagueIds()).toEqual(['4689', '4822', '4328', '4335', '4332', '4331', '4334']);
    expect(leagueIdForSlug('premier-league')).toBe('4328');
    expect(leagueIdForSlug('missing')).toBeNull();
  });

  it('formats single-year and split seasons without changing non-year values', () => {
    expect(seasonFormatFor('4689')).toBe('single');
    expect(seasonFormatFor('4822')).toBe('single');
    expect(seasonFormatFor('4328')).toBe('split');
    expect(seasonLabel('4689', '2026')).toBe('2026');
    expect(seasonLabel('4328', '2026')).toBe('2026/27');
    expect(seasonLabel('4328', '2026-2027')).toBe('2026-2027');
  });
});
