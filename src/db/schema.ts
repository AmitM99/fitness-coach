import Dexie, { type Table } from 'dexie';

/**
 * Everything lives in IndexedDB on this device. Nothing is ever uploaded —
 * the only network call the app makes is the weekly review, and only when the
 * user presses the button (see coach-app-vision.md #1).
 */

/* ---------- static reference data (seeded from /public/data) ---------- */

export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  bodyPartHe: string;
  equipment: string;
  equipmentHe: string;
  target: string;
  targetHe: string;
  muscleGroup: string;
  secondary: string[];
  steps: string[];
  /** Hand-written Hebrew form cues; null when we have none for this movement. */
  cuesHe: string[] | null;
  media: string;
  image: string;
  gif: string;
}

export interface Food {
  id: string;
  code: string;
  he: string;
  en: string | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugars: number | null;
  sodium: number | null;
  satFat: number | null;
  portions: { label: string; grams: number }[];
}

/* ---------- planning ---------- */

export interface PlanItem {
  id: string;
  exerciseId: string;
  /** Same letter = performed as a superset / circuit block. */
  group: string | null;
  targetSets: number;
  /** Free text on purpose: real programs say "8-10", "AMRAP", "5". */
  targetReps: string;
  targetWeight: number | null;
  restSec: number;
  /** Coaching note, usually Hebrew. */
  notes: string;
  /**
   * Coach-chosen substitutes, best first — what to do when the machine is
   * broken or taken. Hand-picked rather than searched because a same-muscle
   * search knows nothing about his wrist or what the gym actually has.
   * Optional: programs written before this field simply have none.
   */
  alternatives?: string[];
}

export interface PlanDay {
  id: string;
  name: string;
  /** 0=Sun … 6=Sat, or null when the day floats within the week. */
  dayOfWeek: number | null;
  items: PlanItem[];
}

export interface Program {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  archived: boolean;
  active: boolean;
  days: PlanDay[];
  /** Start of the current block, yyyy-mm-dd. Null for open-ended programs. */
  startDate: string | null;
  /** Block length. When it elapses, the app prompts for a re-plan. */
  weeks: number | null;
  /**
   * A/B/C style rotation: days are performed in order regardless of weekday,
   * which survives a missed week far better than fixed days do.
   */
  rotation: boolean;
}

/* ---------- performing ---------- */

export interface Session {
  id: string;
  /** yyyy-mm-dd, local. */
  date: string;
  programId: string | null;
  planDayId: string | null;
  name: string;
  startedAt: string;
  finishedAt: string | null;
  notes: string;
  /** 1 (rough) … 5 (great) — feeds the weekly review. */
  feeling: number | null;
  status: 'active' | 'done';
}

export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  planItemId: string | null;
  setIndex: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  isWarmup: boolean;
  done: boolean;
  notes: string;
}

/* ---------- body ---------- */

export interface WeightEntry {
  id: string;
  date: string;
  kg: number;
  note: string;
}

export type MeasurementKey =
  | 'waist'
  | 'chest'
  | 'hips'
  | 'armL'
  | 'armR'
  | 'thighL'
  | 'thighR'
  | 'neck'
  | 'calf';

export interface Measurement {
  id: string;
  date: string;
  key: MeasurementKey;
  cm: number;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  pose: 'front' | 'side' | 'back';
  blob: Blob;
  note: string;
}

/* ---------- nutrition (intentionally light) ---------- */

export interface FoodLog {
  id: string;
  date: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodId: string | null;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/* ---------- misc ---------- */

export interface Habit {
  id: string;
  name: string;
  noteHe: string;
  archived: boolean;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  done: boolean;
}

/**
 * A note about how one exercise went in one session — "כאב בכתף בסט האחרון",
 * "המשקל הרגיש קל". Kept separate from the set rows because it describes the
 * exercise as a whole, and because it feeds the weekly review, where the
 * sentence often explains a number better than the number does.
 */
export interface ExerciseNote {
  id: string;
  sessionId: string;
  exerciseId: string;
  text: string;
  updatedAt: string;
}

/**
 * A cardio session — a run, ride or walk. Kept apart from the strength tables
 * because it is measured in distance, time and pace rather than sets and reps,
 * and because most of these arrive from a watch rather than being typed in.
 */
export interface CardioSession {
  id: string;
  /** yyyy-mm-dd, local. */
  date: string;
  /** Garmin's activity type, normalised: 'running', 'cycling', 'walking', … */
  type: string;
  title: string;
  distanceKm: number | null;
  durationSec: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  elevationM: number | null;
  /** Derived from distance and duration, so charts never recompute it. */
  paceSecPerKm: number | null;
  notes: string;
  source: 'garmin' | 'manual';
  /**
   * date + type + duration. Re-importing an overlapping CSV export is the
   * normal case, so rows need to collapse rather than duplicate.
   */
  dedupeKey: string;
}

/**
 * One night of sleep plus the recovery markers the watch derives from it.
 * Keyed by the date he woke up, which is how Garmin files a night.
 *
 * Every metric is nullable: a night the watch was off leaves no row at all, and
 * a missing field stays null rather than being filled with a guess.
 */
export interface RecoveryDay {
  /** `garmin-<date>`, so a weekly sync that overlaps the last one overwrites it. */
  id: string;
  /** yyyy-mm-dd, the morning the night ended. */
  date: string;
  sleepHours: number | null;
  /** Garmin's 0–100 sleep score. */
  sleepScore: number | null;
  deepPct: number | null;
  remPct: number | null;
  awakeMin: number | null;
  /** Garmin's average stress during sleep, 0–100. */
  sleepStress: number | null;
  /** Average overnight HRV, ms. */
  hrvMs: number | null;
  /** Garmin's 7-day rolling HRV average, ms. */
  hrvWeeklyAvgMs: number | null;
  /**
   * Garmin's HRV status — BALANCED, UNBALANCED, LOW, POOR. Null while the watch
   * is still building a baseline (~3 weeks of nightly wear), and in that window
   * the HRV numbers have nothing to be compared against.
   */
  hrvStatus: string | null;
  restingHr: number | null;
  notes: string;
  source: 'garmin' | 'manual';
}

export interface Review {
  id: string;
  /** yyyy-mm-dd of the week's Monday. */
  weekStart: string;
  createdAt: string;
  summary: string;
  response: string;
}

/**
 * The intake answers. These travel with every weekly summary — without them a
 * coach is reading numbers with no idea there's a wrist injury or a 45-minute
 * ceiling behind them.
 */
export interface Profile {
  id: 'profile';
  goal: string;
  sessionsPerWeek: string;
  sessionMinutes: number | null;
  experience: string;
  history: string;
  whatWorks: string;
  gym: string;
  equipment: string;
  /** Injuries and current pain. */
  injuries: string;
  /** Movements or equipment to program around. */
  avoid: string;
  medical: string;
  age: number | null;
  likes: string;
  dislikes: string;
  cardio: string;
  sleep: string;
  stress: string;
  /** How often to rebuild the program, in weeks. */
  replanWeeks: number;
  updatedAt: string;
}

export const EMPTY_PROFILE: Profile = {
  id: 'profile',
  goal: '',
  sessionsPerWeek: '',
  sessionMinutes: null,
  experience: '',
  history: '',
  whatWorks: '',
  gym: '',
  equipment: '',
  injuries: '',
  avoid: '',
  medical: '',
  age: null,
  likes: '',
  dislikes: '',
  cardio: '',
  sleep: '',
  stress: '',
  replanWeeks: 4,
  updatedAt: '',
};

export interface SettingsRow {
  id: 'settings';
  displayName: string;
  heightCm: number | null;
  targetKcal: number | null;
  targetProtein: number | null;
  targetCarbs: number | null;
  targetFat: number | null;
  goalWeightKg: number | null;
  /** Stored locally only, never bundled into an export by default. */
  anthropicApiKey: string;
  seededVersion: number;

  /* --- rest timer --- */
  /** Start the countdown automatically when a set is ticked off. */
  autoRest: boolean;
  /** Between sets, when the plan doesn't prescribe its own rest. */
  defaultRestSec: number;
  /** Between exercises — normally longer than the between-set rest. */
  exerciseRestSec: number;
  /** Buzz when the countdown reaches zero. */
  restVibrate: boolean;
  /** Raise a system notification when the countdown reaches zero. */
  restNotify: boolean;
  /** Play a tone when the countdown reaches zero. */
  restSound: boolean;
}

export const SEED_VERSION = 1;

class CoachDB extends Dexie {
  exercises!: Table<Exercise, string>;
  foods!: Table<Food, string>;
  programs!: Table<Program, string>;
  sessions!: Table<Session, string>;
  setLogs!: Table<SetLog, string>;
  weights!: Table<WeightEntry, string>;
  measurements!: Table<Measurement, string>;
  photos!: Table<ProgressPhoto, string>;
  foodLogs!: Table<FoodLog, string>;
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  reviews!: Table<Review, string>;
  settings!: Table<SettingsRow, string>;
  profile!: Table<Profile, string>;
  exerciseNotes!: Table<ExerciseNote, string>;
  cardio!: Table<CardioSession, string>;
  recovery!: Table<RecoveryDay, string>;

  constructor() {
    super('coach');
    this.version(1).stores({
      exercises: 'id, name, bodyPart, equipment, target',
      foods: 'id, he, en',
      programs: 'id, active, archived, createdAt',
      sessions: 'id, date, status, programId',
      setLogs: 'id, sessionId, exerciseId, [exerciseId+sessionId]',
      weights: 'id, date',
      measurements: 'id, date, key, [key+date]',
      photos: 'id, date, pose',
      foodLogs: 'id, date, [date+meal]',
      habits: 'id, archived',
      habitLogs: 'id, date, habitId, [habitId+date]',
      reviews: 'id, weekStart',
      settings: 'id',
    });

    // v2 adds the athlete profile, plus mesocycle fields on existing programs.
    this.version(2)
      .stores({ profile: 'id' })
      .upgrade(async (tx) => {
        await tx
          .table('programs')
          .toCollection()
          .modify((p: Program) => {
            p.startDate ??= null;
            p.weeks ??= null;
            p.rotation ??= false;
          });
      });

    // v3 adds per-exercise notes inside a session.
    this.version(3).stores({
      exerciseNotes: 'id, sessionId, exerciseId, [sessionId+exerciseId]',
    });

    // v4 adds cardio sessions, imported from a watch or entered by hand.
    this.version(4).stores({
      cardio: 'id, date, type, &dedupeKey',
    });

    // v5 adds nightly sleep and recovery, synced weekly from the watch.
    this.version(5).stores({
      recovery: 'id, &date',
    });
  }
}

export const db = new CoachDB();

export const DEFAULT_SETTINGS: SettingsRow = {
  id: 'settings',
  displayName: '',
  heightCm: null,
  targetKcal: null,
  targetProtein: null,
  targetCarbs: null,
  targetFat: null,
  goalWeightKg: null,
  anthropicApiKey: '',
  seededVersion: 0,
  autoRest: true,
  defaultRestSec: 90,
  exerciseRestSec: 150,
  restVibrate: true,
  restNotify: true,
  restSound: true,
};

export async function getSettings(): Promise<SettingsRow> {
  const row = await db.settings.get('settings');
  // Merged with the defaults so rows written by an older version pick up new
  // fields instead of returning undefined.
  if (row) return { ...DEFAULT_SETTINGS, ...row };
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<SettingsRow>) {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'settings' });
}

export async function getProfile(): Promise<Profile> {
  const row = await db.profile.get('profile');
  if (row) return row;
  await db.profile.put(EMPTY_PROFILE);
  return EMPTY_PROFILE;
}

export async function updateProfile(patch: Partial<Profile>) {
  const current = await getProfile();
  await db.profile.put({
    ...current,
    ...patch,
    id: 'profile',
    updatedAt: new Date().toISOString(),
  });
}

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
