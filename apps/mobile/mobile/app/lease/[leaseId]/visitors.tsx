/**
 * Visitor log — frame R19. Lease-scoped rather than profile-scoped: the log
 * belongs to the tenancy, and an ended lease's log is read-only history
 * (F-R14 §9).
 */
import { LeaseVisitors } from '@/screens/tenant/lease-visitors';

export default function LeaseVisitorsScreen() {
  return <LeaseVisitors />;
}
