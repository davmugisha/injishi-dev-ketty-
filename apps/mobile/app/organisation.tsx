/**
 * `/organisation` — frame R5's "Organisation profile ›".
 *
 * A card rather than a sheet: it holds the facts a landlord's compliance
 * position rests on, and half of them are what an RRA filing quotes.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { OrganisationScreen } from '@/screens/account';

export default function OrganisationRoute() {
  return <OrganisationScreen />;
}
