/**
 * `/organisation` — frame R5's "Organisation profile ›".
 *
 * A card rather than a sheet: it holds the facts a landlord's compliance
 * position rests on, and half of them are what an RRA filing quotes.
 *
 * **Closed for every seat, and linked from nowhere** (mobile audit 2026-10-05,
 * SA-03). It showed another company's legal name, TIN and contacts as the
 * workspace's own. `app/_layout.tsx` refuses the route and Account no longer
 * draws its row; the screen is kept for the read that replaces its fixture.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { OrganisationScreen } from '@/screens/account';

export default function OrganisationRoute() {
  return <OrganisationScreen />;
}
