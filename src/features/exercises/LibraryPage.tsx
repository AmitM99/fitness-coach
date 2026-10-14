import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, SlidersHorizontal, Languages } from 'lucide-react';
import { db, type Exercise } from '@/db/schema';
import { Screen, Sheet, Empty, cn } from '@/components/ui';
import ExerciseThumb from './ExerciseThumb';

const PAGE = 60;

export default function LibraryPage() {
  const navigate = useNavigate();
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [] as Exercise[]);

  const [query, setQuery] = useState('');
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [onlyCues, setOnlyCues] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const facets = useMemo(() => {
    const uniq = (fn: (e: Exercise) => string) => [...new Set(exercises.map(fn))].sort();
    return {
      bodyParts: uniq((e) => e.bodyPart),
      equipment: uniq((e) => e.equipment),
      targets: uniq((e) => e.target),
    };
  }, [exercises]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises
      .filter((e) => (bodyPart ? e.bodyPart === bodyPart : true))
      .filter((e) => (equipment ? e.equipment === equipment : true))
      .filter((e) => (target ? e.target === target : true))
      .filter((e) => (onlyCues ? !!e.cuesHe : true))
      .filter((e) =>
        q
          ? e.name.toLowerCase().includes(q) ||
            e.target.toLowerCase().includes(q) ||
            e.targetHe.includes(q) ||
            e.bodyPartHe.includes(q)
          : true
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, query, bodyPart, equipment, target, onlyCues]);

  const activeFilters = [bodyPart, equipment, target].filter(Boolean).length + (onlyCues ? 1 : 0);

  return (
    <Screen
      title="Exercise Library"
      subtitle={`${results.length} of ${exercises.length} exercises`}
      action={
        <button
          onClick={() => setFiltersOpen(true)}
          className={cn(
            'p-2 rounded-lg relative',
            activeFilters ? 'text-accent-400' : 'text-ink-300 hover:bg-ink-850'
          )}
          aria-label="Filters"
        >
          <SlidersHorizontal size={20} />
          {activeFilters > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent-500 text-ink-950 text-[10px] font-bold flex items-center justify-center">
              {activeFilters}
            </span>
          )}
        </button>
      }
    >
      <div className="relative mb-3">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
        <input
          className="field pl-9"
          placeholder="Search by name or muscle…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
        />
      </div>

      <div className="rail pb-2 mb-3">
        <button
          className={cn('chip', bodyPart === null ? 'chip-on' : 'chip-off')}
          onClick={() => setBodyPart(null)}
        >
          All
        </button>
        {facets.bodyParts.map((bp) => {
          const he = exercises.find((e) => e.bodyPart === bp)?.bodyPartHe;
          return (
            <button
              key={bp}
              className={cn('chip capitalize', bodyPart === bp ? 'chip-on' : 'chip-off')}
              onClick={() => {
                setBodyPart(bp === bodyPart ? null : bp);
                setLimit(PAGE);
              }}
              title={he}
            >
              {bp}
            </button>
          );
        })}
      </div>

      {results.length === 0 ? (
        <Empty title="No exercises match" hint="Try clearing a filter or searching for something broader." />
      ) : (
        <>
          <div className="space-y-1.5">
            {results.slice(0, limit).map((ex) => (
              <button
                key={ex.id}
                onClick={() => navigate(`/exercises/${ex.id}`)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-ink-850 text-left"
                aria-label={`${ex.name} — ${ex.target}, ${ex.equipment}`}
              >
                <ExerciseThumb exercise={ex} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium capitalize truncate text-sm">{ex.name}</div>
                  <div className="text-xs text-ink-500 capitalize truncate">
                    {ex.target} · {ex.equipment}
                  </div>
                </div>
                {ex.cuesHe && (
                  <Languages size={14} className="text-accent-500/70 shrink-0" aria-label="Has Hebrew cues" />
                )}
              </button>
            ))}
          </div>

          {limit < results.length && (
            <button className="btn-ghost w-full mt-4" onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({results.length - limit} left)
            </button>
          )}
        </>
      )}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <FilterGroup
          label="Equipment"
          options={facets.equipment}
          value={equipment}
          onChange={(v) => {
            setEquipment(v);
            setLimit(PAGE);
          }}
          heFor={(k) => exercises.find((e) => e.equipment === k)?.equipmentHe}
        />
        <FilterGroup
          label="Target muscle"
          options={facets.targets}
          value={target}
          onChange={(v) => {
            setTarget(v);
            setLimit(PAGE);
          }}
          heFor={(k) => exercises.find((e) => e.target === k)?.targetHe}
        />

        <label className="flex items-center gap-3 mt-5 p-3 rounded-xl bg-ink-850 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyCues}
            onChange={(e) => setOnlyCues(e.target.checked)}
            className="w-4 h-4 accent-accent-500"
          />
          <div>
            <div className="text-sm font-medium">Only with Hebrew cues</div>
            <div className="he text-xs text-ink-500">רק תרגילים עם דגשי ביצוע בעברית</div>
          </div>
        </label>

        <button
          className="btn-ghost w-full mt-4"
          onClick={() => {
            setBodyPart(null);
            setEquipment(null);
            setTarget(null);
            setOnlyCues(false);
          }}
        >
          Clear all filters
        </button>
      </Sheet>
    </Screen>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
  heFor,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  heFor: (key: string) => string | undefined;
}) {
  return (
    <div className="mb-5">
      <div className="label mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            className={cn('chip capitalize text-xs', value === o ? 'chip-on' : 'chip-off')}
            onClick={() => onChange(o === value ? null : o)}
          >
            {o}
            {heFor(o) && <span className="he text-[10px] opacity-70 mr-1"> {heFor(o)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
