// src/lib/dates.ts
// 화면의 날짜는 한국 시간(Asia/Seoul, UTC+9, 서머타임 없음) 기준이다. DB 의 경기 시각은 UTC.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 한국 날짜 'YYYY-MM-DD' */
export function kstDate(at: Date = new Date()): string {
  return new Date(at.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function isDateString(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // Date 는 2026-02-31 을 3월 3일로 넘겨 버리므로, 되돌린 값이 같은지 본다
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** 한국 날짜에서 days 만큼 옮긴 날짜 */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 한국 날짜 하루의 UTC 범위 [from, to) */
export function kstDayRange(date: string): { from: string; to: string } {
  const start = new Date(`${date}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** 'HH:mm' (한국 시간) */
export function kstTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
}

/** '11월 18일 (화)' */
export function kstDateLabel(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" });
}

/** '11. 22. (토)' — 경기 시각(UTC ISO)의 한국 날짜 */
export function kstShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" });
}

/** '11월 21일' — 경기 시각(UTC ISO)의 한국 날짜 */
export function kstMonthDay(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });
}

/** '11월 21일 07:53' (한국 시간) */
export function kstDateTime(iso: string): string {
  return `${kstMonthDay(iso)} ${kstTime(iso)}`;
}

/** 생년월일과 오늘(한국 날짜)로 만 나이 */
export function ageOn(birthDate: string | null | undefined, today: string = kstDate()): number | null {
  if (!isDateString(birthDate?.slice(0, 10))) return null;
  const [by, bm, bd] = birthDate!.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
