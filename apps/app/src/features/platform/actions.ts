"use server";

import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import { advanceHousekeepingTask } from "@/server/mutations/platform";

/** What the housekeeper's press answers: done, or the API's refusal in words the phone can show. */
type TaskStatusResult = { ok: true } | { ok: false; error: string };

/**
 * Housekeeper starts or finishes a room. The task moves on the API (`POST /ops/housekeeping-tasks/:id/advance`),
 * so the change is the business's record: the board, the room rack and the supervisor see it too. A refusal (a
 * move the state machine does not allow, a task that is not hers, no permission) comes back as words for a
 * toast, never as an error that breaks the screen.
 */
export async function setHousekeepingTaskStatus(id: string, status: "active" | "done"): Promise<TaskStatusResult> {
  await requirePersona("StaffToday");
  try {
    await advanceHousekeepingTask(await requestContext(), id, status === "active" ? "in_progress" : "done");
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.forbidden ? `Not allowed: ${error.message}` : error.message };
    }
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
  revalidatePath("/staff");
  return { ok: true };
}
