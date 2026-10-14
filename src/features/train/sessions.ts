import {
  db, uid, type ExerciseNote, type PlanDay, type Program, type SetLog, type Session,
} from '@/db/schema';
import { todayKey } from '@/lib/date';
import { loadRest, saveRest } from './restStore';
import { parseTargetReps } from '@/lib/training';

/** Returns the in-progress session, if the user walked away mid-workout. */
export async function activeSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('active').first();
}

/**
 * Creates a session. When started from a plan day, the prescribed sets are
 * pre-created as empty rows so the workout reads as a checklist rather than a
 * blank page.
 */
export async function startSession(opts: {
  name: string;
  program?: Program | null;
  planDay?: PlanDay | null;
  date?: string;
}): Promise<string> {
  const id = uid();
  const now = new Date().toISOString();

  const session: Session = {
    id,
    date: opts.date ?? todayKey(),
    programId: opts.program?.id ?? null,
    planDayId: opts.planDay?.id ?? null,
    name: opts.name,
    startedAt: now,
    finishedAt: null,
    notes: '',
    feeling: null,
    status: 'active',
  };

  const sets: SetLog[] = [];
  if (opts.planDay) {
    for (const item of opts.planDay.items) {
      for (let i = 0; i < Math.max(1, item.targetSets); i++) {
        sets.push({
          id: uid(),
          sessionId: id,
          exerciseId: item.exerciseId,
          planItemId: item.id,
          setIndex: i,
          weight: item.targetWeight,
          reps: parseTargetReps(item.targetReps),
          rpe: null,
          isWarmup: false,
          done: false,
          notes: '',
        });
      }
    }
  }

  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.sessions.add(session);
    if (sets.length) await db.setLogs.bulkAdd(sets);
  });

  return id;
}

export async function finishSession(sessionId: string, patch: { notes?: string; feeling?: number | null }) {
  const session = await db.sessions.get(sessionId);
  if (!session) return;

  // Empty sets would otherwise pollute the history and the volume maths.
  const sets = await db.setLogs.where('sessionId').equals(sessionId).toArray();
  const empty = sets.filter((s) => !s.done).map((s) => s.id);

  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    if (empty.length) await db.setLogs.bulkDelete(empty);
    await db.sessions.put({
      ...session,
      ...patch,
      finishedAt: new Date().toISOString(),
      status: 'done',
    });
  });
  clearRestFor(sessionId);
}

/** A finished or discarded workout leaves no rest timer behind. */
function clearRestFor(sessionId: string) {
  if (loadRest(sessionId)) saveRest(null);
}

export async function discardSession(sessionId: string) {
  await db.transaction('rw', db.sessions, db.setLogs, db.exerciseNotes, async () => {
    await db.setLogs.where('sessionId').equals(sessionId).delete();
    await db.exerciseNotes.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
  clearRestFor(sessionId);
}

/** The most recent completed sets for an exercise, to pre-fill and compare against. */
export async function previousPerformance(exerciseId: string, excludeSessionId: string): Promise<SetLog[]> {
  const all = await db.setLogs.where('exerciseId').equals(exerciseId).toArray();
  const candidates = all.filter((s) => s.sessionId !== excludeSessionId && s.done);
  if (!candidates.length) return [];

  const sessionIds = [...new Set(candidates.map((s) => s.sessionId))];
  const sessions = await db.sessions.bulkGet(sessionIds);
  const dateById = new Map(
    sessions.filter((s): s is Session => !!s).map((s) => [s.id, s.date])
  );

  let latestId: string | null = null;
  let latestDate = '';
  for (const sid of sessionIds) {
    const d = dateById.get(sid) ?? '';
    if (d > latestDate) {
      latestDate = d;
      latestId = sid;
    }
  }

  return candidates
    .filter((s) => s.sessionId === latestId)
    .sort((a, b) => a.setIndex - b.setIndex);
}

export async function addSetRow(sessionId: string, exerciseId: string, planItemId: string | null) {
  const existing = await db.setLogs
    .where('[exerciseId+sessionId]')
    .equals([exerciseId, sessionId])
    .toArray();

  const last = existing.filter((s) => !s.isWarmup).sort((a, b) => a.setIndex - b.setIndex).at(-1);

  await db.setLogs.add({
    id: uid(),
    sessionId,
    exerciseId,
    planItemId,
    setIndex: (last?.setIndex ?? -1) + 1,
    weight: last?.weight ?? null,
    reps: last?.reps ?? null,
    rpe: null,
    isWarmup: false,
    done: false,
    notes: '',
  });
}

export async function addExerciseToSession(sessionId: string, exerciseId: string, sets = 3) {
  // The exercise may already be in this session — adding it again should
  // continue its set numbering rather than restart at 1 and produce two "Set 1"
  // rows that also collide in the rest-timer's "set X of Y" count.
  const existing = await db.setLogs
    .where('[exerciseId+sessionId]')
    .equals([exerciseId, sessionId])
    .toArray();
  const nextIndex = existing.reduce((max, r) => Math.max(max, r.setIndex + 1), 0);

  const rows: SetLog[] = Array.from({ length: sets }, (_, i) => ({
    id: uid(),
    sessionId,
    exerciseId,
    planItemId: null,
    setIndex: nextIndex + i,
    weight: null,
    reps: null,
    rpe: null,
    isWarmup: false,
    done: false,
    notes: '',
  }));
  await db.setLogs.bulkAdd(rows);
}

export type SwapReason = 'broken' | 'busy' | 'dislike';

/** Written into the session note, so the weekly review can read why. */
export const SWAP_REASON_HE: Record<SwapReason, string> = {
  broken: 'מכונה תקולה',
  busy: 'מכונה תפוסה',
  dislike: 'לא אוהב את התרגיל',
};

/**
 * Replaces an exercise mid-workout, keeping the set structure.
 *
 * Weights come from the last time he did the new movement. With no history
 * they stay blank: a weight from a different exercise is a guess, and a
 * guessed number in the log is worse than an empty one.
 *
 * With a reason, a note on the new exercise records what it replaced, so the
 * review can tell "the machine was broken" from a change of program.
 * "dislike" also rewrites the plan (see replaceInProgram).
 */
export async function swapExerciseInSession(
  sessionId: string,
  fromExerciseId: string,
  toExerciseId: string,
  reason?: SwapReason
) {
  const rows = await db.setLogs
    .where('[exerciseId+sessionId]')
    .equals([fromExerciseId, sessionId])
    .toArray();

  const prior = (await previousPerformance(toExerciseId, sessionId)).filter(
    (s) => !s.isWarmup && s.weight != null
  );
  const weightFor = (setIndex: number) =>
    (prior[setIndex] ?? prior.at(-1))?.weight ?? null;

  await db.setLogs.bulkPut(
    rows.map((r) => ({
      ...r,
      exerciseId: toExerciseId,
      weight: weightFor(r.setIndex),
      done: false,
    }))
  );

  if (!reason) return;

  // The old exercise's note would be orphaned by the swap, so it moves along.
  const [from, oldNote] = await Promise.all([
    db.exercises.get(fromExerciseId),
    getExerciseNote(sessionId, fromExerciseId),
  ]);
  const line = `במקום ${from?.name ?? 'התרגיל המקורי'} — ${SWAP_REASON_HE[reason]}`;
  await setExerciseNote(sessionId, toExerciseId, [line, oldNote?.text].filter(Boolean).join('\n'));
  if (oldNote) await db.exerciseNotes.delete(oldNote.id);

  const planItemId = rows[0]?.planItemId;
  const session = await db.sessions.get(sessionId);
  if (reason === 'dislike' && planItemId && session?.programId) {
    await replaceInProgram(session.programId, planItemId, toExerciseId, weightFor(0));
  }
}

/**
 * Makes a swap permanent in the plan. The old movement becomes the first
 * alternative, so changing his mind is one tap in the same menu rather than a
 * trip to the program editor.
 */
export async function replaceInProgram(
  programId: string,
  planItemId: string,
  toExerciseId: string,
  targetWeight: number | null
) {
  const program = await db.programs.get(programId);
  if (!program) return;

  const days = program.days.map((day) => ({
    ...day,
    items: day.items.map((item) => {
      if (item.id !== planItemId) return item;
      const alternatives = [item.exerciseId, ...(item.alternatives ?? [])].filter(
        (id, i, all) => id !== toExerciseId && all.indexOf(id) === i
      );
      return { ...item, exerciseId: toExerciseId, targetWeight, alternatives };
    }),
  }));

  await db.programs.put({ ...program, days });
}

export async function removeExerciseFromSession(sessionId: string, exerciseId: string) {
  const rows = await db.setLogs
    .where('[exerciseId+sessionId]')
    .equals([exerciseId, sessionId])
    .toArray();
  await db.setLogs.bulkDelete(rows.map((r) => r.id));
}

/** Reads the note attached to one exercise within one session. */
export async function getExerciseNote(
  sessionId: string,
  exerciseId: string
): Promise<ExerciseNote | undefined> {
  return db.exerciseNotes.where('[sessionId+exerciseId]').equals([sessionId, exerciseId]).first();
}

/** Writes, or clears, that note. Blank text removes the row rather than storing an empty one. */
export async function setExerciseNote(sessionId: string, exerciseId: string, text: string) {
  const existing = await getExerciseNote(sessionId, exerciseId);
  const trimmed = text.trim();

  if (!trimmed) {
    if (existing) await db.exerciseNotes.delete(existing.id);
    return;
  }

  await db.exerciseNotes.put({
    id: existing?.id ?? uid(),
    sessionId,
    exerciseId,
    text: trimmed,
    updatedAt: new Date().toISOString(),
  });
}
