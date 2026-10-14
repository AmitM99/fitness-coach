import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Play, Timer } from 'lucide-react';
import { db } from '@/db/schema';
import { formatDuration, mmss } from '@/lib/date';
import { activeSession } from './sessions';
import { loadRest, onRestChange, type RestState } from './restStore';

/**
 * Shown on every screen while a workout is minimised.
 *
 * Without it, walking away from the player to check an exercise or last week's
 * numbers would leave the session running with no visible way back — the only
 * exit would be to finish or discard it.
 */
export default function ActiveSessionBar() {
  const navigate = useNavigate();
  const session = useLiveQuery(() => activeSession(), []);
  const sets = useLiveQuery(
    () => (session ? db.setLogs.where('sessionId').equals(session.id).toArray() : []),
    [session?.id],
    []
  );
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<RestState | null>(null);

  // The rest keeps counting while you browse — show it here too.
  useEffect(() => {
    if (!session) return;
    const read = () => setRest(loadRest(session.id));
    read();
    return onRestChange(read);
  }, [session?.id]);

  useEffect(() => {
    if (!session) return;
    const start = new Date(session.startedAt).getTime();
    // Wall-clock, so a phone that slept mid-workout still shows the truth.
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const t = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [session?.startedAt]);

  if (!session) return null;

  const done = sets.filter((s) => s.done).length;
  const restLeft = rest ? Math.ceil((rest.endsAt - Date.now()) / 1000) : null;

  // The tab bar measures 63px plus its own safe-area padding, so 72px clears it
  // with a visible gap. Both offsets add --safe-bottom, so it cancels out and
  // the gap stays constant on devices with a home indicator.
  return (
    <button
      onClick={() => navigate(`/session/${session.id}`)}
      className="fixed inset-x-0 z-30 px-3"
      style={{ bottom: 'calc(72px + var(--safe-bottom))' }}
      aria-label={`Resume ${session.name}`}
    >
      <div className="max-w-lg mx-auto flex items-center gap-3 rounded-full bg-accent-500 text-ink-950 pl-2.5 pr-4 py-2.5 shadow-lg animate-fade-up">
        <span className="w-7 h-7 rounded-full bg-ink-950/15 flex items-center justify-center shrink-0">
          <Play size={14} fill="currentColor" />
        </span>
        <span className="flex-1 min-w-0 text-left">
          <span className="block font-semibold text-sm truncate leading-tight">{session.name}</span>
          <span className="block text-[11px] opacity-75 tnum">
            {formatDuration(elapsed)} · {done}/{sets.length} sets
          </span>
        </span>
        {restLeft !== null ? (
          <span className="flex items-center gap-1 text-sm font-bold tnum shrink-0">
            <Timer size={14} />
            {restLeft > 0 ? mmss(restLeft) : 'Go'}
          </span>
        ) : (
          <span className="text-xs font-bold shrink-0">Resume</span>
        )}
      </div>
    </button>
  );
}
