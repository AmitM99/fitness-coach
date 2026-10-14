import { Component, type ReactNode } from 'react';

/**
 * Catches render errors so a single bad screen doesn't leave a blank page.
 *
 * That matters more here than in most apps: the data lives only in this
 * browser, so a user faced with a white screen might reasonably assume it is
 * all gone and clear the site data — destroying their training history. The
 * fallback exists to say plainly that the data is intact, and to offer the
 * backup as the first action.
 */
interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Screen crashed:', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="text-lg font-bold">Something broke on this screen</h1>

        <p className="he text-sm text-ink-300 leading-relaxed max-w-sm">
          הנתונים שלך <strong>לא נפגעו</strong> — הם שמורים במכשיר ולא קשורים לתקלה הזו.
          אל תמחק את נתוני האתר.
        </p>

        <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
          <button className="btn-primary" onClick={() => { window.location.hash = '#/today'; window.location.reload(); }}>
            Back to Today
          </button>
          <a className="btn-ghost" href="#/more/data" onClick={() => setTimeout(() => window.location.reload(), 50)}>
            Download a backup first
          </a>
        </div>

        <details className="mt-4 max-w-sm w-full text-left">
          <summary className="text-xs text-ink-500 cursor-pointer">Technical detail</summary>
          <pre className="mt-2 text-[11px] text-ink-500 whitespace-pre-wrap break-words bg-ink-900 rounded-lg p-3 overflow-x-auto">
            {error.message}
          </pre>
        </details>
      </div>
    );
  }
}
