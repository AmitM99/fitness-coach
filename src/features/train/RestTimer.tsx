import { useEffect, useRef, useState } from 'react';
import { Plus, X, Timer, ArrowRight } from 'lucide-react';
import { mmss } from '@/lib/date';
import { notify } from '@/lib/notify';
import { playRestDone } from '@/lib/sound';
import type { RestState } from './restStore';

export type { RestState };

/**
 * Counts down between sets and between exercises. Deliberately dismissible and
 * extendable — a timer you can't override is a timer you start ignoring.
 *
 * Controlled: the end instant lives in the persisted RestState, so the parent
 * saves every change (+30s) and the timer survives leaving the screen.
 */
export default function RestTimer({
  rest,
  vibrate,
  notifyOnDone,
  sound,
  onChange,
  onDismiss,
}: {
  rest: RestState;
  vibrate: boolean;
  notifyOnDone: boolean;
  sound: boolean;
  onChange: (next: RestState) => void;
  onDismiss: () => void;
}) {
  /**
   * Counted against the wall clock rather than by decrementing a tick.
   *
   * iOS suspends JavaScript the moment a PWA goes to the background, so an
   * interval-based countdown silently freezes and comes back showing more time
   * left than there really is. Tracking the end instant means the display is
   * correct the instant you return, however long the phone was locked.
   */
  const { endsAt, total } = rest;
  const [now, setNow] = useState(() => Date.now());
  // A rest restored long after it ended shouldn't buzz at you on return.
  const firedRef = useRef(endsAt < Date.now() - 15_000);

  useEffect(() => {
    firedRef.current = endsAt < Date.now() - 15_000;
    setNow(Date.now());
  }, [endsAt]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 500);
    // Re-sync the moment the app is foregrounded, before the next tick lands.
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, []);

  const remaining = Math.ceil((endsAt - now) / 1000);
  const spec = rest;

  useEffect(() => {
    if (remaining > 0 || firedRef.current) return;
    firedRef.current = true;

    if (vibrate) navigator.vibrate?.([120, 60, 120]);
    if (sound) playRestDone(spec.kind === 'exercise');

    if (notifyOnDone) {
      void notify(
        spec.kind === 'exercise' ? 'Rest over — next exercise' : 'Rest over — back to work',
        { body: spec.label, tag: 'rest-timer' }
      );
    }
  }, [remaining, vibrate, sound, notifyOnDone, spec.kind, spec.label]);

  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const over = remaining <= 0;
  const isExerciseRest = spec.kind === 'exercise';

  return (
    <div
      className="fixed inset-x-0 z-40 px-4"
      style={{ bottom: 'calc(12px + var(--safe-bottom))' }}
    >
      <div className="relative max-w-lg mx-auto rounded-3xl bg-ink-800 overflow-hidden shadow-2xl animate-fade-up">
        <div
          className={`absolute inset-y-0 left-0 transition-[width] duration-1000 ease-linear ${
            over ? 'bg-accent-500/40' : isExerciseRest ? 'bg-accent-600/25' : 'bg-accent-500/20'
          }`}
          style={{ width: `${pct * 100}%` }}
        />
        <div className="relative flex items-center gap-3 px-4 py-3">
          {isExerciseRest ? (
            <ArrowRight size={18} className="text-accent-500" />
          ) : (
            <Timer size={18} className="text-accent-500" />
          )}

          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tnum leading-none">
              {over ? (isExerciseRest ? 'Move on' : 'Go') : mmss(remaining)}
            </div>
            <div className="text-[11px] text-ink-400 mt-0.5 truncate">
              {isExerciseRest ? 'Next: ' : ''}
              {spec.label}
            </div>
          </div>

          <button
            onClick={() => {
              // Extend from now when it has already run out, so "+30s" always
              // means a full thirty seconds rather than topping up a deficit.
              firedRef.current = false;
              onChange({ ...rest, endsAt: Math.max(endsAt, Date.now()) + 30_000, total: total + 30 });
            }}
            className="btn-ghost bg-ink-700 py-2 px-3 text-xs shrink-0"
          >
            <Plus size={13} />
            30s
          </button>
          <button
            onClick={onDismiss}
            className="icon-btn w-9 h-9 bg-ink-700 text-ink-300"
            aria-label="Dismiss rest timer"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
