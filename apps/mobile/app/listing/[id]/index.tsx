/**
 * `listing/[id]` — the Property detail page, and a redirect for the other kind
 * of id that reaches it.
 *
 * A Hospitality stay reached from Explore renders the **Property detail page**
 * (F-B15, Session 3, `src/screens/guest/listing-detail.tsx`).
 *
 * A Residence unit used to render a second detail screen inlined in this file,
 * which Session 0 parked here and marked as Session 9's to rebuild. Session 9
 * rebuilt it against frame B22 at `directory/[unitId]`, so what is left here is
 * a **redirect**: a Residence id lands on the one Residence unit screen rather
 * than on a copy of it. Two screens for one aggregate is two screens to keep in
 * step, and the reveal, the credit and the placement intent all live on the
 * broker's one.
 *
 * The split is on the fixture, not on a route param, because the two catalogues
 * are genuinely separate: `getStay` reads Hospitality inventory, `getUnit`
 * reads the private Broker Directory, and a Residence unit is never publicly
 * explorable (F-R01, and the invariant `src/data/stays.ts` states).
 */
import { Redirect, useLocalSearchParams } from 'expo-router';
import { getStay } from '@/data/stays';
import { getUnit } from '@/data/broker';
import { ListingDetailScreen } from '@/screens/guest/listing-detail';

export default function ListingDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // Hospitality first: a Guest arriving from Explore is the common path, and
  // the Property detail page owns every state the read can be in — including
  // the one where nothing resolves, which is where an unknown id belongs.
  if (getStay(id) || !getUnit(id)) return <ListingDetailScreen id={id} />;

  return <Redirect href={{ pathname: '/directory/[unitId]', params: { unitId: id } }} />;
}
