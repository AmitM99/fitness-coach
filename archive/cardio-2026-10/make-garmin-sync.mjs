#!/usr/bin/env node
/**
 * Turns one weekly Garmin pull into a file the app imports with Data & Backup →
 * Import → Merge.
 *
 *   node scripts/make-garmin-sync.mjs sync/raw/2026-10-05.json
 *
 * The raw file is what Claude collects from the garmin-hosted MCP connector
 * (sleep summaries, HRV trend, resting HR, activities). It is kept in
 * sync/raw/ so every sync can be regenerated and audited.
 *
 * The output holds only cardio and recovery — no settings, no profile — so a
 * Merge adds and updates those two tables and leaves everything else alone.
 * Ids are deterministic, so importing overlapping weeks overwrites instead of
 * duplicating. Values are copied, never estimated: what Garmin did not report
 * stays null.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/make-garmin-sync.mjs sync/raw/<date>.json');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(input, 'utf8'));
const notes = raw.notes ?? {};
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round = (v, dp = 0) => (v === null ? null : Math.round(v * 10 ** dp) / 10 ** dp);

/** Same normalisation as src/lib/garmin.ts, so the dedupe keys line up. */
function normaliseType(t) {
  const s = String(t ?? '').toLowerCase();
  if (/run|ריצה/.test(s)) return 'running';
  if (/walk|hike|הליכה/.test(s)) return 'walking';
  if (/bike|cycl|ride|אופני/.test(s)) return 'cycling';
  if (/swim|שחי/.test(s)) return 'swimming';
  if (/strength|weight|כוח/.test(s)) return 'strength';
  return s || 'other';
}

const cardio = (raw.activities ?? [])
  .map((a) => ({ ...a, type: normaliseType(a.type) }))
  // Gym sessions are logged set by set in the app; importing them again from the
  // watch would count them twice in the weekly review.
  .filter((a) => a.type !== 'strength')
  .map((a) => {
    const date = String(a.start_time).slice(0, 10);
    const durationSec = round(num(a.duration_seconds));
    const distanceKm = round(num(a.distance_meters) !== null ? a.distance_meters / 1000 : null, 2);
    return {
      id: `garmin-${a.id}`,
      date,
      type: a.type,
      title: a.name || a.type,
      distanceKm,
      durationSec,
      avgHr: round(num(a.avg_hr_bpm)),
      maxHr: round(num(a.max_hr_bpm)),
      calories: round(num(a.calories)),
      elevationM: round(num(a.elevation_gain_meters)),
      paceSecPerKm: distanceKm && durationSec ? Math.round(durationSec / distanceKm) : null,
      notes: notes[`cardio:${date}`] ?? '',
      source: 'garmin',
      // Matches the CSV importer's key: a later CSV of the same run updates this row.
      dedupeKey: `${date}|${a.type}|${durationSec ?? 0}`,
    };
  });

const hrvByDate = new Map((raw.hrv ?? []).map((h) => [h.date, h]));
const recovery = (raw.sleep ?? [])
  // A nap-only day has no night to describe.
  .filter((s) => num(s.sleep_hours) !== null)
  .map((s) => {
    const hrv = hrvByDate.get(s.date) ?? {};
    const status = hrv.status && hrv.status !== 'NONE' ? hrv.status : null;
    return {
      id: `garmin-${s.date}`,
      date: s.date,
      sleepHours: round(num(s.sleep_hours), 2),
      sleepScore: num(s.sleep_score),
      deepPct: num(s.deep_sleep_percent),
      remPct: num(s.rem_sleep_percent),
      awakeMin: num(s.awake_seconds) !== null ? Math.round(s.awake_seconds / 60) : null,
      sleepStress: num(s.avg_sleep_stress),
      hrvMs: num(s.avg_overnight_hrv),
      hrvWeeklyAvgMs: num(hrv.weekly_avg_hrv_ms),
      hrvStatus: status,
      restingHr: num(raw.restingHr?.[s.date]),
      notes: notes[`recovery:${s.date}`] ?? '',
      source: 'garmin',
    };
  });

const out = {
  app: 'fitness-coach',
  backupVersion: 1,
  exportedAt: new Date(`${raw.pulledAt}T00:00:00.000Z`).toISOString(),
  data: { cardio, recovery },
};

const target = join('sync', `garmin-sync-${basename(input, '.json')}.json`);
writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log(`${target}: ${cardio.length} activities, ${recovery.length} nights`);
