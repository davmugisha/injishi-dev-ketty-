/** Live sources for the platform area: API responses presented as the platform fixture document types. */
import type { HousekeepingDone, HousekeepingTask, Tone } from "@injishi/data/fixtures/platform";
import { clock, kigaliDate } from "../format";
import { defineSources, type SourceContext } from "./types";

/** GET /api/v1/ops/housekeeping-tasks (OperatorHousekeepingTask in @injishi/contracts). */
interface ApiHousekeepingTask {
  id: string;
  roomId: string;
  roomLabel: string | null;
  taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
  status: "pending" | "in_progress" | "done" | "inspected" | "blocked";
  assignedToUserId: string | null;
  assignedToName: string | null;
  priority: number;
  note: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const KIND: Record<ApiHousekeepingTask["taskType"], { label: string; tone: Tone }> = {
  checkout_clean: { label: "Checkout", tone: "accent" },
  stayover_clean: { label: "Stayover", tone: "default" },
  deep_clean: { label: "Deep clean", tone: "info" },
  inspection: { label: "Inspection", tone: "warning" },
  turndown: { label: "Turndown", tone: "default" },
};

/** People who work the board from a phone see their own rooms; anyone supervising sees the whole board. */
const OWN_LIST = new Set(["housekeeper", "supervisor", "technician"]);

async function tasksFor(ctx: SourceContext): Promise<ApiHousekeepingTask[]> {
  const { tasks } = await ctx.ops().get<{ tasks: ApiHousekeepingTask[] }>("/api/v1/ops/housekeeping-tasks");
  const me = ctx.account?.user.id;
  return ctx.persona && OWN_LIST.has(ctx.persona.id) ? tasks.filter((t) => t.assignedToUserId === me) : tasks;
}

/** A note that opens with a due time ("Due 12:00 · …") carries the board's flag. */
function splitDue(note: string | null): { flag: string | null; note: string } {
  const m = (note ?? "").match(/^(Due \d{2}:\d{2})(?: · )?(.*)$/);
  return m ? { flag: m[1], note: m[2] } : { flag: null, note: note ?? "" };
}

export const sources = defineSources({
  "platform.housekeepingTasks": {
    naturalKey: "room",
    async list(ctx): Promise<HousekeepingTask[]> {
      const open = (await tasksFor(ctx)).filter((t) => ["pending", "in_progress", "blocked"].includes(t.status));
      return open
        .map((t) => {
          const { flag, note } = splitDue(t.note);
          return {
            id: t.id,
            room: t.roomLabel ?? "",
            kind: KIND[t.taskType].label,
            kindTone: KIND[t.taskType].tone,
            note,
            flag: t.status === "blocked" ? "Blocked" : flag,
            status: t.status === "in_progress" ? "active" : "waiting",
            priority: t.priority,
          } as HousekeepingTask & { priority: number };
        })
        .sort(
          (a, b) =>
            b.priority - a.priority ||
            (a.flag ?? "~").localeCompare(b.flag ?? "~") ||
            a.room.localeCompare(b.room, undefined, { numeric: true }),
        )
        .map(({ priority: _priority, ...task }) => task);
    },
  },
  "platform.housekeepingDone": {
    naturalKey: "room",
    async list(ctx): Promise<HousekeepingDone[]> {
      const today = ctx.today.iso;
      return (await tasksFor(ctx))
        .filter((t) => (t.status === "done" || t.status === "inspected") && t.completedAt)
        .filter((t) => kigaliDate(t.completedAt as string) === today)
        .sort((a, b) => (a.completedAt as string).localeCompare(b.completedAt as string))
        .map((t) => {
          const inspected = t.status === "inspected";
          const awaiting = !inspected && t.taskType === "checkout_clean";
          return {
            id: t.id,
            room: t.roomLabel ?? "",
            kind: KIND[t.taskType].label,
            when: `Cleaned ${clock(t.completedAt)}${inspected ? " · inspected" : awaiting ? " · waiting for inspection" : ""}`,
            state: inspected ? "Inspected" : "Clean",
            stateTone: "success",
          };
        });
    },
  },
});
