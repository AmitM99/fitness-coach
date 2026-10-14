import type { SetLog, Session, PlanItem } from '@/db/schema';

/**
 * Estimated 1RM, Epley: 1RM = w × (1 + reps/30).
 *
 * This is an *estimate*, and it drifts badly above ~12 reps — the UI labels it
 * "est." and stops trusting it past 15 reps rather than showing a number that
 * looks authoritative and isn't.
 */
export function estimate1RM(weight: number | null, reps: number | null): number | null {
  if (!weight || !reps || weight <= 0 || reps <= 0) return null;
  if (reps > 15) return null;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function setVolume(s: SetLog): number {
  if (s.isWarmup || !s.done) return 0;
  return (s.weight ?? 0) * (s.reps ?? 0);
}

export function sessionVolume(sets: SetLog[]): number {
  return sets.reduce((sum, s) => sum + setVolume(s), 0);
}

export function workingSets(sets: SetLog[]): SetLog[] {
  return sets.filter((s) => s.done && !s.isWarmup);
}

export interface ExerciseSessionPoint {
  sessionId: string;
  date: string;
  topWeight: number | null;
  topE1RM: number | null;
  volume: number;
  totalReps: number;
  sets: number;
}

/** Rolls per-set logs into one point per session, for the progression charts. */
export function exerciseHistory(
  sets: SetLog[],
  sessionsById: Map<string, Session>
): ExerciseSessionPoint[] {
  const bySession = new Map<string, SetLog[]>();
  for (const s of sets) {
    if (!bySession.has(s.sessionId)) bySession.set(s.sessionId, []);
    bySession.get(s.sessionId)!.push(s);
  }

  const points: ExerciseSessionPoint[] = [];
  for (const [sessionId, all] of bySession) {
    const session = sessionsById.get(sessionId);
    if (!session) continue;
    const work = workingSets(all);
    if (work.length === 0) continue;

    const weights = work.map((s) => s.weight ?? 0).filter((w) => w > 0);
    const e1rms = work
      .map((s) => estimate1RM(s.weight, s.reps))
      .filter((v): v is number => v !== null);

    points.push({
      sessionId,
      date: session.date,
      topWeight: weights.length ? Math.max(...weights) : null,
      topE1RM: e1rms.length ? Math.max(...e1rms) : null,
      volume: sessionVolume(work),
      totalReps: work.reduce((n, s) => n + (s.reps ?? 0), 0),
      sets: work.length,
    });
  }

  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export interface PersonalRecords {
  bestWeight: { value: number; date: string } | null;
  bestE1RM: { value: number; date: string } | null;
  bestVolume: { value: number; date: string } | null;
  bestReps: { value: number; weight: number; date: string } | null;
}

export function personalRecords(
  sets: SetLog[],
  sessionsById: Map<string, Session>
): PersonalRecords {
  let bestWeight: PersonalRecords['bestWeight'] = null;
  let bestE1RM: PersonalRecords['bestE1RM'] = null;
  let bestReps: PersonalRecords['bestReps'] = null;

  for (const s of workingSets(sets)) {
    const date = sessionsById.get(s.sessionId)?.date;
    if (!date) continue;

    if (s.weight && (!bestWeight || s.weight > bestWeight.value)) {
      bestWeight = { value: s.weight, date };
    }
    const e = estimate1RM(s.weight, s.reps);
    if (e && (!bestE1RM || e > bestE1RM.value)) {
      bestE1RM = { value: e, date };
    }
    if (s.reps && (!bestReps || s.reps > bestReps.value)) {
      bestReps = { value: s.reps, weight: s.weight ?? 0, date };
    }
  }

  const history = exerciseHistory(sets, sessionsById);
  const topVol = history.reduce<ExerciseSessionPoint | null>(
    (best, p) => (!best || p.volume > best.volume ? p : best),
    null
  );

  return {
    bestWeight,
    bestE1RM,
    bestVolume: topVol ? { value: topVol.volume, date: topVol.date } : null,
    bestReps,
  };
}

/**
 * What to pre-fill when the user opens a set. Uses the last time this exercise
 * was performed so they're editing a sensible number, not typing from scratch.
 */
export function suggestFromLast(
  previous: SetLog[],
  setIndex: number,
  planItem: PlanItem | null
): { weight: number | null; reps: number | null } {
  const match = previous.find((s) => s.setIndex === setIndex && !s.isWarmup);
  if (match) return { weight: match.weight, reps: match.reps };

  const last = previous.filter((s) => !s.isWarmup).at(-1);
  if (last) return { weight: last.weight, reps: last.reps };

  const targetReps = planItem ? parseInt(planItem.targetReps, 10) : NaN;
  return {
    weight: planItem?.targetWeight ?? null,
    reps: Number.isFinite(targetReps) ? targetReps : null,
  };
}

/** "8-10" → 8, "5" → 5, "AMRAP" → null. */
export function parseTargetReps(text: string): number | null {
  const m = text.match(/\d+/);
  return m ? Number(m[0]) : null;
}

export function formatWeight(kg: number | null): string {
  if (kg === null || kg === undefined) return '—';
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
}

export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)}kg`;
}

/** Groups plan items into supersets/circuits by their `group` letter. */
export function groupPlanItems(items: PlanItem[]): PlanItem[][] {
  const out: PlanItem[][] = [];
  let current: PlanItem[] = [];
  let currentGroup: string | null = null;

  for (const item of items) {
    if (item.group && item.group === currentGroup) {
      current.push(item);
      continue;
    }
    if (current.length) out.push(current);
    current = [item];
    currentGroup = item.group;
  }
  if (current.length) out.push(current);
  return out;
}

export interface SessionRecord {
  exerciseId: string;
  kind: 'e1rm' | 'weight';
  value: number;
  previous: number;
  /** The set that set the record, for display: "80 kg × 5". */
  weight: number;
  reps: number;
}

/**
 * Records broken in one session, measured against every earlier session.
 * An exercise done for the first time has nothing to beat, so it never
 * counts — a "PR" on day one would be noise, not news.
 */
export function sessionRecords(
  session: Session,
  thisSessionSets: SetLog[],
  history: SetLog[],
  sessionsById: Map<string, Session>
): SessionRecord[] {
  const isEarlier = (other: Session) =>
    other.id !== session.id &&
    (other.date < session.date ||
      (other.date === session.date && other.startedAt < session.startedAt));

  const out: SessionRecord[] = [];
  const exIds = [...new Set(workingSets(thisSessionSets).map((s) => s.exerciseId))];

  for (const exId of exIds) {
    const before = workingSets(
      history.filter((s) => {
        const owner = sessionsById.get(s.sessionId);
        return s.exerciseId === exId && owner && isEarlier(owner);
      })
    );
    if (before.length === 0) continue;

    const now = workingSets(thisSessionSets.filter((s) => s.exerciseId === exId));
    const bestBy = (rows: SetLog[], score: (s: SetLog) => number | null) =>
      rows.reduce<{ set: SetLog; v: number } | null>((best, s) => {
        const v = score(s);
        // On a tie, the set with more reps is the better one to show.
        const better = !best || v! > best.v || (v === best.v && (s.reps ?? 0) > (best.set.reps ?? 0));
        return v !== null && better ? { set: s, v } : best;
      }, null);

    const e1 = (s: SetLog) => estimate1RM(s.weight, s.reps);
    const w = (s: SetLog) => (s.weight && s.weight > 0 ? s.weight : null);

    const nowE1 = bestBy(now, e1);
    const prevE1 = bestBy(before, e1);
    const nowW = bestBy(now, w);
    const prevW = bestBy(before, w);

    // A heavier top set is the headline; an e1RM record without one (more reps
    // at the same load) is still worth celebrating, so it's the fallback.
    if (nowW && prevW && nowW.v > prevW.v) {
      out.push({
        exerciseId: exId, kind: 'weight', value: nowW.v, previous: prevW.v,
        weight: nowW.set.weight ?? 0, reps: nowW.set.reps ?? 0,
      });
    } else if (nowE1 && prevE1 && nowE1.v > prevE1.v) {
      out.push({
        exerciseId: exId, kind: 'e1rm', value: nowE1.v, previous: prevE1.v,
        weight: nowE1.set.weight ?? 0, reps: nowE1.set.reps ?? 0,
      });
    }
  }
  return out;
}
