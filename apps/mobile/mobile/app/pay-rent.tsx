/**
 * Pay rent — frame R12's sheet. MTN MoMo first, then Airtel Money, then card,
 * matching the order those rails answer in. Registered as a `formSheet` in
 * `app/_layout.tsx`; `Sheet` draws what goes inside one.
 */
import { PayRent } from '@/screens/tenant/pay-rent';

export default function PayRentScreen() {
  return <PayRent />;
}
