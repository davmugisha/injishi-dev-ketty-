"use client";

/**
 * Cleaning tasks (F-P04) — the desktop side of the housekeeping board.
 *
 * **On real data** (ADR-035, D-f wave 1). Reads
 * `GET /api/v1/ops/housekeeping-tasks` and commands `POST /:id/advance`. The
 * demo store is gone from this screen (D-i).
 *
 * It is the same list the housekeepers carry on their phones. Housekeeping
 * status never blocks a booking; it only tells the desk what is ready, because
 * availability and cleanliness are orthogonal (D15).
 *
 * **THE ASSIGN DROPDOWN IS GONE, AND THAT IS A FINDING RATHER THAN A CHOICE.**
 * The demo let a supervisor pick a housekeeper for any task from a select. No
 * endpoint does that. `POST /ops/housekeeping-tasks` takes `assignedToUserId`
 * when a task is CREATED, and `POST /:id/advance` takes a status and a note and
 * nothing else — there is no reassign. Keeping the control would have meant a
 * dropdown that changed a name on screen and nothing in the database, which is
 * the exact class of thing this wave exists to remove. Who a task belongs to is
 * shown, read only, and reassignment is recorded as owed in ADR-035.
 *
 * Assignment being ABSENT is still a real answer: an unassigned task goes to the
 * shared list and whoever is free picks it up. That was true in the demo and is
 * true here.
 */

import { cn } from "@/lib/utils";
import type { HousekeepingTaskStatus, OperatorHousekeepingTask } from "@injishi/contracts";
import { Icon } from "../components/icon";
import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
  surfaceClass,
} from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useAdvanceHousekeepingTask, useHousekeepingTasks } from "../data/ops";
import { usePms } from "../store";

/** The five real task states, worded for a desk. */
const STATUS: Record<
  HousekeepingTaskStatus,
  { label: string; intent: "ok" | "warn" | "info" | "bad" | "neutral" }
> = {
  pending: { label: "Waiting", intent: "warn" },
  in_progress: { label: "Being cleaned", intent: "info" },
  done: { label: "Cleaned", intent: "ok" },
  inspected: { label: "Inspected", intent: "neutral" },
  // A task that cannot proceed until maintenance has been. The demo had no
  // such state and so could not show the one task that is actually stuck.
  blocked: { label: "Blocked", intent: "bad" },
};

/** What the five task types are called on screen. */
const TASK_TYPE: Record<string, string> = {
  checkout_clean: "Checkout clean",
  stayover_clean: "Stayover clean",
  inspection: "Inspection",
  deep_clean: "Deep clean",
  turndown: "Turndown",
};

/** Where a task goes next, and what the button says. */
const NEXT: Partial<Record<HousekeepingTaskStatus, { to: HousekeepingTaskStatus; label: string }>> = {
  pending: { to: "in_progress", label: "Start cleaning" },
  in_progress: { to: "done", label: "Mark cleaned" },
  done: { to: "inspected", label: "Mark inspected" },
  // A blocked task goes back to the queue once the fault behind it is fixed.
  blocked: { to: "pending", label: "Unblock" },
};

/**
 * Where the room ENDS UP, which is the thing the desk needs to know.
 *
 * The toast used to read "Room 12 — start cleaning", the button's own words
 * back again. A desk asking "can I sell 12 tonight?" gets no answer from that.
 */
const ARRIVED: Record<HousekeepingTaskStatus, (room: string) => string> = {
  pending: (r) => `Room ${r} is back in the cleaning queue.`,
  in_progress: (r) => `Room ${r} is being cleaned.`,
  done: (r) => `Room ${r} is clean and waiting on an inspection.`,
  inspected: (r) => `Room ${r} is inspected and ready to sell.`,
  blocked: (r) => `Room ${r} is blocked until maintenance has been.`,
};

/** Still outstanding, so it belongs in the top list. */
const OPEN: HousekeepingTaskStatus[] = ["pending", "in_progress", "blocked"];

const COLS = "minmax(72px,.6fr) minmax(170px,1.6fr) minmax(130px,1fr) minmax(190px,1.2fr) auto";

export function Cleaning() {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useHousekeepingTasks(workspaceId);
  const advance = useAdvanceHousekeepingTask(workspaceId);

  // Gated on `housekeeping.set`, matching the server: the person doing the
  // cleaning sends this, and a housekeeper holds that permission.
  const maySet = can("housekeeping.set");
  const denied = maySet ? undefined : reasonFor("housekeeping.set");

  function move(task: OperatorHousekeepingTask, to: HousekeepingTaskStatus) {
    advance.mutate(
      { taskId: task.id, to },
      {
        onSuccess: () => toast(ARRIVED[to](task.roomLabel ?? "—"), "ok"),
        onError: toastError,
      },
    );
  }

  if (query.isPending) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <Skeleton height={38} />
        <Skeleton height={190} delay={60} />
      </div>
    );
  }

  if (query.isError) {
    /* A failed read is not an empty board. "All caught up" told to a property
       with eleven dirty rooms is the worst thing this screen can say. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load the cleaning board. Every task is still on it — this is on
        our side, not an empty list.
      </LoadFailed>
    );
  }

  const tasks = query.data?.tasks ?? [];
  const open = tasks.filter((t) => OPEN.includes(t.status));
  const done = tasks.filter((t) => !OPEN.includes(t.status));

  const row = (t: OperatorHousekeepingTask, i: number, actionable: boolean) => {
    const status = STATUS[t.status];
    const next = NEXT[t.status];
    // Only the row that was pressed. `advance.isPending` alone put "Saving…"
    // on every task on the board at once.
    const busy = advance.isPending && advance.variables?.taskId === t.id;
    return (
      <div
        key={t.id}
        className={cn(
          "grid items-center gap-2.5 px-[18px] py-3",
          i === 0 ? "border-t border-transparent" : "border-t border-line",
        )}
        style={{ gridTemplateColumns: COLS }}
      >
        <span className="pms-num text-sm font-bold whitespace-nowrap text-ink">
          Room {t.roomLabel ?? "—"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">
            {TASK_TYPE[t.taskType] ?? t.taskType}
          </span>
          {t.note && (
            <span className="block truncate text-2xs text-muted-foreground">{t.note}</span>
          )}
        </span>
        <span>
          <Badge intent={status.intent}>{status.label}</Badge>
        </span>
        <span className="text-xs text-muted-foreground">
          {t.assignedToName
            ? actionable
              ? t.assignedToName
              : `Done by ${t.assignedToName}`
            : actionable
              ? "Unassigned — any phone picks it up"
              : "Done"}
        </span>
        <span className="flex justify-end">
          {actionable && next ? (
            <ActionButton
              variant={t.status === "pending" ? "primary" : "secondary"}
              onClick={() => !denied && !busy && move(t, next.to)}
              deniedReason={denied}
              pending={busy}
            >
              {busy ? "Saving" : next.label}
            </ActionButton>
          ) : (
            <span className="text-ok">
              <Icon name="check" size={16} strokeWidth={2.4} />
            </span>
          )}
        </span>
      </div>
    );
  };

  return (
    <div className="pms-enter flex flex-col gap-4">
      {/* COUNTS, NOT FILTERS. These were `Chip`s with an empty `onClick`: they
          had a chip's border, a chip's hover and a chip's cursor, and nothing
          happened when you pressed one. A tally reads as a tally. */}
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
        {(Object.keys(STATUS) as HousekeepingTaskStatus[]).map((key) => (
          <span key={key} className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
            <span className="pms-num text-base font-bold text-ink">
              {tasks.filter((t) => t.status === key).length}
            </span>
            {STATUS[key].label}
          </span>
        ))}
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground">
          The same list the housekeepers work from on their phones.
        </span>
      </div>

      <section>
        <SectionHeading n={open.length}>Waiting</SectionHeading>
        {open.length === 0 ? (
          <EmptyState className="mt-2.5 p-6">
            All caught up. New checkouts appear here the moment the desk taps Check out.
          </EmptyState>
        ) : (
          <div className={cn(surfaceClass, "mt-2.5 scrollbar overflow-x-auto")}>
            <div className="min-w-[760px]">{open.map((t, i) => row(t, i, true))}</div>
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <SectionHeading n={done.length}>Cleaned</SectionHeading>
          <div className={cn(surfaceClass, "mt-2.5 scrollbar overflow-x-auto")}>
            <div className="min-w-[760px]">{done.map((t, i) => row(t, i, false))}</div>
          </div>
        </section>
      )}

      <p className="text-2xs text-muted-foreground">
        Check out puts a room on this board on its own. Housekeeping status never blocks a
        booking — it only tells the desk what is ready.
      </p>
    </div>
  );
}
