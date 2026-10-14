import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Check, Plus, Trash2, Info, ChevronDown, ChevronUp, Flag, Trophy, Repeat2, StickyNote,
} from 'lucide-react';
import { db, type Exercise, type ExerciseNote, type PlanItem, type SetLog } from '@/db/schema';
import { Sheet, HeNote, Confirm, useToast, cn } from '@/components/ui';
import { formatDuration } from '@/lib/date';
import { formatWeight, formatVolume } from '@/lib/training';
import ExercisePicker from '@/features/exercises/ExercisePicker';
import ExerciseThumb from '@/features/exercises/ExerciseThumb';
import RestTimer from './RestTimer';
import { loadRest, saveRest, type RestState } from './restStore';
import { getSettings } from '@/db/schema';
import { unlockAudio } from '@/lib/sound';
import {
  addExerciseToSession, addSetRow, discardSession, finishSession, removeExerciseFromSession,
  setExerciseNote,
} from './sessions';
import SwapSheet from './SwapSheet';

export default function SessionPlayer() {
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
  const settings = useLiveQuery(() => getSettings(), []);
  const program = useLiveQuery(
    () => (session?.programId ? db.programs.get(session.programId) : undefined),
    [session?.programId]
  );

  // Prior performance for every exercise in this session, for the "last time"
  // column that makes progressive overload obvious.
  const priorSets = useLiveQuery(async () => {
    if (!id) return new Map<string, SetLog[]>();
    const exIds = [...new Set(sets.map((s) => s.exerciseId))];
    const out = new Map<string, SetLog[]>();
    const allSessions = await db.sessions.where('status').equals('done').toArray();
    const dateById = new Map(allSessions.map((s) => [s.id, s.date]));

    for (const exId of exIds) {
      const rows = (await db.setLogs.where('exerciseId').equals(exId).toArray())
        .filter((r) => r.sessionId !== id && r.done && dateById.has(r.sessionId));
      if (!rows.length) continue;
      let bestId = '';
      let bestDate = '';
      for (const r of rows) {
        const d = dateById.get(r.sessionId)!;
        if (d > bestDate) { bestDate = d; bestId = r.sessionId; }
      }
      out.set(exId, rows.filter((r) => r.sessionId === bestId).sort((a, b) => a.setIndex - b.setIndex));
    }
    return out;
  }, [id, sets.length], new Map<string, SetLog[]>());

  // Restored on mount, so leaving the player (or iOS reloading the app) keeps it.
  const [rest, setRestState] = useState<RestState | null>(() => (id ? loadRest(id) : null));
  const setRest = (next: RestState | null) => {
    setRestState(next);
    saveRest(next);
  };
  const [picker, setPicker] = useState(false);
  const [swapping, setSwapping] = useState<{ exercise: Exercise; planItem: PlanItem | null } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [elapsed, setElapsed] = useState(0);
  const [infoFor, setInfoFor] = useState<Exercise | null>(null);
  const [notingExercise, setNotingExercise] = useState<Exercise | null>(null);

  const notes = useLiveQuery(
    () => (id ? db.exerciseNotes.where('sessionId').equals(id).toArray() : []),
    [id],
    [] as ExerciseNote[]
  );
  const noteFor = (exId: string) => notes.find((n) => n.exerciseId === exId)?.text ?? '';

  useEffect(() => {
    if (!session) return;
    const start = new Date(session.startedAt).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session?.startedAt]);

  // Keep the phone awake for the whole workout — a dimmed, locked screen
  // between sets is the most common annoyance in a gym. Browsers drop the
  // lock whenever the tab is hidden, so it is re-requested on return.
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState === 'visible' && !cancelled) {
          lock = await navigator.wakeLock.request('screen');
        }
      } catch {
        /* denied or unsupported (e.g. low battery) — the workout still works */
      }
    };
    void acquire();
    const onVisible = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const exercise = (id: string) => byId.get(id);

  const planItems = useMemo(() => {
    const day = program?.days.find((d) => d.id === session?.planDayId);
    return new Map<string, PlanItem>((day?.items ?? []).map((i) => [i.id, i]));
  }, [program, session?.planDayId]);

  // Preserve the plan's exercise order; anything added ad hoc goes to the end.
  const ordered = useMemo(() => {
    const groups = new Map<string, SetLog[]>();
    for (const s of sets) {
      if (!groups.has(s.exerciseId)) groups.set(s.exerciseId, []);
      groups.get(s.exerciseId)!.push(s);
    }
    const day = program?.days.find((d) => d.id === session?.planDayId);
    // Ordered by plan slot rather than exercise id, so a swapped-in exercise
    // keeps its place instead of dropping to the bottom.
    const planOrder = (day?.items ?? []).map((i) => i.id);
    return [...groups.entries()]
      .map(([exId, rows]) => ({
        exercise: byId.get(exId),
        exerciseId: exId,
        rows: rows.sort((a, b) => a.setIndex - b.setIndex),
      }))
      .sort((a, b) => {
        const ai = planOrder.indexOf(a.rows[0]?.planItemId ?? '');
        const bi = planOrder.indexOf(b.rows[0]?.planItemId ?? '');
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
  }, [sets, byId, program, session?.planDayId]);

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center text-ink-400">Loading workout…</div>
    );
  }

  const doneCount = sets.filter((s) => s.done).length;
  // The next set to do, in plan order — highlighted the way Skulpt does.
  const currentSetId = ordered.flatMap((o) => o.rows).find((r) => !r.done)?.id ?? null;
  const volume = sets.reduce((n, s) => n + (s.done ? (s.weight ?? 0) * (s.reps ?? 0) : 0), 0);

  async function toggleSet(row: SetLog) {
    const nextDone = !row.done;
    await db.setLogs.put({ ...row, done: nextDone });
    if (!nextDone || row.isWarmup) return;

    // iOS only allows audio to start from a gesture — this tap is that gesture.
    if (settings?.restSound) unlockAudio();
    if (settings?.restVibrate) navigator.vibrate?.(15);
    if (settings && !settings.autoRest) return;

    const planItem = row.planItemId ? planItems.get(row.planItemId) : null;

    // Was that the last set of this exercise? If so the next break is the
    // longer one you take walking to a different machine.
    const siblings = sets.filter((s) => s.exerciseId === row.exerciseId && !s.isWarmup);
    const stillToDo = siblings.filter((s) => s.id !== row.id && !s.done);

    if (stillToDo.length === 0) {
      const position = ordered.findIndex((o) => o.exerciseId === row.exerciseId);
      const upcoming = ordered.slice(position + 1).find((o) => o.rows.some((r) => !r.done));
      if (!upcoming) return; // workout is finished — no point starting a timer

      const seconds = settings?.exerciseRestSec ?? 150;
      if (seconds > 0) {
        setRest({
          sessionId: row.sessionId,
          endsAt: Date.now() + seconds * 1000,
          total: seconds,
          kind: 'exercise',
          label: upcoming.exercise?.name ?? 'next exercise',
        });
      }
      return;
    }

    const seconds = planItem?.restSec ?? settings?.defaultRestSec ?? 90;
    if (seconds > 0) {
      const doneCountForExercise = siblings.filter((s) => s.done || s.id === row.id).length;
      setRest({
        sessionId: row.sessionId,
        endsAt: Date.now() + seconds * 1000,
        total: seconds,
        kind: 'set',
        label: `Set ${doneCountForExercise + 1} of ${siblings.length} · ${
          exercise(row.exerciseId)?.name ?? ''
        }`,
      });
    }
  }

  async function patchSet(row: SetLog, patch: Partial<SetLog>) {
    await db.setLogs.put({ ...row, ...patch });
  }

  async function onFinish(notes: string, feeling: number | null) {
    await finishSession(session!.id, { notes, feeling });
    toast('Workout saved');
    navigate(`/session/${session!.id}/summary`, { replace: true });
  }

  return (
    <div className="min-h-full pb-32">
      <header
        className="sticky top-0 z-20 bg-ink-950/85 backdrop-blur-xl"
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <div className="px-4 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate('/today')}
            className="icon-btn"
            aria-label="Minimise workout"
            title="Keep the workout running and browse the app"
          >
            <ChevronDown size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-bold truncate leading-tight">{session.name}</div>
            <div className="text-xs text-ink-500 tnum mt-0.5">
              {formatDuration(elapsed)} · {doneCount}/{sets.length} sets
              {volume > 0 && <> · {formatVolume(volume)}</>}
            </div>
          </div>
          <button className="btn-primary py-2.5 px-4 text-sm" onClick={() => setFinishing(true)}>
            <Flag size={15} />
            Finish
          </button>
        </div>
        <div className="h-1 mx-4 rounded-full bg-ink-900 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent-500 transition-[width] duration-300"
            style={{ width: `${sets.length ? (doneCount / sets.length) * 100 : 0}%` }}
          />
        </div>
      </header>

      <main className="px-4 pt-4 space-y-3">
        {ordered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-ink-300 font-medium">Empty workout</p>
            <HeNote className="text-center mt-2 text-ink-500">
              הוסף תרגילים ותתחיל לתעד. כל סט נשמר מיד — אפשר לצאת ולחזור.
            </HeNote>
          </div>
        )}

        {ordered.map(({ exercise, exerciseId, rows }) => {
          const planItem = rows[0]?.planItemId ? planItems.get(rows[0].planItemId) : null;
          const prior = priorSets.get(exerciseId) ?? [];
          const isCollapsed = collapsed[exerciseId];
          const allDone = rows.every((r) => r.done);

          return (
            <div key={exerciseId} className="card overflow-hidden">
              <div className="p-3.5 flex items-center gap-3">
                {exercise && <ExerciseThumb exercise={exercise} size={44} />}
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => setCollapsed((c) => ({ ...c, [exerciseId]: !c[exerciseId] }))}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold capitalize line-clamp-2 leading-snug text-[15px]">
                      {exercise?.name ?? 'Exercise'}
                    </span>
                    {allDone && <Check size={15} strokeWidth={3} className="text-accent-500 shrink-0" />}
                  </div>
                  <div className="text-xs text-ink-500 tnum">
                    {planItem
                      ? `${planItem.targetSets} × ${planItem.targetReps} · ${planItem.restSec}s rest`
                      : `${rows.length} sets`}
                  </div>
                </button>
                {exercise && (
                  <button
                    onClick={() => setNotingExercise(exercise)}
                    className={cn(
                      'p-1.5 rounded-lg',
                      noteFor(exerciseId) ? 'text-accent-400' : 'text-ink-500 hover:text-accent-400'
                    )}
                    aria-label={noteFor(exerciseId) ? 'Edit note' : 'Add note'}
                  >
                    <StickyNote size={17} />
                  </button>
                )}
                {exercise && (
                  <button
                    onClick={() => setSwapping({ exercise, planItem: planItem ?? null })}
                    className="p-1.5 rounded-lg text-ink-500 hover:text-accent-400"
                    aria-label="Swap exercise"
                  >
                    <Repeat2 size={17} />
                  </button>
                )}
                {exercise && (
                  <button
                    onClick={() => setInfoFor(exercise)}
                    className="p-1.5 rounded-lg text-ink-500 hover:text-accent-400"
                    aria-label="Exercise info"
                  >
                    <Info size={17} />
                  </button>
                )}
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [exerciseId]: !c[exerciseId] }))}
                  className="p-1.5 rounded-lg text-ink-500"
                  aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
                </button>
              </div>

              {planItem?.notes && (
                <div className="px-3 py-2 bg-accent-500/[0.07] border-b border-ink-850">
                  <HeNote className="text-accent-400/90 text-xs">{planItem.notes}</HeNote>
                </div>
              )}

              {noteFor(exerciseId) && (
                <button
                  className="w-full px-3 py-2 bg-ink-850/60 border-b border-ink-850 text-left"
                  onClick={() => exercise && setNotingExercise(exercise)}
                >
                  <div className="label text-[10px] mb-0.5">Your note</div>
                  <HeNote className="text-xs">{noteFor(exerciseId)}</HeNote>
                </button>
              )}

              {!isCollapsed && (
                <>
                  <div className="px-3.5 pt-1 pb-1 grid grid-cols-[30px_56px_1fr_1fr_44px] gap-2 items-center">
                    <div className="label text-[10px]">Set</div>
                    <div className="label text-[10px] text-center">Prev</div>
                    <div className="label text-[10px] text-center">kg</div>
                    <div className="label text-[10px] text-center">Reps</div>
                    <div />
                  </div>

                  <div>
                    {rows.map((row, i) => (
                      <SetRow
                        key={row.id}
                        row={row}
                        index={i}
                        current={row.id === currentSetId}
                        prior={prior[i] ?? null}
                        onToggle={() => toggleSet(row)}
                        onPatch={(p) => patchSet(row, p)}
                        onDelete={() => db.setLogs.delete(row.id)}
                      />
                    ))}
                  </div>

                  <div className="flex border-t border-ink-800 mt-1">
                    <button
                      className="flex-1 py-3 text-sm font-semibold text-accent-500 hover:bg-ink-850 flex items-center justify-center gap-1.5"
                      onClick={() => addSetRow(session.id, exerciseId, rows[0]?.planItemId ?? null)}
                    >
                      <Plus size={14} />
                      Add set
                    </button>
                    <button
                      className="px-4 py-2.5 text-xs text-ink-500 hover:text-bad hover:bg-ink-850"
                      onClick={() => removeExerciseFromSession(session.id, exerciseId)}
                      aria-label="Remove exercise"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        <button className="btn-ghost w-full" onClick={() => setPicker(true)}>
          <Plus size={17} />
          Add exercise
        </button>
      </main>

      {rest && (
        <RestTimer
          rest={rest}
          onChange={setRest}
          vibrate={settings?.restVibrate ?? true}
          notifyOnDone={settings?.restNotify ?? true}
          sound={settings?.restSound ?? true}
          onDismiss={() => setRest(null)}
        />
      )}

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(ex) => addExerciseToSession(session.id, ex.id)}
      />

      <SwapSheet
        sessionId={session.id}
        exercise={swapping?.exercise ?? null}
        planItem={swapping?.planItem ?? null}
        byId={byId}
        onClose={() => setSwapping(null)}
        onSwapped={(ex, reason) =>
          toast(
            reason === 'dislike' && swapping?.planItem
              ? `Swapped to ${ex.name} — saved in the program`
              : `Swapped to ${ex.name} for today`
          )
        }
      />

      <ExerciseInfoSheet exercise={infoFor} onClose={() => setInfoFor(null)} />

      <ExerciseNoteSheet
        exercise={notingExercise}
        initial={notingExercise ? noteFor(notingExercise.id) : ''}
        onClose={() => setNotingExercise(null)}
        onSave={async (text) => {
          if (!notingExercise) return;
          await setExerciseNote(session.id, notingExercise.id, text);
          setNotingExercise(null);
          toast(text.trim() ? 'Note saved' : 'Note removed');
        }}
      />

      <FinishSheet
        open={finishing}
        onClose={() => setFinishing(false)}
        doneCount={doneCount}
        volume={volume}
        elapsed={elapsed}
        onFinish={onFinish}
        onDiscard={() => {
          setFinishing(false);
          setConfirmDiscard(true);
        }}
      />

      <Confirm
        open={confirmDiscard}
        title="Discard this workout?"
        body="Everything logged in this session will be deleted. This can't be undone."
        confirmLabel="Discard"
        onConfirm={async () => {
          await discardSession(session.id);
          toast('Workout discarded');
          navigate('/train', { replace: true });
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SetRow({
  row,
  index,
  current,
  prior,
  onToggle,
  onPatch,
  onDelete,
}: {
  row: SetLog;
  index: number;
  current: boolean;
  prior: SetLog | null;
  onToggle: () => void;
  onPatch: (patch: Partial<SetLog>) => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);

  const beatPrevious =
    row.done &&
    prior &&
    (row.weight ?? 0) * (row.reps ?? 0) > (prior.weight ?? 0) * (prior.reps ?? 0);

  // Done = white, current = lime, upcoming = dimmed — readable at arm's length.
  const numTone = current ? 'text-accent-500' : row.done ? 'text-ink-100' : 'text-ink-500';
  const numInput = cn(
    'w-full bg-transparent text-center tnum text-[22px] font-semibold outline-none rounded-xl py-1',
    'focus:bg-ink-800 placeholder:text-ink-700',
    numTone
  );

  return (
    <div
      className={cn(
        'px-3.5 py-1.5 grid grid-cols-[30px_56px_1fr_1fr_44px] gap-2 items-center transition-colors',
        current && 'bg-accent-500/[0.12]'
      )}
    >
      <button
        onClick={() => setShowDelete((v) => !v)}
        onDoubleClick={onDelete}
        className={cn('text-[13px] tnum text-left', current ? 'text-accent-500' : 'text-ink-500')}
        title="Tap for options"
      >
        {index + 1}
        {row.isWarmup ? ' W' : ''}
      </button>

      <div className="text-center text-[11px] text-ink-500 tnum truncate">
        {prior ? `${formatWeight(prior.weight)}×${prior.reps ?? '—'}` : '—'}
      </div>

      <div className="flex items-baseline justify-center">
        <input
          type="number"
          inputMode="decimal"
          className={numInput}
          value={row.weight ?? ''}
          placeholder="—"
          onChange={(e) => onPatch({ weight: e.target.value === '' ? null : Number(e.target.value) })}
          aria-label="Weight (kg)"
        />
      </div>

      <div className="flex items-baseline justify-center">
        <input
          type="number"
          inputMode="numeric"
          className={numInput}
          value={row.reps ?? ''}
          placeholder="—"
          onChange={(e) => onPatch({ reps: e.target.value === '' ? null : Number(e.target.value) })}
          aria-label="Reps"
        />
      </div>

      <button
        onClick={onToggle}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center transition-colors relative justify-self-end',
          row.done
            ? 'bg-accent-500 text-ink-950'
            : current
              ? 'border-2 border-accent-500 text-accent-500'
              : 'bg-ink-800 text-ink-600 hover:bg-ink-700'
        )}
        aria-label={row.done ? 'Mark set incomplete' : 'Mark set complete'}
      >
        <Check size={19} strokeWidth={3} />
        {beatPrevious && (
          <Trophy size={12} className="absolute -top-1 -right-1 text-accent-300" fill="currentColor" />
        )}
      </button>

      {showDelete && (
        <div className="col-span-5 flex gap-2 pt-1.5 pb-1">
          <button
            className="chip chip-off bg-ink-800 text-xs"
            onClick={() => {
              onPatch({ isWarmup: !row.isWarmup });
              setShowDelete(false);
            }}
          >
            {row.isWarmup ? 'Make working set' : 'Mark as warm-up'}
          </button>
          <button
            className="chip text-xs bg-bad/15 border-transparent text-bad"
            onClick={() => {
              onDelete();
              setShowDelete(false);
            }}
          >
            Delete set
          </button>
          <button className="chip chip-off bg-ink-800 text-xs ml-auto" onClick={() => setShowDelete(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ExerciseInfoSheet({
  exercise,
  onClose,
}: {
  exercise: Exercise | null;
  onClose: () => void;
}) {
  if (!exercise) return null;
  return (
    <Sheet open onClose={onClose} title={exercise.name}>
      <div className="flex gap-3 mb-4">
        <ExerciseThumb exercise={exercise} size={96} animated />
        <div className="text-sm space-y-1">
          <div>
            <div>
              <span className="text-ink-500">Target: </span>
              <span className="capitalize">{exercise.target}</span>
            </div>
            <div dir="rtl" className="text-ink-400 text-xs">
              {exercise.targetHe}
            </div>
          </div>
          <div>
            <span className="text-ink-500">Equipment: </span>
            <span className="capitalize">{exercise.equipment}</span>
          </div>
          {exercise.secondary.length > 0 && (
            <div className="text-xs text-ink-400 capitalize">
              Also works: {exercise.secondary.join(', ')}
            </div>
          )}
        </div>
      </div>

      {exercise.cuesHe && (
        <div className="mb-4 p-3 rounded-xl bg-accent-500/[0.08] border border-accent-500/20">
          <div className="label text-accent-500 mb-2">דגשי ביצוע</div>
          <ul className="he space-y-1.5">
            {exercise.cuesHe.map((c, i) => (
              <li key={i} className="text-sm text-ink-200 leading-relaxed">
                • {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {exercise.steps.length > 0 && (
        <div>
          <div className="label mb-2">How to perform</div>
          <ol className="space-y-2">
            {exercise.steps.map((s, i) => (
              <li key={i} className="text-sm text-ink-300 leading-relaxed flex gap-2.5">
                <span className="text-accent-500 font-bold tnum shrink-0">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A note about this exercise in this session. It lands in the weekly summary
 * next to the numbers, which is where a sentence like "כאב בכתף בסט האחרון"
 * does far more work than the load ever could.
 */
function ExerciseNoteSheet({
  exercise,
  initial,
  onClose,
  onSave,
}: {
  exercise: Exercise | null;
  initial: string;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const [forId, setForId] = useState(exercise?.id ?? null);

  // Re-seed when a different exercise's note is opened.
  if (exercise && forId !== exercise.id) {
    setForId(exercise.id);
    setText(initial);
  }

  if (!exercise) return null;

  return (
    <Sheet open onClose={onClose} title={`Note — ${exercise.name}`}>
      <textarea
        className="field min-h-[120px] he"
        placeholder="איך זה הרגיש? כאב, המשקל היה קל או כבד מדי, משהו לשנות בפעם הבאה…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <HeNote className="mt-2 text-xs text-ink-500">
        ההערה נשמרת לאימון הזה ונכנסת לסיכום השבועי יחד עם המספרים.
      </HeNote>
      <button className="btn-primary w-full mt-4" onClick={() => onSave(text)}>
        Save note
      </button>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

const FEELINGS = [
  { v: 1, label: 'Rough' },
  { v: 2, label: 'Meh' },
  { v: 3, label: 'OK' },
  { v: 4, label: 'Good' },
  { v: 5, label: 'Great' },
];

function FinishSheet({
  open,
  onClose,
  doneCount,
  volume,
  elapsed,
  onFinish,
  onDiscard,
}: {
  open: boolean;
  onClose: () => void;
  doneCount: number;
  volume: number;
  elapsed: number;
  onFinish: (notes: string, feeling: number | null) => void;
  onDiscard: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [feeling, setFeeling] = useState<number | null>(null);

  return (
    <Sheet open={open} onClose={onClose} title="Finish workout">
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card p-3 text-center">
          <div className="text-xl font-bold tnum">{doneCount}</div>
          <div className="text-[11px] text-ink-500">sets</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xl font-bold tnum">{formatVolume(volume)}</div>
          <div className="text-[11px] text-ink-500">volume</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xl font-bold tnum">{formatDuration(elapsed)}</div>
          <div className="text-[11px] text-ink-500">duration</div>
        </div>
      </div>

      <label className="label">How did it feel?</label>
      <div className="rail mt-2 mb-4">
        {FEELINGS.map((f) => (
          <button
            key={f.v}
            className={cn('chip', feeling === f.v ? 'chip-on' : 'chip-off')}
            onClick={() => setFeeling(f.v === feeling ? null : f.v)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <label className="label">Notes</label>
      <textarea
        className="field mt-1.5 min-h-[80px] he"
        placeholder="איך הלך? כאבים, אנרגיה, מה לשנות בפעם הבאה…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <HeNote className="mt-2 text-xs text-ink-500">
        ההערות והתחושה נכנסות לסיכום השבועי — שווה לכתוב משפט.
      </HeNote>

      <button className="btn-primary w-full mt-5" onClick={() => onFinish(notes, feeling)}>
        <Check size={17} />
        Save workout
      </button>

      <button className="btn-danger w-full mt-2" onClick={onDiscard}>
        <Trash2 size={16} />
        Discard this workout
      </button>
    </Sheet>
  );
}
