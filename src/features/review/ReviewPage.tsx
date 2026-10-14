import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Copy, Sparkles, KeyRound, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, uid, getSettings, type Review } from '@/db/schema';
import { Screen, Card, SectionTitle, Empty, HeNote, useToast, cn } from '@/components/ui';
import { addDays, longDate, todayKey, weekStart } from '@/lib/date';
import { buildWeeklySummary, requestCoachFeedback, REVIEW_PROMPT } from '@/lib/review';

export default function ReviewPage() {
  const toast = useToast();
  const [week, setWeek] = useState(() => weekStart(todayKey()));
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState('');

  const settings = useLiveQuery(() => getSettings(), []);
  const saved = useLiveQuery(
    () => db.reviews.where('weekStart').equals(week).first(),
    [week]
  );
  const allReviews = useLiveQuery(
    () => db.reviews.orderBy('weekStart').reverse().toArray(),
    [],
    [] as Review[]
  );

  useEffect(() => {
    buildWeeklySummary(week).then(setSummary);
    setResponse('');
  }, [week]);

  useEffect(() => {
    if (saved?.response) setResponse(saved.response);
  }, [saved?.id]);

  const hasKey = !!settings?.anthropicApiKey?.trim();
  const isCurrentWeek = week === weekStart(todayKey());

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(REVIEW_PROMPT + summary);
      toast('Copied — paste it into any Claude chat');
    } catch {
      toast('Could not access the clipboard', 'bad');
    }
  }

  async function askClaude() {
    if (!settings?.anthropicApiKey) return;
    setBusy(true);
    try {
      const reply = await requestCoachFeedback(settings.anthropicApiKey, summary);
      setResponse(reply);
      const existing = await db.reviews.where('weekStart').equals(week).first();
      const row: Review = {
        id: existing?.id ?? uid(),
        weekStart: week,
        createdAt: new Date().toISOString(),
        summary,
        response: reply,
      };
      await db.reviews.put(row);
      toast('Review saved');
    } catch (err) {
      toast((err as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function saveSummaryOnly() {
    const existing = await db.reviews.where('weekStart').equals(week).first();
    await db.reviews.put({
      id: existing?.id ?? uid(),
      weekStart: week,
      createdAt: new Date().toISOString(),
      summary,
      response: response || existing?.response || '',
    });
    toast('Saved');
  }

  return (
    <Screen
      title="Weekly Review"
      subtitle={`${longDate(week)} – ${longDate(addDays(week, 6))}`}
      back
      action={
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeek((w) => addDays(w, -7))}
            className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-850"
            aria-label="Previous week"
          >
            <ChevronLeft size={19} />
          </button>
          <button
            onClick={() => setWeek((w) => addDays(w, 7))}
            disabled={isCurrentWeek}
            className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-850 disabled:opacity-30"
            aria-label="Next week"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      }
    >
      <HeNote className="mb-4 text-xs text-ink-500 leading-relaxed">
        כאן כל מה שתיעדת בשבוע נאסף לסיכום אחד — אימונים, נפח, משקל ותחושות. אפשר לשלוח אותו ל‑Claude
        ולקבל משוב ותוכנית להמשך, בלי להעתיק נתונים ידנית.
      </HeNote>

      <SectionTitle
        action={
          <button className="text-xs text-ink-400 hover:text-ink-200 flex items-center gap-1" onClick={copySummary}>
            <Copy size={13} />
            Copy
          </button>
        }
      >
        This week's summary
      </SectionTitle>

      <Card className="mb-4">
        <pre className="text-xs text-ink-300 whitespace-pre-wrap font-sans leading-relaxed max-h-80 overflow-y-auto">
          {summary || 'Building summary…'}
        </pre>
      </Card>

      <SectionTitle>Coach feedback</SectionTitle>

      {hasKey ? (
        <button className="btn-primary w-full mb-3" onClick={askClaude} disabled={busy}>
          {busy ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-ink-950/30 border-t-ink-950 animate-spin" />
              Asking Claude…
            </>
          ) : (
            <>
              <Sparkles size={17} />
              Ask Claude for feedback
            </>
          )}
        </button>
      ) : (
        <Card className="mb-3">
          <div className="flex items-start gap-3">
            <KeyRound size={19} className="text-accent-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium mb-1">No API key set</div>
              <HeNote className="text-xs text-ink-400 mb-3">
                אפשר לשלוח את הסיכום ישירות מהאפליקציה אם תוסיף מפתח API, או פשוט להעתיק אותו
                ולהדביק בשיחה רגילה עם Claude — התוצאה זהה.
              </HeNote>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1 py-2 text-sm" onClick={copySummary}>
                  <Copy size={15} />
                  Copy summary
                </button>
                <Link to="/more/settings" className="btn-ghost flex-1 py-2 text-sm">
                  Add key
                </Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      {response && (
        <Card className="mb-3">
          <div className="text-sm text-ink-200 whitespace-pre-wrap leading-relaxed">{response}</div>
          <button className="btn-ghost w-full mt-4 py-2 text-sm" onClick={saveSummaryOnly}>
            <Save size={15} />
            Save this review
          </button>
        </Card>
      )}

      {!response && (
        <textarea
          className="field min-h-[120px] text-sm"
          placeholder="Or paste Claude's reply here to keep it with this week…"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          onBlur={() => response.trim() && saveSummaryOnly()}
        />
      )}

      {allReviews.length > 0 && (
        <>
          <SectionTitle>Past reviews</SectionTitle>
          <div className="space-y-2">
            {allReviews.map((r) => (
              <Card key={r.id} onClick={() => setWeek(r.weekStart)}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {longDate(r.weekStart)} – {longDate(addDays(r.weekStart, 6))}
                    </div>
                    <div className="text-xs text-ink-500 truncate">
                      {r.response ? r.response.slice(0, 60) + '…' : 'Summary only'}
                    </div>
                  </div>
                  <ChevronRight size={16} className={cn('text-ink-600 shrink-0')} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {allReviews.length === 0 && !summary.includes('###') && (
        <Empty
          title="Nothing logged this week yet"
          hint={<HeNote className="text-center">אחרי אימון או שניים הסיכום כאן יתחיל להיות שימושי.</HeNote>}
        />
      )}
    </Screen>
  );
}
