import { db, getSettings, updateSettings, SEED_VERSION, type Exercise, type Food } from './schema';

export type SeedPhase = 'idle' | 'exercises' | 'foods' | 'done';

/**
 * Asks the browser not to evict our data under storage pressure.
 *
 * This matters most on iOS: script-writable storage for an ordinary website
 * can be cleared after ~7 days without a visit. Installing to the home screen
 * exempts the app from that, and a granted persistence request hardens it
 * further. Failure is non-fatal — the app works either way, it just means the
 * user should keep taking backups.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<{ usedMb: number; quotaMb: number } | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est?.usage || !est.quota) return null;
    return {
      usedMb: Math.round((est.usage / 1048576) * 10) / 10,
      quotaMb: Math.round(est.quota / 1048576),
    };
  } catch {
    return null;
  }
}

/**
 * Loads the bundled reference data into IndexedDB on first run. Both files are
 * served from /public, so this is a same-origin request — no third party.
 */
export async function seedIfNeeded(onPhase?: (p: SeedPhase, detail?: string) => void) {
  const settings = await getSettings();
  const exCount = await db.exercises.count();
  const foodCount = await db.foods.count();

  if (settings.seededVersion === SEED_VERSION && exCount > 0 && foodCount > 0) {
    onPhase?.('done');
    return;
  }

  if (exCount === 0 || settings.seededVersion !== SEED_VERSION) {
    onPhase?.('exercises', 'Loading exercise library…');
    const res = await fetch('/data/exercises.json');
    if (!res.ok) throw new Error('Could not load exercises.json — run `npm run data:build`.');
    const exercises: Exercise[] = await res.json();
    await db.exercises.bulkPut(exercises);
  }

  if (foodCount === 0 || settings.seededVersion !== SEED_VERSION) {
    onPhase?.('foods', 'Loading nutrition database…');
    const res = await fetch('/data/foods.json');
    if (!res.ok) throw new Error('Could not load foods.json — run `npm run data:build`.');
    const foods: Food[] = await res.json();
    await db.foods.bulkPut(foods);
  }

  await updateSettings({ seededVersion: SEED_VERSION });
  onPhase?.('done');
}

export interface Taxonomies {
  bodyParts: { key: string; he: string }[];
  equipment: { key: string; he: string }[];
  targets: { key: string; he: string }[];
}

let taxonomiesCache: Taxonomies | null = null;

export async function loadTaxonomies(): Promise<Taxonomies> {
  if (taxonomiesCache) return taxonomiesCache;
  const res = await fetch('/data/exercise-taxonomies.json');
  taxonomiesCache = await res.json();
  return taxonomiesCache!;
}
