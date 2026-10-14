/** Local-day helpers. Everything user-facing is keyed by local yyyy-mm-dd. */

export function toDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}

export function todayKey() {
  return toDayKey();
}

/** Monday-based week start, which is how the Israeli training week reads. */
export function weekStart(key: string): string {
  const d = fromDayKey(key);
  const dow = d.getDay(); // 0=Sun
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

export function weekDays(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startKey, i));
}

export function daysBetween(a: string, b: string): number {
  const ms = fromDayKey(b).getTime() - fromDayKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const dowShort = (key: string) => DOW_SHORT[fromDayKey(key).getDay()];
export const dayNum = (key: string) => fromDayKey(key).getDate();

export function longDate(key: string): string {
  const d = fromDayKey(key);
  return `${MONTH[d.getMonth()]} ${d.getDate()}`;
}

export function shortDate(key: string): string {
  const d = fromDayKey(key);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function relativeDay(key: string): string | null {
  const diff = daysBetween(todayKey(), key);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return null;
}

/** Range keys for the 1W / 1M / 3M / 6M / 1Y switchers. */
export type RangeKey = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '1W', label: '1 Week', days: 7 },
  { key: '1M', label: '1 Month', days: 30 },
  { key: '3M', label: '3 Months', days: 90 },
  { key: '6M', label: '6 Months', days: 180 },
  { key: '1Y', label: '1 Year', days: 365 },
  { key: 'ALL', label: 'All', days: null },
];

export function rangeStart(range: RangeKey): string | null {
  const spec = RANGES.find((r) => r.key === range);
  if (!spec || spec.days === null) return null;
  return addDays(todayKey(), -spec.days);
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export function mmss(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Wall-clock length of a finished session, or null when it has no end. */
export function sessionMs(s: { startedAt: string; finishedAt: string | null }): number | null {
  if (!s.finishedAt) return null;
  const ms = new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime();
  return ms > 0 ? ms : null;
}

/** "1 hr 32 min" / "48 min" — how Skulpt labels workout length. */
export function hoursMinutes(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** "HH:MM:SS" running clock. */
export function clock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
}

export const dowLong = (key: string) =>
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][fromDayKey(key).getDay()];

export function monthName(monthIndex: number): string {
  return MONTH[monthIndex];
}

/** "6 — 12 October", or "29 September — 5 October" across a month boundary. */
export function weekRangeLabel(startKey: string): string {
  const a = fromDayKey(startKey);
  const b = fromDayKey(addDays(startKey, 6));
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} — ${b.getDate()} ${MONTH[b.getMonth()]}`
    : `${a.getDate()} ${MONTH[a.getMonth()]} — ${b.getDate()} ${MONTH[b.getMonth()]}`;
}

/**
 * Monday-first grid for a month: leading nulls pad the first row so day 1
 * lands under its weekday.
 */
export function monthGrid(year: number, monthIndex: number): (string | null)[] {
  const first = new Date(year, monthIndex, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => toDayKey(new Date(year, monthIndex, i + 1))),
  ];
}
