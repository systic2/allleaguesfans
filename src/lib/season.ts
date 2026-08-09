export type SeasonFormat = 'single' | 'split';

export function getCurrentSeasonForFormat(
  format: SeasonFormat | string,
  now: Date = new Date()
): { queryParam: string; dbValue: string } {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  if (format === 'split') {
    const startYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    const endYear = startYear + 1;
    return {
      queryParam: `${startYear}-${endYear}`,
      dbValue: String(startYear)
    };
  }

  return {
    queryParam: String(currentYear),
    dbValue: String(currentYear)
  };
}
