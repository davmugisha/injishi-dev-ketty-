/**
 * The housekeeper's day, on the API: a manager puts a room on Jeanne's board, she starts it and
 * finishes it on the staff phone (the same mutation the screen's buttons call), the finished room
 * moves to "Done today", and a finance user, who holds no `housekeeping.set`, is refused.
 */
import type { HousekeepingDone, HousekeepingTask } from "@injishi/data/fixtures/platform";
import { advanceHousekeepingTask } from "../../src/server/mutations/platform";
import { sources } from "../../src/server/sources/platform";
import type { Flow } from "./types";

interface Room {
  id: string;
  label: string | null;
}

export const flows: Flow[] = [
  {
    name: "a room goes onto the housekeeper's board, is cleaned, and lands in Done today",
    async run({ as, check, refused, step }) {
      const manager = await as("manager");
      const jeanne = await as("housekeeper");
      const jeanneId = jeanne.account?.user.id;
      check(jeanneId, "the housekeeper has no account");

      const { rooms } = await manager.ops().get<{ rooms: Room[] }>("/api/v1/ops/rooms");
      const room = rooms.find((r) => r.label === "210");
      check(room, "room 210 is not in Isangano's inventory");
      const created = await manager.ops().post<{ id: string }>("/api/v1/ops/housekeeping-tasks", {
        roomId: room.id,
        taskType: "checkout_clean",
        assignedToUserId: jeanneId,
        priority: 60,
        note: "Due 15:00 · flow check",
      });
      step(`manager put room 210 on Jeanne's board (${created.id})`);

      const waiting = (await sources["platform.housekeepingTasks"].list(jeanne)) as HousekeepingTask[];
      const onBoard = waiting.find((t) => t.id === created.id);
      check(onBoard, "Jeanne's board does not show the new task");
      check(
        onBoard.status === "waiting" && onBoard.flag === "Due 15:00" && onBoard.kind === "Checkout",
        `the new task reads ${JSON.stringify(onBoard)}`,
      );
      check(waiting[0].id === created.id, "a priority-60 task is not first on the board");

      await advanceHousekeepingTask(jeanne, created.id, "in_progress");
      const started = ((await sources["platform.housekeepingTasks"].list(jeanne)) as HousekeepingTask[]).find(
        (t) => t.id === created.id,
      );
      check(started?.status === "active", `after Start the task reads ${JSON.stringify(started)}`);
      step("Jeanne started it: the board shows it active");

      await advanceHousekeepingTask(jeanne, created.id, "done");
      const after = (await sources["platform.housekeepingTasks"].list(jeanne)) as HousekeepingTask[];
      check(!after.some((t) => t.id === created.id), "a finished task is still on the board");
      const done = (await sources["platform.housekeepingDone"].list(jeanne)) as HousekeepingDone[];
      const landed = done.find((d) => d.id === created.id);
      check(
        landed && /^Cleaned \d{2}:\d{2} · waiting for inspection$/.test(landed.when) && landed.state === "Clean",
        `Done today reads ${JSON.stringify(landed)}`,
      );
      step(`finished: Done today shows "${landed.when}"`);

      // Starting a task that is already done is refused by the API's state machine, not by the screen.
      await refused(
        409,
        () => advanceHousekeepingTask(jeanne, created.id, "in_progress"),
        "restarting a finished task",
      );

      const finance = await as("finance");
      const anyWaiting = after[0];
      check(anyWaiting, "no waiting task left to probe the refusal with");
      await refused(
        403,
        () => advanceHousekeepingTask(finance, anyWaiting.id, "in_progress"),
        "finance moving a cleaning task",
      );
      step("finance (no housekeeping.set) is refused with 403");
    },
  },
];
