/**
 * `/reveal-credits` — frame B25's "Reveal credits · 7 left ›".
 *
 * A card, because the reveal LOG is the point of it (F-R09 §10) and a log is a
 * list.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { RevealCreditsScreen } from '@/screens/account';

export default function RevealCreditsRoute() {
  return <RevealCreditsScreen />;
}
