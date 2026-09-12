/**
 * `useNow` — the ticking clock the countdown reads.
 *
 * The kit's `Countdown` already owns a 1s heartbeat, and it is the right one
 * for the thing it was built for: frame X2's "Resend code in 0:42", where every
 * second visibly changes. A trip countdown is not that. It reads in minutes,
 * hours or days, so a 1s tick would repaint the hero card 3,600 times to change
 * one word — and the hero card holds a photograph.
 *
 * So this ticks at the resolution the READING actually has. Under an hour it
 * ticks every 15 seconds so the minutes stay honest; over an hour, every five
 * minutes, which is still four times finer than the value can move. The
 * interval is chosen from the target rather than passed in, because a caller
 * choosing it is a caller who eventually chooses wrong.
 *
 * Anchored to `Date.now()` on every render rather than incremented, for the
 * reason `Countdown` gives: a counter that adds one per tick drifts and, worse,
 * stops when the app is backgrounded. A phone locked overnight comes back to a
 * countdown that is right, not one that lost eight hours.
 */
import { useEffect, useState } from 'react';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Fine while the reading is in minutes, coarse once it is in hours or days. */
export function tickFor(remainingMs: number): number {
  return remainingMs < HOUR ? 15 * 1000 : 5 * MINUTE;
}

/**
 * The current time, repainted at a cadence that suits how far off `target` is.
 *
 * `target` is optional: with none, this ticks at the coarse rate, which is what
 * a screen showing several countdowns at once wants.
 */
export function useNow(target?: number): number {
  const [now, setNow] = useState(() => Date.now());

  const interval = tickFor(target === undefined ? Number.POSITIVE_INFINITY : target - now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);

  return now;
}
