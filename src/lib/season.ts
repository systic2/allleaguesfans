import { kstDate } from "./dates";

export type SeasonFormat = 'single' | 'split';

export function getCurrentSeasonForFormat(
  format: SeasonFormat | string,
  now: Date = new Date()
): { queryParam: string; dbValue: string } {
  // 한국 날짜 기준 (브라우저 시간대와 무관)
  const [currentYear, currentMonth] = kstDate(now).split("-").map(Number); // 월은 1-12

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
