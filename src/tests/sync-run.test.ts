import { describe, expect, it } from 'vitest';
import { buildSyncRunRow } from '@/lib/mappers/sync-run';

const startedAt = '2026-11-18T00:00:00.000Z';
const finishedAt = '2026-11-18T00:01:00.000Z';

describe('buildSyncRunRow', () => {
  it('always clears the error for a successful step', () => {
    expect(buildSyncRunRow('standings', startedAt, finishedAt, true, new Error('ignored'), 'https://run.test/1')).toEqual({
      step: 'standings',
      startedAt,
      finishedAt,
      ok: true,
      error: null,
    });
  });

  it.each([
    { thrown: undefined, expected: 'step reported failures' },
    { thrown: new Error('database unavailable'), expected: 'database unavailable' },
    { thrown: 503, expected: '503' },
  ])('formats a failed step error from $thrown', ({ thrown, expected }) => {
    expect(buildSyncRunRow('events', startedAt, finishedAt, false, thrown, null).error).toBe(expected);
  });

  it('appends the run URL to a failed step error', () => {
    expect(buildSyncRunRow('events', startedAt, finishedAt, false, undefined, 'https://run.test/42').error)
      .toBe('step reported failures (https://run.test/42)');
  });
});
