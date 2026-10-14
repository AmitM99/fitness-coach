import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AreaChart, Area, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { Plus, Camera, ChevronRight, Ruler, Scale } from 'lucide-react';
import {
  db, uid, getSettings, type Exercise, type Measurement, type MeasurementKey, type Session,
  type SetLog, type WeightEntry,
} from '@/db/schema';
import {
  Screen, Card, SectionTitle, Empty, Sheet, Stat, HeNote, NumberPad, useToast, cn,
} from '@/components/ui';
import { RANGES, rangeStart, shortDate, todayKey, longDate, addDays, type RangeKey } from '@/lib/date';
import { formatVolume } from '@/lib/training';
import { TrainingCalendar, ActivitySummary } from './TrainingCalendar';
import MuscleVolume from './MuscleVolume';

const MEASUREMENTS: { key: MeasurementKey; label: string; he: string }[] = [
  { key: 'waist', label: 'Waist', he: 'מותניים' },
  { key: 'chest', label: 'Chest', he: 'חזה' },
  { key: 'hips', label: 'Hips', he: 'אגן' },
  { key: 'armL', label: 'Arm (L)', he: 'יד שמאל' },
  { key: 'armR', label: 'Arm (R)', he: 'יד ימין' },
  { key: 'thighL', label: 'Thigh (L)', he: 'ירך שמאל' },
  { key: 'thighR', label: 'Thigh (R)', he: 'ירך ימין' },
  { key: 'neck', label: 'Neck', he: 'צוואר' },
  { key: 'calf', label: 'Calf', he: 'תאום' },
];

export default function ProgressPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [range, setRange] = useState<RangeKey>('3M');
  const [weighIn, setWeighIn] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false);

  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), [], [] as WeightEntry[]);
  const measurements = useLiveQuery(() => db.measurements.toArray(), [], [] as Measurement[]);
  const sessions = useLiveQuery(
    () => db.sessions.where('status').equals('done').toArray(),
    [],
    [] as Session[]
  );
  const allSets = useLiveQuery(() => db.setLogs.toArray(), [], [] as SetLog[]);
  const settings = useLiveQuery(() => getSettings(), []);
  const photoCount = useLiveQuery(() => db.photos.count(), [], 0);
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [] as Exercise[]);
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const start = rangeStart(range);

  /**
   * Daily weight swings by a kilo on water alone, which makes a single reading a
   * bad thing to react to. The 7-day average is the line that actually shows
   * which way things are going, so it is drawn on top of the raw points.
   */
  const weightSeries = useMemo(() => {
    const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
    return sorted
      .map((w, i) => {
        const windowStart = addDays(w.date, -6);
        const window = sorted
          .slice(0, i + 1)
          .filter((x) => x.date >= windowStart);
        return {
          date: shortDate(w.date),
          raw: w.date,
          kg: w.kg,
          trend:
            window.length >= 2
              ? Math.round((window.reduce((n, x) => n + x.kg, 0) / window.length) * 10) / 10
              : null,
        };
      })
      .filter((p) => (start ? p.raw >= start : true));
  }, [weights, start]);

  const latest = weights.at(-1) ?? null;
  const first = weightSeries[0] ?? null;
  const delta = latest && first ? latest.kg - first.kg : null;

  /** Weekly training volume — the clearest single signal that training is progressing. */
  const volumeSeries = useMemo(() => {
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const byWeek = new Map<string, number>();
    for (const set of allSets) {
      const session = sessionById.get(set.sessionId);
      if (!session) continue;
      if (start && session.date < start) continue;
      const d = new Date(session.date);
      const dow = d.getDay();
      d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
      const key = d.toISOString().slice(0, 10);
      byWeek.set(key, (byWeek.get(key) ?? 0) + (set.weight ?? 0) * (set.reps ?? 0));
    }
    return [...byWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, volume]) => ({ week: shortDate(week), volume: Math.round(volume) }));
  }, [allSets, sessions, start]);

  const sessionsInRange = sessions.filter((s) => (start ? s.date >= start : true));

  async function logWeight(kg: number, note: string) {
    const today = todayKey();
    const existing = weights.find((w) => w.date === today);
    if (existing) {
      await db.weights.put({ ...existing, kg, note });
    } else {
      await db.weights.add({ id: uid(), date: today, kg, note });
    }
    toast('Weight logged');
    setWeighIn(false);
  }

  return (
    <Screen title="Results" subtitle="Everything stays on this device">
      <TrainingCalendar sessions={sessions} />

      <SectionTitle>Activity Summary</SectionTitle>
      <ActivitySummary sessions={sessions} />

      <SectionTitle>Sets per muscle</SectionTitle>
      <MuscleVolume sessions={sessions} sets={allSets} byId={byId} />

      <div className="rail pb-2 mt-8 mb-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            className={cn('chip', range === r.key ? 'chip-on' : 'chip-off')}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <SectionTitle
        action={
          <button
            className="text-sm font-medium text-accent-500 flex items-center gap-1"
            onClick={() => setWeighIn(true)}
          >
            <Plus size={13} />
            Log weight
          </button>
        }
      >
        Body weight
      </SectionTitle>

      <Card>
        {weights.length === 0 ? (
          <Empty
            icon={<Scale size={30} />}
            title="No weigh-ins yet"
            hint={
              <HeNote className="text-center">
                שקילה באותה שעה, אותם תנאים — עדיף בבוקר אחרי שירותים ולפני אוכל. המגמה חשובה, לא
                המספר של יום בודד.
              </HeNote>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <Stat label="current" value={latest ? latest.kg.toFixed(1) : '—'} unit="kg" tone="accent" />
              <Stat
                label={`change (${range})`}
                value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
                unit="kg"
                tone={delta !== null && settings?.goalWeightKg
                  ? (Math.abs((latest?.kg ?? 0) - settings.goalWeightKg) <
                     Math.abs((first?.kg ?? 0) - settings.goalWeightKg) ? 'good' : 'default')
                  : 'default'}
              />
              <Stat
                label="goal"
                value={settings?.goalWeightKg ? settings.goalWeightKg.toFixed(1) : '—'}
                unit={settings?.goalWeightKg ? 'kg' : undefined}
              />
            </div>

            <div style={{ height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#b5e655" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#b5e655" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#2c2c2e" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#8e8e93', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tick={{ fill: '#8e8e93', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={46}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1c1c1e', border: '1px solid #3a3a3c', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: '#a1a1a6' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="kg"
                    stroke="#b5e655"
                    strokeWidth={2.5}
                    fill="url(#wg)"
                    dot={{ r: 2.5, fill: '#b5e655' }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="trend"
                    name="7-day average"
                    stroke="#f5f5f7"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>

      <SectionTitle>Training volume</SectionTitle>
      <Card>
        {volumeSeries.length === 0 ? (
          <Empty
            title="No workouts logged in this range"
            hint={<HeNote className="text-center">נפח שבועי = משקל × חזרות. זה המדד שמראה אם העומס באמת עולה.</HeNote>}
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <Stat label="workouts" value={sessionsInRange.length} />
              <Stat
                label="total volume"
                value={formatVolume(volumeSeries.reduce((n, v) => n + v.volume, 0))}
                tone="accent"
              />
              <Stat
                label="per week"
                value={
                  volumeSeries.length
                    ? (sessionsInRange.length / volumeSeries.length).toFixed(1)
                    : '—'
                }
              />
            </div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#2c2c2e" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: '#8e8e93', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#8e8e93', fontSize: 10 }} tickLine={false} axisLine={false} width={46} />
                  <Tooltip
                    cursor={{ fill: '#ffffff08' }}
                    contentStyle={{ background: '#1c1c1e', border: '1px solid #3a3a3c', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: '#a1a1a6' }}
                  />
                  <Bar
                    dataKey="volume"
                    name="volume (kg)"
                    fill="#b5e655"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>

      <SectionTitle
        action={
          <button
            className="text-sm font-medium text-accent-500 flex items-center gap-1"
            onClick={() => setMeasureOpen(true)}
          >
            <Plus size={13} />
            Add
          </button>
        }
      >
        Measurements
      </SectionTitle>
      <Card className="p-0 overflow-hidden">
        {measurements.length === 0 ? (
          <div className="p-4">
            <Empty
              icon={<Ruler size={28} />}
              title="No measurements yet"
              hint={<HeNote className="text-center">היקפים מראים שינוי בהרכב גוף גם כשהמשקל תקוע.</HeNote>}
            />
          </div>
        ) : (
          <div className="divide-y divide-ink-850">
            {MEASUREMENTS.map((m) => {
              const rows = measurements
                .filter((x) => x.key === m.key)
                .sort((a, b) => a.date.localeCompare(b.date));
              if (rows.length === 0) return null;
              const last = rows.at(-1)!;
              const prev = rows.at(-2);
              const diff = prev ? last.cm - prev.cm : null;
              return (
                <div key={m.key} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{m.label}</div>
                    <div className="he text-[11px] text-ink-500">{m.he}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tnum">{last.cm} cm</div>
                    {diff !== null && diff !== 0 && (
                      <div className={cn('text-[11px] tnum', diff < 0 ? 'text-good' : 'text-ink-500')}>
                        {diff > 0 ? '+' : ''}
                        {diff.toFixed(1)} cm
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <SectionTitle>Progress photos</SectionTitle>
      <Card onClick={() => navigate('/progress/photos')}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ink-800 flex items-center justify-center text-accent-400">
            <Camera size={20} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">
              {photoCount > 0 ? `${photoCount} photos` : 'Add your first photo'}
            </div>
            <div className="he text-xs text-ink-500">השוואה בין תאריכים — נשמר רק במכשיר הזה</div>
          </div>
          <ChevronRight size={17} className="text-ink-600" />
        </div>
      </Card>

      <WeighInSheet
        open={weighIn}
        onClose={() => setWeighIn(false)}
        initial={latest?.kg ?? null}
        onSave={logWeight}
      />

      <MeasurementSheet
        open={measureOpen}
        onClose={() => setMeasureOpen(false)}
        existing={measurements}
        onSave={async (key, cm) => {
          const today = todayKey();
          const existing = measurements.find((m) => m.key === key && m.date === today);
          if (existing) await db.measurements.put({ ...existing, cm });
          else await db.measurements.add({ id: uid(), date: today, key, cm });
          toast('Measurement saved');
        }}
      />
    </Screen>
  );
}

function WeighInSheet({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: number | null;
  onSave: (kg: number, note: string) => void;
}) {
  const [kg, setKg] = useState<number | null>(initial);
  const [note, setNote] = useState('');

  return (
    <Sheet open={open} onClose={onClose} title={`Weigh-in — ${longDate(todayKey())}`}>
      <label className="label">Weight</label>
      <div className="mt-1.5">
        <NumberPad value={kg ?? initial} onChange={setKg} step={0.1} suffix="kg" autoFocus />
      </div>

      <label className="label mt-4 block">Note</label>
      <input
        className="field mt-1.5 he"
        placeholder="למשל: אחרי שבוע עמוס, ישנתי מעט"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <button
        className="btn-primary w-full mt-5"
        onClick={() => {
          const value = kg ?? initial;
          if (value) onSave(value, note);
        }}
        disabled={!(kg ?? initial)}
      >
        Save
      </button>
    </Sheet>
  );
}

function MeasurementSheet({
  open,
  onClose,
  existing,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  existing: Measurement[];
  onSave: (key: MeasurementKey, cm: number) => void;
}) {
  const [draft, setDraft] = useState<Partial<Record<MeasurementKey, number | null>>>({});

  const lastFor = (key: MeasurementKey) =>
    existing
      .filter((m) => m.key === key)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1)?.cm ?? null;

  return (
    <Sheet open={open} onClose={onClose} title={`Measurements — ${longDate(todayKey())}`}>
      <HeNote className="mb-4 text-xs text-ink-500">
        מדוד באותו מקום ובאותה שעה בכל פעם. סרט מדידה צמוד אבל בלי ללחוץ.
      </HeNote>

      <div className="space-y-3">
        {MEASUREMENTS.map((m) => (
          <div key={m.key} className="flex items-center gap-3">
            <div className="w-24 shrink-0">
              <div className="text-sm font-medium">{m.label}</div>
              <div className="he text-[11px] text-ink-500">{m.he}</div>
            </div>
            <div className="flex-1">
              <NumberPad
                value={draft[m.key] ?? lastFor(m.key)}
                onChange={(v) => setDraft((d) => ({ ...d, [m.key]: v }))}
                step={0.5}
                suffix="cm"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn-primary w-full mt-5"
        onClick={() => {
          for (const [key, value] of Object.entries(draft)) {
            if (value) onSave(key as MeasurementKey, value);
          }
          setDraft({});
          onClose();
        }}
      >
        Save measurements
      </button>
    </Sheet>
  );
}
