import { db, uid, type CardioSession } from '@/db/schema';
import type { ParsedCardio } from './garmin';

export interface ImportOutcome {
  added: number;
  updated: number;
}

/**
 * Writes parsed activities. Re-importing an export that overlaps a previous one
 * is the normal workflow — Garmin only exports the rows loaded on screen — so a
 * repeated activity updates in place instead of appearing twice.
 */
export async function importCardio(rows: ParsedCardio[]): Promise<ImportOutcome> {
  let added = 0;
  let updated = 0;

  await db.transaction('rw', db.cardio, async () => {
    for (const row of rows) {
      const existing = await db.cardio.where('dedupeKey').equals(row.dedupeKey).first();
      if (existing) {
        // Keep any note typed in the app; the watch has nothing to say about it.
        await db.cardio.put({ ...(row as CardioSession), id: existing.id, notes: existing.notes });
        updated++;
      } else {
        await db.cardio.add({ ...(row as CardioSession), id: uid() });
        added++;
      }
    }
  });

  return { added, updated };
}

export function formatPace(secPerKm: number | null): string {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

export function formatDistance(km: number | null): string {
  if (km === null || !Number.isFinite(km)) return '—';
  return `${km.toFixed(2)} km`;
}

export function formatCardioDuration(sec: number | null): string {
  if (!sec || !Number.isFinite(sec)) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
               : `${m}:${String(s).padStart(2, '0')}`;
}
