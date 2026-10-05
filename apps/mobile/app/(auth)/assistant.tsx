/**
 * `/(auth)/assistant` — the support assistant, signed out (ADR-061 slice G).
 *
 * Inside `(auth)` because the root layout sends a signed out reader to sign in
 * from anywhere else, and "I can't sign in" is the question this has to be
 * reachable for. Opened from the sign in screen. Same screen as `/assistant`.
 */
import { AssistantScreen } from '@/screens/assistant';

export default function SignedOutAssistantRoute() {
  return <AssistantScreen />;
}
