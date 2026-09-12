/**
 * Inbox — frame R13, shared by Guest and Tenant (ADR-032,
 * `032-messaging-surface.md`).
 *
 * The route; the screen is `src/screens/inbox/inbox.tsx`. Built by Session 6,
 * replacing Session 0's empty-state placeholder. Renamed from Messages by
 * Session 0 per decision D3: the tab is Inbox and the segment inside it is
 * Messages | Notifications, which is the distinction the old name flattened.
 */
import { Inbox } from '@/screens/inbox/inbox';

export default function InboxScreen() {
  return <Inbox />;
}
