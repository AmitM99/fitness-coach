import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { db, uid, getSettings, type Food, type FoodLog } from '@/db/schema';
import { Screen, Card, SectionTitle, Empty, Sheet, Ring, HeNote, useToast } from '@/components/ui';
import { addDays, longDate, todayKey, relativeDay } from '@/lib/date';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', he: 'בוקר' },
  { key: 'lunch', label: 'Lunch', he: 'צהריים' },
  { key: 'dinner', label: 'Dinner', he: 'ערב' },
  { key: 'snack', label: 'Snack', he: 'ביניים' },
] as const;

type MealKey = (typeof MEALS)[number]['key'];

export default function NutritionPage() {
  const toast = useToast();
  const [date, setDate] = useState(todayKey());
  const [adding, setAdding] = useState<MealKey | null>(null);

  const settings = useLiveQuery(() => getSettings(), []);
  const logs = useLiveQuery(
    () => db.foodLogs.where('date').equals(date).toArray(),
    [date],
    [] as FoodLog[]
  );

  const totals = logs.reduce(
    (acc, f) => ({
      kcal: acc.kcal + f.kcal,
      protein: acc.protein + f.protein,
      carbs: acc.carbs + f.carbs,
      fat: acc.fat + f.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <Screen
      title="Nutrition"
      subtitle={relativeDay(date) ?? longDate(date)}
      action={
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDate((d) => addDays(d, -1))}
            className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-850"
            aria-label="Previous day"
          >
            <ChevronLeft size={19} />
          </button>
          <button
            onClick={() => setDate((d) => addDays(d, 1))}
            disabled={date >= todayKey()}
            className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-850 disabled:opacity-30"
            aria-label="Next day"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      }
    >
      <Card className="mb-4">
        <div className="flex items-center justify-around">
          <Ring value={totals.kcal} max={settings?.targetKcal ?? null} size={76} stroke={6}>
            <span className="text-base font-bold tnum">{Math.round(totals.kcal)}</span>
            <span className="text-[9px] text-ink-500">
              {settings?.targetKcal ? `/ ${settings.targetKcal}` : 'kcal'}
            </span>
          </Ring>
          <Macro label="Protein" he="חלבון" value={totals.protein} max={settings?.targetProtein ?? null} color="#3ecf8e" />
          <Macro label="Carbs" he="פחמימה" value={totals.carbs} max={settings?.targetCarbs ?? null} color="#5b9cf5" />
          <Macro label="Fat" he="שומן" value={totals.fat} max={settings?.targetFat ?? null} color="#f5a524" />
        </div>
        {!settings?.targetKcal && (
          <HeNote className="mt-3 pt-3 border-t border-ink-850 text-xs text-ink-500 text-center">
            לא הגדרת יעד יומי. אפשר להגדיר בהגדרות — או פשוט לתעד בלי יעד.
          </HeNote>
        )}
      </Card>

      {MEALS.map((meal) => {
        const rows = logs.filter((l) => l.meal === meal.key);
        const kcal = rows.reduce((n, r) => n + r.kcal, 0);
        return (
          <div key={meal.key}>
            <SectionTitle
              action={
                <button
                  className="text-xs text-accent-400 flex items-center gap-1"
                  onClick={() => setAdding(meal.key)}
                >
                  <Plus size={13} />
                  Add
                </button>
              }
            >
              {meal.label}
              <span className="he text-ink-500 font-normal mr-2"> {meal.he}</span>
              {kcal > 0 && <span className="text-ink-500 font-normal tnum"> · {Math.round(kcal)} kcal</span>}
            </SectionTitle>

            {rows.length === 0 ? (
              <Card className="py-3">
                <p className="text-xs text-ink-600 text-center">Nothing logged</p>
              </Card>
            ) : (
              <Card className="p-0 overflow-hidden">
                <div className="divide-y divide-ink-850">
                  {rows.map((r) => (
                    <div key={r.id} className="px-3.5 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="he text-sm truncate">{r.name}</div>
                        <div className="text-[11px] text-ink-500 tnum">
                          {r.grams}g · {Math.round(r.protein)}p / {Math.round(r.carbs)}c / {Math.round(r.fat)}f
                        </div>
                      </div>
                      <div className="font-semibold tnum text-sm">{Math.round(r.kcal)}</div>
                      <button
                        onClick={() => db.foodLogs.delete(r.id)}
                        className="p-1 text-ink-600 hover:text-bad"
                        aria-label="Remove"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        );
      })}

      <p className="text-[11px] text-ink-600 text-center mt-6 leading-relaxed">
        Nutrition values from מאגר התזונה הלאומי הישראלי, משרד הבריאות (data.gov.il).
        <br />
        Nothing is estimated — if a value is missing upstream it stays blank.
      </p>

      <AddFoodSheet
        meal={adding}
        date={date}
        onClose={() => setAdding(null)}
        onAdded={() => toast('Logged')}
      />
    </Screen>
  );
}

function Macro({
  label,
  he,
  value,
  max,
  color,
}: {
  label: string;
  he: string;
  value: number;
  max: number | null;
  color: string;
}) {
  return (
    <div className="text-center">
      <Ring value={value} max={max} size={56} stroke={4} color={color}>
        <span className="text-xs font-bold tnum">{Math.round(value)}</span>
      </Ring>
      <div className="text-[10px] text-ink-500 mt-1">{label}</div>
      <div className="he text-[9px] text-ink-600">{he}</div>
    </div>
  );
}

function AddFoodSheet({
  meal,
  date,
  onClose,
  onAdded,
}: {
  meal: MealKey | null;
  date: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState(100);

  // The sheet stays mounted between openings, so without this it would reopen
  // on whatever food was half-selected last time.
  useEffect(() => {
    setQuery('');
    setPicked(null);
    setGrams(100);
  }, [meal]);

  const foods = useLiveQuery(() => db.foods.toArray(), [], [] as Food[]);

  const results = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    const lower = q.toLowerCase();
    return foods
      .filter((f) => f.he.includes(q) || f.en?.toLowerCase().includes(lower))
      .slice(0, 50);
  }, [foods, query]);

  const scale = grams / 100;

  async function add() {
    if (!picked || !meal) return;
    await db.foodLogs.add({
      id: uid(),
      date,
      meal,
      foodId: picked.id,
      name: picked.he,
      grams,
      kcal: (picked.kcal ?? 0) * scale,
      protein: (picked.protein ?? 0) * scale,
      carbs: (picked.carbs ?? 0) * scale,
      fat: (picked.fat ?? 0) * scale,
    });
    onAdded();
    setPicked(null);
    setQuery('');
    setGrams(100);
    onClose();
  }

  return (
    <Sheet open={meal !== null} onClose={onClose} title="Add food">
      {picked ? (
        <>
          <div className="he text-lg font-semibold mb-1">{picked.he}</div>
          {picked.en && <div className="text-xs text-ink-500 mb-4">{picked.en}</div>}

          <label className="label">Amount</label>
          <div className="flex gap-2 mt-1.5 mb-3">
            <input
              type="number"
              inputMode="numeric"
              className="field text-center tnum font-semibold"
              value={grams}
              onChange={(e) => setGrams(Math.max(0, Number(e.target.value)))}
            />
            <span className="self-center text-sm text-ink-400">grams</span>
          </div>

          {picked.portions.length > 0 && (
            <div className="rail pb-2 mb-4">
              {picked.portions.map((p, i) => (
                <button key={i} className="chip chip-off text-xs" onClick={() => setGrams(p.grams)}>
                  <span className="he">{p.label}</span>
                  <span className="tnum text-ink-500"> {p.grams}g</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 mb-5">
            {[
              ['kcal', picked.kcal],
              ['protein', picked.protein],
              ['carbs', picked.carbs],
              ['fat', picked.fat],
            ].map(([label, per100]) => (
              <div key={label as string} className="card p-2.5 text-center">
                <div className="font-bold tnum">
                  {per100 === null ? '—' : Math.round((per100 as number) * scale)}
                </div>
                <div className="text-[10px] text-ink-500">{label as string}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setPicked(null)}>
              Back
            </button>
            <button className="btn-primary flex-1" onClick={add}>
              Add
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="relative mb-3">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              className="field pl-9 he"
              placeholder="חפש מזון… (לפחות 2 תווים)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          {query.trim().length < 2 ? (
            <HeNote className="text-center text-sm text-ink-500 py-8">
              חיפוש מתוך 4,624 פריטים ממאגר משרד הבריאות. אפשר בעברית או באנגלית.
            </HeNote>
          ) : results.length === 0 ? (
            <Empty title="No matches" hint="Try a shorter or more general word." />
          ) : (
            <div className="space-y-0.5">
              {results.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPicked(f)}
                  className="w-full text-right p-2.5 rounded-xl hover:bg-ink-850"
                >
                  <div className="he text-sm truncate">{f.he}</div>
                  <div className="text-[11px] text-ink-500 tnum text-left">
                    {f.kcal === null ? 'no data' : `${Math.round(f.kcal)} kcal`} / 100g
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
