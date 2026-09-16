"use client";

/**
 * "My tasks": the rooms waiting on this housekeeper, then the rooms anybody
 * may take, then what was finished today.
 *
 * Tasks assigned to somebody else are left off. They are real, and they are on
 * the desk's Cleaning board, but a list of other people's work on a small
 * screen is how the wrong room gets cleaned twice.
 */

import type { OperatorHousekeepingTask, OperatorRoom } from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { cn } from "@/lib/utils";

import { kigaliDateOf, todayIso } from "../../lib/format";
import { Badge, EmptyState, SectionHeading, surfaceClass } from "../ui";
import { ROOM_STATUS, TASK_NEXT, TASK_STATUS, TASK_TYPE, roomName } from "./words";

const OPEN = new Set(["pending", "in_progress", "blocked"]);

export interface TaskListProps {
  tasks: readonly OperatorHousekeepingTask[];
  rooms: readonly OperatorRoom[];
  /** The signed-in person's id, or null when the session could not be read. */
  meId: string | null;
  maySet: boolean;
  mayReport: boolean;
  busyTaskId: string | null;
  onMove: (task: OperatorHousekeepingTask, to: OperatorHousekeepingTask["status"]) => void;
  onReport: (roomId: string) => void;
}

export function TaskList({
  tasks,
  rooms,
  meId,
  maySet,
  mayReport,
  busyTaskId,
  onMove,
  onReport,
}: TaskListProps) {
  const today = todayIso();
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  // Without an id every open task is shown as shared: less sorted, still true.
  const mine = meId ? tasks.filter((t) => OPEN.has(t.status) && t.assignedToUserId === meId) : [];
  const shared = tasks.filter(
    (t) => OPEN.has(t.status) && (meId ? t.assignedToUserId === null : true),
  );
  const doneToday = tasks.filter(
    (t) =>
      !OPEN.has(t.status) &&
      (meId ? t.assignedToUserId === meId || t.assignedToUserId === null : true) &&
      t.completedAt !== null &&
      kigaliDateOf(t.completedAt) === today,
  );

  const card = (t: OperatorHousekeepingTask) => {
    const room = roomById.get(t.roomId) ?? null;
    const next = TASK_NEXT[t.status];
    const busy = busyTaskId === t.id;
    const status = TASK_STATUS[t.status];
    return (
      <li
        key={t.id}
        data-task-id={t.id}
        className={cn(surfaceClass, "flex flex-col gap-3 p-4")}
      >
        <div className="flex items-start gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-xl font-bold text-ink">{roomName(t.roomLabel)}</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              {TASK_TYPE[t.taskType] ?? t.taskType}
              {room ? ` · ${room.roomTypeName}` : ""}
            </span>
          </span>
          <Badge intent={status.intent}>{status.label}</Badge>
        </div>
        {room?.occupiedBy && (
          <p className="text-sm text-ink2">Guest in the room — knock first.</p>
        )}
        {t.note && <p className="text-sm text-ink2">{t.note}</p>}
        {room && (
          <p className="text-xs text-muted-foreground">
            Room now: {ROOM_STATUS[room.housekeeping].label}
          </p>
        )}
        {maySet && next && (
          <Button
            type="button"
            variant={t.status === "blocked" ? "outline" : "primary"}
            size="lg"
            shape="rounded"
            fullWidth
            pending={busy}
            onClick={() => !busy && onMove(t, next.to)}
            className="min-h-12 text-base font-semibold"
          >
            {busy ? "Saving" : next.label}
          </Button>
        )}
        {mayReport && (
          <Button
            type="button"
            variant="ghost"
            size="md"
            shape="rounded"
            fullWidth
            onClick={() => onReport(t.roomId)}
            className="min-h-11 text-sm font-semibold text-ink2"
          >
            Something is broken here
          </Button>
        )}
      </li>
    );
  };

  const nothingOpen = mine.length === 0 && shared.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {nothingOpen && (
        <EmptyState className="mt-2 flex flex-col gap-1 p-6 text-center">
          <span className="text-base font-semibold text-ink">No rooms waiting</span>
          <span>New rooms come here when a guest checks out or the manager gives you one.</span>
        </EmptyState>
      )}

      {mine.length > 0 && (
        <section className="flex flex-col gap-2.5" aria-label="For you">
          <SectionHeading n={mine.length}>For you</SectionHeading>
          <ul className="flex flex-col gap-2.5">{mine.map(card)}</ul>
        </section>
      )}

      {shared.length > 0 && (
        <section className="flex flex-col gap-2.5" aria-label="Anyone can take">
          <SectionHeading n={shared.length}>{meId ? "Anyone can take" : "Waiting"}</SectionHeading>
          <ul className="flex flex-col gap-2.5">{shared.map(card)}</ul>
        </section>
      )}

      {doneToday.length > 0 && (
        <section className="flex flex-col gap-2.5" aria-label="Done today">
          <SectionHeading n={doneToday.length}>Done today</SectionHeading>
          <ul className={cn(surfaceClass, "flex flex-col")}>
            {doneToday.map((t, i) => (
              <li
                key={t.id}
                data-task-id={t.id}
                className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-line")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-ink">{roomName(t.roomLabel)}</span>
                  <span className="block text-xs text-muted-foreground">{TASK_TYPE[t.taskType] ?? t.taskType}</span>
                </span>
                <Badge intent={TASK_STATUS[t.status].intent}>{TASK_STATUS[t.status].label}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
