/**
 * `/payout-account` — frame R5's "Payout account · MoMo · mock ›", and B25's.
 *
 * A `FORM_SHEET`: one destination, one balance, one escape.
 *
 * **Closed for every seat, and linked from nowhere** (mobile audit 2026-10-05,
 * SA-04). It showed a fixture MoMo destination and balance as the workspace's
 * own. `app/_layout.tsx` refuses the route and Account no longer draws its row;
 * the screen is kept for the read that replaces its fixture.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { PayoutAccountSheet } from '@/screens/account';

export default function PayoutAccountRoute() {
  return <PayoutAccountSheet />;
}
