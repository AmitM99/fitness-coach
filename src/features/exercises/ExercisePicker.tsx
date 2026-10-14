import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search } from 'lucide-react';
import { db, type Exercise } from '@/db/schema';
import { Sheet, cn } from '@/components/ui';
import ExerciseThumb from './ExerciseThumb';

/**
 * Searching 1,324 exercises on a phone: the filter chips do the heavy lifting,
 * the text box narrows the rest. Results are capped so scrolling stays smooth.
 */
export default function ExercisePicker({
  open,
  onClose,
  onPick,
  title = 'Add exercise',
  /** When swapping, alternatives that hit the same muscle are shown first. */
  similarTo = null,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  title?: string;
  similarTo?: Exercise | null;
}) {
  const [query, setQuery] = useState('');
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [onlySimilar, setOnlySimilar] = useState(false);

  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [] as Exercise[]);

  // Opening the picker to swap should start from the same muscle, not from A-Z.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setBodyPart(null);
    setOnlySimilar(!!similarTo);
  }, [open, similarTo?.id]);

  const bodyParts = useMemo(
    () => [...new Set(exercises.map((e) => e.bodyPart))].sort(),
    [exercises]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises
      .filter((e) => (similarTo && onlySimilar ? e.target === similarTo.target && e.id !== similarTo.id : true))
      .filter((e) => (bodyPart ? e.bodyPart === bodyPart : true))
      .filter((e) =>
        q ? e.name.toLowerCase().includes(q) || e.target.toLowerCase().includes(q) : true
      )
      .sort((a, b) => {
        // Same equipment as the exercise being replaced is usually the swap
        // you actually want (a machine is rarely a substitute for a dumbbell).
        if (similarTo) {
          const aSame = a.equipment === similarTo.equipment ? 0 : 1;
          const bSame = b.equipment === similarTo.equipment ? 0 : 1;
          if (aSame !== bSame) return aSame - bSame;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, 120);
  }, [exercises, query, bodyPart, similarTo, onlySimilar]);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="relative mb-3">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
        <input
          className="field pl-9"
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {similarTo && (
        <button
          className={cn('chip w-full mb-3', onlySimilar ? 'chip-on' : 'chip-off')}
          onClick={() => setOnlySimilar((v) => !v)}
        >
          {onlySimilar
            ? `Alternatives for ${similarTo.target} only`
            : 'Showing all exercises — tap to narrow'}
        </button>
      )}

      <div className="rail pb-1 mb-3">
        <button
          className={cn('chip', bodyPart === null ? 'chip-on' : 'chip-off')}
          onClick={() => setBodyPart(null)}
        >
          All
        </button>
        {bodyParts.map((bp) => (
          <button
            key={bp}
            className={cn('chip capitalize', bodyPart === bp ? 'chip-on' : 'chip-off')}
            onClick={() => setBodyPart(bp === bodyPart ? null : bp)}
          >
            {bp}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {results.map((ex) => (
          <button
            key={ex.id}
            onClick={() => {
              onPick(ex);
              onClose();
              setQuery('');
            }}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-ink-850 text-left"
            aria-label={`${ex.name} — ${ex.target}, ${ex.equipment}`}
          >
            <ExerciseThumb exercise={ex} size={44} />
            <div className="min-w-0 flex-1">
              <div className="font-medium capitalize truncate text-sm">{ex.name}</div>
              <div className="text-xs text-ink-500 capitalize truncate">
                {ex.target} · {ex.equipment}
              </div>
            </div>
          </button>
        ))}
        {results.length === 0 && (
          <p className="text-center text-sm text-ink-500 py-8">No exercises match.</p>
        )}
        {results.length === 120 && (
          <p className="text-center text-xs text-ink-600 py-3">
            Showing the first 120 — refine your search.
          </p>
        )}
      </div>
    </Sheet>
  );
}
