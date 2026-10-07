/**
 * `/staff` — frame R5's "Staff & invites ›".
 *
 * A card, because it is a list and a list owes four states.
 *
 * **Closed for every seat, and linked from nowhere** (mobile audit 2026-10-05,
 * HO-05). It showed four invented people as the workspace's own.
 * `app/_layout.tsx` refuses the route and Account no longer draws its row; the
 * screen is kept for the read that replaces its fixture.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { StaffScreen } from '@/screens/account';

export default function StaffRoute() {
  return <StaffScreen />;
}
