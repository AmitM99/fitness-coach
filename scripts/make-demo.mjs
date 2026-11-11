#!/usr/bin/env node
/**
 * Writes demo/demo-backup.json: a fictional athlete with ~8 weeks of history,
 * so the app can be shown without any real health data.
 *
 * Everything here is invented. Load it from More → Data → Import backup
 * (use "replace" on a fresh browser profile).
 *
 *   node scripts/make-demo.mjs            # history ends yesterday
 *   node scripts/make-demo.mjs 2026-11-10 # history ends on a fixed date
 *
 * Exercise ids are the ExerciseDB ids produced by `npm run data:build`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

/* ---------- deterministic helpers ---------- */

let seed = 42;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const between = (lo, hi) => lo + rand() * (hi - lo);
const round = (n, step = 1) => Math.round(n / step) * step;
let idCounter = 0;
const uid = (p) => `demo-${p}-${(++idCounter).toString(36).padStart(4, '0')}`;

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const at = (d, h, m = 0) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
};

const endArg = process.argv[2];
const END = endArg ? new Date(`${endArg}T12:00:00`) : addDays(new Date(), -1);
const WEEKS = 8;
const START = addDays(END, -WEEKS * 7 + 1);

/* ---------- program: 3-day A/B/C rotation ---------- */

const EX = {
  squat: '0043',
  bench: '0025',
  row: '0027',
  ohp: '0405',
  pulldown: '0198',
  rdl: '0085',
  incline: '0314',
  cableRow: '0861',
  legCurl: '0586',
  legExt: '0585',
  curl: '0031',
  pushdown: '0201',
  lateral: '0334',
  goblet: '1760',
};

const item = (exerciseId, sets, reps, weight, restSec, notes = '', alternatives) => ({
  id: uid('item'),
  exerciseId,
  group: null,
  targetSets: sets,
  targetReps: reps,
  targetWeight: weight,
  restSec,
  notes,
  ...(alternatives ? { alternatives } : {}),
});

const days = [
  {
    id: uid('day'),
    name: 'A — סקוואט ולחיצה',
    dayOfWeek: null,
    items: [
      item(EX.squat, 4, '5-6', 60, 180, 'עומק עד מתחת למקביל, גב ניטרלי', [EX.goblet]),
      item(EX.bench, 4, '6-8', 42.5, 150, 'שכמות צמודות, רגליים יציבות'),
      item(EX.cableRow, 3, '10-12', 40, 90),
      item(EX.lateral, 3, '12-15', 6, 60),
    ],
  },
  {
    id: uid('day'),
    name: 'B — ירכיים אחוריות ומשיכה',
    dayOfWeek: null,
    items: [
      item(EX.rdl, 4, '6-8', 55, 150, 'ירידה איטית, מוט צמוד לרגליים'),
      item(EX.pulldown, 4, '8-10', 37.5, 90),
      item(EX.ohp, 3, '8-10', 10, 90),
      item(EX.legCurl, 3, '10-12', 30, 60),
    ],
  },
  {
    id: uid('day'),
    name: 'C — נפח',
    dayOfWeek: null,
    items: [
      item(EX.goblet, 3, '10-12', 20, 90),
      item(EX.incline, 3, '8-10', 14, 90),
      item(EX.row, 3, '8-10', 35, 90),
      item(EX.legExt, 3, '12-15', 25, 60),
      item(EX.curl, 2, '10-12', 15, 60),
      item(EX.pushdown, 2, '12-15', 15, 60),
    ],
  },
];

const program = {
  id: uid('program'),
  name: 'כוח בסיסי 3× בשבוע (דמו)',
  description: 'תוכנית סבב A/B/C לבניית כוח בסיסי לצד ריצה. נתוני דמו בלבד.',
  createdAt: at(START, 8),
  archived: false,
  active: true,
  days,
  startDate: iso(START),
  weeks: WEEKS + 2,
  rotation: true,
};

/* ---------- sessions and sets ---------- */

const sessions = [];
const setLogs = [];
const exerciseNotes = [];
// Sun / Tue / Thu lifting, a missed session now and then.
const liftDays = new Set([0, 2, 4]);
let rotation = 0;

for (let d = new Date(START); d <= END; d = addDays(d, 1)) {
  if (!liftDays.has(d.getDay())) continue;
  if (rand() < 0.1) continue; // missed

  const week = Math.floor((d - START) / (7 * 864e5));
  const day = days[rotation % days.length];
  rotation++;
  const sessionId = uid('session');
  const start = at(d, 18, round(between(0, 40), 5));
  const minutes = round(between(50, 70));
  const feeling = Math.max(2, Math.min(5, Math.round(between(2.6, 5.2))));

  sessions.push({
    id: sessionId,
    date: iso(d),
    programId: program.id,
    planDayId: day.id,
    name: day.name,
    startedAt: start,
    finishedAt: new Date(new Date(start).getTime() + minutes * 60000).toISOString(),
    notes: feeling <= 2 ? 'יום עייף אחרי שבוע עמוס בעבודה' : '',
    feeling,
    status: 'done',
  });

  for (const it of day.items) {
    // Linear-ish progression with small plates, plus a deload in week 5.
    const step = it.targetWeight >= 40 ? 2.5 : 1;
    const deload = week === 4 ? 0.85 : 1;
    const w = round((it.targetWeight + step * Math.floor(week * 0.75)) * deload, step >= 2.5 ? 2.5 : 1);
    const [lo, hi] = it.targetReps.split('-').map(Number);

    if (it.targetWeight >= 40) {
      setLogs.push({
        id: uid('set'), sessionId, exerciseId: it.exerciseId, planItemId: it.id,
        setIndex: 0, weight: round(w * 0.6, 2.5), reps: 8, rpe: null,
        isWarmup: true, done: true, notes: '',
      });
    }
    for (let s = 0; s < it.targetSets; s++) {
      const reps = Math.max(lo - 1, Math.round(between(lo, hi + 0.9) - s * 0.4));
      setLogs.push({
        id: uid('set'), sessionId, exerciseId: it.exerciseId, planItemId: it.id,
        setIndex: s + 1, weight: w, reps,
        rpe: round(between(6.5, 8.5) + s * 0.3, 0.5),
        isWarmup: false, done: true, notes: '',
      });
    }
  }

  if (rand() < 0.2) {
    const it = day.items[0];
    exerciseNotes.push({
      id: uid('note'),
      sessionId,
      exerciseId: it.exerciseId,
      text: ['המשקל הרגיש קל, אפשר לעלות', 'הסט האחרון היה איטי', 'טכניקה טובה היום'][Math.floor(rand() * 3)],
      updatedAt: start,
    });
  }
}

/* ---------- body ---------- */

const weights = [];
let kg = 66.8;
for (let d = new Date(START); d <= END; d = addDays(d, 1)) {
  if (rand() < 0.35) continue;
  kg += between(-0.25, 0.18);
  weights.push({ id: uid('weight'), date: iso(d), kg: round(kg, 0.1), note: '' });
}

const measurements = [];
for (let w = 0; w < WEEKS; w += 2) {
  const date = iso(addDays(START, w * 7 + 1));
  const drift = w * 0.15;
  for (const [key, cm] of [['waist', 74 - drift], ['hips', 98 - drift * 0.5], ['thighL', 57], ['armL', 28 + drift * 0.2]]) {
    measurements.push({ id: uid('meas'), date, key, cm: round(cm + between(-0.3, 0.3), 0.5) });
  }
}

/* ---------- cardio and recovery ---------- */

const cardio = [];
const recovery = [];
for (let d = new Date(START); d <= END; d = addDays(d, 1)) {
  const date = iso(d);
  const dow = d.getDay();
  const week = Math.floor((d - START) / (7 * 864e5));

  if ((dow === 1 || dow === 3 || dow === 5) && rand() > 0.1) {
    const long = dow === 5;
    const km = round(long ? 6 + week * 0.4 : between(4, 5.5), 0.01);
    const pace = round(long ? between(395, 420) : between(370, 400));
    const durationSec = Math.round(km * pace);
    cardio.push({
      id: uid('cardio'),
      date,
      type: 'running',
      title: long ? 'ריצה ארוכה' : 'ריצה קלה',
      distanceKm: km,
      durationSec,
      avgHr: round(long ? between(146, 156) : between(142, 152)),
      maxHr: round(between(162, 175)),
      calories: Math.round(km * 62),
      elevationM: round(between(10, 60)),
      paceSecPerKm: Math.round(durationSec / km),
      notes: '',
      source: 'manual',
      dedupeKey: `${date}|running|${durationSec}`,
    });
  }

  if (rand() < 0.08) continue; // watch off
  const sleepHours = round(between(6.2, 8.3), 0.1);
  const hrv = round(between(48, 66));
  recovery.push({
    id: `demo-${date}`,
    date,
    sleepHours,
    sleepScore: Math.min(95, round(sleepHours * 10 + between(-6, 8))),
    deepPct: round(between(14, 22)),
    remPct: round(between(18, 26)),
    awakeMin: round(between(8, 40)),
    sleepStress: round(between(12, 28)),
    hrvMs: hrv,
    hrvWeeklyAvgMs: week < 3 ? null : round(between(54, 60)),
    hrvStatus: week < 3 ? null : 'BALANCED',
    restingHr: round(between(52, 58)),
    notes: '',
    source: 'manual',
  });
}

/* ---------- nutrition (last 5 days only — logging is intentionally light) ---------- */

const MEALS = [
  ['breakfast', 'יוגורט חלבון עם גרנולה', 250, 330, 28, 38, 7],
  ['lunch', 'חזה עוף, אורז וסלט', 450, 610, 48, 70, 14],
  ['snack', 'בננה וחופן שקדים', 150, 260, 7, 30, 13],
  ['dinner', 'חביתה, לחם מלא וגבינה', 300, 480, 30, 35, 22],
];
const foodLogs = [];
for (let i = 4; i >= 0; i--) {
  const date = iso(addDays(END, -i));
  for (const [meal, name, grams, kcal, protein, carbs, fat] of MEALS) {
    const f = between(0.85, 1.15);
    foodLogs.push({
      id: uid('food'), date, meal, foodId: null, name,
      grams: round(grams * f), kcal: round(kcal * f), protein: round(protein * f),
      carbs: round(carbs * f), fat: round(fat * f),
    });
  }
}

/* ---------- habits ---------- */

const habits = [
  { id: uid('habit'), name: '8 כוסות מים', noteHe: '', archived: false },
  { id: uid('habit'), name: '10 דקות מתיחות', noteHe: 'אחרי ריצה', archived: false },
  { id: uid('habit'), name: 'מסך כבוי עד 23:00', noteHe: '', archived: false },
];
const habitLogs = [];
for (let d = addDays(END, -20); d <= END; d = addDays(d, 1)) {
  for (const h of habits) {
    if (rand() < 0.7) habitLogs.push({ id: uid('hlog'), habitId: h.id, date: iso(d), done: true });
  }
}

/* ---------- a past weekly review ---------- */

const monday = (d) => addDays(d, -((d.getDay() + 6) % 7));
const lastWeek = monday(addDays(END, -7));
const reviews = [
  {
    id: uid('review'),
    weekStart: iso(lastWeek),
    createdAt: at(addDays(lastWeek, 7), 9),
    summary: 'סיכום שבוע לדוגמה (נתוני דמו).',
    response:
      'שבוע טוב: 3 אימוני כוח ו-3 ריצות, שינה ממוצעת סביב 7 שעות.\n\n' +
      '• סקוואט ולחיצת חזה ממשיכים לעלות בהדרגה, RPE עדיין בטווח 7–8.\n' +
      '• הריצה הארוכה התארכה בלי עלייה בדופק הממוצע — סימן טוב לבסיס האירובי.\n' +
      '• המשקל יורד לאט, כמתוכנן.\n\n' +
      'לשבוע הבא: להוסיף 2.5 ק"ג לסקוואט, ולשמור את הריצות הקלות באמת קלות.',
  },
];

/* ---------- profile and settings ---------- */

const profile = {
  id: 'profile',
  goal: 'לבנות כוח בסיסי ולרוץ 10 ק"מ מתחת לשעה (דמו)',
  sessionsPerWeek: '3 כוח + 3 ריצות',
  sessionMinutes: 60,
  experience: 'שנה של אימוני כוח, רצה באופן קבוע חצי שנה',
  history: 'התחילה עם אימוני פונקציונלי, עברה לתוכנית כוח מסודרת',
  whatWorks: 'תוכנית קבועה עם מעקב משקלים',
  gym: 'חדר כושר שכונתי',
  equipment: 'מוטות, משקולות יד, כבלים, מכונות בסיסיות',
  injuries: 'אין',
  avoid: '',
  medical: '',
  age: 29,
  likes: 'סקוואט, ריצות בוקר',
  dislikes: 'מכונות בידוד ארוכות',
  cardio: 'ריצה 3 פעמים בשבוע',
  sleep: '7 שעות בממוצע',
  stress: 'בינוני',
  replanWeeks: 4,
  updatedAt: at(START, 8),
};

const settings = {
  id: 'settings',
  displayName: 'דנה (דמו)',
  heightCm: 166,
  targetKcal: 1900,
  targetProtein: 120,
  targetCarbs: 200,
  targetFat: 65,
  goalWeightKg: 64,
  anthropicApiKey: '',
  seededVersion: 1,
  autoRest: true,
  defaultRestSec: 90,
  exerciseRestSec: 150,
  restVibrate: true,
  restNotify: false,
  restSound: true,
};

/* ---------- write ---------- */

const backup = {
  app: 'fitness-coach',
  backupVersion: 1,
  exportedAt: at(END, 21),
  data: {
    programs: [program],
    sessions,
    setLogs,
    weights,
    measurements,
    foodLogs,
    habits,
    habitLogs,
    reviews,
    settings,
    profile,
    exerciseNotes,
    cardio,
    recovery,
    photos: [],
  },
};

mkdirSync(new URL('../demo/', import.meta.url), { recursive: true });
const out = new URL('../demo/demo-backup.json', import.meta.url);
writeFileSync(out, JSON.stringify(backup, null, 2) + '\n');
console.log(
  `demo/demo-backup.json: ${sessions.length} sessions, ${setLogs.length} sets, ` +
    `${cardio.length} runs, ${recovery.length} nights, ${weights.length} weigh-ins ` +
    `(${iso(START)} → ${iso(END)})`
);
