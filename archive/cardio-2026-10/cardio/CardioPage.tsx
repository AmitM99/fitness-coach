import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Upload, Footprints, Trash2, AlertTriangle, TrendingUp, CheckCircle2, Bike, Waves, Dumbbell, Moon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { db, type CardioSession, type RecoveryDay } from '@/db/schema';
import {
  Screen, Card, SectionTitle, Empty, Sheet, Stat, HeNote, Confirm, useToast, cn,
} from '@/components/ui';
import { shortDate, longDate, weekStart, todayKey, addDays, relativeDay } from '@/lib/date';
import { parseGarminCsv, type ParseResult } from '@/lib/garmin';
import { importCardio, formatPace, formatDistance, formatCardioDuration } from '@/lib/cardio';

const TYPE_ICON: Record<string, typeof Footprints> = {
  running: Footprints,
  walking: Footprints,
  cycling: Bike,
  swimming: Waves,
  strength: Dumbbell,
};

const TYPE_LABEL: Record<string, string> = {
  running: 'Run',
  walking: 'Walk',
  cycling: 'Ride',
  swimming: 'Swim',
  strength: 'Strength',
};

export default function CardioPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const sessions = useLiveQuery(
    () => db.cardio.orderBy('date').reverse().toArray(),
    [],
    [] as CardioSession[]
  );

  const nights = useLiveQuery(
    () => db.recovery.orderBy('date').reverse().limit(14).toArray(),
    [],
    [] as RecoveryDay[]
  );

  const [preview, setPreview] = useState<ParseResult | null>(null);
  /**
   * The watch also records gym sessions, but those are logged here set by set.
   * Importing both would double-count them in the weekly summary, so they are
   * dropped unless asked for.
   */
  const [skipStrength, setSkipStrength] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CardioSession | null>(null);

  const runs = useMemo(() => sessions.filter((s) => s.type === 'running'), [sessions]);

  /** Weekly running load — the number that decides whether a ramp is safe. */
  const weekly = useMemo(() => {
    const byWeek = new Map<string, { km: number; sec: number; count: number }>();
    for (const r of runs) {
      const wk = weekStart(r.date);
      const cur = byWeek.get(wk) ?? { km: 0, sec: 0, count: 0 };
      cur.km += r.distanceKm ?? 0;
      cur.sec += r.durationSec ?? 0;
      cur.count += 1;
      byWeek.set(wk, cur);
    }
    return [...byWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([wk, v]) => ({
        week: shortDate(wk),
        weekKey: wk,
        km: Math.round(v.km * 10) / 10,
        runs: v.count,
        minutes: Math.round(v.sec / 60),
      }));
  }, [runs]);

  const thisWeek = weekly.find((w) => w.weekKey === weekStart(todayKey()));
  const lastWeek = weekly.find((w) => w.weekKey === addDays(weekStart(todayKey()), -7));

  /** A jump far above ~10% a week is the classic way new runners get hurt. */
  const rampWarning =
    thisWeek && lastWeek && lastWeek.km > 0 && thisWeek.km > lastWeek.km * 1.35
      ? Math.round(((thisWeek.km - lastWeek.km) / lastWeek.km) * 100)
      : null;

  const totals = useMemo(() => {
    const km = runs.reduce((n, r) => n + (r.distanceKm ?? 0), 0);
    const sec = runs.reduce((n, r) => n + (r.durationSec ?? 0), 0);
    const paced = runs.filter((r) => r.paceSecPerKm);
    const avgPace = paced.length
      ? Math.round(paced.reduce((n, r) => n + (r.paceSecPerKm ?? 0), 0) / paced.length)
      : null;
    return { km, sec, avgPace, count: runs.length };
  }, [runs]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const result = parseGarminCsv(await file.text());
      if (result.rows.length === 0) {
        toast('No activities found in that file', 'bad');
      } else {
        setPreview(result);
      }
    } catch {
      toast('Could not read that file', 'bad');
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  const rowsToImport = useMemo(
    () => (preview ? preview.rows.filter((r) => !skipStrength || r.type !== 'strength') : []),
    [preview, skipStrength]
  );

  async function confirmImport() {
    if (!preview) return;
    setBusy(true);
    try {
      const { added, updated } = await importCardio(rowsToImport);
      toast(`${added} added, ${updated} updated`);
      setPreview(null);
    } catch (err) {
      toast((err as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Cardio"
      subtitle={totals.count ? `${totals.count} runs logged` : 'Import from your watch'}
      action={
        <button
          onClick={() => fileRef.current?.click()}
          className="p-2 rounded-lg text-flame-400 hover:bg-ink-850"
          aria-label="Import activities"
        >
          <Upload size={20} />
        </button>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {sessions.length === 0 ? (
        <Card>
          <Empty
            icon={<Footprints size={32} />}
            title="No activities yet"
            hint={
              <HeNote className="text-center">
                מייצאים מ‑Garmin Connect ומייבאים לכאן. ההסבר המלא למטה.
              </HeNote>
            }
          />
          <button className="btn-primary w-full" onClick={() => fileRef.current?.click()}>
            <Upload size={17} />
            Import Garmin CSV
          </button>
        </Card>
      ) : (
        <>
          <Card className="mb-4">
            <div className="grid grid-cols-4 gap-2">
              <Stat label="runs" value={totals.count} />
              <Stat label="distance" value={Math.round(totals.km)} unit="km" tone="accent" />
              <Stat label="time" value={Math.round(totals.sec / 3600)} unit="h" />
              <Stat label="avg pace" value={formatPace(totals.avgPace).replace('/km', '')} />
            </div>
          </Card>

          {rampWarning && (
            <Card className="mb-4 border-warn/40 bg-warn/[0.08]">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-warn mt-0.5 shrink-0" />
                <HeNote className="text-xs leading-relaxed">
                  <strong>קפיצה של {rampWarning}% בנפח הריצה השבוע.</strong> העלאה חדה היא
                  הדרך הנפוצה ביותר להיפצע בתחילת ריצה — שין ספלינטס, ברכיים, אכילס.
                  הכלל המקובל הוא עד כ‑10% בשבוע.
                </HeNote>
              </div>
            </Card>
          )}

          {weekly.length > 1 && (
            <>
              <SectionTitle>Weekly running volume</SectionTitle>
              <Card>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekly} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke="#282d36" vertical={false} />
                      <XAxis dataKey="week" tick={{ fill: '#5b6472', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#5b6472', fontSize: 10 }} tickLine={false} axisLine={false} width={34} />
                      <Tooltip
                        cursor={{ fill: '#ffffff08' }}
                        contentStyle={{ background: '#1d2127', border: '1px solid #3a414d', borderRadius: 12, fontSize: 12 }}
                        labelStyle={{ color: '#8b939f' }}
                      />
                      <Bar dataKey="km" name="km" fill="#f5b325" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}

          <SectionTitle>Activities</SectionTitle>
          <div className="space-y-2">
            {sessions.slice(0, 40).map((s) => (
              <Card key={s.id}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-ink-800 flex items-center justify-center text-flame-400 shrink-0">
                    {(() => {
                      const Icon = TYPE_ICON[s.type] ?? Footprints;
                      return <Icon size={17} />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {TYPE_LABEL[s.type] ?? s.type} · {relativeDay(s.date) ?? longDate(s.date)}
                    </div>
                    <div className="text-xs text-ink-500 tnum">
                      {formatDistance(s.distanceKm)} · {formatCardioDuration(s.durationSec)}
                      {s.paceSecPerKm ? ` · ${formatPace(s.paceSecPerKm)}` : ''}
                      {s.avgHr ? ` · ${Math.round(s.avgHr)} bpm` : ''}
                    </div>
                    {s.notes && <HeNote className="text-[11px] text-ink-500 mt-1">{s.notes}</HeNote>}
                  </div>
                  <button
                    onClick={() => setPendingDelete(s)}
                    className="p-1.5 rounded-lg text-ink-600 hover:text-bad shrink-0"
                    aria-label="Delete activity"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {nights.length > 0 && (
        <>
          <SectionTitle>Sleep &amp; recovery</SectionTitle>
          {!nights[0].hrvStatus && nights.some((n) => n.hrvMs !== null) && (
            <HeNote className="text-[11px] text-ink-500 mb-2">
              ל‑HRV עדיין אין בסיס — Garmin צריך כ‑3 שבועות של ענידה בלילה. עד אז המספרים
              לא אומרים אם הוא גבוה או נמוך.
            </HeNote>
          )}
          <div className="space-y-2">
            {nights.map((n) => (
              <Card key={n.id}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-ink-800 flex items-center justify-center text-flame-400 shrink-0">
                    <Moon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {relativeDay(n.date) ?? longDate(n.date)}
                      {n.sleepScore !== null && (
                        <span className={cn('ml-2 tnum', n.sleepScore < 60 ? 'text-bad' : 'text-ink-400')}>
                          score {n.sleepScore}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-500 tnum">
                      {[
                        n.sleepHours !== null ? `${n.sleepHours.toFixed(1)} h` : null,
                        n.hrvMs !== null ? `HRV ${n.hrvMs}` : null,
                        n.restingHr !== null ? `RHR ${n.restingHr}` : null,
                      ].filter(Boolean).join(' · ')}
                    </div>
                    {n.notes && <HeNote className="text-[11px] text-ink-500 mt-1">{n.notes}</HeNote>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle>How to export from Garmin</SectionTitle>
      <Card>
        <HeNote className="text-xs leading-relaxed">
          <p className="mb-2">
            <strong>אין סנכרון אוטומטי, וזו החלטה.</strong> ה‑API של Garmin פתוח לחברות
            בלבד — הוא דוחה יחידים — והוא היה מחייב שרת שמחזיק את נתוני הבריאות שלך.
          </p>
          <p><strong>פעם בשבוע, דקה:</strong></p>
        </HeNote>
        <div className="mt-2 space-y-1.5 text-xs text-ink-400 he">
          <div>1. במחשב, היכנס ל‑<span dir="ltr" className="text-ink-200">connect.garmin.com</span></div>
          <div>2. בתפריט: <span dir="ltr" className="text-ink-200">Activities</span></div>
          <div>3. גלול למטה עד שכל הריצות שאתה רוצה נטענו ברשימה</div>
          <div>4. למעלה מימין: <span dir="ltr" className="text-ink-200">Export CSV</span></div>
          <div>5. AirDrop לטלפון, ואז כפתור הייבוא למעלה</div>
        </div>
        <HeNote className="text-[11px] text-ink-500 mt-3 pt-3 border-t border-ink-850">
          Garmin מייצא רק את השורות שנטענו על המסך, אז כדאי לגלול. ייבוא חוזר של אותן
          פעילויות לא ייצור כפילויות — הן יתעדכנו במקום.
        </HeNote>
      </Card>

      <Sheet open={preview !== null} onClose={() => setPreview(null)} title="Check before importing">
        {preview && (
          <>
            <div className="flex items-center gap-2 mb-3 text-sm">
              <CheckCircle2 size={16} className="text-good" />
              <span>
                <strong className="tnum">{rowsToImport.length}</strong> activities to import
                {preview.skipped > 0 && (
                  <span className="text-ink-500"> · {preview.skipped} rows skipped</span>
                )}
              </span>
            </div>

            <HeNote className="text-xs text-ink-400 mb-3">
              Garmin לא מתעד את שמות העמודות והן משתנות בין חשבונות, אז שווה לוודא
              שהזיהוי נכון לפני הייבוא.
            </HeNote>

            <div className="card p-3 mb-3">
              <div className="label mb-2">Detected columns</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {(['date', 'type', 'distance', 'duration', 'avgHr', 'calories'] as const).map((f) => {
                  const idx = preview.columns[f];
                  return (
                    <div key={f} className="flex justify-between gap-2">
                      <span className="text-ink-500">{f}</span>
                      <span className={cn('truncate', idx === undefined ? 'text-bad' : 'text-ink-200')}>
                        {idx === undefined ? 'not found' : preview.headers[idx]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {preview.rows.some((r) => r.type === 'strength') && (
              <label className="flex items-center gap-3 p-2.5 rounded-xl bg-ink-850 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={skipStrength}
                  onChange={(e) => setSkipStrength(e.target.checked)}
                  className="w-4 h-4 accent-flame-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">Skip strength activities</div>
                  <div className="he text-[11px] text-ink-500">
                    אימוני הכוח מתועדים כאן סט-סט — ייבוא שלהם גם מהשעון היה סופר אותם פעמיים
                  </div>
                </div>
              </label>
            )}

            <div className="label mb-1.5">First few activities</div>
            <div className="space-y-1 mb-4">
              {rowsToImport.slice(0, 4).map((r, i) => (
                <div key={i} className="text-xs text-ink-300 tnum flex justify-between gap-2 py-1 border-b border-ink-850 last:border-0">
                  <span>{r.date} · {r.type}</span>
                  <span className="text-ink-400">
                    {formatDistance(r.distanceKm)} · {formatCardioDuration(r.durationSec)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setPreview(null)}>
                Cancel
              </button>
              <button
                className="btn-primary flex-1"
                onClick={confirmImport}
                disabled={busy || rowsToImport.length === 0}
              >
                <TrendingUp size={16} />
                Import
              </button>
            </div>
          </>
        )}
      </Sheet>

      <Confirm
        open={!!pendingDelete}
        title="Delete this activity?"
        body="It will be removed from this device. Re-importing the CSV brings it back."
        onConfirm={async () => {
          if (pendingDelete) {
            await db.cardio.delete(pendingDelete.id);
            toast('Activity deleted');
          }
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}
