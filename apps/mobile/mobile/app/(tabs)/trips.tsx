/**
 * Trips — the Guest's bookings and stays (Hospitality demand).
 *
 * The route is the mount point; `src/screens/guest/trips.tsx` is the screen.
 * That split is the repo's convention for a tab with a real surface behind it
 * (see `app/(tabs)/index.tsx`), and it is what lets the screen be rendered in a
 * test without a router.
 */
import { Trips } from '@/screens/guest/trips';

export default function TripsScreen() {
  return <Trips />;
}
