/**
 * Report an issue — frame R20. Writes into `@/data/tickets`, which the
 * Landlord surface's Repairs tab (frame R4) reads.
 */
import { LeaseMaintenanceNew } from '@/screens/tenant/lease-maintenance-new';

export default function LeaseMaintenanceNewScreen() {
  return <LeaseMaintenanceNew />;
}
