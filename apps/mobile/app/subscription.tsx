/**
 * `/subscription` — frame R5's "Subscription · Growth ›" and B25's "· Pro ›".
 *
 * The plan is read off the active seat, so one route serves all three.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { SubscriptionScreen } from '@/screens/account';

export default function SubscriptionRoute() {
  return <SubscriptionScreen />;
}
