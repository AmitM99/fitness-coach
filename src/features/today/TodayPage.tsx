import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Play, Plus, Settings, Scale, UtensilsCrossed, ChevronLeft, ChevronRight, Dumbbell,
} from 'lucide-react';
import {
  db, uid, getSettings, type Exercise, type FoodLog, type Program, type Session, type WeightEntry,
} from '@/db/schema';
import { Screen, Card, SectionTitle, Sheet, Ring, HeNote, NumberPad, useToast, cn } from '@/components/ui';
import {
  addDays, clock, dayNum, dowLong, dowShort, hoursMinutes, longDate, sessionMs, todayKey,
  weekDays, weekRangeLabel, weekStart, fromDayKey,
} from '@/lib/date';
import { sessionFocus } from '@/lib/muscles';
import { activeSession, startSession } from '@/features/train/sessions';

export default function TodayPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [selected, setSelected] = useState(todayKey());
  const [weighIn, setWeighIn] = useState(false);

  const settings = useLiveQuery(() => getSettings(), []);
  const programs = useLiveQuery(() => db.programs.toArray(), [], [] as Program[]);
  const running = useLiveQuery(() => activeSession(), []);
  const sessions = useLiveQuery(
    () => db.sessions.where('date').equals(selected).toArray(),
    [selected],
    [] as Session[]
  );
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), [], [] as WeightEntry[]);
  const foodLogs = useLiveQuery(
    () => db.foodLogs.where('date').equals(selected).toArray(),
    [selected],
    [] as FoodLog[]
  );
  const doneSessions = useLiveQuery(
    () => db.sessions.where('status').equals('done').toArray(),
    [],
    [] as Session[]
  );
  const allSessionDates = doneSessions.map((s) => s.date);
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [] as Exercise[]);
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const week = useMemo(() => weekDays(weekStart(selected)), [selected]);
  const onCurrentWeek = weekStart(selected) === weekStart(todayKey());
  const activeProgram = programs.find((p) => p.active && !p.archived) ?? null;

  /**
   * Which session to offer. A rotation program has no fixed weekdays — it
   * offers whichever day follows the one last completed, so missing a week
   * costs you nothing.
   */
  const plannedDay = useMemo(() => {
    if (!activeProgram || activeProgram.days.length === 0) return null;

    if (activeProgram.rotation) {
      const lastDone = doneSessions
        .filter((s) => s.programId === activeProgram.id && s.planDayId)
        .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt))
        .at(-1);
      if (!lastDone) return activeProgram.days[0];
      const lastIndex = activeProgram.days.findIndex((d) => d.id === lastDone.planDayId);
      return activeProgram.days[(lastIndex + 1) % activeProgram.days.length];
    }

    const dow = fromDayKey(selected).getDay();
    return activeProgram.days.find((d) => d.dayOfWeek === dow) ?? null;
  }, [activeProgram, selected, doneSessions]);

  const doneToday = sessions.filter((s) => s.status === 'done');
  const weekDone = doneSessions
    .filter((s) => s.date >= week[0] && s.date <= week[6])
    .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt));
  const latestWeight = weights.at(-1) ?? null;

  const macros = foodLogs.reduce(
    (acc, f) => ({
      kcal: acc.kcal + f.kcal,
      protein: acc.protein + f.protein,
      carbs: acc.carbs + f.carbs,
      fat: acc.fat + f.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const hasTargets = !!(settings?.targetKcal || settings?.targetProtein);

  async function begin() {
    if (running) {
      navigate(`/session/${running.id}`);
      return;
    }
    const id = await startSession({
      name: plannedDay?.name ?? 'Open workout',
      program: activeProgram,
      planDay: plannedDay,
      date: selected,
    });
    navigate(`/session/${id}`);
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <Screen
      title={settings?.displayName ? `${greeting}, ${settings.displayName}` : greeting}
      subtitle={longDate(selected)}
      action={
        <button
          onClick={() => navigate('/more/settings')}
          className="icon-btn"
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>
      }
    >
      {/* Week strip — Skulpt-style: a lime disc for every day trained, a ring
          for the day being looked at. Arrows reach past and future weeks. */}
      <div className="flex items-center justify-between mb-2 -mx-1">
        <button
          onClick={() => setSelected((d) => addDays(d, -7))}
          className="icon-btn w-8 h-8 bg-transparent text-ink-500"
          aria-label="Previous week"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => setSelected(todayKey())}
          className="text-xs font-medium text-ink-500 hover:text-ink-200"
        >
          {onCurrentWeek ? 'This week' : 'Back to this week'}
        </button>
        <button
          onClick={() => setSelected((d) => addDays(d, 7))}
          className="icon-btn w-8 h-8 bg-transparent text-ink-500"
          aria-label="Next week"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-6">
        {week.map((day) => {
          const isSelected = day === selected;
          const isToday = day === todayKey();
          const trained = allSessionDates.includes(day);
          return (
            <button key={day} onClick={() => setSelected(day)} className="flex flex-col items-center gap-2">
              <span className={cn('text-[13px]', isToday ? 'text-ink-100 font-semibold' : 'text-ink-500')}>
                {dowShort(day)}
              </span>
              <span
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center text-[17px] tnum transition-colors',
                  trained
                    ? 'bg-accent-500 text-ink-950 font-semibold'
                    : isSelected
                      ? 'border-2 border-ink-100 text-ink-100'
                      : 'border border-ink-700 text-ink-300',
                  trained && isSelected && 'ring-2 ring-offset-2 ring-offset-ink-950 ring-ink-100'
                )}
              >
                {dayNum(day)}
              </span>
            </button>
          );
        })}
      </div>

      {running && <NowCard sessionId={running.id} name={running.name} startedAt={running.startedAt} byId={byId} onOpen={() => navigate(`/session/${running.id}`)} />}

      {!running && (
        <Card className="mb-2">
          {plannedDay ? (
            <>
              <div className="text-[13px] text-ink-500 mb-1">
                {selected === todayKey() ? 'Today' : dowLong(selected)} ·{' '}
                {activeProgram?.rotation ? 'Next in rotation' : activeProgram?.name}
              </div>
              <div className="text-xl font-bold tracking-tight mb-1">{plannedDay.name}</div>
              <div className="text-sm text-ink-500 mb-4">{plannedDay.items.length} exercises</div>
              <button className="btn-primary w-full" onClick={begin}>
                <Play size={16} fill="currentColor" />
                Start workout
              </button>
            </>
          ) : (
            <>
              <div className="text-center py-2 mb-3">
                <p className="text-ink-200 font-semibold">
                  {doneToday.length > 0 ? 'Another session?' : 'Nothing scheduled'}
                </p>
                <HeNote className="text-center text-xs text-ink-500 mt-1">
                  {activeProgram
                    ? 'אין יום מוצמד לתאריך הזה — אפשר להתחיל אימון חופשי או לבחור יום מהתוכנית.'
                    : 'צור תוכנית כדי שהאימונים יתחילו בלחיצה אחת.'}
                </HeNote>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={begin}>
                  <Plus size={16} />
                  Open workout
                </button>
                <button className="btn-ghost flex-1" onClick={() => navigate('/train')}>
                  <Dumbbell size={16} />
                  Programs
                </button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* The week at a glance, newest first — the count is the habit signal. */}
      <div className="flex items-baseline justify-between mt-8 mb-3">
        <h2 className="text-xl font-bold tracking-tight">{weekRangeLabel(week[0])}</h2>
      </div>
      <span className="inline-block mb-3 px-3 py-1 rounded-full bg-ink-900 text-[13px] text-ink-300">
        {weekDone.length} {weekDone.length === 1 ? 'workout' : 'workouts'}
      </span>
      <div className="space-y-2">
        {weekDone.map((s) => (
          <SessionDoneCard key={s.id} session={s} byId={byId} onOpen={() => navigate(`/session/${s.id}/summary`)} />
        ))}
      </div>

      {/* Body weight */}
      <SectionTitle>Body</SectionTitle>
      <Card onClick={() => setWeighIn(true)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ink-800 flex items-center justify-center text-accent-400">
            <Scale size={19} />
          </div>
          <div className="flex-1">
            <div className="font-semibold tnum">
              {latestWeight ? `${latestWeight.kg.toFixed(1)} kg` : 'Log your weight'}
            </div>
            <div className="text-xs text-ink-500">
              {latestWeight
                ? latestWeight.date === todayKey()
                  ? 'Logged today'
                  : `Last: ${longDate(latestWeight.date)}`
                : 'No weigh-ins yet'}
            </div>
          </div>
          <Plus size={18} className="text-ink-500" />
        </div>
      </Card>

      {/* Nutrition — intentionally a summary, the detail lives on its own page */}
      <SectionTitle
        action={
          <button
            className="text-xs text-ink-400 hover:text-ink-200"
            onClick={() => navigate('/nutrition')}
          >
            Open
          </button>
        }
      >
        Nutrition
      </SectionTitle>
      <Card onClick={() => navigate('/nutrition')}>
        {hasTargets ? (
          <div className="flex items-center justify-around">
            <Ring value={macros.kcal} max={settings?.targetKcal ?? null} size={64}>
              <span className="text-sm font-bold tnum">{Math.round(macros.kcal)}</span>
              <span className="text-[9px] text-ink-500">kcal</span>
            </Ring>
            <MacroRing label="Protein" value={macros.protein} max={settings?.targetProtein ?? null} color="#3ecf8e" />
            <MacroRing label="Carbs" value={macros.carbs} max={settings?.targetCarbs ?? null} color="#5b9cf5" />
            <MacroRing label="Fat" value={macros.fat} max={settings?.targetFat ?? null} color="#f5a524" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ink-800 flex items-center justify-center text-accent-400">
              <UtensilsCrossed size={19} />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Set a daily target</div>
              <div className="he text-xs text-ink-500">אופציונלי — רק אם תרצה לעקוב</div>
            </div>
            <ChevronRight size={17} className="text-ink-600" />
          </div>
        )}
      </Card>

      <WeighInSheet
        open={weighIn}
        onClose={() => setWeighIn(false)}
        initial={latestWeight?.kg ?? null}
        date={selected}
        onSave={async (kg) => {
          const existing = weights.find((w) => w.date === selected);
          if (existing) await db.weights.put({ ...existing, kg });
          else await db.weights.add({ id: uid(), date: selected, kg, note: '' });
          toast('Weight logged');
          setWeighIn(false);
        }}
      />
    </Screen>
  );
}

function MacroRing({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number | null;
  color: string;
}) {
  return (
    <div className="text-center">
      <Ring value={value} max={max} size={52} stroke={4} color={color}>
        <span className="text-[11px] font-bold tnum">{Math.round(value)}</span>
      </Ring>
      <div className="text-[10px] text-ink-500 mt-1">{label}</div>
    </div>
  );
}

function SessionDoneCard({
  session,
  byId,
  onOpen,
}: {
  session: Session;
  byId: Map<string, Exercise>;
  onOpen: () => void;
}) {
  const sets = useLiveQuery(
    () => db.setLogs.where('sessionId').equals(session.id).toArray(),
    [session.id],
    []
  );
  const focus = sessionFocus(sets.filter((s) => s.done), byId);
  const ms = sessionMs(session);

  return (
    <Card onClick={onOpen}>
      <div className="text-[13px] text-ink-500">
        {session.date === todayKey() ? 'Today' : dowLong(session.date)} · Strength
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="w-2.5 h-2.5 rounded-full bg-accent-500 shrink-0" />
        <span className="text-lg font-bold tracking-tight truncate">{session.name}</span>
      </div>
      <div className="text-sm text-ink-400 mt-1 truncate">
        {[ms ? hoursMinutes(ms) : null, focus.join(', ') || null].filter(Boolean).join(' · ') ||
          `${sets.length} sets`}
      </div>
    </Card>
  );
}

/** The in-progress workout, as a full-bleed lime card with a live clock. */
function NowCard({
  sessionId,
  name,
  startedAt,
  byId,
  onOpen,
}: {
  sessionId: string;
  name: string;
  startedAt: string;
  byId: Map<string, Exercise>;
  onOpen: () => void;
}) {
  const sets = useLiveQuery(
    () => db.setLogs.where('sessionId').equals(sessionId).toArray(),
    [sessionId],
    []
  );
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const focus = sessionFocus(sets, byId);

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-3xl bg-accent-500 text-ink-950 p-4 mb-2 active:scale-[0.99] transition-transform"
    >
      <div className="text-[13px] font-medium opacity-80">Now · Strength</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="w-2.5 h-2.5 rounded-full bg-ink-950 shrink-0 animate-pulse" />
        <span className="text-lg font-bold tracking-tight truncate">{name}</span>
      </div>
      <div className="text-sm font-medium mt-1 tnum truncate">
        {clock(now - new Date(startedAt).getTime())}
        {focus.length > 0 && <> · {focus.join(', ')}</>}
      </div>
    </button>
  );
}

function WeighInSheet({
  open,
  onClose,
  initial,
  date,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: number | null;
  date: string;
  onSave: (kg: number) => void;
}) {
  const [kg, setKg] = useState<number | null>(null);
  const value = kg ?? initial;

  return (
    <Sheet open={open} onClose={onClose} title={`Weigh-in — ${longDate(date)}`}>
      <NumberPad value={value} onChange={setKg} step={0.1} suffix="kg" autoFocus />
      <HeNote className="mt-3 text-xs text-ink-500">
        עדיף למדוד בבוקר, אחרי שירותים, לפני אוכל — כך המספרים ברי-השוואה.
      </HeNote>
      <button className="btn-primary w-full mt-5" onClick={() => value && onSave(value)} disabled={!value}>
        Save
      </button>
    </Sheet>
  );
}
