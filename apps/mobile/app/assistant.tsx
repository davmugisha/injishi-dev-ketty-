/**
 * `/assistant` — the support assistant, signed in (ADR-061 slice G). Opened
 * from Account. The screen lives in `src/screens/assistant/`; this is one line
 * so `app/` stays a route table.
 */
import { AssistantScreen } from '@/screens/assistant';

export default function AssistantRoute() {
  return <AssistantScreen />;
}
