/**
 * `/privacy` — Account's Privacy row, on every seat (ADR-063 AC-8).
 *
 * The crash reports switch today; PostHog's analytics switch joins it with
 * feature 22. The screen lives in `src/screens/account/`; this is one line so
 * `app/` stays a route table.
 */
import { PrivacyScreen } from '@/screens/account';

export default function PrivacyRoute() {
  return <PrivacyScreen />;
}
