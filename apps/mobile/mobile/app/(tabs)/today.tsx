/**
 * `/today` — the Host home. Unlinked in the tab bar because `index` renders it
 * for the host surface; registered so a deep link and the Bookings tab's
 * "Open Today" both have somewhere to land.
 */
import { HostToday } from '@/screens/host';

export default function TodayScreen() {
  return <HostToday />;
}
