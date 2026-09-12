/**
 * One conversation. Access is proved from the booking or the lease, never from
 * workspace membership (F-S06, ADR-032).
 *
 * The route; the screen is `src/screens/inbox/thread.tsx`. Built by Session 6.
 */
import { Thread } from '@/screens/inbox/thread';

export default function ThreadScreen() {
  return <Thread />;
}
