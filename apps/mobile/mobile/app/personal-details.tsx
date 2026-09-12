/**
 * `/personal-details` — frame R14's "Personal details ›" and the Guest
 * artboard's "Profile". F-S12 §6 is the spec.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { PersonalDetailsScreen } from '@/screens/account';

export default function PersonalDetailsRoute() {
  return <PersonalDetailsScreen />;
}
