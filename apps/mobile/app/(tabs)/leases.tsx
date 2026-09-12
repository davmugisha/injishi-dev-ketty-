/**
 * `/leases` — two seats, one path.
 *
 * For the **landlord** this is a real tab (second in the set, frame R3). For
 * the **tenant** the home tab already renders My Leases, so this is unlinked
 * and exists to keep `/leases` resolving for a deep link or a `router.push`
 * written against it.
 *
 * One route file rather than two because the PATH is one path. Which lease list
 * you get is a question about the seat you are in, not about the address —
 * exactly the question `useDomain().surface` exists to answer.
 */
import { useDomain } from '@/domain';
import { Leases } from '@/screens/leases';
import { LandlordLeases } from '@/screens/landlord/leases';

export default function LeasesScreen() {
  const { surface } = useDomain();
  return surface === 'landlord' ? <LandlordLeases /> : <Leases />;
}
