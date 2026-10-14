import { Link } from 'react-router-dom';
import {
  CalendarCheck, Dumbbell, Scale, Sparkles, RefreshCw, HelpCircle, ShieldCheck,
} from 'lucide-react';
import { Screen, Card, SectionTitle, HeNote } from '@/components/ui';

/**
 * The manual, inside the app.
 *
 * Most of what makes this app work isn't discoverable from the buttons: that
 * the weekly summary has to be sent by hand, that devices don't sync, that a
 * block ends after four weeks. Writing it down here means it survives being
 * forgotten.
 */

const STEPS = [
  {
    icon: Dumbbell,
    title: 'לפני האימון',
    body: 'פותחים את Today ולוחצים Start workout. האפליקציה כבר יודעת איזה אימון בתור — בתוכנית שלך זו רוטציה A → B → C, אז היא פשוט ממשיכה מאיפה שהפסקת. אם פספסת שבוע, לא נשבר כלום.',
  },
  {
    icon: CalendarCheck,
    title: 'תוך כדי האימון',
    body: 'מקלידים משקל וחזרות ולוחצים ✓ בסוף כל סט. הטיימר מתחיל לבד. עמודת PREV מראה מה עשית בפעם הקודמת — זה הסימן אם להעלות משקל. כפתור ⇄ מחליף תרגיל אם התפוס, וכפתור הפתק שומר הערה על תרגיל ספציפי.',
  },
  {
    icon: Scale,
    title: 'שקילה',
    body: '2-3 פעמים בשבוע, בבוקר, אחרי שירותים ולפני אוכל. יום בודד לא אומר כלום — המגמה לאורך שבועות היא מה שנמדד.',
  },
  {
    icon: Sparkles,
    title: 'פעם בשבוע — הפעולה היחידה שנדרשת ממך',
    body: 'More → Weekly Review → Copy, ואז להדביק בשיחה איתי. הסיכום כבר כולל הכול: אימונים, נפח, שיאים, משקל, ההערות שכתבת והפרופיל שלך עם הפציעה. אתה לא צריך להסביר כלום מחדש.',
  },
  {
    icon: RefreshCw,
    title: 'אחת ל-4 שבועות',
    body: 'מסך Train יסמן שהבלוק נגמר. אני בונה תוכנית חדשה לפי מה שקרה בפועל, שולח קובץ, ואתה טוען אותו ב-Train → Import a program file. ההיסטוריה נשמרת והגרפים ממשיכים.',
  },
];

export default function HelpPage() {
  return (
    <Screen title="How this works" subtitle="מדריך קצר לשימוש יומיומי" back>
      <HeNote className="mb-5 text-sm text-ink-300 leading-relaxed">
        האפליקציה אוספת ומחשבת לבד. מה שדורש ממך פעולה זה שלושה דברים בלבד:{' '}
        <strong>לתעד תוך כדי אימון</strong>, <strong>להישקל</strong>, ו
        <strong>לשלוח לי את הסיכום פעם בשבוע</strong>. כל השאר קורה מעצמו.
      </HeNote>

      <SectionTitle>הזרימה השבועית</SectionTitle>
      <div className="space-y-2">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <Card key={title}>
            <div className="flex gap-3">
              <div className="shrink-0 flex flex-col items-center gap-1">
                <span className="w-9 h-9 rounded-xl bg-ink-800 text-accent-400 flex items-center justify-center">
                  <Icon size={18} />
                </span>
                <span className="text-[10px] text-ink-600 tnum">{i + 1}</span>
              </div>
              <div className="min-w-0">
                <div className="he font-semibold text-sm mb-1">{title}</div>
                <HeNote className="text-xs leading-relaxed">{body}</HeNote>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle>דברים ששווה לדעת</SectionTitle>
      <Card className="space-y-4">
        <Fact title="המכשירים לא מסתנכרנים">
          כל דפדפן ומכשיר מחזיקים מאגר נפרד. אם תתעד אימון בטלפון הוא לא יופיע במחשב.
          בחר מכשיר אחד ותתעד רק בו. להעברה: <strong>More → Data &amp; Backup</strong>,
          מורידים גיבוי בצד אחד ומשחזרים בשני.
        </Fact>

        <Fact title="גיבוי אחת לחודש">
          הנתונים יושבים רק במכשיר שלך. זה מה שנותן פרטיות מלאה, אבל זה גם אומר
          שאין עותק בענן. <strong>Download backup</strong>, ולשמור את הקובץ בדרייב.
        </Fact>

        <Fact title="עובד בלי אינטרנט">
          אחרי הפתיחה הראשונה האפליקציה נשמרת במכשיר. אם אין קליטה בחדר כושר —
          הכול ימשיך לעבוד, כולל הטיימר והתיעוד.
        </Fact>

        <Fact title="הטיימר מדויק גם כשהמסך כבוי">
          הוא מחשב מול שעון אמיתי, לא סופר לאחור. אפשר לנעול את הטלפון באמצע מנוחה
          ולחזור — הזמן שיוצג יהיה נכון.
        </Fact>

        <Fact title="1RM משוער הוא הערכה">
          מחושב בנוסחת אפלי מהמשקל והחזרות. מעל 15 חזרות הוא מפסיק להיות אמין ולכן
          לא מוצג. זה כלי למעקב מגמה, לא מספר לרדוף אחריו.
        </Fact>
      </Card>

      <SectionTitle>הפרטיות שלך</SectionTitle>
      <Card>
        <div className="flex items-start gap-3">
          <ShieldCheck size={19} className="text-good mt-0.5 shrink-0" />
          <HeNote className="text-xs leading-relaxed">
            אין חשבון, אין שרת ואין אנליטיקס. האימונים, המשקל והתמונות לא עוזבים את
            המכשיר. הבקשה היחידה שיוצאת החוצה אי פעם היא הביקורת השבועית — ורק אם
            הגדרת מפתח API ולחצת על הכפתור בעצמך.
          </HeNote>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Link to="/more/profile" className="btn-ghost">Athlete Profile</Link>
        <Link to="/more/data" className="btn-ghost">Data &amp; Backup</Link>
      </div>
    </Screen>
  );
}

function Fact({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <HelpCircle size={15} className="text-ink-600 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="he text-sm font-medium mb-0.5">{title}</div>
        <HeNote className="text-xs text-ink-400 leading-relaxed">{children}</HeNote>
      </div>
    </div>
  );
}
