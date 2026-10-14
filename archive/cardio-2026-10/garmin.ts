/**
 * Imports the CSV that Garmin Connect's activity list produces.
 *
 * Garmin does not document that file: the column set varies between accounts,
 * and the headers follow the account's display language. A parser that hard-codes
 * column names would break on someone else's export, so this one matches headers
 * against a list of aliases, derives what it can, and hands back what it found so
 * the user can confirm before anything is written.
 *
 * There is no live sync on purpose. Garmin's API is enterprise-only — it rejects
 * individuals outright — and it would need a server holding his health data,
 * which is the one thing this app refuses to do.
 */

/* ---------------------------------------------------------------- */
/* CSV                                                               */

/** Minimal RFC-4180 reader: quoted fields, escaped quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }

    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }

  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/* ---------------------------------------------------------------- */
/* Column detection                                                  */

/**
 * Header aliases, lowercased. English covers the common export; the Hebrew and
 * a few European terms are here because the file follows the account language.
 */
const ALIASES: Record<string, string[]> = {
  date:      ['date', 'activity date', 'start time', 'datum', 'תאריך'],
  type:      ['activity type', 'type', 'sport', 'סוג פעילות', 'סוג'],
  title:     ['title', 'activity name', 'name', 'כותרת', 'שם'],
  distance:  ['distance', 'distance (km)', 'dist', 'מרחק'],
  duration:  ['time', 'duration', 'elapsed time', 'moving time', 'total time', 'זמן', 'משך'],
  avgHr:     ['avg hr', 'average heart rate', 'avg heart rate', 'avg. hr', 'דופק ממוצע'],
  maxHr:     ['max hr', 'max heart rate', 'maximum heart rate', 'max. hr', 'דופק מרבי'],
  calories:  ['calories', 'kcal', 'קלוריות'],
  elevation: ['total ascent', 'elev gain', 'elevation gain', 'ascent', 'עלייה'],
};

export type Field = keyof typeof ALIASES;

const norm = (h: string) => h.trim().toLowerCase().replace(/\s+/g, ' ');

export function detectColumns(headers: string[]): Partial<Record<Field, number>> {
  const found: Partial<Record<Field, number>> = {};
  const cleaned = headers.map(norm);

  for (const [field, names] of Object.entries(ALIASES) as [Field, string[]][]) {
    // Exact match first; a loose match would let "Avg HR" win the "HR" slot.
    let idx = cleaned.findIndex((h) => names.includes(h));
    if (idx === -1) idx = cleaned.findIndex((h) => names.some((n) => h.startsWith(n)));
    if (idx !== -1) found[field] = idx;
  }
  return found;
}

/* ---------------------------------------------------------------- */
/* Value parsing                                                     */

/** "1:23:45" → 5025, "23:45" → 1425, "45" → 45, "1.5" (minutes) → 90. */
export function parseDuration(raw: string): number | null {
  const v = raw.trim();
  if (!v || v === '--') return null;

  if (v.includes(':')) {
    const parts = v.split(':').map((p) => Number(p.replace(',', '.')));
    if (parts.some((n) => !Number.isFinite(n))) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
  }

  const n = Number(v.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  // A bare number in this column is minutes in every export we've seen.
  return Math.round(n * 60);
}

/** Handles "5.2", "5,2" and thousands separators like "1,234.5". */
export function parseNumber(raw: string): number | null {
  const v = raw.trim();
  if (!v || v === '--') return null;

  let t = v.replace(/[^\d.,-]/g, '');
  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    // Whichever separator comes last is the decimal point.
    t = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (lastComma !== -1) {
    // A lone comma is a decimal comma unless it groups thousands (e.g. "1,234").
    t = /,\d{3}$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  }

  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Garmin writes "2026-10-04 07:12:33" or a localised form; keep the day only. */
export function parseDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;

  const iso = v.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = v.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (dmy) {
    // Garmin follows the account locale here; day-first is the common case
    // outside the US, and it is what this account produces.
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
      parsed.getDate()
    ).padStart(2, '0')}`;
  }
  return null;
}

export function normaliseType(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (/run|ריצה/.test(t)) return 'running';
  if (/walk|hike|הליכה/.test(t)) return 'walking';
  if (/bike|cycl|ride|אופני/.test(t)) return 'cycling';
  if (/swim|שחי/.test(t)) return 'swimming';
  if (/strength|weight|כוח/.test(t)) return 'strength';
  return t || 'other';
}

/* ---------------------------------------------------------------- */
/* Build rows                                                        */

export interface ParsedCardio {
  date: string;
  type: string;
  title: string;
  distanceKm: number | null;
  durationSec: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  elevationM: number | null;
  paceSecPerKm: number | null;
  notes: string;
  source: 'garmin' | 'manual';
  dedupeKey: string;
}

export interface ParseResult {
  headers: string[];
  columns: Partial<Record<Field, number>>;
  rows: ParsedCardio[];
  /** Lines that produced no usable date — reported rather than silently dropped. */
  skipped: number;
}

export function parseGarminCsv(text: string): ParseResult {
  const table = parseCsv(text);
  if (table.length < 2) return { headers: [], columns: {}, rows: [], skipped: 0 };

  const headers = table[0];
  const columns = detectColumns(headers);
  const at = (row: string[], f: Field) => {
    const i = columns[f];
    return i === undefined ? '' : (row[i] ?? '');
  };

  const rows: ParsedCardio[] = [];
  let skipped = 0;

  for (const row of table.slice(1)) {
    const date = parseDate(at(row, 'date'));
    if (!date) { skipped++; continue; }

    const distanceKm = parseNumber(at(row, 'distance'));
    const durationSec = parseDuration(at(row, 'duration'));
    const type = normaliseType(at(row, 'type'));

    rows.push({
      date,
      type,
      title: at(row, 'title').trim() || type,
      distanceKm,
      durationSec,
      avgHr: parseNumber(at(row, 'avgHr')),
      maxHr: parseNumber(at(row, 'maxHr')),
      calories: parseNumber(at(row, 'calories')),
      elevationM: parseNumber(at(row, 'elevation')),
      paceSecPerKm:
        distanceKm && durationSec && distanceKm > 0
          ? Math.round(durationSec / distanceKm)
          : null,
      notes: '',
      source: 'garmin',
      dedupeKey: `${date}|${type}|${durationSec ?? 0}`,
    });
  }

  return { headers, columns, rows, skipped };
}
