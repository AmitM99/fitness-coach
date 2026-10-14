import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle } from 'lucide-react';
import { getProfile, updateProfile, type Profile } from '@/db/schema';
import { Screen, Card, SectionTitle, HeNote, useToast } from '@/components/ui';

/**
 * The intake questionnaire. Re-answered at the end of each training block —
 * what changed matters as much as the numbers did.
 */
const FIELDS: {
  key: keyof Profile;
  label: string;
  he: string;
  type?: 'text' | 'area' | 'number';
  placeholder?: string;
  critical?: boolean;
}[] = [
  { key: 'goal', label: 'Main goal', he: 'המטרה המרכזית', type: 'area' },
  { key: 'sessionsPerWeek', label: 'Sessions per week', he: 'אימונים בשבוע', placeholder: 'e.g. 2-3' },
  { key: 'sessionMinutes', label: 'Session length', he: 'אורך אימון (דקות)', type: 'number' },
  { key: 'experience', label: 'Training background', he: 'רקע באימונים', type: 'area' },
  { key: 'history', label: 'Recent history', he: 'היסטוריה אחרונה', type: 'area' },
  { key: 'whatWorks', label: 'What works / what makes you quit', he: 'מה עובד ומה גורם לנטישה', type: 'area' },
  { key: 'gym', label: 'Where you train', he: 'איפה מתאמנים' },
  { key: 'equipment', label: 'Available equipment', he: 'ציוד זמין', type: 'area' },
  { key: 'injuries', label: 'Injuries & pain', he: 'פציעות וכאבים', type: 'area', critical: true },
  { key: 'avoid', label: 'Movements to avoid', he: 'תנועות להימנע מהן', type: 'area', critical: true },
  { key: 'medical', label: 'Medical notes', he: 'הערות רפואיות', type: 'area' },
  { key: 'age', label: 'Age', he: 'גיל', type: 'number' },
  { key: 'likes', label: 'Exercises you like', he: 'תרגילים שאתה אוהב', type: 'area' },
  { key: 'dislikes', label: 'Exercises you avoid', he: 'תרגילים שלא בא לך לעשות', type: 'area' },
  { key: 'cardio', label: 'Cardio preference', he: 'העדפת אירובי', type: 'area' },
  { key: 'sleep', label: 'Sleep', he: 'שינה', placeholder: 'e.g. 6-8h' },
  { key: 'stress', label: 'Life load / stress', he: 'עומס בחיים', type: 'area' },
];

export default function ProfilePage() {
  const toast = useToast();
  const stored = useLiveQuery(() => getProfile(), []);
  const [draft, setDraft] = useState<Profile | null>(null);

  useEffect(() => {
    if (stored && !draft) setDraft(stored);
  }, [stored, draft]);

  if (!draft) return <Screen title="Athlete Profile" back>{null}</Screen>;

  const set = (patch: Partial<Profile>) => setDraft({ ...draft, ...patch });

  const save = async () => {
    await updateProfile(draft);
    toast('Profile saved');
  };

  return (
    <Screen
      title="Athlete Profile"
      subtitle="Goes into every weekly review"
      back
      action={
        <button className="btn-primary py-1.5 px-3.5 text-sm" onClick={save}>
          Save
        </button>
      }
    >
      <HeNote className="mb-4 text-xs text-ink-500 leading-relaxed">
        זה ההקשר שנוסע יחד עם המספרים. בלי זה, סיכום שבועי הוא רק טבלה — עם זה הוא יודע שיש
        פציעה ביד, שיש תקרה של 45 דקות, ושאותו אימון לאורך זמן גורם לך לעזוב.
      </HeNote>

      <SectionTitle>Answers</SectionTitle>
      <Card className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label flex items-center gap-1.5">
              {f.critical && <AlertTriangle size={12} className="text-accent-500" />}
              {f.label}
              <span className="he text-ink-500 font-normal normal-case"> · {f.he}</span>
            </label>
            {f.type === 'area' ? (
              <textarea
                className="field mt-1.5 min-h-[64px] he"
                value={String(draft[f.key] ?? '')}
                onChange={(e) => set({ [f.key]: e.target.value } as Partial<Profile>)}
              />
            ) : (
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                inputMode={f.type === 'number' ? 'numeric' : 'text'}
                className="field mt-1.5"
                placeholder={f.placeholder}
                value={String(draft[f.key] ?? '')}
                onChange={(e) =>
                  set({
                    [f.key]:
                      f.type === 'number'
                        ? e.target.value === ''
                          ? null
                          : Number(e.target.value)
                        : e.target.value,
                  } as Partial<Profile>)
                }
              />
            )}
          </div>
        ))}
      </Card>

      <SectionTitle>Re-planning</SectionTitle>
      <Card>
        <label className="label">Rebuild the program every</label>
        <div className="flex gap-2 mt-2">
          {[4, 6, 8].map((w) => (
            <button
              key={w}
              className={`chip flex-1 ${draft.replanWeeks === w ? 'chip-on' : 'chip-off'}`}
              onClick={() => set({ replanWeeks: w })}
            >
              {w} weeks
            </button>
          ))}
        </div>
        <HeNote className="mt-3 text-xs text-ink-500">
          בסוף כל בלוק האפליקציה תסמן שהגיע הזמן לתכנן מחדש, ותציע לעדכן את התשובות כאן.
        </HeNote>
      </Card>

      <button className="btn-primary w-full mt-6" onClick={save}>
        Save profile
      </button>
    </Screen>
  );
}
