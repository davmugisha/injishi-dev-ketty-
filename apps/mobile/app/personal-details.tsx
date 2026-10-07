/**
 * `/personal-details` — frame R14's "Personal details ›" and the Guest
 * artboard's "Profile". F-S12 §6 is the spec. Read only for now: the name
 * and phone are `GET /api/v1/me/profile` (mobile audit 2026-10-05, SA-14).
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { PersonalDetailsScreen } from '@/screens/account';

export default function PersonalDetailsRoute() {
  return <PersonalDetailsScreen />;
}
