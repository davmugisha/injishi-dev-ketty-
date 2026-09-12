/**
 * `/staff` — frame R5's "Staff & invites ›".
 *
 * A card, because it is a list and a list owes four states.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { StaffScreen } from '@/screens/account';

export default function StaffRoute() {
  return <StaffScreen />;
}
