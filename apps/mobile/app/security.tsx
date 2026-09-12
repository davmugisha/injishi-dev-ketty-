/**
 * `/security` — the "Security · 2FA · On ›" row on all three Account frames.
 *
 * F-S12 §6: the 2FA toggle, the active sessions, and sign out everywhere.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { SecurityScreen } from '@/screens/account';

export default function SecurityRoute() {
  return <SecurityScreen />;
}
