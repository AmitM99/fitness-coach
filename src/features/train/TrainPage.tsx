import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Play, Pencil, Dumbbell, ChevronRight, Archive, Upload, CalendarClock } from 'lucide-react';
import { db, uid, type Program, type Session } from '@/db/schema';
import { Screen, Card, SectionTitle, Empty, Sheet, HeNote, useToast, cn } from '@/components/ui';
import { longDate, relativeDay, formatDuration, daysBetween, todayKey } from '@/lib/date';
import { formatVolume } from '@/lib/training';
import { importAlternatives, importProgram } from '@/lib/backup';
import { startSession, activeSession } from './sessions';

export default function TrainPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const programs = useLiveQuery(
    () => db.programs.orderBy('createdAt').reverse().toArray(),
    [],
    [] as Program[]
  );
  const active = useLiveQuery(() => activeSession(), []);
  const recent = useLiveQuery(
    () => db.sessions.where('status').equals('done').reverse().sortBy('date'),
    [],
    [] as Session[]
  );

  const visible = programs.filter((p) => (showArchived ? true : !p.archived));
  const activeProgram = programs.find((p) => p.active && !p.archived) ?? null;

  async function createProgram() {
    const name = newName.trim();
    if (!name) return;
    const program: Program = {
      id: uid(),
      name,
      description: '',
      createdAt: new Date().toISOString(),
      archived: false,
      active: programs.filter((p) => !p.archived).length === 0,
      days: [],
      startDate: null,
      weeks: null,
      rotation: false,
    };
    await db.programs.add(program);
    setNewName('');
    setCreating(false);
    navigate(`/train/program/${program.id}`);
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      // One import button for both kinds of coach file: a whole program, or
      // a patch of alternatives for the programs already here.
      if (payload?.kind === 'alternatives') {
        const { items, programs } = await importAlternatives(payload);
        toast(
          items
            ? `Alternatives added to ${items} exercises in ${programs} program${programs === 1 ? '' : 's'}`
            : 'Nothing to add: those exercises already have alternatives'
        );
      } else {
        const id = await importProgram(payload);
        toast('Program imported');
        navigate(`/train/program/${id}`);
      }
    } catch (err) {
      toast((err as Error).message, 'bad');
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function quickStart(programId: string | null, dayId: string | null, name: string) {
    if (active) {
      navigate(`/session/${active.id}`);
      return;
    }
    const program = programId ? programs.find((p) => p.id === programId) ?? null : null;
    const planDay = program?.days.find((d) => d.id === dayId) ?? null;
    const id = await startSession({ name, program, planDay });
    navigate(`/session/${id}`);
  }

  return (
    <Screen
      title="Train"
      subtitle={activeProgram ? activeProgram.name : 'No active program'}
      action={
        <button onClick={() => setCreating(true)} className="p-2 rounded-lg text-accent-400 hover:bg-ink-850">
          <Plus size={22} />
        </button>
      }
    >
      {active && (
        <Card
          className="border-accent-500/40 bg-accent-500/10 mb-4"
          onClick={() => navigate(`/session/${active.id}`)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-500 text-ink-950 flex items-center justify-center">
              <Play size={18} fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{active.name}</div>
              <div className="text-xs text-accent-400">Workout in progress — tap to resume</div>
            </div>
            <ChevronRight size={18} className="text-ink-500" />
          </div>
        </Card>
      )}

      {activeProgram?.startDate && activeProgram.weeks && (() => {
        const week = Math.floor(daysBetween(activeProgram.startDate, todayKey()) / 7) + 1;
        const due = week > activeProgram.weeks;
        return (
          <Card className={cn('mb-4', due && 'border-accent-500/40 bg-accent-500/[0.08]')}>
            <div className="flex items-center gap-3">
              <CalendarClock size={18} className={due ? 'text-accent-400' : 'text-ink-500'} />
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {due
                    ? 'Block finished — time to rebuild'
                    : `Week ${Math.max(1, week)} of ${activeProgram.weeks}`}
                </div>
                <HeNote className="text-[11px] text-ink-500">
                  {due
                    ? 'שלח את הסיכום השבועי וקבל תוכנית חדשה'
                    : 'בסוף הבלוק נתכנן מחדש לפי ההתקדמות'}
                </HeNote>
              </div>
            </div>
          </Card>
        );
      })()}

      {activeProgram && activeProgram.days.length > 0 && (
        <>
          <SectionTitle>
            {activeProgram.rotation ? 'Rotation — do the next one' : 'This program'}
          </SectionTitle>
          <div className="space-y-2">
            {activeProgram.days.map((day) => (
              <Card key={day.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{day.name}</div>
                  <div className="text-xs text-ink-500">
                    {day.items.length} {day.items.length === 1 ? 'exercise' : 'exercises'}
                  </div>
                </div>
                <button
                  className="btn-primary py-2 px-3.5 text-sm"
                  onClick={() => quickStart(activeProgram.id, day.id, day.name)}
                  disabled={day.items.length === 0}
                >
                  <Play size={15} fill="currentColor" />
                  Start
                </button>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle
        action={
          <button
            className="text-xs text-ink-400 hover:text-ink-200 flex items-center gap-1"
            onClick={() => setShowArchived((v) => !v)}
          >
            <Archive size={13} />
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
        }
      >
        Programs
      </SectionTitle>

      {visible.length === 0 ? (
        <Card>
          <Empty
            icon={<Dumbbell size={32} />}
            title="No programs yet"
            hint={
              <HeNote className="text-center">
                תוכנית היא תבנית שבועית — ימי אימון עם תרגילים, סטים וחזרות. בנה אחת פעם אחת, ואז כל
                אימון מתחיל בלחיצה אחת במקום להקליד הכול מחדש.
              </HeNote>
            }
          />
          <button className="btn-primary w-full" onClick={() => setCreating(true)}>
            <Plus size={17} />
            New program
          </button>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => (
            <Card key={p.id} onClick={() => navigate(`/train/program/${p.id}`)}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{p.name}</span>
                    {p.active && !p.archived && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-accent-500/20 text-accent-400 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    )}
                    {p.archived && (
                      <span className="text-[10px] uppercase tracking-wide text-ink-500">Archived</span>
                    )}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {p.days.length} {p.days.length === 1 ? 'day' : 'days'} ·{' '}
                    {p.days.reduce((n, d) => n + d.items.length, 0)} exercises
                  </div>
                </div>
                <Pencil size={16} className="text-ink-500 shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <SectionTitle>Quick start</SectionTitle>
      <div className="space-y-2">
        <button
          className="btn-ghost w-full"
          onClick={() => quickStart(null, null, 'Open workout')}
        >
          <Dumbbell size={17} />
          Empty workout
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => onImportFile(e.target.files?.[0])}
        />
        <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()}>
          <Upload size={17} />
          Import a program file
        </button>
      </div>

      {recent.length > 0 && (
        <>
          <SectionTitle>Recent workouts</SectionTitle>
          <div className="space-y-2">
            {recent.slice(0, 8).map((s) => (
              <RecentRow key={s.id} session={s} onOpen={() => navigate(`/session/${s.id}/summary`)} />
            ))}
          </div>
        </>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="New program">
        <label className="label">Program name</label>
        <input
          className="field mt-1.5"
          placeholder="e.g. Upper / Lower — Autumn"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createProgram()}
          autoFocus
        />
        <HeNote className="mt-3">
          תן שם שתזהה בעוד חודשיים. אפשר להחזיק כמה תוכניות במקביל ולהחליף ביניהן.
        </HeNote>
        <button className="btn-primary w-full mt-5" onClick={createProgram} disabled={!newName.trim()}>
          Create
        </button>
      </Sheet>
    </Screen>
  );
}

function RecentRow({ session, onOpen }: { session: Session; onOpen: () => void }) {
  const sets = useLiveQuery(
    () => db.setLogs.where('sessionId').equals(session.id).toArray(),
    [session.id],
    []
  );

  const volume = sets.reduce((n, s) => n + (s.weight ?? 0) * (s.reps ?? 0), 0);
  const duration =
    session.finishedAt && session.startedAt
      ? new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()
      : null;

  return (
    <Card onClick={onOpen}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{session.name}</div>
          <div className="text-xs text-ink-500 mt-0.5">
            {relativeDay(session.date) ?? longDate(session.date)} · {sets.length} sets
            {volume > 0 && <> · {formatVolume(volume)}</>}
            {duration !== null && duration > 0 && <> · {formatDuration(duration)}</>}
          </div>
        </div>
        <ChevronRight size={16} className={cn('text-ink-600 shrink-0')} />
      </div>
    </Card>
  );
}
