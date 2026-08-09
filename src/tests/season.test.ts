import { describe, expect, it } from 'vitest';
import { getCurrentSeasonForFormat } from '../lib/season';

describe('getCurrentSeasonForFormat', () => {
  it.each([
    new Date(2026, 0, 15),
    new Date(2026, 11, 15),
  ])('returns the current year for the single format', (now) => {
    expect(getCurrentSeasonForFormat('single', now)).toEqual({
      queryParam: '2026',
      dbValue: '2026',
    });
  });

  it('uses the previous and current years for the split format in June', () => {
    const now = new Date(2026, 5, 15);

    expect(getCurrentSeasonForFormat('split', now)).toEqual({
      queryParam: '2025-2026',
      dbValue: '2025',
    });
  });

  it('uses the current and next years for the split format in July', () => {
    const now = new Date(2026, 6, 15);

    expect(getCurrentSeasonForFormat('split', now)).toEqual({
      queryParam: '2026-2027',
      dbValue: '2026',
    });
  });
});
