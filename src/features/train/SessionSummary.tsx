import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, Trophy } from 'lucide-react';
import { db, type Exercise, type Session, type SetLog } from '@/db/schema';
import { Screen, Card, Empty, Stat, HeNote, useToast } from '@/components/ui';
import { formatDuration, longDate, relativeDay } from '@/lib/date';
import { estimate1RM, formatVolume, formatWeight, sessionRecords } from '@/lib/training';
import ExerciseThumb from '@/features/exercises/ExerciseThumb';
import { discardSession } from './sessions';

const FEELING_LABEL: Record<number, string> = {
  1: 'Rough', 2: 'Meh', 3: 'OK', 4: 'Good', 5: 'Great',
};

export default function SessionSummary() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const session = useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [id]);
  const sets = useLiveQuery(
    () => (id ? db.setLogs.where('sessionId').equals(id).toArray() : []),
    [id],
    [] as SetLog[]
  );
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [] as Exercise[]);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  // Earlier performances of the exercises in this workout, for record checks.
  const history = useLiveQuery(async () => {
    const exIds = [...new Set(sets.map((s) => s.exerciseId))];
    if (exIds.length === 0) return { rows: [] as SetLog[], sessions: [] as Session[] };
    const rows = await db.setLogs.where('exerciseId').anyOf(exIds).toArray();
    const sessions = await db.sessions.where('status').equals('done').toArray();
    return { rows, sessions };
  }, [sets.length]);

  const records = useMemo(() => {
    if (!session || !history) return [];
    return sessionRecords(session, sets, history.rows, new Map(history.sessions.map((s) => [s.id, s])));
  }, [session, sets, history]);

  const grouped = useMemo(() => {
    const map = new Map<string, SetLog[]>();
    for (const s of sets) {
      if (!map.has(s.exerciseId)) map.set(s.exerciseId, []);
      map.get(s.exerciseId)!.push(s);
    }
    return [...map.entries()].map(([exId, rows]) => ({
      exercise: byId.get(exId),
      rows: rows.sort((a, b) => a.setIndex - b.setIndex),
    }));
  }, [sets, byId]);

  if (!session) {
    return (
      <Screen title="Workout" back>
        <Empty title="Workout not found" />
      </Screen>
    );
  }

  const volume = sets.reduce((n, s) => n + (s.weight ?? 0) * (s.reps ?? 0), 0);
  const duration =
    session.finishedAt && session.startedAt
      ? new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()
      : 0;
  const totalReps = sets.reduce((n, s) => n + (s.reps ?? 0), 0);

  return (
    <Screen
      title={session.name}
      subtitle={`${relativeDay(session.date) ?? longDate(session.date)}`}
      back
      action={
        <button
          onClick={async () => {
            await discardSession(session.id);
            toast('Workout deleted');
            navigate('/train', { replace: true });
          }}
          className="icon-btn text-ink-400 hover:text-bad"
          aria-label="Delete workout"
        >
          <Trash2 size={19} />
        </button>
      }
    >
      {records.length > 0 && (
        <div className="rounded-3xl bg-accent-500 text-ink-950 p-4 mb-4 animate-pop">
          <div className="flex items-center gap-2">
            <Trophy size={22} fill="currentColor" />
            <div className="text-xl font-bold tracking-tight flex-1">
              {records.length === 1 ? 'New personal record' : `${records.length} new personal records`}
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {records.map((r) => (
              <div key={r.exerciseId} className="flex items-baseline gap-2">
                <span className="flex-1 min-w-0 truncate capitalize font-medium">
                  {byId.get(r.exerciseId)?.name ?? 'Exercise'}
                </span>
                <span className="tnum font-bold">
                  {formatWeight(r.weight)} kg × {r.reps}
                </span>
                <span className="tnum text-xs opacity-70 w-[86px] text-right">
                  {r.kind === 'weight'
                    ? `was ${formatWeight(r.previous)} kg`
                    : `e1RM ${formatWeight(r.previous)}→${formatWeight(r.value)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Card className="mb-4">
        <div className="grid grid-cols-4 gap-2">
          <Stat label="sets" value={sets.length} />
          <Stat label="reps" value={totalReps} />
          <Stat label="volume" value={formatVolume(volume)} tone="accent" />
          <Stat label="time" value={duration > 0 ? formatDuration(duration) : '—'} />
        </div>
        {session.feeling && (
          <div className="mt-3 pt-3 border-t border-ink-850 text-sm text-center text-ink-300">
            Felt: <span className="font-semibold text-accent-400">{FEELING_LABEL[session.feeling]}</span>
          </div>
        )}
        {session.notes && (
          <div className="mt-3 pt-3 border-t border-ink-850">
            <HeNote>{session.notes}</HeNote>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {grouped.map(({ exercise, rows }) => {
          const best = rows
            .map((r) => estimate1RM(r.weight, r.reps))
            .filter((v): v is number => v !== null);

          return (
            <Card key={exercise?.id ?? Math.random()} className="p-0 overflow-hidden">
              <div className="p-3 flex items-center gap-3 border-b border-ink-850">
                {exercise && <ExerciseThumb exercise={exercise} size={40} />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium capitalize truncate text-sm">
                    {exercise?.name ?? 'Exercise'}
                  </div>
                  <div className="text-xs text-ink-500 tnum">
                    {rows.length} sets
                    {best.length > 0 && <> · est. 1RM {Math.max(...best)}kg</>}
                  </div>
                </div>
              </div>
              <div className="divide-y divide-ink-850/60">
                {rows.map((r, i) => (
                  <div key={r.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                    <span className="w-6 text-xs text-ink-500 tnum">
                      {r.isWarmup ? 'W' : i + 1}
                    </span>
                    <span className="tnum font-semibold">{formatWeight(r.weight)} kg</span>
                    <span className="text-ink-500">×</span>
                    <span className="tnum font-semibold">{r.reps ?? '—'}</span>
                    {r.weight && r.reps && (
                      <span className="ml-auto text-xs text-ink-500 tnum">
                        {Math.round(r.weight * r.reps)} kg
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {grouped.length === 0 && <Empty title="No sets were logged in this workout" />}
    </Screen>
  );
}
