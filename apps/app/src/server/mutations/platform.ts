/** Writes for the platform area, through the API. Plain functions: server actions and verify scripts both call them. */
import type { SourceContext } from "../sources/types";

/** Start (in_progress) or finish (done) a cleaning task. The API refuses a move its state machine does not allow. */
export async function advanceHousekeepingTask(
  ctx: SourceContext,
  id: string,
  to: "in_progress" | "done",
): Promise<void> {
  await ctx.ops().post(`/api/v1/ops/housekeeping-tasks/${encodeURIComponent(id)}/advance`, { to });
}
