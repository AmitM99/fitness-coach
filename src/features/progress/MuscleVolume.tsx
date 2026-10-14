import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Exercise, Session, SetLog } from '@/db/schema';
import { cn } from '@/components/ui';
import { addDays, todayKey, weekRangeLabel, weekStart } from '@/lib/date';
import { MUSCLE_GROUPS, WEEKLY_SET_BAND, formatSets, muscleSets } from '@/lib/muscles';

/**
 * Working sets per muscle group for one week. Every group is listed, zeros
 * included — the empty rows are what show a neglected muscle.
 */
export default function MuscleVolume({
  sessions,
  sets,
  byId,
}: {
  sessions: Session[];
  sets: SetLog[];
  byId: Map<string, Exercise>;
}) {
  const [start, setStart] = useState(weekStart(todayKey()));
  const end = addDays(start, 6);
  const isCurrent = start === weekStart(todayKey());

  const counts = useMemo(() => {
    const ids = new Set(sessions.filter((s) => s.date >= start && s.date <= end).map((s) => s.id));
    return muscleSets(
      sets.filter((s) => ids.has(s.sessionId)),
      byId
    );
  }, [sessions, sets, byId, start, end]);

  const total = Object.values(counts).reduce((n, v) => n + v, 0);
  // Scale bars to the band's top, or further if a group goes past it.
  const scaleMax = Math.max(WEEKLY_SET_BAND.high, ...Object.values(counts));
  const pct = (v: number) => `${(v / scaleMax) * 100}%`;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <button className="icon-btn w-9 h-9 bg-ink-800" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <div className="text-[15px] font-semibold">{isCurrent ? 'This week' : weekRangeLabel(start)}</div>
          {isCurrent && <div className="text-[12px] text-ink-500">{weekRangeLabel(start)}</div>}
        </div>
        <button
          className="icon-btn w-9 h-9 bg-ink-800 disabled:opacity-30"
          onClick={() => setStart(addDays(start, 7))}
          disabled={isCurrent}
          aria-label="Next week"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {total === 0 ? (
        <p className="he text-sm text-ink-500 text-center py-6">אין סטים מתועדים בשבוע הזה.</p>
      ) : (
        <div className="space-y-2.5">
          {MUSCLE_GROUPS.map((g) => {
            const v = counts[g.key];
            const inBand = v >= WEEKLY_SET_BAND.low && v <= WEEKLY_SET_BAND.high;
            return (
              <div key={g.key} className="grid grid-cols-[84px_1fr_36px] items-center gap-3">
                <div className="text-[13px] leading-tight">
                  <div className={cn(v === 0 ? 'text-ink-500' : 'text-ink-100')}>{g.label}</div>
                  <div className="he text-[11px] text-ink-500 text-left">{g.he}</div>
                </div>
                <div className="relative h-2.5 rounded-full bg-ink-800 overflow-hidden">
                  {/* Reference band, drawn under the bar. */}
                  <div
                    className="absolute inset-y-0 bg-ink-700/70"
                    style={{ left: pct(WEEKLY_SET_BAND.low), width: `calc(${pct(WEEKLY_SET_BAND.high)} - ${pct(WEEKLY_SET_BAND.low)})` }}
                  />
                  <div
                    className={cn('absolute inset-y-0 left-0 rounded-full', inBand ? 'bg-accent-500' : 'bg-ink-300')}
                    style={{ width: pct(v) }}
                  />
                </div>
                <div className={cn('text-right text-sm font-semibold tnum', v === 0 && 'text-ink-600')}>
                  {formatSets(v)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="he text-xs text-ink-500 mt-4 leading-relaxed">
        כל סט עבודה נספר כסט שלם לשריר המטרה וכחצי סט לכל שריר משני (לפי מאגר התרגילים). הרצועה
        האפורה היא הטווח שמקובל לצטט לבניית שריר, בערך {WEEKLY_SET_BAND.low} עד {WEEKLY_SET_BAND.high}{' '}
        סטים בשבוע. זו נקודת ייחוס, לא יעד. ירוק אומר שהשריר בתוך הטווח.
      </p>
    </div>
  );
}
