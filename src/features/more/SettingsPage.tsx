import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Eye, EyeOff, ExternalLink, Bell, BellOff, Smartphone, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSettings, updateSettings, type SettingsRow } from '@/db/schema';
import { Screen, Card, SectionTitle, HeNote, useToast } from '@/components/ui';
import {
  isIOS, isInstalledStandalone, notificationPermission, notificationsSupported,
  requestNotificationPermission, notify,
} from '@/lib/notify';
import { playRestDone, unlockAudio } from '@/lib/sound';

export default function SettingsPage() {
  const toast = useToast();
  const settings = useLiveQuery(() => getSettings(), []);
  const [draft, setDraft] = useState<SettingsRow | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (settings && !draft) setDraft(settings);
  }, [settings, draft]);

  if (!draft) return <Screen title="Settings" back>{null}</Screen>;

  const set = (patch: Partial<SettingsRow>) => setDraft({ ...draft, ...patch });

  const num = (v: string): number | null => (v === '' ? null : Number(v));

  async function save() {
    if (!draft) return;
    await updateSettings(draft);
    toast('Settings saved');
  }

  return (
    <Screen
      title="Settings"
      back
      action={
        <button className="btn-primary py-1.5 px-3.5 text-sm" onClick={save}>
          Save
        </button>
      }
    >
      <Link to="/more/help" className="btn-ghost w-full mb-2 justify-start">
        <HelpCircle size={17} className="text-accent-400" />
        <span className="flex-1 text-left">
          How this works
          <span className="he block text-[11px] text-ink-500 font-normal">
            מדריך קצר לשימוש באפליקציה
          </span>
        </span>
      </Link>

      <SectionTitle>Profile</SectionTitle>
      <Card className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input
            className="field mt-1.5"
            value={draft.displayName}
            onChange={(e) => set({ displayName: e.target.value })}
            placeholder="Shown on the Today screen"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Height</label>
            <input
              type="number"
              inputMode="decimal"
              className="field mt-1.5 tnum"
              value={draft.heightCm ?? ''}
              onChange={(e) => set({ heightCm: num(e.target.value) })}
              placeholder="cm"
            />
          </div>
          <div>
            <label className="label">Goal weight</label>
            <input
              type="number"
              inputMode="decimal"
              className="field mt-1.5 tnum"
              value={draft.goalWeightKg ?? ''}
              onChange={(e) => set({ goalWeightKg: num(e.target.value) })}
              placeholder="kg"
            />
          </div>
        </div>
      </Card>

      <SectionTitle>Daily nutrition targets</SectionTitle>
      <Card>
        <HeNote className="text-xs text-ink-500 mb-3">
          אופציונלי לגמרי. אם תשאיר ריק, מסך התזונה פשוט יציג את הסכומים בלי יעד להשוות אליו.
        </HeNote>
        <div className="grid grid-cols-2 gap-3">
          {([
            ['targetKcal', 'Calories', 'kcal'],
            ['targetProtein', 'Protein', 'g'],
            ['targetCarbs', 'Carbs', 'g'],
            ['targetFat', 'Fat', 'g'],
          ] as const).map(([key, label, unit]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                type="number"
                inputMode="numeric"
                className="field mt-1.5 tnum"
                value={draft[key] ?? ''}
                onChange={(e) => set({ [key]: num(e.target.value) } as Partial<SettingsRow>)}
                placeholder={unit}
              />
            </div>
          ))}
        </div>
      </Card>

      <SectionTitle>Rest timer</SectionTitle>
      <Card>
        <label className="flex items-center gap-3 p-2.5 rounded-xl bg-ink-850 cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={draft.autoRest}
            onChange={(e) => set({ autoRest: e.target.checked })}
            className="w-4 h-4 accent-accent-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium">Start automatically</div>
            <div className="he text-[11px] text-ink-500">
              הטיימר יוצא לדרך ברגע שאתה מסמן סט כהושלם
            </div>
          </div>
        </label>

        <label className="flex items-center gap-3 p-2.5 rounded-xl bg-ink-850 cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={draft.restSound}
            onChange={(e) => {
              set({ restSound: e.target.checked });
              if (e.target.checked) {
                // Preview it, and use this tap to unlock audio on iOS.
                unlockAudio();
                playRestDone();
              }
            }}
            className="w-4 h-4 accent-accent-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium">Play a sound</div>
            <div className="he text-[11px] text-ink-500">
              צליל בסיום הספירה. סמן כדי לשמוע דוגמה — לא יעבוד אם הטלפון במצב שקט
            </div>
          </div>
        </label>

        <label className="flex items-center gap-3 p-2.5 rounded-xl bg-ink-850 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={draft.restVibrate}
            onChange={(e) => set({ restVibrate: e.target.checked })}
            className="w-4 h-4 accent-accent-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium">Vibrate when done</div>
            <div className="he text-[11px] text-ink-500">רטט קצר בסוף הספירה — עדיף על צליל בחדר כושר</div>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Between sets</label>
            <input
              type="number"
              inputMode="numeric"
              className="field mt-1.5 tnum"
              value={draft.defaultRestSec}
              onChange={(e) => set({ defaultRestSec: Math.max(0, Number(e.target.value)) })}
            />
            <div className="he text-[10px] text-ink-600 mt-1">
              שניות. תוכנית עם מנוחה משלה גוברת על זה.
            </div>
          </div>
          <div>
            <label className="label">Between exercises</label>
            <input
              type="number"
              inputMode="numeric"
              className="field mt-1.5 tnum"
              value={draft.exerciseRestSec}
              onChange={(e) => set({ exerciseRestSec: Math.max(0, Number(e.target.value)) })}
            />
            <div className="he text-[10px] text-ink-600 mt-1">
              שניות. מתחיל אחרי הסט האחרון של כל תרגיל.
            </div>
          </div>
        </div>

        <HeNote className="mt-3 pt-3 border-t border-ink-850 text-xs text-ink-500">
          אפס = בלי טיימר. תמיד אפשר להוסיף 30 שניות או לסגור אותו תוך כדי.
        </HeNote>
      </Card>

      <SectionTitle>Notifications</SectionTitle>
      <NotificationsCard
        enabled={draft.restNotify}
        onToggle={(v) => set({ restNotify: v })}
      />

      <SectionTitle>Claude API key</SectionTitle>
      <Card>
        <HeNote className="text-xs text-ink-400 mb-3 leading-relaxed">
          נדרש רק אם אתה רוצה לשלוח את הסיכום השבועי ישירות מהאפליקציה. המפתח נשמר במכשיר הזה בלבד
          ונשלח רק ל‑api.anthropic.com בלחיצה על הכפתור. בלי מפתח — אפשר להעתיק את הסיכום ולהדביק
          בשיחה רגילה.
        </HeNote>

        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            className="field pr-10 font-mono text-xs"
            value={draft.anthropicApiKey}
            onChange={(e) => set({ anthropicApiKey: e.target.value })}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-500 hover:text-ink-300"
            aria-label={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent-400 hover:underline mt-3 inline-flex items-center gap-1"
        >
          Get a key from the Anthropic Console
          <ExternalLink size={12} />
        </a>
      </Card>

      <button className="btn-primary w-full mt-6" onClick={save}>
        Save settings
      </button>
    </Screen>
  );
}

/**
 * Notification setup. This screen is deliberately explicit about the iOS
 * prerequisite — without it, tapping "enable" on an iPhone in Safari appears
 * to do nothing and there is no way for the user to work out why.
 */
function NotificationsCard({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  const toast = useToast();
  const [permission, setPermission] = useState(notificationPermission());
  const installed = isInstalledStandalone();
  const ios = isIOS();
  const supported = notificationsSupported();

  const needsInstall = ios && !installed;

  return (
    <Card>
      <label className="flex items-center gap-3 p-2.5 rounded-xl bg-ink-850 cursor-pointer mb-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-4 h-4 accent-accent-500"
        />
        <div className="flex-1">
          <div className="text-sm font-medium">Notify when rest is over</div>
          <div className="he text-[11px] text-ink-500">
            התראה בסיום המנוחה, גם אם יצאת מהאפליקציה לרגע
          </div>
        </div>
      </label>

      {needsInstall ? (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-accent-500/[0.08] border border-accent-500/20">
          <Smartphone size={18} className="text-accent-400 mt-0.5 shrink-0" />
          <HeNote className="text-xs text-ink-300 leading-relaxed">
            באייפון התראות עובדות <strong>רק אחרי שמוסיפים את האפליקציה למסך הבית</strong>.
            בספארי: כפתור השיתוף ← "הוסף למסך הבית". אחר כך פתח את האפליקציה מהאייקון וחזור לכאן.
          </HeNote>
        </div>
      ) : !supported ? (
        <p className="text-xs text-ink-500">
          This browser doesn't support notifications.
        </p>
      ) : permission === 'granted' ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-good">
            <Bell size={16} />
            Notifications are on
          </div>
          <button
            className="btn-ghost w-full py-2 text-sm"
            onClick={async () => {
              const ok = await notify('Rest over — back to work', {
                body: 'This is what it looks like mid-workout.',
                tag: 'test',
              });
              toast(ok ? 'Sent — check your notifications' : 'Could not show it', ok ? 'ok' : 'bad');
            }}
          >
            Send a test notification
          </button>
        </div>
      ) : permission === 'denied' ? (
        <div className="flex items-start gap-3">
          <BellOff size={18} className="text-warn mt-0.5 shrink-0" />
          <HeNote className="text-xs text-ink-400 leading-relaxed">
            חסמת התראות עבור האתר הזה. צריך לאפשר אותן בהגדרות המכשיר —
            באייפון: הגדרות ← התראות ← Coach.
          </HeNote>
        </div>
      ) : (
        <button
          className="btn-primary w-full py-2 text-sm"
          onClick={async () => {
            const result = await requestNotificationPermission();
            setPermission(result);
            toast(
              result === 'granted' ? 'Notifications enabled' : 'Permission not granted',
              result === 'granted' ? 'ok' : 'bad'
            );
          }}
        >
          <Bell size={15} />
          Enable notifications
        </button>
      )}

      <HeNote className="mt-3 pt-3 border-t border-ink-850 text-xs text-ink-500 leading-relaxed">
        <strong>מה שאי אפשר:</strong> תזכורת יומית מתוזמנת ("אל תשכח להתאמן היום") דורשת שרת
        שדוחף התראות. אין לנו כזה בכוונה — הנתונים לא יוצאים מהמכשיר. ההתראה על סיום מנוחה
        עובדת כי האפליקציה פתוחה מולך באותו רגע.
      </HeNote>
    </Card>
  );
}
