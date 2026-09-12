/**
 * `/rent` — frame R12, the Tenant tab set's second tab.
 *
 * Only the Personal workspace on the Residence domain reaches it as a tab; the
 * route stays registered for every surface so a deep link or a `router.push`
 * written against it resolves.
 */
import { Rent } from '@/screens/tenant/rent';

export default function RentScreen() {
  return <Rent />;
}
