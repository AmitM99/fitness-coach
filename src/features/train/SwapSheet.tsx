import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search } from 'lucide-react';
import type { Exercise, PlanItem } from '@/db/schema';
import { Sheet, HeNote, cn } from '@/components/ui';
import { formatWeight } from '@/lib/training';
import ExercisePicker from '@/features/exercises/ExercisePicker';
import ExerciseThumb from '@/features/exercises/ExerciseThumb';
import { previousPerformance, swapExerciseInSession, type SwapReason } from './sessions';

const REASONS: { key: SwapReason; en: string; he: string }[] = [
  { key: 'broken', en: 'Broken', he: 'תקולה' },
  { key: 'busy', en: 'Taken', he: 'תפוסה' },
  { key: 'dislike', en: "Don't like", he: 'לא אוהב' },
];

/**
 * The mid-workout swap. The coach's alternatives come first because they
 * already respect the injury list. The full search is still one tap away.
 *
 * The reason decides how far the swap reaches. A broken or taken machine is
 * about today only. Not liking the movement changes the plan.
 */
export default function SwapSheet({
  sessionId,
  exercise,
  planItem,
  byId,
  onClose,
  onSwapped,
}: {
  sessionId: string;
  exercise: Exercise | null;
  planItem: PlanItem | null;
  byId: Map<string, Exercise>;
  onClose: () => void;
  onSwapped: (to: Exercise, reason: SwapReason) => void;
}) {
  const [reason, setReason] = useState<SwapReason>('broken');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setReason('broken');
    setSearching(false);
  }, [exercise?.id]);

  const alternatives = (planItem?.alternatives ?? [])
    .map((id) => byId.get(id))
    .filter((e): e is Exercise => !!e);

  // His own last weight on each alternative. It's what the swap will fill in,
  // so he sees it before tapping.
  const lastWeight = useLiveQuery(
    async () => {
      const out = new Map<string, number>();
      for (const alt of alternatives) {
        const prior = (await previousPerformance(alt.id, sessionId)).filter(
          (s) => !s.isWarmup && s.weight != null
        );
        if (prior.length) out.set(alt.id, Math.max(...prior.map((s) => s.weight!)));
      }
      return out;
    },
    [sessionId, alternatives.map((a) => a.id).join()],
    new Map<string, number>()
  );

  if (!exercise) return null;

  async function pick(to: Exercise) {
    if (!exercise) return;
    const from = exercise;
    // Close first: otherwise closing the search reopens this sheet for the
    // moment the write takes.
    onClose();
    await swapExerciseInSession(sessionId, from.id, to.id, reason);
    onSwapped(to, reason);
  }

  const permanent = reason === 'dislike' && !!planItem;

  return (
    <>
      <Sheet open={!searching} onClose={onClose} title={`Swap ${exercise.name}`}>
        <div className="label mb-1.5">Why?</div>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {REASONS.map((r) => (
            <button
              key={r.key}
              className={cn(
                'chip rounded-xl px-2 py-1.5 flex flex-col items-center leading-tight',
                reason === r.key ? 'chip-on' : 'chip-off'
              )}
              onClick={() => setReason(r.key)}
              aria-pressed={reason === r.key}
            >
              <span className="text-xs">{r.en}</span>
              <span className="he text-[11px] opacity-80">{r.he}</span>
            </button>
          ))}
        </div>
        <HeNote className="text-xs text-ink-400 mb-4">
          {permanent
            ? 'ההחלפה תישמר גם בתוכנית. התרגיל הנוכחי עובר לרשימת החלופות, כך שאפשר לחזור אליו מכאן.'
            : 'ההחלפה רק לאימון הזה. בפעם הבאה התוכנית חוזרת לתרגיל המקורי.'}
        </HeNote>

        <div className="label mb-1.5">Coach's alternatives</div>
        {alternatives.length === 0 ? (
          <HeNote className="text-xs text-ink-500 mb-3">
            לתרגיל הזה עוד אין חלופות מוכנות. אפשר להוסיף אותן בעורך התוכנית.
          </HeNote>
        ) : (
          <div className="space-y-1.5 mb-3">
            {alternatives.map((alt) => {
              const w = lastWeight.get(alt.id);
              return (
                <button
                  key={alt.id}
                  onClick={() => pick(alt)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl bg-ink-850/60 hover:bg-ink-850 text-left"
                >
                  <ExerciseThumb exercise={alt} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium capitalize truncate text-sm">{alt.name}</div>
                    <div className="text-xs text-ink-500 truncate tnum">
                      <span className="capitalize">{alt.equipment}</span> ·{' '}
                      {w != null ? `last ${formatWeight(w)} kg` : 'no history yet'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button className="btn-ghost w-full" onClick={() => setSearching(true)}>
          <Search size={16} />
          Search all exercises
        </button>
      </Sheet>

      <ExercisePicker
        open={searching}
        onClose={() => setSearching(false)}
        title={`Swap ${exercise.name}`}
        similarTo={exercise}
        onPick={pick}
      />
    </>
  );
}
