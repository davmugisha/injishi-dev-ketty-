/**
 * Home tab — one route, six surfaces.
 *
 * `index` is the home tab of every tab set (see `_layout.tsx` note 1), so the
 * navigator always has a linked initial route whichever surface is active. It
 * renders that surface's FIRST screen:
 *
 *   guest     Explore        built
 *   tenant    My leases      built
 *   landlord  Rent roll      built
 *   broker    Directory      built
 *   work      Queue          built
 *   host      Today          built, optional session A
 *
 * A `switch` rather than a chain of ternaries on purpose: the day a seventh
 * surface is added, this file should fail to compile rather than silently fall
 * through to Explore.
 */
import { useDomain } from '@/domain';
import { Explore } from '@/screens/guest/explore';
import { Leases } from '@/screens/leases';
import { Directory } from '@/screens/broker/directory';
import { RentRoll } from '@/screens/landlord/rent-roll';
import { WorkQueue } from '@/screens/work';
import { HostToday } from '@/screens/host';

export default function HomeScreen() {
  const { surface } = useDomain();

  switch (surface) {
    case 'guest':
      return <Explore />;
    case 'tenant':
      return <Leases />;
    case 'landlord':
      return <RentRoll />;
    case 'broker':
      return <Directory />;
    case 'work':
      return <WorkQueue />;
    case 'host':
      return <HostToday />;
  }
}
