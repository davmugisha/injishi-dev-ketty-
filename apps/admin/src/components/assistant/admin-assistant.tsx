import { AssistantCurrentConversation } from "@injishi/contracts";

import { apiGet } from "@/lib/api/server";

import { AssistantPanel } from "./assistant-panel";

/**
 * The assistant's first read, on the server (ADR-061 slice G).
 *
 * The panel used to fetch this with a Server Action from `useEffect` on mount.
 * On `/`, which redirects to `/overview`, that action landed during the
 * redirect navigation and Next's router threw "Rendered more hooks than during
 * the previous render" (found in the browser walk; `/overview` opened directly
 * was clean). Every other admin read is server rendered, and so is this one
 * now: nothing fires on mount, and the panel starts with what it needs,
 * including the greeting and the starter questions a new conversation opens
 * with.
 *
 * Draws nothing when the API has the assistant off or cannot be reached.
 */
export async function AdminAssistant() {
  const result = await apiGet("/api/v1/assistant/conversations/current", AssistantCurrentConversation, {
    surface: "admin",
  });
  if (!result.ok || !result.data.enabled) return null;
  return (
    <AssistantPanel
      initialConversation={result.data.conversation}
      greeting={result.data.greeting}
      starters={result.data.suggestions}
    />
  );
}
