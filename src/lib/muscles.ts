import type { Exercise, SetLog } from '@/db/schema';

/**
 * Weekly sets per muscle group.
 *
 * The exercise data (ExerciseDB) names one primary `target` and a free list of
 * `secondary` muscles in its own vocabulary. Both are folded into a short list
 * of groups a lifter actually thinks in. A working set counts 1 for the
 * primary group and ½ for each secondary group — the usual convention for
 * "fractional" set counting. Muscles that don't map (hip flexors, ankles…)
 * are ignored rather than guessed into a group.
 */

export type MuscleGroupKey =
  | 'chest' | 'back' | 'shoulders' | 'traps' | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'lowerBack';

export const MUSCLE_GROUPS: { key: MuscleGroupKey; label: string; he: string }[] = [
  { key: 'chest', label: 'Chest', he: 'חזה' },
  { key: 'back', label: 'Back', he: 'גב' },
  { key: 'shoulders', label: 'Shoulders', he: 'כתפיים' },
  { key: 'traps', label: 'Traps', he: 'טרפז' },
  { key: 'biceps', label: 'Biceps', he: 'יד קדמית' },
  { key: 'triceps', label: 'Triceps', he: 'יד אחורית' },
  { key: 'forearms', label: 'Forearms', he: 'אמות' },
  { key: 'quads', label: 'Quads', he: 'ארבע ראשי' },
  { key: 'hamstrings', label: 'Hamstrings', he: 'ירך אחורית' },
  { key: 'glutes', label: 'Glutes', he: 'ישבן' },
  { key: 'calves', label: 'Calves', he: 'תאומים' },
  { key: 'core', label: 'Core', he: 'בטן' },
  { key: 'lowerBack', label: 'Lower back', he: 'גב תחתון' },
];

const ALIASES: Record<string, MuscleGroupKey> = {
  pectorals: 'chest', chest: 'chest', 'upper chest': 'chest',
  lats: 'back', 'latissimus dorsi': 'back', 'upper back': 'back', rhomboids: 'back', back: 'back',
  delts: 'shoulders', deltoids: 'shoulders', shoulders: 'shoulders',
  'rear deltoids': 'shoulders', 'rotator cuff': 'shoulders',
  traps: 'traps', trapezius: 'traps', 'levator scapulae': 'traps',
  biceps: 'biceps', brachialis: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms', 'wrist flexors': 'forearms', 'wrist extensors': 'forearms',
  'grip muscles': 'forearms',
  quads: 'quads', quadriceps: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes', abductors: 'glutes',
  calves: 'calves', soleus: 'calves',
  abs: 'core', abdominals: 'core', obliques: 'core', core: 'core', 'lower abs': 'core',
  'serratus anterior': 'core',
  'lower back': 'lowerBack', spine: 'lowerBack',
};

export function muscleGroupOf(name: string): MuscleGroupKey | null {
  return ALIASES[name.trim().toLowerCase()] ?? null;
}

/** How much one working set of this exercise counts toward each group. */
export function exerciseMuscleWeights(ex: Exercise): Map<MuscleGroupKey, number> {
  const out = new Map<MuscleGroupKey, number>();
  for (const name of ex.secondary ?? []) {
    const g = muscleGroupOf(name);
    if (g) out.set(g, 0.5);
  }
  // Primary last, so it wins when the data lists a muscle in both places.
  const primary = muscleGroupOf(ex.target);
  if (primary) out.set(primary, 1);
  return out;
}

export type MuscleSets = Record<MuscleGroupKey, number>;

export function emptyMuscleSets(): MuscleSets {
  return Object.fromEntries(MUSCLE_GROUPS.map((g) => [g.key, 0])) as MuscleSets;
}

/** Done, non-warm-up sets → fractional set count per group. */
export function muscleSets(sets: SetLog[], byId: Map<string, Exercise>): MuscleSets {
  const out = emptyMuscleSets();
  const cache = new Map<string, Map<MuscleGroupKey, number>>();
  for (const s of sets) {
    if (!s.done || s.isWarmup) continue;
    const ex = byId.get(s.exerciseId);
    if (!ex) continue;
    let weights = cache.get(ex.id);
    if (!weights) {
      weights = exerciseMuscleWeights(ex);
      cache.set(ex.id, weights);
    }
    for (const [g, w] of weights) out[g] += w;
  }
  return out;
}

/** Rounds to the nearest half, which is all the precision fractional counting has. */
export function formatSets(n: number): string {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/**
 * Commonly cited hypertrophy range for direct weekly sets per muscle
 * (roughly 10–20). Shown as a reference band, not a target the app enforces.
 */
export const WEEKLY_SET_BAND = { low: 10, high: 20 } as const;

/**
 * The muscle groups a session mainly hit, by primary-muscle working sets,
 * largest first — "Chest, Triceps" on a workout card.
 */
export function sessionFocus(sets: SetLog[], byId: Map<string, Exercise>, max = 3): string[] {
  const count = new Map<MuscleGroupKey, number>();
  for (const s of sets) {
    if (s.isWarmup) continue;
    const ex = byId.get(s.exerciseId);
    const g = ex ? muscleGroupOf(ex.target) : null;
    if (g) count.set(g, (count.get(g) ?? 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([g]) => MUSCLE_GROUPS.find((m) => m.key === g)!.label);
}
