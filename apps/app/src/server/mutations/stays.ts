/** Writes for the stays area, through the API. Plain functions: server actions and verify scripts both call them. */
import type { SourceContext } from "../sources/types";

/**
 * Reply to a guest on their conversation (POST /ops/threads/:id/messages, `message.send`). No
 * Idempotency-Key, by the route's design: a repeated message is visible and fixable; an archived
 * conversation is refused (409) by the API.
 */
export async function sendGuestMessage(ctx: SourceContext, threadId: string, body: string): Promise<void> {
  await ctx.ops().post(`/api/v1/ops/threads/${encodeURIComponent(threadId)}/messages`, { body });
}
