/**
 * The clock the Inbox and the thread screen share.
 *
 * A minute is the finest granularity any stamp on either screen has ("3m" on
 * a row, "Today" on a day line), so ticking faster would re-render a list for
 * no visible change. `trip-clock.ts` makes the same trade at a different rate,
 * because a countdown to check-in genuinely needs seconds and a conversation
 * does not.
 *
 * It lived inside `inbox.tsx`, and the thread screen read `Date.now()` once per
 * render instead, so a conversation left open past midnight kept calling
 * yesterday's messages "Today" (mobile audit 2026-10-05, IN-13). One clock, in
 * its own module, so both screens tick the same way.
 */
import { useEffect, useState } from 'react';
import { MINUTE_MS } from './relative-time';

export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}
