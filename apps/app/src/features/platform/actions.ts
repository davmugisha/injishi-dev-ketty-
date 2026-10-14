"use server";

import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { advanceHousekeepingTask } from "@/server/mutations/platform";

/**
 * Housekeeper starts or finishes a room. The task moves on the API (`POST /ops/housekeeping-tasks/:id/advance`),
 * so the change is the business's record: the board, the room rack and the supervisor see it too.
 */
export async function setHousekeepingTaskStatus(id: string, status: "active" | "done"): Promise<void> {
  await requirePersona("StaffToday");
  await advanceHousekeepingTask(await requestContext(), id, status === "active" ? "in_progress" : "done");
  revalidatePath("/staff");
}
