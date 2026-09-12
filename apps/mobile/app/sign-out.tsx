/**
 * `/sign-out` — the confirm behind Account's danger-outline row.
 *
 * A `CONFIRM_SHEET`. It is the one control in the app whose feedback is the app
 * disappearing, which is what earns it the question.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { SignOutSheet } from '@/screens/account';

export default function SignOutRoute() {
  return <SignOutSheet />;
}
