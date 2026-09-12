/**
 * `/rent-roll` — the Landlord home, frames R1 and R2. Unlinked in the tab bar
 * because `index` already renders it for the landlord surface; this keeps the
 * path resolving for a deep link or a `router.push` written against it.
 */
import { RentRoll } from '@/screens/landlord/rent-roll';

export default function RentRollScreen() {
  return <RentRoll />;
}
