import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { db, type Session, type SetLog } from '@/db/schema';
import { Screen, Card, SectionTitle, Empty, Stat, HeNote } from '@/components/ui';
import { shortDate, longDate } from '@/lib/date';
import { exerciseHistory, personalRecords, formatVolume, formatWeight } from '@/lib/training';
import ExerciseThumb from './ExerciseThumb';

export default function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();

  const exercise = useLiveQuery(() => (id ? db.exercises.get(id) : undefined), [id]);
  const sets = useLiveQuery(
    () => (id ? db.setLogs.where('exerciseId').equals(id).toArray() : []),
    [id],
    [] as SetLog[]
  );
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [] as Session[]);

  const sessionsById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const history = useMemo(() => exerciseHistory(sets, sessionsById), [sets, sessionsById]);
  const prs = useMemo(() => personalRecords(sets, sessionsById), [sets, sessionsById]);

  if (!exercise) {
    return (
      <Screen title="Exercise" back>
        <Empty title="Exercise not found" />
      </Screen>
    );
  }

  const chartData = history.map((p) => ({
    date: shortDate(p.date),
    e1rm: p.topE1RM,
    volume: Math.round(p.volume),
    top: p.topWeight,
  }));

  return (
    <Screen title={exercise.name} subtitle={`${exercise.target} · ${exercise.equipment}`} back>
      <Card className="mb-4">
        <div className="flex gap-4">
          <ExerciseThumb exercise={exercise} size={110} animated />
          <div className="text-sm space-y-1.5 min-w-0">
            <Row label="Body part" en={exercise.bodyPart} he={exercise.bodyPartHe} />
            <Row label="Target" en={exercise.target} he={exercise.targetHe} />
            <Row label="Equipment" en={exercise.equipment} he={exercise.equipmentHe} />
            {exercise.secondary.length > 0 && (
              <div className="text-xs text-ink-400 capitalize pt-1">
                Also works: {exercise.secondary.join(', ')}
              </div>
            )}
          </div>
        </div>
      </Card>

      {exercise.cuesHe && (
        <Card className="mb-4 border-accent-500/25 bg-accent-500/[0.06]">
          <div className="label text-accent-500 mb-2">דגשי ביצוע</div>
          <ul className="he space-y-2">
            {exercise.cuesHe.map((c, i) => (
              <li key={i} className="text-sm text-ink-200 leading-relaxed">
                • {c}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {history.length > 0 && (
        <>
          <SectionTitle>Your records</SectionTitle>
          <Card>
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label="best set"
                value={prs.bestWeight ? formatWeight(prs.bestWeight.value) : '—'}
                unit={prs.bestWeight ? 'kg' : undefined}
                tone="accent"
              />
              <Stat
                label="est. 1RM"
                value={prs.bestE1RM ? formatWeight(prs.bestE1RM.value) : '—'}
                unit={prs.bestE1RM ? 'kg' : undefined}
              />
              <Stat
                label="best volume"
                value={prs.bestVolume ? formatVolume(prs.bestVolume.value) : '—'}
              />
            </div>
            <HeNote className="mt-3 pt-3 border-t border-ink-850 text-xs text-ink-500">
              ה‑1RM המשוער מחושב בנוסחת אפלי — הוא אומדן, לא מדידה. מעל 15 חזרות הוא מפסיק להיות
              אמין ולכן לא מוצג.
            </HeNote>
          </Card>

          <SectionTitle>Progression</SectionTitle>
          <Card>
            <div className="text-xs text-ink-500 mb-2">Estimated 1RM over time</div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#2c2c2e" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#8e8e93', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#8e8e93', fontSize: 10 }} tickLine={false} axisLine={false} width={46} />
                  <Tooltip
                    contentStyle={{
                      background: '#1c1c1e',
                      border: '1px solid #3a3a3c',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#a1a1a6' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="e1rm"
                    name="est. 1RM (kg)"
                    stroke="#b5e655"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#b5e655' }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <SectionTitle>History</SectionTitle>
          <div className="space-y-2">
            {[...history].reverse().map((p) => (
              <Card key={p.sessionId}>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{longDate(p.date)}</div>
                    <div className="text-xs text-ink-500 tnum">
                      {p.sets} sets · {p.totalReps} reps · {formatVolume(p.volume)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tnum text-accent-400">{formatWeight(p.topWeight)} kg</div>
                    {p.topE1RM && (
                      <div className="text-[11px] text-ink-500 tnum">est. 1RM {p.topE1RM}</div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {history.length === 0 && (
        <Card className="mb-4">
          <Empty
            title="No history yet"
            hint={
              <HeNote className="text-center">
                ברגע שתתעד את התרגיל הזה באימון, כאן יופיעו הגרפים, השיאים וההתקדמות לאורך זמן.
              </HeNote>
            }
          />
        </Card>
      )}

      <SectionTitle>How to perform</SectionTitle>
      <Card>
        <ol className="space-y-2.5">
          {exercise.steps.map((s, i) => (
            <li key={i} className="text-sm text-ink-300 leading-relaxed flex gap-2.5">
              <span className="text-accent-500 font-bold tnum shrink-0">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ol>
        <p className="text-[11px] text-ink-600 mt-4 pt-3 border-t border-ink-850">
          Exercise data & media © Gym visual — gymvisual.com
        </p>
      </Card>
    </Screen>
  );
}

function Row({ label, en, he }: { label: string; en: string; he: string }) {
  return (
    <div>
      <div>
        <span className="text-ink-500">{label}: </span>
        <span className="capitalize">{en}</span>
      </div>
      {/* Own line with an explicit direction — mixing Hebrew into the English
          line leaves the punctuation stranded on the wrong side. */}
      {he !== en && (
        <div dir="rtl" className="text-ink-400 text-xs">
          {he}
        </div>
      )}
    </div>
  );
}
