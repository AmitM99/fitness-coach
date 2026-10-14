import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronRight, Sparkles, UtensilsCrossed, Settings, Database, ShieldCheck, BookOpen,
  ClipboardList, HelpCircle,
} from 'lucide-react';
import { db } from '@/db/schema';
import { Screen, Card, SectionTitle, HeNote } from '@/components/ui';

export default function MorePage() {
  const navigate = useNavigate();
  const exerciseCount = useLiveQuery(() => db.exercises.count(), [], 0);
  const foodCount = useLiveQuery(() => db.foods.count(), [], 0);
  const sessionCount = useLiveQuery(() => db.sessions.where('status').equals('done').count(), [], 0);

  const items = [
    {
      to: '/review',
      icon: Sparkles,
      title: 'Weekly Review',
      he: 'סיכום השבוע ומשוב מהמאמן',
      accent: true,
    },
    {
      to: '/more/help',
      icon: HelpCircle,
      title: 'How this works',
      he: 'מדריך קצר — מה נדרש ממך ומה קורה לבד',
    },
    {
      to: '/more/profile',
      icon: ClipboardList,
      title: 'Athlete Profile',
      he: 'מטרות, מגבלות והעדפות — נכנס לכל סיכום',
    },
    { to: '/nutrition', icon: UtensilsCrossed, title: 'Nutrition', he: 'תיעוד תזונה מול יעד' },
    { to: '/more/settings', icon: Settings, title: 'Settings', he: 'פרופיל, יעדים ומפתח API' },
    { to: '/more/data', icon: Database, title: 'Data & Backup', he: 'ייצוא, גיבוי ושחזור' },
  ];

  return (
    <Screen title="More">
      <div className="space-y-2">
        {items.map(({ to, icon: Icon, title, he, accent }) => (
          <Card key={to} onClick={() => navigate(to)}>
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  accent ? 'bg-accent-500/15 text-accent-400' : 'bg-ink-800 text-ink-300'
                }`}
              >
                <Icon size={19} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{title}</div>
                <div className="he text-xs text-ink-500">{he}</div>
              </div>
              <ChevronRight size={17} className="text-ink-600" />
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle>Your data</SectionTitle>
      <Card>
        <div className="flex items-start gap-3">
          <ShieldCheck size={19} className="text-good mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium mb-1">Everything stays on this device</div>
            <HeNote className="text-xs text-ink-400 leading-relaxed">
              אין חשבון, אין שרת, אין אנליטיקס. כל הנתונים — אימונים, משקל, תמונות — שמורים
              ב‑IndexedDB בדפדפן הזה בלבד. הבקשה היחידה שיוצאת החוצה היא הביקורת השבועית, ורק כשאתה
              לוחץ על הכפתור.
            </HeNote>
          </div>
        </div>
      </Card>

      <SectionTitle>Reference data</SectionTitle>
      <Card>
        <div className="flex items-start gap-3">
          <BookOpen size={19} className="text-ink-400 mt-0.5 shrink-0" />
          <div className="text-xs text-ink-400 space-y-2 leading-relaxed">
            <p>
              <span className="text-ink-200 font-medium tnum">{exerciseCount.toLocaleString()}</span>{' '}
              exercises — from the open{' '}
              <span className="text-ink-300">hasaneyldrm/exercises-dataset</span>. Media © Gym visual
              (gymvisual.com), used for personal training only.
            </p>
            <p>
              <span className="text-ink-200 font-medium tnum">{foodCount.toLocaleString()}</span> foods
              — <span className="he">מאגר התזונה הלאומי הישראלי, משרד הבריאות</span> via data.gov.il
              (open licence).
            </p>
            <p className="text-ink-500 pt-1 border-t border-ink-850">
              Nutrient and exercise values are used exactly as published. Nothing is estimated or
              invented — where the source has no value, the app shows a blank.
            </p>
          </div>
        </div>
      </Card>

      <p className="text-center text-[11px] text-ink-600 mt-8 tnum">
        {sessionCount} workouts logged
      </p>
    </Screen>
  );
}
