import { Suspense, lazy, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { House, Dumbbell, Gauge, ChartNoAxesColumn, SlidersHorizontal } from 'lucide-react';
import { seedIfNeeded, requestPersistentStorage } from '@/db/seed';
import { registerServiceWorker } from '@/lib/notify';
import { ToastHost, cn } from '@/components/ui';
import ActiveSessionBar from '@/features/train/ActiveSessionBar';
import ErrorBoundary from '@/components/ErrorBoundary';

// The screens you reach from a cold start are bundled up front.
import TodayPage from '@/features/today/TodayPage';
import TrainPage from '@/features/train/TrainPage';
import SessionPlayer from '@/features/train/SessionPlayer';

// Everything else — in particular the chart pages, which pull in Recharts —
// loads on demand so the first paint on a phone stays light.
const ProgramEditor = lazy(() => import('@/features/train/ProgramEditor'));
const SessionSummary = lazy(() => import('@/features/train/SessionSummary'));
const LibraryPage = lazy(() => import('@/features/exercises/LibraryPage'));
const ExerciseDetail = lazy(() => import('@/features/exercises/ExerciseDetail'));
const ProgressPage = lazy(() => import('@/features/progress/ProgressPage'));
const PhotosPage = lazy(() => import('@/features/progress/PhotosPage'));
const NutritionPage = lazy(() => import('@/features/nutrition/NutritionPage'));
const ReviewPage = lazy(() => import('@/features/review/ReviewPage'));
const MorePage = lazy(() => import('@/features/more/MorePage'));
const SettingsPage = lazy(() => import('@/features/more/SettingsPage'));
const ProfilePage = lazy(() => import('@/features/more/ProfilePage'));
const HelpPage = lazy(() => import('@/features/more/HelpPage'));
const DataPage = lazy(() => import('@/features/more/DataPage'));

const TABS = [
  { to: '/today', label: 'Home', icon: House },
  { to: '/train', label: 'Train', icon: Dumbbell },
  { to: '/progress', label: 'Results', icon: ChartNoAxesColumn },
  { to: '/exercises', label: 'Exercises', icon: Gauge },
  { to: '/more', label: 'More', icon: SlidersHorizontal },
];

function TabBar() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-ink-950/85 backdrop-blur-xl border-t border-ink-900"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="flex">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                // Five tabs leave ~75px each on a 375px phone, so the label must
                // never wrap and the icon gives up a little size for it.
                'flex-1 min-w-0 flex flex-col items-center gap-1 pt-2.5 pb-2 text-[10.5px] font-medium transition-colors',
                isActive ? 'text-ink-100' : 'text-ink-500'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.7} />
                <span className="whitespace-nowrap">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function Boot({ message }: { message: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="w-10 h-10 rounded-full border-2 border-ink-700 border-t-accent-500 animate-spin" />
      <p className="text-sm text-ink-400">{message}</p>
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('Starting…');
  const location = useLocation();

  useEffect(() => {
    void requestPersistentStorage();
    void registerServiceWorker();
    seedIfNeeded((_phase, detail) => detail && setMessage(detail))
      .then(() => setStatus('ready'))
      .catch((err: Error) => {
        setMessage(err.message);
        setStatus('error');
      });
  }, []);

  if (status === 'loading') return <Boot message={message} />;

  if (status === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="font-semibold text-bad">Could not load reference data</p>
        <p className="text-sm text-ink-400">{message}</p>
        <code className="text-xs bg-ink-850 rounded-lg px-3 py-2 text-ink-300">npm run data:build</code>
      </div>
    );
  }

  // Only the player itself is full-screen: it has its own minimise control, so
  // the tab bar would be a second, competing way out. The summary that follows
  // a finished workout is an ordinary screen and keeps its navigation.
  const immersive =
    location.pathname.startsWith('/session/') && !location.pathname.endsWith('/summary');

  return (
    <ToastHost>
      <ErrorBoundary>
      <Suspense fallback={<Boot message="" />}>
      <Routes>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/train" element={<TrainPage />} />
        <Route path="/train/program/:id" element={<ProgramEditor />} />
        <Route path="/session/:id" element={<SessionPlayer />} />
        <Route path="/session/:id/summary" element={<SessionSummary />} />
        <Route path="/exercises" element={<LibraryPage />} />
        <Route path="/exercises/:id" element={<ExerciseDetail />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/progress/photos" element={<PhotosPage />} />
        <Route path="/nutrition" element={<NutritionPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/more/settings" element={<SettingsPage />} />
        <Route path="/more/profile" element={<ProfilePage />} />
        <Route path="/more/help" element={<HelpPage />} />
        <Route path="/more/data" element={<DataPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
      {/* Home already shows the running workout as its lime "Now" card. */}
      {!immersive && location.pathname !== '/today' && <ActiveSessionBar />}
      {!immersive && <TabBar />}
    </ToastHost>
  );
}
