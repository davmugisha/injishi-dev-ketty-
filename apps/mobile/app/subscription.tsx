/**
 * `/subscription` — frame R5's "Subscription · Growth ›" and B25's "· Pro ›".
 *
 * The plan is read off the active seat, so one route serves all three.
 *
 * **Closed for every seat, and linked from nowhere** (mobile audit 2026-10-05,
 * SA-05). It showed a fixture paid plan as the workspace's own.
 * `app/_layout.tsx` refuses the route and Account no longer draws its row; the
 * screen is kept for the read that replaces its fixture.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { SubscriptionScreen } from '@/screens/account';

export default function SubscriptionRoute() {
  return <SubscriptionScreen />;
}
