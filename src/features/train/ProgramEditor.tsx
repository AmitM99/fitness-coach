import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Settings2, Link2, Link2Off, Repeat2, Download, X,
} from 'lucide-react';
import { db, uid, type Exercise, type PlanDay, type PlanItem, type Program } from '@/db/schema';
import {
  Screen, Card, Empty, Sheet, HeNote, NumberPad, Confirm, useToast, cn,
} from '@/components/ui';
import ExercisePicker from '@/features/exercises/ExercisePicker';
import ExerciseThumb from '@/features/exercises/ExerciseThumb';
import { groupPlanItems } from '@/lib/training';
import { downloadFile } from '@/lib/backup';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ProgramEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const program = useLiveQuery(() => (id ? db.programs.get(id) : undefined), [id]);
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [] as Exercise[]);
  const byId = new Map(exercises.map((e) => [e.id, e]));

  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<{ dayId: string; item: PlanItem } | null>(null);
  const [editing, setEditing] = useState<{ dayId: string; item: PlanItem } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!program) {
    return (
      <Screen title="Program" back>
        <Empty title="Program not found" />
      </Screen>
    );
  }

  const save = (patch: Partial<Program>) => db.programs.put({ ...program, ...patch });

  const updateDays = (days: PlanDay[]) => save({ days });

  const addDay = () => {
    const day: PlanDay = {
      id: uid(),
      name: `Day ${program.days.length + 1}`,
      dayOfWeek: null,
      items: [],
    };
    updateDays([...program.days, day]);
  };

  const patchDay = (dayId: string, patch: Partial<PlanDay>) =>
    updateDays(program.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)));

  const removeDay = (dayId: string) => updateDays(program.days.filter((d) => d.id !== dayId));

  const addExercise = (dayId: string, ex: Exercise) => {
    const item: PlanItem = {
      id: uid(),
      exerciseId: ex.id,
      group: null,
      targetSets: 3,
      targetReps: '8-10',
      targetWeight: null,
      restSec: 90,
      notes: '',
    };
    patchDay(dayId, { items: [...(program.days.find((d) => d.id === dayId)?.items ?? []), item] });
  };

  const patchItem = (dayId: string, itemId: string, patch: Partial<PlanItem>) => {
    const day = program.days.find((d) => d.id === dayId);
    if (!day) return;
    patchDay(dayId, {
      items: day.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    });
  };

  const removeItem = (dayId: string, itemId: string) => {
    const day = program.days.find((d) => d.id === dayId);
    if (!day) return;
    patchDay(dayId, { items: day.items.filter((it) => it.id !== itemId) });
  };

  const moveItem = (dayId: string, index: number, dir: -1 | 1) => {
    const day = program.days.find((d) => d.id === dayId);
    if (!day) return;
    const next = [...day.items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patchDay(dayId, { items: next });
  };

  /** Links an item to the one above it, making them a superset. */
  const toggleSuperset = (dayId: string, index: number) => {
    const day = program.days.find((d) => d.id === dayId);
    if (!day || index === 0) return;
    const items = [...day.items];
    const prev = items[index - 1];
    const cur = items[index];

    if (cur.group && cur.group === prev.group) {
      items[index] = { ...cur, group: null };
    } else {
      const group = prev.group ?? uid().slice(0, 4);
      items[index - 1] = { ...prev, group };
      items[index] = { ...cur, group };
    }
    patchDay(dayId, { items });
  };

  const deleteProgram = async () => {
    await db.programs.delete(program.id);
    toast('Program deleted');
    navigate('/train');
  };

  const makeActive = async () => {
    const all = await db.programs.toArray();
    await db.programs.bulkPut(all.map((p) => ({ ...p, active: p.id === program.id })));
    toast(`"${program.name}" is now your active program`);
  };

  return (
    <Screen
      title={program.name}
      subtitle={`${program.days.length} days · ${program.days.reduce((n, d) => n + d.items.length, 0)} exercises`}
      back
      action={
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-lg text-ink-300 hover:bg-ink-850"
          aria-label="Program settings"
        >
          <Settings2 size={20} />
        </button>
      }
    >
      {program.days.length === 0 && (
        <Card>
          <Empty
            title="No training days yet"
            hint={
              <HeNote className="text-center">
                כל "יום" הוא אימון אחד בתוכנית — למשל Push, Pull, Legs. אחר כך פשוט לוחצים Start על היום
                שמתאים.
              </HeNote>
            }
          />
        </Card>
      )}

      <div className="space-y-4">
        {program.days.map((day, dayIdx) => {
          const groups = groupPlanItems(day.items);
          return (
            <Card key={day.id} className="p-0 overflow-hidden">
              <div className="p-3.5 border-b border-ink-850 flex items-center gap-2">
                <input
                  className="bg-transparent font-semibold outline-none flex-1 min-w-0 focus:text-accent-400"
                  value={day.name}
                  onChange={(e) => patchDay(day.id, { name: e.target.value })}
                />
                <select
                  className="bg-ink-850 border border-ink-700 rounded-lg text-xs px-2 py-1.5 text-ink-300"
                  value={day.dayOfWeek ?? ''}
                  onChange={(e) =>
                    patchDay(day.id, { dayOfWeek: e.target.value === '' ? null : Number(e.target.value) })
                  }
                >
                  <option value="">Any day</option>
                  {DOW.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeDay(day.id)}
                  className="p-1.5 rounded-lg text-ink-500 hover:text-bad hover:bg-ink-850"
                  aria-label={`Delete ${day.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="divide-y divide-ink-850">
                {groups.map((group, gi) => (
                  <div key={gi} className={cn(group.length > 1 && 'bg-accent-500/[0.04]')}>
                    {group.length > 1 && (
                      <div className="px-3.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-accent-500/80">
                        Superset — {group.length} exercises
                      </div>
                    )}
                    {group.map((item) => {
                      const index = day.items.findIndex((i) => i.id === item.id);
                      const ex = byId.get(item.exerciseId);
                      return (
                        <div key={item.id} className="p-3 flex items-center gap-2.5">
                          <div className="flex flex-col text-ink-600">
                            <button
                              onClick={() => moveItem(day.id, index, -1)}
                              disabled={index === 0}
                              className="disabled:opacity-25 hover:text-ink-300"
                              aria-label="Move up"
                            >
                              <ChevronUp size={15} />
                            </button>
                            <button
                              onClick={() => moveItem(day.id, index, 1)}
                              disabled={index === day.items.length - 1}
                              className="disabled:opacity-25 hover:text-ink-300"
                              aria-label="Move down"
                            >
                              <ChevronDown size={15} />
                            </button>
                          </div>

                          {ex && <ExerciseThumb exercise={ex} size={40} />}

                          <button
                            className="flex-1 min-w-0 text-left"
                            onClick={() => setEditing({ dayId: day.id, item })}
                          >
                            <div className="text-sm font-medium capitalize truncate">
                              {ex?.name ?? 'Unknown exercise'}
                            </div>
                            <div className="text-xs text-ink-500 tnum">
                              {item.targetSets} × {item.targetReps}
                              {item.targetWeight ? ` @ ${item.targetWeight}kg` : ''} · {item.restSec}s rest
                              {item.alternatives?.length ? ` · ${item.alternatives.length} alt` : ''}
                            </div>
                            {item.notes && (
                              <div className="he text-[11px] text-accent-500/80 truncate mt-0.5">
                                {item.notes}
                              </div>
                            )}
                          </button>

                          <button
                            onClick={() => setSwapping({ dayId: day.id, item })}
                            className="p-1.5 rounded-lg text-ink-600 hover:text-accent-400"
                            aria-label="Swap exercise"
                          >
                            <Repeat2 size={15} />
                          </button>

                          <button
                            onClick={() => toggleSuperset(day.id, index)}
                            disabled={index === 0}
                            className={cn(
                              'p-1.5 rounded-lg disabled:opacity-20',
                              item.group && day.items[index - 1]?.group === item.group
                                ? 'text-accent-400'
                                : 'text-ink-600 hover:text-ink-300'
                            )}
                            aria-label="Toggle superset with previous"
                          >
                            {item.group && day.items[index - 1]?.group === item.group ? (
                              <Link2 size={15} />
                            ) : (
                              <Link2Off size={15} />
                            )}
                          </button>

                          <button
                            onClick={() => removeItem(day.id, item.id)}
                            className="p-1.5 rounded-lg text-ink-600 hover:text-bad"
                            aria-label="Remove exercise"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <button
                className="w-full py-3 text-sm font-medium text-accent-400 hover:bg-ink-850 flex items-center justify-center gap-1.5 border-t border-ink-850"
                onClick={() => setPickerDay(day.id)}
              >
                <Plus size={16} />
                Add exercise
              </button>

              {dayIdx === program.days.length - 1 && <div />}
            </Card>
          );
        })}
      </div>

      <button className="btn-ghost w-full mt-4" onClick={addDay}>
        <Plus size={17} />
        Add training day
      </button>

      <ExercisePicker
        open={pickerDay !== null}
        onClose={() => setPickerDay(null)}
        onPick={(ex) => pickerDay && addExercise(pickerDay, ex)}
      />

      <ExercisePicker
        open={swapping !== null}
        onClose={() => setSwapping(null)}
        title="Swap exercise"
        similarTo={swapping ? byId.get(swapping.item.exerciseId) ?? null : null}
        onPick={(ex) => {
          if (!swapping) return;
          // Sets, reps and rest are the prescription — only the movement changes.
          patchItem(swapping.dayId, swapping.item.id, {
            exerciseId: ex.id,
            targetWeight: null,
            alternatives: swapping.item.alternatives?.filter((id) => id !== ex.id),
          });
          toast(`Swapped to ${ex.name}`);
        }}
      />

      <ItemEditor
        editing={editing}
        exercise={editing ? byId.get(editing.item.exerciseId) : undefined}
        byId={byId}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) patchItem(editing.dayId, editing.item.id, patch);
          setEditing(null);
        }}
      />

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Program settings">
        <label className="label">Name</label>
        <input
          className="field mt-1.5 mb-4"
          value={program.name}
          onChange={(e) => save({ name: e.target.value })}
        />

        <label className="label">Description</label>
        <textarea
          className="field mt-1.5 mb-4 min-h-[80px] he"
          placeholder="מטרות התוכנית, דגשים כלליים…"
          value={program.description}
          onChange={(e) => save({ description: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">Block starts</label>
            <input
              type="date"
              className="field mt-1.5"
              value={program.startDate ?? ''}
              onChange={(e) => save({ startDate: e.target.value || null })}
            />
          </div>
          <div>
            <label className="label">Block length</label>
            <input
              type="number"
              inputMode="numeric"
              className="field mt-1.5 tnum"
              placeholder="weeks"
              value={program.weeks ?? ''}
              onChange={(e) => save({ weeks: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
        </div>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-ink-850 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={program.rotation}
            onChange={(e) => save({ rotation: e.target.checked })}
            className="w-4 h-4 accent-accent-500"
          />
          <div>
            <div className="text-sm font-medium">Rotation (A → B → C)</div>
            <div className="he text-[11px] text-ink-500">
              ממשיכים לאימון הבא בתור, בלי ימים קבועים — שורד שבוע שמפספסים
            </div>
          </div>
        </label>

        <div className="space-y-2">
          {!program.active && (
            <button className="btn-primary w-full" onClick={makeActive}>
              Make this my active program
            </button>
          )}
          <button
            className="btn-ghost w-full"
            onClick={() => {
              downloadFile(
                `program-${program.name.replace(/\s+/g, '-').toLowerCase()}.json`,
                JSON.stringify({ app: 'fitness-coach', kind: 'program', program }, null, 2),
                'application/json'
              );
              toast('Program exported');
            }}
          >
            <Download size={16} />
            Export program
          </button>
          <button
            className="btn-ghost w-full"
            onClick={() => save({ archived: !program.archived })}
          >
            {program.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button className="btn-danger w-full" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} />
            Delete program
          </button>
        </div>
      </Sheet>

      <Confirm
        open={confirmDelete}
        title="Delete this program?"
        body="Workouts you already logged from it are kept — only the plan is removed."
        onConfirm={deleteProgram}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

function ItemEditor({
  editing,
  exercise,
  byId,
  onClose,
  onSave,
}: {
  editing: { dayId: string; item: PlanItem } | null;
  exercise: Exercise | undefined;
  byId: Map<string, Exercise>;
  onClose: () => void;
  onSave: (patch: Partial<PlanItem>) => void;
}) {
  const [draft, setDraft] = useState<PlanItem | null>(null);
  const [addingAlt, setAddingAlt] = useState(false);
  const item = draft ?? editing?.item ?? null;

  // Reset the draft whenever a different item is opened.
  if (editing && (!draft || draft.id !== editing.item.id)) {
    setDraft(editing.item);
  }
  if (!editing || !item) return null;

  const set = (patch: Partial<PlanItem>) => setDraft({ ...item, ...patch });
  const alts = item.alternatives ?? [];
  const moveAlt = (from: number, to: number) => {
    const next = [...alts];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    set({ alternatives: next });
  };

  return (
    <>
      <Sheet open={!addingAlt} onClose={onClose} title={exercise?.name ?? 'Exercise'}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Sets</label>
            <div className="mt-1.5">
              <NumberPad
                value={item.targetSets}
                onChange={(v) => set({ targetSets: Math.max(1, v ?? 1) })}
                step={1}
              />
            </div>
          </div>
          <div>
            <label className="label">Reps</label>
            <input
              className="field mt-1.5 text-center tnum font-semibold"
              value={item.targetReps}
              onChange={(e) => set({ targetReps: e.target.value })}
              placeholder="8-10"
            />
          </div>
          <div>
            <label className="label">Target weight</label>
            <div className="mt-1.5">
              <NumberPad
                value={item.targetWeight}
                onChange={(v) => set({ targetWeight: v })}
                step={2.5}
                suffix="kg"
              />
            </div>
          </div>
          <div>
            <label className="label">Rest</label>
            <div className="mt-1.5">
              <NumberPad
                value={item.restSec}
                onChange={(v) => set({ restSec: Math.max(0, v ?? 0) })}
                step={15}
                suffix="s"
              />
            </div>
          </div>
        </div>

        <label className="label mt-4 block">Coaching note — דגש</label>
        <textarea
          className="field mt-1.5 min-h-[70px] he"
          placeholder="למשל: להתמקד בירידה איטית, 3 שניות"
          value={item.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />

        {exercise?.cuesHe && (
          <div className="mt-3 p-3 rounded-xl bg-ink-850 border border-ink-800">
            <div className="label mb-1.5">Form cues — דגשי ביצוע</div>
            <ul className="he space-y-1">
              {exercise.cuesHe.map((c, i) => (
                <li key={i} className="text-xs text-ink-300 leading-relaxed">
                  • {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        <label className="label mt-4 block">Alternatives — חלופות</label>
        <HeNote className="text-xs text-ink-500 mt-1 mb-2">
          מה עושים כשהמכונה תקולה או תפוסה. הראשונה ברשימה מוצעת ראשונה.
        </HeNote>
        <div className="space-y-1.5">
          {alts.map((altId, i) => {
            const alt = byId.get(altId);
            return (
              <div key={altId} className="flex items-center gap-2 p-1.5 rounded-xl bg-ink-850/60">
                {alt && <ExerciseThumb exercise={alt} size={32} />}
                <div className="flex-1 min-w-0 text-sm capitalize truncate">
                  {alt?.name ?? `Unknown exercise ${altId}`}
                </div>
                <button
                  className="p-1 text-ink-500 disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => moveAlt(i, i - 1)}
                  aria-label="Move up"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  className="p-1 text-ink-500 hover:text-bad"
                  onClick={() => set({ alternatives: alts.filter((id) => id !== altId) })}
                  aria-label="Remove alternative"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
        <button className="btn-ghost w-full mt-2 text-sm" onClick={() => setAddingAlt(true)}>
          <Plus size={15} />
          Add alternative
        </button>

        <button className="btn-primary w-full mt-5" onClick={() => onSave(item)}>
          Save
        </button>
      </Sheet>

      <ExercisePicker
        open={addingAlt}
        onClose={() => setAddingAlt(false)}
        title="Add alternative"
        similarTo={exercise ?? null}
        onPick={(ex) => {
          if (ex.id === item.exerciseId || alts.includes(ex.id)) return;
          set({ alternatives: [...alts, ex.id] });
        }}
      />
    </>
  );
}
