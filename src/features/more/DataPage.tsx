import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload, FileSpreadsheet, AlertTriangle, Trash2, HardDrive, ShieldCheck } from 'lucide-react';
import { requestPersistentStorage, storageEstimate } from '@/db/seed';
import { db } from '@/db/schema';
import { Screen, Card, SectionTitle, HeNote, Sheet, Confirm, useToast } from '@/components/ui';
import {
  exportBackup, importBackup, exportWorkoutsCsv, exportBodyCsv, exportNutritionCsv,
  downloadFile, stamp,
} from '@/lib/backup';

export default function DataPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeApiKey, setIncludeApiKey] = useState(false);
  const [pendingImport, setPendingImport] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<{ usedMb: number; quotaMb: number } | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    storageEstimate().then(setUsage);
  }, []);

  const counts = useLiveQuery(async () => ({
    sessions: await db.sessions.count(),
    sets: await db.setLogs.count(),
    weights: await db.weights.count(),
    photos: await db.photos.count(),
    foods: await db.foodLogs.count(),
    programs: await db.programs.count(),
  }), [], null);

  async function doExport() {
    setBusy(true);
    try {
      const payload = await exportBackup({ includePhotos, includeApiKey });
      downloadFile(`coach-backup-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json');
      toast('Backup downloaded');
    } catch (err) {
      toast((err as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      setPendingImport(JSON.parse(text));
    } catch {
      toast('That file is not valid JSON', 'bad');
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function runImport(mode: 'merge' | 'replace') {
    setBusy(true);
    try {
      await importBackup(pendingImport, mode);
      toast(mode === 'replace' ? 'Data replaced' : 'Data merged');
      setPendingImport(null);
    } catch (err) {
      toast((err as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  const csvExports = [
    { label: 'Workouts', he: 'אימונים — שורה לכל סט', fn: exportWorkoutsCsv, file: `coach-workouts-${stamp()}.csv` },
    { label: 'Body metrics', he: 'משקל והיקפים', fn: exportBodyCsv, file: `coach-body-${stamp()}.csv` },
    { label: 'Nutrition', he: 'תיעוד תזונה', fn: exportNutritionCsv, file: `coach-nutrition-${stamp()}.csv` },
  ];

  return (
    <Screen title="Data & Backup" back>
      {counts && (
        <Card className="mb-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ['workouts', counts.sessions],
              ['sets', counts.sets],
              ['programs', counts.programs],
              ['weigh-ins', counts.weights],
              ['photos', counts.photos],
              ['food logs', counts.foods],
            ].map(([label, n]) => (
              <div key={label as string}>
                <div className="text-lg font-bold tnum">{n as number}</div>
                <div className="text-[11px] text-ink-500">{label as string}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <SectionTitle>Storage</SectionTitle>
      <Card>
        <div className="flex items-start gap-3">
          {persisted ? (
            <ShieldCheck size={19} className="text-good mt-0.5 shrink-0" />
          ) : (
            <HardDrive size={19} className="text-warn mt-0.5 shrink-0" />
          )}
          <div className="flex-1">
            <div className="text-sm font-medium mb-1">
              {persisted === null
                ? 'Storage status unknown'
                : persisted
                  ? 'Data is protected from automatic cleanup'
                  : 'Data is not marked as persistent'}
            </div>
            <HeNote className="text-xs text-ink-400 leading-relaxed">
              {persisted
                ? 'הדפדפן התחייב לא למחוק את הנתונים כדי לפנות מקום. עדיין שווה לשמור גיבוי מדי פעם.'
                : 'הדפדפן עשוי למחוק את הנתונים אם ייגמר מקום. באייפון — הוספה למסך הבית מקטינה מאוד את הסיכון. בכל מקרה, שמור גיבוי.'}
            </HeNote>
            {usage && (
              <div className="text-[11px] text-ink-500 tnum mt-2">
                {usage.usedMb} MB used of ~{usage.quotaMb} MB available
              </div>
            )}
            {!persisted && (
              <button
                className="btn-ghost w-full mt-3 py-2 text-sm"
                onClick={async () => {
                  const ok = await requestPersistentStorage();
                  setPersisted(ok);
                  toast(ok ? 'Storage is now persistent' : 'The browser declined — keep backups');
                }}
              >
                Request persistent storage
              </button>
            )}
          </div>
        </div>
      </Card>

      <SectionTitle>Full backup</SectionTitle>
      <Card>
        <HeNote className="text-xs text-ink-400 mb-4 leading-relaxed">
          קובץ JSON אחד עם כל הנתונים שלך, כולל תמונות. זה הקובץ שמשחזר הכול — שמור אותו במקום בטוח.
        </HeNote>

        <label className="flex items-center gap-3 p-2.5 rounded-xl bg-ink-850 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includePhotos}
            onChange={(e) => setIncludePhotos(e.target.checked)}
            className="w-4 h-4 accent-accent-500"
          />
          <div className="flex-1">
            <div className="text-sm">Include progress photos</div>
            <div className="text-[11px] text-ink-500">Makes the file much larger</div>
          </div>
        </label>

        <label className="flex items-center gap-3 p-2.5 rounded-xl bg-ink-850 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={includeApiKey}
            onChange={(e) => setIncludeApiKey(e.target.checked)}
            className="w-4 h-4 accent-accent-500"
          />
          <div className="flex-1">
            <div className="text-sm">Include API key</div>
            <div className="he text-[11px] text-ink-500">
              כבוי כברירת מחדל — זה סוד, לא נתוני אימון
            </div>
          </div>
        </label>

        <button className="btn-primary w-full" onClick={doExport} disabled={busy}>
          <Download size={17} />
          Download backup
        </button>
      </Card>

      <SectionTitle>Spreadsheet export</SectionTitle>
      <Card>
        <HeNote className="text-xs text-ink-400 mb-3">
          CSV שנפתח ישירות באקסל או ב‑Google Sheets, בלי צורך באפליקציה הזו.
        </HeNote>
        <div className="space-y-2">
          {csvExports.map(({ label, he, fn, file }) => (
            <button
              key={label}
              className="btn-ghost w-full justify-start"
              onClick={async () => {
                const csv = await fn();
                // Excel needs the BOM to read Hebrew correctly.
                downloadFile(file, '﻿' + csv, 'text/csv;charset=utf-8');
                toast(`${label} exported`);
              }}
            >
              <FileSpreadsheet size={17} className="text-ink-400" />
              <span className="flex-1 text-left">
                {label}
                <span className="he block text-[11px] text-ink-500 font-normal">{he}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <SectionTitle>Restore</SectionTitle>
      <Card>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()}>
          <Upload size={17} />
          Choose a backup file
        </button>
      </Card>

      <SectionTitle>Danger zone</SectionTitle>
      <Card className="border-bad/25">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={18} className="text-bad mt-0.5 shrink-0" />
          <HeNote className="text-xs text-ink-400 leading-relaxed">
            מוחק את מה שתיעדת — אימונים, משקל, היקפים, תמונות ותזונה. <strong>הפרופיל,
            ההגדרות והתוכניות שלך נשמרים</strong>, וכך גם ספריית התרגילים ומאגר המזון.
            אין דרך לשחזר בלי קובץ גיבוי.
          </HeNote>
        </div>
        <button className="btn-danger w-full" onClick={() => setConfirmWipe(true)}>
          <Trash2 size={16} />
          Erase all my data
        </button>
      </Card>

      <Sheet open={pendingImport !== null} onClose={() => setPendingImport(null)} title="Restore backup">
        <HeNote className="text-sm text-ink-300 mb-5 leading-relaxed">
          <strong>Merge</strong> — מוסיף את הנתונים מהקובץ ודורס רשומות עם אותו מזהה.
          <br />
          <strong>Replace</strong> — מוחק את כל מה שקיים עכשיו ומחליף בקובץ.
        </HeNote>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => runImport('merge')} disabled={busy}>
            Merge
          </button>
          <button className="btn-danger flex-1" onClick={() => runImport('replace')} disabled={busy}>
            Replace
          </button>
        </div>
      </Sheet>

      <Confirm
        open={confirmWipe}
        title="Erase all your data?"
        body="Workouts, weigh-ins, measurements, photos and food logs will be permanently deleted from this device. Your athlete profile and settings are kept."
        confirmLabel="Erase everything"
        onConfirm={async () => {
          await db.transaction(
            'rw',
            [db.programs, db.sessions, db.setLogs, db.weights, db.measurements,
             db.foodLogs, db.habits, db.habitLogs, db.reviews, db.photos],
            async () => {
              await Promise.all([
                db.sessions.clear(), db.setLogs.clear(),
                db.weights.clear(), db.measurements.clear(), db.foodLogs.clear(),
                db.habits.clear(), db.habitLogs.clear(), db.reviews.clear(), db.photos.clear(),
              ]);
            }
          );
          toast('All personal data erased');
        }}
        onCancel={() => setConfirmWipe(false)}
      />
    </Screen>
  );
}
