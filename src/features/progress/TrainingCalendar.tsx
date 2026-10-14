import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { Session } from '@/db/schema';
import { cn } from '@/components/ui';
import { dayNum, fromDayKey, monthGrid, monthName, sessionMs, todayKey } from '@/lib/date';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Month view of training days. Gaps are the whole point: a run of empty
 * circles is far harder to ignore than a "last workout: 18 days ago" line.
 */
export function TrainingCalendar({ sessions }: { sessions: Session[] }) {
  const navigate = useNavigate();
  const today = fromDayKey(todayKey());
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const byDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    return map;
  }, [sessions]);

  const cells = monthGrid(cursor.y, cursor.m);
  const shift = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <button className="icon-btn w-9 h-9 bg-ink-800" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <div className="text-[17px] font-semibold">
          {monthName(cursor.m)} {cursor.y}
        </div>
        <button className="icon-btn w-9 h-9 bg-ink-800" onClick={() => shift(1)} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-2 justify-items-center">
        {DOW.map((d) => (
          <div key={d} className="text-[12px] text-ink-500 mb-1">
            {d}
          </div>
        ))}
        {cells.map((key, i) => {
          if (!key) return <div key={`pad-${i}`} />;
          const done = byDate.get(key);
          const isToday = key === todayKey();
          return (
            <button
              key={key}
              disabled={!done}
              onClick={() => done && navigate(`/session/${done[0].id}/summary`)}
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-[15px] tnum',
                done
                  ? 'bg-accent-500 text-ink-950 font-semibold'
                  : isToday
                    ? 'border-2 border-ink-100 text-ink-100'
                    : 'border border-ink-700 text-ink-400'
              )}
              aria-label={done ? `${key}: ${done.map((s) => s.name).join(', ')}` : key}
            >
              {dayNum(key)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Training time this month against last month, day by day. */
export function ActivitySummary({ sessions }: { sessions: Session[] }) {
  const today = fromDayKey(todayKey());
  const y = today.getFullYear();
  const m = today.getMonth();
  const prev = new Date(y, m - 1, 1);

  const { series, thisTotal, prevTotal, thisCount, prevCount } = useMemo(() => {
    const minutesByDay = (yy: number, mm: number) => {
      const out = new Map<number, number>();
      let count = 0;
      for (const s of sessions) {
        const d = fromDayKey(s.date);
        if (d.getFullYear() !== yy || d.getMonth() !== mm) continue;
        count++;
        const ms = sessionMs(s);
        if (ms) out.set(d.getDate(), (out.get(d.getDate()) ?? 0) + ms / 60000);
      }
      return { out, count };
    };
    const cur = minutesByDay(y, m);
    const old = minutesByDay(prev.getFullYear(), prev.getMonth());
    const days = Math.max(new Date(y, m + 1, 0).getDate(), new Date(y, m, 0).getDate());

    let a = 0;
    let b = 0;
    const rows = [];
    for (let day = 1; day <= days; day++) {
      a += cur.out.get(day) ?? 0;
      b += old.out.get(day) ?? 0;
      rows.push({
        day,
        // The current month stops at today rather than drawing a flat future.
        thisMonth: day <= today.getDate() ? Math.round(a) : null,
        lastMonth: Math.round(b),
      });
    }
    return { series: rows, thisTotal: a, prevTotal: b, thisCount: cur.count, prevCount: old.count };
  }, [sessions]);

  const fmt = (min: number) => {
    const h = Math.floor(min / 60);
    const mm = Math.round(min % 60);
    return h > 0 ? `${h}hr ${mm}min` : `${mm}min`;
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[28px] font-bold tracking-tight tnum leading-none">{fmt(thisTotal)}</div>
          <div className="flex items-center gap-1.5 text-[13px] text-ink-400 mt-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-500" />
            {monthName(m).slice(0, 3)} · {thisCount} {thisCount === 1 ? 'workout' : 'workouts'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold tnum text-ink-300 leading-none">{fmt(prevTotal)}</div>
          <div className="flex items-center justify-end gap-1.5 text-[13px] text-ink-500 mt-1.5">
            <span className="w-2 h-2 rounded-full bg-ink-500" />
            {monthName(prev.getMonth()).slice(0, 3)} · {prevCount}
          </div>
        </div>
      </div>

      <div style={{ height: 120 }} className="mt-4 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
            <XAxis dataKey="day" hide />
            <YAxis hide domain={[0, 'dataMax']} />
            {prevTotal > 0 && (
              <ReferenceLine y={Math.round(prevTotal)} stroke="#48484a" strokeDasharray="4 4" />
            )}
            <Line
              type="stepAfter"
              dataKey="lastMonth"
              stroke="#636366"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="stepAfter"
              dataKey="thisMonth"
              stroke="#b5e655"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="he text-xs text-ink-500 mt-2">
        זמן אימון מצטבר החודש (ירוק) מול החודש הקודם (אפור). הקו המקווקו = סך החודש הקודם.
      </p>
    </div>
  );
}
