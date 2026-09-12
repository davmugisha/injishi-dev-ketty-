/**
 * `/appearance` — system, light or dark.
 *
 * A `CONFIRM_SHEET`: three rows and an escape, and a taller detent would open a
 * dead zone under the last option.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { AppearanceSheet } from '@/screens/account';

export default function AppearanceRoute() {
  return <AppearanceSheet />;
}
