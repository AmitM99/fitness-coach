import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */

export function Screen({
  title,
  subtitle,
  back,
  action,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="min-h-full">
      {/* A slim sticky bar carries only the round controls; the title itself is
          a large heading that scrolls with the page, iOS / Skulpt style. */}
      <header
        className="sticky top-0 z-20 bg-ink-950/80 backdrop-blur-xl"
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <div className="px-4 h-14 flex items-center gap-2">
          {back && (
            <button onClick={() => navigate(-1)} className="icon-btn" aria-label="Back">
              <ChevronLeft size={22} />
            </button>
          )}
          <div className="flex-1" />
          {action}
        </div>
      </header>
      <main className="px-4 pb-32 animate-fade-up">
        <div className="mb-5">
          <h1 className="text-[32px] leading-[1.1] font-bold tracking-tight">{title}</h1>
          {subtitle && <div className="text-sm text-ink-500 mt-1">{subtitle}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Card({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cn('card p-4 w-full', onClick && 'text-left active:scale-[0.99] transition-transform', className)}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-8 first:mt-0">
      <h2 className="text-xl font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: ReactNode }) {
  return (
    <div className="text-center py-12 px-6">
      {icon && <div className="text-ink-600 flex justify-center mb-3">{icon}</div>}
      <p className="text-ink-300 font-medium">{title}</p>
      {/* A div, not a <p>: callers routinely pass a <HeNote> block in here. */}
      {hint && <div className="text-sm text-ink-500 mt-1.5 leading-relaxed">{hint}</div>}
    </div>
  );
}

/** Hebrew coaching note. Isolated so it renders RTL inside the English UI. */
export function HeNote({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('he text-sm leading-relaxed text-ink-300', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */

export function Stat({
  label,
  value,
  unit,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: 'default' | 'accent' | 'good';
}) {
  return (
    <div className="text-center">
      <div
        className={cn(
          'text-xl font-bold tnum tracking-tight whitespace-nowrap',
          tone === 'accent' && 'text-accent-500',
          tone === 'good' && 'text-good'
        )}
      >
        {value}
        {unit && <span className="text-xs font-medium text-ink-400 ml-0.5">{unit}</span>}
      </div>
      <div className="text-[11px] text-ink-500 mt-0.5">{label}</div>
    </div>
  );
}

/** Progress ring used for the macro targets. */
export function Ring({
  value,
  max,
  size = 56,
  stroke = 5,
  color = '#b5e655',
  children,
}: {
  value: number;
  max: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max && max > 0 ? Math.min(value / max, 1) : 0;
  const over = max && max > 0 && value > max * 1.05;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#2c2c2e" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? '#f05252' : color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-lg bg-ink-900 rounded-t-[28px] sm:rounded-[28px]
                   max-h-[88vh] flex flex-col animate-fade-up"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink-700 shrink-0" />
        <div className="flex items-center justify-between px-4 pt-2 pb-3 shrink-0">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="icon-btn w-9 h-9 bg-ink-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */

export function NumberPad({
  value,
  onChange,
  step = 2.5,
  suffix,
  autoFocus,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  suffix?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.select();
  }, [autoFocus]);

  const bump = (delta: number) => {
    const next = Math.round(((value ?? 0) + delta) * 100) / 100;
    onChange(next < 0 ? 0 : next);
  };

  return (
    <div className="flex items-stretch gap-1.5">
      <button type="button" onClick={() => bump(-step)} className="btn-ghost px-3 shrink-0" aria-label="Decrease">
        −
      </button>
      <div className="relative flex-1">
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          className="field text-center tnum font-semibold pr-8"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-500 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      <button type="button" onClick={() => bump(step)} className="btn-ghost px-3 shrink-0" aria-label="Increase">
        +
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type ToastFn = (msg: string, tone?: 'ok' | 'bad') => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; tone: 'ok' | 'bad' }[]>([]);

  const push: ToastFn = (msg, tone = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none"
           style={{ bottom: 'calc(84px + var(--safe-bottom))' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'animate-fade-up rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg border max-w-sm',
              t.tone === 'bad'
                ? 'bg-bad/20 border-bad/40 text-red-200'
                : 'bg-ink-100 border-ink-100 text-ink-950'
            )}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ */

export function Confirm({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      {body && <div className="text-sm text-ink-300 mb-5 leading-relaxed">{body}</div>}
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn-danger flex-1"
          onClick={() => {
            onConfirm();
            onCancel();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
