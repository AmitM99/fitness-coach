import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import type { Exercise } from '@/db/schema';

/**
 * Where exercise media lives. Defaults to the copy bundled under
 * /public/exercise-media by `npm run data:media`, so the app makes no external
 * requests. A deployment that can't host 177 MB of licensed media can point
 * VITE_MEDIA_BASE at the upstream dataset instead.
 */
const MEDIA_BASE = import.meta.env.VITE_MEDIA_BASE ?? '/exercise-media';

/**
 * If media hasn't been fetched, fall back to a glyph rather than reaching out
 * to the network — the app stays usable either way.
 */
export default function ExerciseThumb({
  exercise,
  size = 56,
  animated = false,
  className,
}: {
  exercise: Exercise;
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  // Animations are an optional download (`npm run data:media:gifs`), so an
  // animated request degrades to the still thumbnail before giving up.
  const sources = animated ? [exercise.gif, exercise.image] : [exercise.image];
  const [attempt, setAttempt] = useState(0);
  const src = sources[attempt];

  return (
    <div
      className={`shrink-0 rounded-xl bg-ink-100 overflow-hidden flex items-center justify-center ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      {src === undefined ? (
        <Dumbbell size={size * 0.4} className="text-ink-500" />
      ) : (
        <img
          key={src}
          src={`${MEDIA_BASE}/${src}`}
          alt=""
          // The animated variant is only used where it's the focal point of the
          // screen, so it should not wait on the lazy-loading observer.
          loading={animated ? 'eager' : 'lazy'}
          onError={() => setAttempt((n) => n + 1)}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}
