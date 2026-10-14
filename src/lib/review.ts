import { db, type SetLog } from '@/db/schema';
import { addDays, daysBetween, longDate, weekDays } from '@/lib/date';
import { estimate1RM, formatVolume } from '@/lib/training';
import { MUSCLE_GROUPS, formatSets, muscleSets } from '@/lib/muscles';

/**
 * Builds the weekly summary. This is the whole point of requirement #8: the
 * data is already in the app, so the user should never be copying numbers
 * between tools by hand.
 *
 * The output is plain Markdown — readable on its own, whether or not it is
 * ever sent anywhere.
 */
export async function buildWeeklySummary(weekStartKey: string): Promise<string> {
  const days = weekDays(weekStartKey);
  const from = days[0];
  const to = days[6];

  const [sessions, allSets, exercises, weights, foodLogs, settings, profile, programs] =
    await Promise.all([
      db.sessions.where('status').equals('done').toArray(),
      db.setLogs.toArray(),
      db.exercises.toArray(),
      db.weights.toArray(),
      db.foodLogs.toArray(),
      db.settings.get('settings'),
      db.profile.get('profile'),
      db.programs.toArray(),
    ]);

  const allNotes = await db.exerciseNotes.toArray();

  const inWeek = sessions.filter((s) => s.date >= from && s.date <= to);
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const setsBySession = new Map<string, SetLog[]>();
  for (const s of allSets) {
    if (!setsBySession.has(s.sessionId)) setsBySession.set(s.sessionId, []);
    setsBySession.get(s.sessionId)!.push(s);
  }

  const lines: string[] = [];
  lines.push(`# Training week — ${longDate(from)} to ${longDate(to)}`);
  lines.push('');

  /* --- who this is, so the numbers land in context --- */
  if (profile && (profile.goal || profile.injuries || profile.avoid)) {
    lines.push('## Athlete');
    const row = (label: string, value: string | number | null) =>
      value ? lines.push(`- **${label}:** ${value}`) : null;

    row('Goal', profile.goal);
    row('Sessions/week', profile.sessionsPerWeek);
    row('Session length', profile.sessionMinutes ? `${profile.sessionMinutes} min` : '');
    row('Age', profile.age);
    row('Height', settings?.heightCm ? `${settings.heightCm} cm` : '');
    row('Goal weight', settings?.goalWeightKg ? `${settings.goalWeightKg} kg` : '');
    row('Trains at', profile.gym);
    // Constraints first-class: these change what may be prescribed at all.
    row('⚠ Injuries', profile.injuries);
    row('⚠ Avoid', profile.avoid);
    row('Medical', profile.medical);
    row('What works / what makes them quit', profile.whatWorks);
    row('Likes', profile.likes);
    row('Dislikes', profile.dislikes);
    row('Cardio', profile.cardio);
    row('Sleep', profile.sleep);
    row('Life load', profile.stress);
    lines.push('');
  }

  /* --- where we are in the block --- */
  const activeProgram = programs.find((p) => p.active && !p.archived);
  if (activeProgram) {
    lines.push('## Current program');
    lines.push(`- **${activeProgram.name}**`);
    if (activeProgram.startDate && activeProgram.weeks) {
      const week = Math.floor(daysBetween(activeProgram.startDate, to) / 7) + 1;
      lines.push(`- Block week ${Math.max(1, week)} of ${activeProgram.weeks}`);
      if (week >= activeProgram.weeks) {
        lines.push(`- **This block is finished — time to rebuild the program.**`);
      }
    }
    lines.push('');
  }

  /* --- training --- */
  lines.push(`## Workouts (${inWeek.length})`);
  if (inWeek.length === 0) {
    lines.push('No workouts logged this week.');
  } else {
    let weekVolume = 0;

    for (const session of [...inWeek].sort((a, b) => a.date.localeCompare(b.date))) {
      const sets = (setsBySession.get(session.id) ?? []).filter((s) => s.done);
      const volume = sets.reduce((n, s) => n + (s.weight ?? 0) * (s.reps ?? 0), 0);
      weekVolume += volume;

      const duration =
        session.finishedAt && session.startedAt
          ? Math.round(
              (new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 60000
            )
          : null;

      lines.push('');
      lines.push(
        `### ${longDate(session.date)} — ${session.name}` +
          (duration ? ` (${duration} min)` : '')
      );
      if (session.feeling) {
        lines.push(`Felt: ${['', 'rough', 'meh', 'ok', 'good', 'great'][session.feeling]}`);
      }

      const byExercise = new Map<string, SetLog[]>();
      for (const s of sets) {
        if (!byExercise.has(s.exerciseId)) byExercise.set(s.exerciseId, []);
        byExercise.get(s.exerciseId)!.push(s);
      }

      for (const [exId, rows] of byExercise) {
        const name = exById.get(exId)?.name ?? exId;
        const detail = rows
          .sort((a, b) => a.setIndex - b.setIndex)
          .map((r) => `${r.weight ?? '?'}×${r.reps ?? '?'}`)
          .join(', ');
        const e1rms = rows
          .map((r) => estimate1RM(r.weight, r.reps))
          .filter((v): v is number => v !== null);
        const best = e1rms.length ? ` — est. 1RM ${Math.max(...e1rms)}kg` : '';
        lines.push(`- **${name}**: ${detail}${best}`);

        // The note explains the number; keep them adjacent.
        const note = allNotes.find(
          (n) => n.sessionId === session.id && n.exerciseId === exId
        );
        if (note) lines.push(`  - _Note:_ ${note.text}`);
      }

      if (session.notes) lines.push(`- Notes: ${session.notes}`);
    }

    lines.push('');
    lines.push(`**Week total volume:** ${formatVolume(weekVolume)}`);

    // Fractional count: 1 per working set for the primary muscle, ½ for each
    // secondary — so a neglected group shows up as a low number, not a gap.
    const weekSets = inWeek.flatMap((s) => setsBySession.get(s.id) ?? []);
    const perMuscle = muscleSets(weekSets, exById);
    lines.push('');
    lines.push('**Working sets per muscle** (primary = 1, secondary = ½):');
    lines.push(
      MUSCLE_GROUPS.map((g) => `${g.label} ${formatSets(perMuscle[g.key])}`).join(' · ')
    );
  }

  /* --- how this compares to last week --- */
  const prevFrom = addDays(from, -7);
  const prevTo = addDays(to, -7);
  const prev = sessions.filter((s) => s.date >= prevFrom && s.date <= prevTo);
  const prevVolume = prev.reduce((total, s) => {
    const sets = (setsBySession.get(s.id) ?? []).filter((x) => x.done);
    return total + sets.reduce((n, x) => n + (x.weight ?? 0) * (x.reps ?? 0), 0);
  }, 0);

  if (prev.length > 0) {
    lines.push('');
    lines.push('## Versus last week');
    lines.push(`- Workouts: ${inWeek.length} (was ${prev.length})`);
    lines.push(`- Volume: ${formatVolume(
      inWeek.reduce((total, s) => {
        const sets = (setsBySession.get(s.id) ?? []).filter((x) => x.done);
        return total + sets.reduce((n, x) => n + (x.weight ?? 0) * (x.reps ?? 0), 0);
      }, 0)
    )} (was ${formatVolume(prevVolume)})`);
  }

  // Runs, sleep and HRV live in Garmin and are reviewed from there, not here.

  /* --- body weight --- */
  const weekWeights = weights
    .filter((w) => w.date >= from && w.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));

  lines.push('');
  lines.push('## Body weight');
  if (weekWeights.length === 0) {
    lines.push('No weigh-ins this week.');
  } else {
    const avg = weekWeights.reduce((n, w) => n + w.kg, 0) / weekWeights.length;
    lines.push(`- Entries: ${weekWeights.map((w) => `${w.kg}kg`).join(', ')}`);
    lines.push(`- Weekly average: ${avg.toFixed(1)}kg`);

    const priorWeights = weights
      .filter((w) => w.date >= prevFrom && w.date <= prevTo);
    if (priorWeights.length) {
      const prevAvg = priorWeights.reduce((n, w) => n + w.kg, 0) / priorWeights.length;
      const delta = avg - prevAvg;
      lines.push(
        `- Change vs last week's average: ${delta > 0 ? '+' : ''}${delta.toFixed(2)}kg`
      );
    }
    if (settings?.goalWeightKg) {
      lines.push(`- Goal: ${settings.goalWeightKg}kg`);
    }
  }

  /* --- nutrition, only if actually used --- */
  const weekFood = foodLogs.filter((f) => f.date >= from && f.date <= to);
  if (weekFood.length > 0) {
    const byDay = new Map<string, { kcal: number; protein: number }>();
    for (const f of weekFood) {
      const cur = byDay.get(f.date) ?? { kcal: 0, protein: 0 };
      cur.kcal += f.kcal;
      cur.protein += f.protein;
      byDay.set(f.date, cur);
    }
    const logged = [...byDay.values()];
    lines.push('');
    lines.push('## Nutrition');
    lines.push(`- Days logged: ${logged.length}/7`);
    lines.push(
      `- Average on logged days: ${Math.round(
        logged.reduce((n, d) => n + d.kcal, 0) / logged.length
      )} kcal, ${Math.round(logged.reduce((n, d) => n + d.protein, 0) / logged.length)}g protein`
    );
    if (settings?.targetKcal) lines.push(`- Target: ${settings.targetKcal} kcal`);
  }

  return lines.join('\n');
}

export const REVIEW_PROMPT = `You are my strength coach. Below is my training log for the past week, exported from my own tracking app, along with my athlete profile.

Give me:
1. A short read on how the week actually went — be direct, don't pad it.
2. Anything you notice that I should be concerned about (stalling lifts, volume spikes, poor recovery signals, imbalances).
3. Concrete changes for next week: which lifts to push, which to hold, and what loads/reps to aim for.

Respect the constraints in the Athlete section — especially anything marked ⚠. Never prescribe a movement I've listed as one to avoid.

Keep it practical and specific to the numbers below. If something in the data is missing or too sparse to judge, say so rather than guessing.

---

`;

/**
 * Calls the Anthropic API directly from the browser. This is the only outbound
 * request the app ever makes, it happens on an explicit button press, and the
 * key never leaves this device except as the auth header on this call.
 */
export async function requestCoachFeedback(
  apiKey: string,
  summary: string
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5-5',
      max_tokens: 16000,
      messages: [{ role: 'user', content: REVIEW_PROMPT + summary }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    let message = `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) message = parsed.error.message;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }

  const data = await res.json();
  const blocks: { type: string; text?: string }[] = data.content ?? [];
  return blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')
    .trim();
}
