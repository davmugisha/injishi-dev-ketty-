/**
 * `/security` — the "Security · 2FA · On ›" row on all three Account frames.
 *
 * F-S12 §6 asks for a 2FA toggle, the active sessions, and sign out
 * everywhere. The screen draws the one part the server answers today: the
 * two-step state from `GET /api/v1/me/two-factor`, read only (mobile audit
 * 2026-10-05, SA-06).
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { SecurityScreen } from '@/screens/account';

export default function SecurityRoute() {
  return <SecurityScreen />;
}
