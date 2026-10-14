"use server";

import type { HousekeepingDone, HousekeepingTask } from "@injishi/data/fixtures/platform";
import { deleteDocument, getDocument, saveDocument, updateDocument } from "@injishi/db";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";

/** Housekeeper starts or finishes a room. Finished rooms move to "Done today" (persisted in the embedded DB). */
export async function setHousekeepingTaskStatus(id: string, status: "active" | "done"): Promise<void> {
  await requirePersona("StaffToday");
  if (status === "active") {
    await updateDocument<HousekeepingTask>("platform.housekeepingTasks", id, { status: "active" });
  } else {
    const task = await getDocument<HousekeepingTask>("platform.housekeepingTasks", id);
    if (!task) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    await saveDocument<HousekeepingDone>("platform.housekeepingDone", {
      id: task.id,
      room: task.room,
      kind: task.kind,
      when: `Cleaned ${time} · waiting for inspection`,
      state: "Clean",
      stateTone: "success",
    });
    await deleteDocument("platform.housekeepingTasks", id);
  }
  revalidatePath("/staff");
}
