/**
 * Builds the static datasets the app ships with.
 *
 * Sources (both fetched live, nothing invented — see coach-app-vision.md #3):
 *   1. Exercises  — github.com/hasaneyldrm/exercises-dataset (MIT structure,
 *                   media © Gym visual, redistributed with permission).
 *   2. Nutrition  — מאגר התזונה הלאומי הישראלי, משרד הבריאות, via data.gov.il
 *                   CKAN API (open licence).
 *
 * Output: public/data/*.json — bundled locally so the running app never needs
 * to call out to anyone.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'data');
fs.mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log('•', ...a);

/* ------------------------------------------------------------------ */
/* Exercises                                                           */
/* ------------------------------------------------------------------ */

const EX_URL =
  'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';

// Hebrew labels for the dataset's taxonomies. The user reads the UI in English
// but wants the explanatory layer in Hebrew, so every filter chip carries both.
const HE_BODY_PART = {
  waist: 'מותניים / ליבה',
  'upper legs': 'רגליים עליונות',
  back: 'גב',
  'lower legs': 'רגליים תחתונות',
  chest: 'חזה',
  'upper arms': 'זרועות עליונות',
  cardio: 'אירובי',
  shoulders: 'כתפיים',
  'lower arms': 'אמות',
  neck: 'צוואר',
};

const HE_TARGET = {
  abs: 'בטן',
  quads: 'ארבע ראשי',
  lats: 'רחב גבי',
  calves: 'תאומים',
  pectorals: 'חזה',
  glutes: 'ישבן',
  hamstrings: 'מכופפי ירך',
  adductors: 'מקרבים',
  triceps: 'תלת ראשי',
  'cardiovascular system': 'מערכת לב-ריאה',
  spine: 'זוקפי גב',
  'upper back': 'גב עליון',
  biceps: 'דו ראשי',
  delts: 'דלתא',
  forearms: 'אמות',
  traps: 'טרפז',
  'serratus anterior': 'משונן קדמי',
  abductors: 'מרחיקים',
  'levator scapulae': 'מרים השכמה',
};

const HE_EQUIPMENT = {
  'body weight': 'משקל גוף',
  cable: 'כבלים',
  'leverage machine': 'מכונה',
  assisted: 'בסיוע',
  'medicine ball': 'כדור כוח',
  'stability ball': 'כדור פיזיו',
  band: 'גומייה',
  barbell: 'מוט',
  rope: 'חבל',
  dumbbell: 'משקולות יד',
  'ez barbell': 'מוט EZ',
  'sled machine': 'מזחלת',
  'upper body ergometer': 'ארגומטר ידיים',
  kettlebell: 'קטלבל',
  'olympic barbell': 'מוט אולימפי',
  weighted: 'עם משקל',
  'bosu ball': 'בוסו',
  'resistance band': 'גומיית התנגדות',
  roller: 'גלגלת',
  'skierg machine': 'סקי ארג',
  hammer: 'פטיש',
  'smith machine': 'סמית',
  'wheel roller': 'גלגל בטן',
  'stationary bike': 'אופני כושר',
  tire: 'צמיג',
  'trap bar': 'מוט טראפ',
  'elliptical machine': 'אליפטי',
  'stepmill machine': 'מדרגות',
};

/**
 * Hebrew coaching cues (דגשים) for the core movement patterns.
 *
 * Deliberately hand-written rather than machine-translated: these are the
 * points that actually prevent injury and drive progress, and a bad
 * translation of a form cue is worse than none. Matched by substring against
 * the exercise name, most specific first. Exercises with no match simply show
 * the dataset's English steps.
 */
const HE_CUES = [
  ['barbell full squat', ['ליבה נעולה לפני הירידה — נשימה עמוקה לבטן והידוק.', 'ברכיים יוצאות לכיוון האצבעות, לא נופלות פנימה.', 'עומק: עד שקו הירך עובר את הברך, בלי לאבד את קימור הגב התחתון.', 'המוט על הטרפז, לא על הצוואר.']],
  ['barbell squat', ['ליבה נעולה, נשימה לבטן והידוק לפני כל חזרה.', 'דחיפה דרך אמצע כף הרגל, ברכיים החוצה.', 'הגב נשאר בקו ניטרלי — בלי עיגול בתחתית.']],
  ['front squat', ['מרפקים גבוהים לאורך כל התנועה — ברגע שהם יורדים, הגב מתעגל.', 'המוט נשען על הכתפיים, לא נאחז בכף היד.', 'גו זקוף יותר מסקוואט אחורי.']],
  ['barbell deadlift', ['המוט צמוד לשוק לאורך כל העלייה.', 'הגב ניטרלי — דוחפים את הרצפה, לא מושכים במותן.', 'נעילה בישבן ולא בגב תחתון. בלי היפר-אקסטנשן.', 'זו תרגיל שמצטבר בעייפות — לא לרדוף כישלון בכל סט.']],
  ['romanian deadlift', ['ברכיים כפופות קלות וקבועות — התנועה היא מהירך.', 'מרגישים מתיחה במכופפים, זה הסימן לעומק הנכון.', 'המוט צמוד לרגליים; אם הוא מתרחק, הגב לוקח את העומס.']],
  ['sumo deadlift', ['ברכיים החוצה בכיוון האצבעות.', 'חזה גבוה, גב ניטרלי, מושכים את הרצפה משם.']],
  ['deadlift', ['גב ניטרלי, המוט צמוד לגוף.', 'הכוח מגיע מהרגליים והישבן, לא מהגב התחתון.']],
  ['bench press', ['שכמות מכווצות ולחוצות לספסל — בסיס יציב.', 'המוט יורד לגובה החזה התחתון, לא לצוואר.', 'רגליים לוחצות ברצפה, ישבן נשאר על הספסל.', 'מרפקים בכ-45° לגוף — לא מפוצלים לצדדים.']],
  ['incline bench', ['שיפוע 30° מספיק — מעבר לזה הכתף לוקחת את העבודה.', 'שכמות מכווצות, מרפקים לא מפוצלים לצדדים.']],
  ['dumbbell bench press', ['שליטה בירידה, בלי להקפיץ מהחזה.', 'שכמות מכווצות לאורך כל הסט.']],
  ['overhead press', ['ליבה וישבן נעולים — בלי לפצות בקשת בגב התחתון.', 'הראש "עובר" קדימה מתחת למוט בנעילה.', 'לוחצים ישר למעלה, המוט מעל אמצע כף הרגל.']],
  ['military press', ['ליבה נעולה, בלי קשת בגב התחתון.', 'נעילה מלאה מעל הראש.']],
  ['pull-up', ['התחלה מתלייה מלאה — כתפיים "מופעלות" לפני המשיכה.', 'מובילים במרפקים כלפי מטה, לא במשיכת ידיים.', 'בלי נדנוד — אם צריך תנופה, עברת את מספר החזרות שלך.']],
  ['chin-up', ['אותה תנועה כמו מתח, עם יותר דו-ראשי.', 'ירידה מבוקרת — שם רוב הגירוי.']],
  ['lat pulldown', ['חזה גבוה, מושכים לחלק העליון של החזה.', 'מובילים במרפקים, לא בכפות הידיים.', 'בלי להישען אחורה מדי — זה הופך לחתירה.']],
  ['barbell bent over row', ['גו כמעט מקביל לרצפה, גב ניטרלי.', 'מושכים לכיוון הבטן התחתונה.', 'בלי להשתמש בתנופה מהמותן.']],
  ['cable row', ['חזה גבוה, שכמות נסגרות בסוף התנועה.', 'בלי לעגל את הגב בהחזרה.']],
  ['barbell curl', ['מרפקים צמודים לגוף וקבועים.', 'בלי תנופה מהמותן — אם צריך, הורד משקל.']],
  ['lateral raise', ['משקל קל, שליטה מלאה — זה שריר קטן.', 'מרימים עד גובה כתף, לא מעבר.', 'בלי להרים בטרפז — כתפיים למטה.']],
  ['triceps', ['מרפקים קבועים במקום, רק האמה זזה.', 'נעילה מלאה בסוף, בלי לנעול בכוח.']],
  ['lunge', ['הברך הקדמית בקו האצבעות, לא נופלת פנימה.', 'גו זקוף, יורדים ישר למטה.']],
  ['leg press', ['בלי לנעול ברכיים בכוח בסוף.', 'הגב התחתון נשאר צמוד למשענת — אם הוא מתרומם, הורדת עמוק מדי.']],
  ['plank', ['ישבן והבטן מהודקים — קו ישר מהראש לעקבים.', 'בלי צניחת מותניים, בלי הרמת ישבן.']],
  ['hip thrust', ['סנטר לחזה, מבט קדימה.', 'נעילה בישבן בלבד, בלי קשת בגב התחתון.']],
  ['calf raise', ['טווח מלא — מתיחה למטה, נעילה למעלה.', 'עצירה של שנייה בשיא הכיווץ.']],
  ['face pull', ['מושכים לגובה הפנים, מרפקים גבוהים.', 'מצוין לאיזון מול כל הלחיצות — שווה בכל אימון.']],
  ['dip', ['נטייה קדימה = יותר חזה, גו זקוף = יותר תלת-ראשי.', 'בלי לרדת מתחת ל-90° אם יש רגישות בכתף.']],
  ['row', ['מובילים במרפקים, שכמות נסגרות בסוף.', 'גב ניטרלי לאורך כל התנועה.']],
  ['squat', ['ברכיים בכיוון האצבעות, ליבה נעולה.', 'עומק עד כמה שהגב נשאר ניטרלי.']],
  ['press', ['שליטה בירידה, כוח בעלייה.', 'ליבה נעולה — בלי לפצות בגב התחתון.']],
  ['curl', ['מרפקים קבועים, בלי תנופה.']],
  ['crunch', ['מגלגלים את עמוד השדרה, לא מושכים בצוואר.', 'נשיפה בכיווץ.']],
  ['raise', ['שליטה מלאה, בלי תנופה.']],
];

function hebrewCues(name) {
  const n = name.toLowerCase();
  const hit = HE_CUES.find(([k]) => n.includes(k));
  return hit ? hit[1] : null;
}

async function buildExercises() {
  log('fetching exercises dataset…');
  const res = await fetch(EX_URL);
  if (!res.ok) throw new Error(`exercises fetch failed: ${res.status}`);
  const raw = await res.json();

  const exercises = raw.map((e) => {
    const cues = hebrewCues(e.name);
    return {
      id: e.id,
      name: e.name,
      bodyPart: e.body_part,
      bodyPartHe: HE_BODY_PART[e.body_part] ?? e.body_part,
      equipment: e.equipment,
      equipmentHe: HE_EQUIPMENT[e.equipment] ?? e.equipment,
      target: e.target,
      targetHe: HE_TARGET[e.target] ?? e.target,
      muscleGroup: e.muscle_group,
      secondary: e.secondary_muscles ?? [],
      steps: e.instruction_steps?.en ?? [],
      cuesHe: cues,
      media: e.media_id,
      image: e.image,
      gif: e.gif_url,
    };
  });

  const taxonomies = {
    bodyParts: [...new Set(exercises.map((e) => e.bodyPart))].sort().map((k) => ({ key: k, he: HE_BODY_PART[k] ?? k })),
    equipment: [...new Set(exercises.map((e) => e.equipment))].sort().map((k) => ({ key: k, he: HE_EQUIPMENT[k] ?? k })),
    targets: [...new Set(exercises.map((e) => e.target))].sort().map((k) => ({ key: k, he: HE_TARGET[k] ?? k })),
  };

  fs.writeFileSync(path.join(OUT, 'exercises.json'), JSON.stringify(exercises));
  fs.writeFileSync(path.join(OUT, 'exercise-taxonomies.json'), JSON.stringify(taxonomies));

  const withCues = exercises.filter((e) => e.cuesHe).length;
  log(`exercises: ${exercises.length} (${withCues} with Hebrew cues)`);
  return exercises;
}

/* ------------------------------------------------------------------ */
/* Nutrition (Israeli Ministry of Health)                              */
/* ------------------------------------------------------------------ */

const CKAN = 'https://data.gov.il/api/3/action/datastore_search';
const RES_FOODS = 'c3cb0630-0650-46c1-a068-82d575c094b2';
const RES_UNITS = '98fb46fe-e8de-4067-94d2-b0a8ea4269da';
const RES_FOOD_UNITS = '755d28c0-75f7-40e1-9c8c-ecdd106f9b2d';

async function ckanAll(resourceId, label) {
  const out = [];
  let offset = 0;
  for (;;) {
    const url = `${CKAN}?resource_id=${resourceId}&limit=2000&offset=${offset}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${label} fetch failed: ${r.status}`);
    const j = await r.json();
    if (!j.success) throw new Error(`${label} returned success=false`);
    out.push(...j.result.records);
    if (out.length >= j.result.total || j.result.records.length === 0) return out;
    offset += 2000;
  }
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function buildFoods() {
  log('fetching Israeli MoH nutrition database…');
  const [foods, units, foodUnits] = await Promise.all([
    ckanAll(RES_FOODS, 'foods'),
    ckanAll(RES_UNITS, 'units'),
    ckanAll(RES_FOOD_UNITS, 'foodUnits'),
  ]);

  const unitName = new Map(units.map((u) => [String(u.smlmida), u.shmmida]));

  // Portion weights, grouped by the food's `Code`.
  const portions = new Map();
  for (const row of foodUnits) {
    const code = String(row.mmitzrach);
    const grams = num(row.mishkal);
    const label = unitName.get(String(row.mida));
    if (!grams || !label) continue;
    if (!portions.has(code)) portions.set(code, []);
    portions.get(code).push({ label, grams });
  }

  // Only the nutrients this app actually shows. The full 74-column record is
  // preserved upstream at data.gov.il if it is ever needed.
  const slim = foods
    .filter((f) => f.shmmitzrach)
    .map((f) => ({
      id: String(f.smlmitzrach),
      code: String(f.Code),
      he: f.shmmitzrach,
      en: f.english_name || null,
      kcal: num(f.food_energy),
      protein: num(f.protein),
      carbs: num(f.carbohydrates),
      fat: num(f.total_fat),
      fiber: num(f.total_dietary_fiber),
      sugars: num(f.total_sugars),
      sodium: num(f.sodium),
      satFat: num(f.saturated_fat),
      portions: (portions.get(String(f.Code)) ?? []).slice(0, 8),
    }));

  fs.writeFileSync(path.join(OUT, 'foods.json'), JSON.stringify(slim));
  log(`foods: ${slim.length}`);
}

/* ------------------------------------------------------------------ */

const meta = {
  builtAt: new Date().toISOString(),
  sources: [
    {
      name: 'Exercises dataset',
      url: 'https://github.com/hasaneyldrm/exercises-dataset',
      note: 'Structure MIT. Exercise media © Gym visual (gymvisual.com), redistributed with permission at reduced resolution. Personal use only — commercial reuse needs a separate licence from Gym visual.',
    },
    {
      name: 'מאגר התזונה הלאומי הישראלי — משרד הבריאות',
      url: 'https://data.gov.il/dataset/nutrition-database',
      note: 'Open licence, retrieved via the data.gov.il CKAN API.',
    },
  ],
};

await buildExercises();
await buildFoods();
fs.writeFileSync(path.join(OUT, 'sources.json'), JSON.stringify(meta, null, 2));
log('done →', path.relative(ROOT, OUT));
