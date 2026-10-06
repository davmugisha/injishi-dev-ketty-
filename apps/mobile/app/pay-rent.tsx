/**
 * Pay rent — frame R12's sheet. MTN MoMo first, then Airtel Money, matching
 * the order those rails answer in; no card rail exists until the payment
 * gateway does. Registered as a `formSheet` in `app/_layout.tsx`, which opens
 * it only for the tenant on the demo stack (`usePlatform().isDemo`): the rail
 * behind it is a client timer, not a gateway. `Sheet` draws what goes inside.
 */
import { PayRent } from '@/screens/tenant/pay-rent';

export default function PayRentScreen() {
  return <PayRent />;
}
