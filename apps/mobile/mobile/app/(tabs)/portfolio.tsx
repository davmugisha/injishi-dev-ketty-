/**
 * `/portfolio` — the Landlord rent-roll home. A P1 surface: the MVP Residence
 * tab set is the tenant one (Leases · Rent · Account), so this is unlinked in
 * the tab bar (`href: null` in `_layout.tsx`) and kept only as a route.
 *
 * It had no route file of its own before — the home tab rendered it directly —
 * which meant there was nowhere to hang the `href: null` that parks it. This
 * file is that place, and it keeps `src/screens/portfolio.tsx` compiled and
 * reachable for the day the Landlord shell lands.
 */
import { Portfolio } from '@/screens/portfolio';

export default function PortfolioScreen() {
  return <Portfolio />;
}
