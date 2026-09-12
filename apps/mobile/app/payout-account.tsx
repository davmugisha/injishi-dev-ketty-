/**
 * `/payout-account` — frame R5's "Payout account · MoMo · mock ›", and B25's.
 *
 * A `FORM_SHEET`: one destination, one balance, one escape.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { PayoutAccountSheet } from '@/screens/account';

export default function PayoutAccountRoute() {
  return <PayoutAccountSheet />;
}
