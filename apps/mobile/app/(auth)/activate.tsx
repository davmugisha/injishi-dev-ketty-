/**
 * Activate - frame X3. The invited tenant's first screen: a landlord has
 * already registered a lease for them and this is where they claim it.
 *
 * Activating lands on `lease/[leaseId]/sign` for that lease with the Tenant
 * surface active, which is three facts settled in order — Personal seat,
 * Residence domain, authenticated session. The screen owns that hand-off.
 */
import { ActivateScreen } from '@/screens/auth/activate';

export default function ActivateRoute() {
  return <ActivateScreen />;
}
