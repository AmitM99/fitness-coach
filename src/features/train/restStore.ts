/**
 * The running rest timer, persisted.
 *
 * It used to live only in the player's component state, so minimising the
 * workout — or iOS discarding the backgrounded app — silently dropped it. Now
 * it is stored as an absolute end time, which also means the countdown is
 * right the moment you come back, however long the phone was locked.
 *
 * localStorage rather than IndexedDB: it is one small value read synchronously
 * on mount, and losing it (private mode, cleared storage) only costs a timer.
 */

export interface RestState {
  sessionId: string;
  /** Epoch ms when the rest is over. */
  endsAt: number;
  /** Full length in seconds, for the progress bar (grows with +30s). */
  total: number;
  /** Between sets, or the longer break before moving on. */
  kind: 'set' | 'exercise';
  /** "Set 2 of 3 · …" or the name of the exercise coming up. */
  label: string;
}

const KEY = 'coach.rest';
const EVENT = 'coach-rest-change';

/** A rest that ran out this long ago is no longer worth showing. */
const STALE_AFTER_MS = 5 * 60_000;

export function loadRest(sessionId?: string): RestState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const rest = JSON.parse(raw) as RestState;
    if (sessionId && rest.sessionId !== sessionId) return null;
    if (Date.now() - rest.endsAt > STALE_AFTER_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return rest;
  } catch {
    return null;
  }
}

export function saveRest(rest: RestState | null) {
  try {
    if (rest) localStorage.setItem(KEY, JSON.stringify(rest));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — the timer still runs for this screen */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Calls back whenever the stored rest changes, in this tab. */
export function onRestChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
