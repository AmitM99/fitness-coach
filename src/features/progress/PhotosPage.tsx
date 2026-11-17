import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, Trash2, Columns2, Grid3x3 } from 'lucide-react';
import { db, uid, type ProgressPhoto } from '@/db/schema';
import { Screen, Card, Empty, Sheet, HeNote, Confirm, useToast, cn } from '@/components/ui';
import { longDate, todayKey } from '@/lib/date';
import { sanitizePhoto } from '@/lib/image';

const POSES = [
  { key: 'front', label: 'Front', he: 'חזית' },
  { key: 'side', label: 'Side', he: 'צד' },
  { key: 'back', label: 'Back', he: 'גב' },
] as const;

/** Keeps object URLs alive for the lifetime of the component, then revokes them. */
function usePhotoUrls(photos: ProgressPhoto[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const p of photos) next[p.id] = URL.createObjectURL(p.blob);
    setUrls(next);
    return () => Object.values(next).forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  return urls;
}

export default function PhotosPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const photos = useLiveQuery(
    () => db.photos.orderBy('date').reverse().toArray(),
    [],
    [] as ProgressPhoto[]
  );

  const [pose, setPose] = useState<(typeof POSES)[number]['key']>('front');
  const [mode, setMode] = useState<'grid' | 'compare'>('grid');
  const [pendingDelete, setPendingDelete] = useState<ProgressPhoto | null>(null);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);

  const filtered = useMemo(() => photos.filter((p) => p.pose === pose), [photos, pose]);
  const urls = usePhotoUrls(photos);

  // Default the comparison to oldest vs newest — the view people actually want.
  useEffect(() => {
    if (filtered.length >= 2) {
      setCompareA(filtered.at(-1)!.id);
      setCompareB(filtered[0].id);
    } else {
      setCompareA(null);
      setCompareB(null);
    }
  }, [pose, filtered.length]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    let added = 0;
    for (const file of Array.from(files).slice(0, 20)) {
      try {
        await db.photos.add({
          id: uid(),
          date: todayKey(),
          pose,
          blob: await sanitizePhoto(file),
          note: '',
        });
        added++;
      } catch (err) {
        toast((err as Error).message, 'bad');
      }
    }
    if (added) toast(`Added to ${pose}`);
    if (fileRef.current) fileRef.current.value = '';
  }

  const photoById = new Map(photos.map((p) => [p.id, p]));
  const a = compareA ? photoById.get(compareA) : null;
  const b = compareB ? photoById.get(compareB) : null;

  return (
    <Screen
      title="Progress Photos"
      subtitle="Stored on this device only"
      back
      action={
        <button
          onClick={() => setMode((m) => (m === 'grid' ? 'compare' : 'grid'))}
          className="p-2 rounded-lg text-ink-300 hover:bg-ink-850"
          aria-label="Toggle view"
          disabled={filtered.length < 2}
        >
          {mode === 'grid' ? <Columns2 size={20} /> : <Grid3x3 size={20} />}
        </button>
      }
    >
      <div className="rail pb-2 mb-4">
        {POSES.map((p) => (
          <button
            key={p.key}
            className={cn('chip', pose === p.key ? 'chip-on' : 'chip-off')}
            onClick={() => setPose(p.key)}
          >
            {p.label}
            <span className="he text-[11px] opacity-70 mr-1"> {p.he}</span>
          </button>
        ))}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      <button className="btn-primary w-full mb-4" onClick={() => fileRef.current?.click()}>
        <Camera size={17} />
        Add {pose} photo
      </button>

      {filtered.length === 0 ? (
        <Card>
          <Empty
            icon={<Camera size={32} />}
            title="No photos in this pose yet"
            hint={
              <HeNote className="text-center">
                אותה תאורה, אותו מקום, אותה שעה — אחרת ההשוואה מטעה. אחת לשבועיים מספיק.
                <br />
                התמונות נשמרות רק במכשיר הזה ולא נשלחות לשום מקום.
              </HeNote>
            }
          />
        </Card>
      ) : mode === 'compare' && a && b ? (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[a, b].map((p, i) => (
              <div key={p.id}>
                <img
                  src={urls[p.id]}
                  alt={`${pose} on ${p.date}`}
                  className="w-full aspect-[3/4] object-cover rounded-xl bg-ink-850"
                />
                <div className="text-center text-xs text-ink-400 mt-1.5">{longDate(p.date)}</div>
                <select
                  className="field mt-1.5 py-1.5 text-xs text-center"
                  value={p.id}
                  onChange={(e) => (i === 0 ? setCompareA(e.target.value) : setCompareB(e.target.value))}
                >
                  {filtered.map((f) => (
                    <option key={f.id} value={f.id}>
                      {longDate(f.date)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <HeNote className="text-center text-xs text-ink-500">
            שינוי אמיתי בגוף לוקח שבועות. אם ההשוואה קרובה מדי בזמן, כנראה לא תראה כלום — וזה תקין.
          </HeNote>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((p) => (
            <button key={p.id} className="relative group" onClick={() => setViewing(p)}>
              <img
                src={urls[p.id]}
                alt={`${pose} on ${p.date}`}
                className="w-full aspect-[3/4] object-cover rounded-xl bg-ink-850"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl px-2 py-1.5">
                <span className="text-xs font-medium">{longDate(p.date)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing ? longDate(viewing.date) : ''}>
        {viewing && (
          <>
            <img
              src={urls[viewing.id]}
              alt=""
              className="w-full rounded-xl mb-4 bg-ink-850"
            />
            <label className="label">Note</label>
            <input
              className="field mt-1.5 he mb-4"
              placeholder="משקל, תחושה, שלב בתוכנית…"
              value={viewing.note}
              onChange={(e) => {
                const note = e.target.value;
                setViewing({ ...viewing, note });
                db.photos.put({ ...viewing, note });
              }}
            />
            <button
              className="btn-danger w-full"
              onClick={() => {
                setPendingDelete(viewing);
                setViewing(null);
              }}
            >
              <Trash2 size={16} />
              Delete photo
            </button>
          </>
        )}
      </Sheet>

      <Confirm
        open={!!pendingDelete}
        title="Delete this photo?"
        body="It will be removed from this device permanently."
        onConfirm={async () => {
          if (pendingDelete) {
            await db.photos.delete(pendingDelete.id);
            toast('Photo deleted');
          }
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}
