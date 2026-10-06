/**
 * Request renewal — frame R18, FL26.
 *
 * Hidden in v1.0: renewal is P2 in the owner's cut, `app/_layout.tsx` registers
 * this route behind `guard={false}`, and nothing in the app links here.
 */
import { LeaseRenew } from '@/screens/tenant/lease-renew';

export default function LeaseRenewScreen() {
  return <LeaseRenew />;
}
