/**
 * The rest-timer chime, synthesised rather than loaded from a file.
 *
 * A two-note tone through the Web Audio API costs no bytes, needs no network,
 * and can't be evicted from a cache — the timer must be dependable in a gym
 * basement with no signal.
 *
 * iOS will not let audio start without a user gesture, so `unlockAudio` is
 * called from the same tap that ticks off a set. By the time a rest ends, the
 * context is already running.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/** Call from a real user gesture so the tone can play later, unprompted. */
export function unlockAudio() {
  const c = getContext();
  if (c && c.state === 'suspended') void c.resume();
}

function tone(c: AudioContext, freq: number, startAt: number, duration: number, gain: number) {
  const osc = c.createOscillator();
  const amp = c.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startAt);

  // Shaped attack and release — a raw square edge clicks unpleasantly.
  amp.gain.setValueAtTime(0.0001, startAt);
  amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(amp).connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/**
 * Two rising notes: unmistakable across gym noise without being a klaxon.
 * `emphatic` is used when a whole exercise is done, not just a set.
 */
export function playRestDone(emphatic = false) {
  const c = getContext();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();

  const t = c.currentTime + 0.02;
  tone(c, 660, t, 0.16, 0.22);
  tone(c, 880, t + 0.18, emphatic ? 0.3 : 0.2, 0.22);
  if (emphatic) tone(c, 1175, t + 0.4, 0.26, 0.2);
}
