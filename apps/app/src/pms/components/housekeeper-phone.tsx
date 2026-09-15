"use client";

/**
 * The housekeeper's phone (F-P04) — a focused surface, not a responsive
 * breakpoint of the desk. A room attendant sees three things: their cleaning
 * list, the rooms, and a way to report something broken (blueprint §3.3).
 *
 * **ON THE API.** It used to be a preview built on the demo store: "Mark ready"
 * changed only this browser tab, and the fault form reached nobody.
 * Every control now writes to the rows the desk reads (see
 * `data/housekeeper.ts` for the routes), and every message says what the
 * server answered:
 *
 *   - Start and Finish advance the task. Finish also sets the room clean (or
 *     inspected, for an inspection), because the server moves only the task
 *     and the desk sells from the room.
 *   - A tap on a room's status writes it.
 *   - A fault becomes a maintenance ticket the manager can see.
 *
 * What each button offers comes from `useCapability` (the server's array), and
 * the server refuses what the array does not hold. This file decides nothing.
 *
 * `AppShell` renders it for any grant `opensOnPhoneSurface` picks, with no
 * props; keep it that way.
 */

import type { HousekeepingStatus, OperatorHousekeepingTask, OperatorRoom } from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";

import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useMoveTask,
  usePhoneRooms,
  usePhoneTasks,
  useReportFault,
  useSessionPerson,
  useSetRoomStatus,
} from "../data/housekeeper";
import { useMyProfile } from "../data/profile";
import { useSignOut } from "../data/sign-out";
import { usePms } from "../store";
import { currentGrant } from "../store/helpers";
import { EMPTY_FAULT, FaultReport, type FaultDraft } from "./housekeeper/fault-report";
import { RoomList } from "./housekeeper/room-list";
import { RoomSheet } from "./housekeeper/room-sheet";
import { TaskList } from "./housekeeper/task-list";
import { FAULTS, ROOM_STATUS, roomName } from "./housekeeper/words";
import { Icon } from "./icon";
import { LoadFailed, Skeleton } from "./ui";

type Tab = "tasks" | "rooms" | "report";

const OPEN = new Set(["pending", "in_progress", "blocked"]);

export function HousekeeperPhone() {
  const { state, toast, toastError } = usePms();
  const { signOut, signingOut } = useSignOut();
  const workspaceId = useWorkspaceId();
  const { can, status } = useCapability();
  const person = useSessionPerson();
  const profile = useMyProfile();

  const tasksQuery = usePhoneTasks(workspaceId);
  const roomsQuery = usePhoneRooms(workspaceId);
  const move = useMoveTask(workspaceId);
  const setRoom = useSetRoomStatus(workspaceId);
  const report = useReportFault(workspaceId);

  const [tab, setTab] = useState<Tab>("tasks");
  const [draft, setDraft] = useState<FaultDraft>(EMPTY_FAULT);
  const [sheetRoomId, setSheetRoomId] = useState<string | null>(null);

  // Only once the server has answered. Before that `can` reads the demo
  // fixture, and a button offered from a fixture is the thing this replaced.
  const resolved = status === "resolved" && workspaceId !== null;
  const maySet = resolved && can("housekeeping.set");
  const mayReport = resolved && can("ticket.advance");

  const grant = currentGrant(state);
  const placeName = grant?.propertyName ?? grant?.label ?? "Housekeeping";
  const fullName = person.data?.name ?? profile.data?.fullName ?? null;
  const firstName = fullName?.trim().split(/\s+/)[0] ?? null;

  const meId = person.data?.id ?? null;
  const tasks = tasksQuery.data?.tasks ?? [];
  const rooms = roomsQuery.data?.rooms ?? [];
  const myOpen = tasks.filter(
    (t) => OPEN.has(t.status) && (meId ? t.assignedToUserId === meId || t.assignedToUserId === null : true),
  ).length;

  const labelOf = (roomId: string) => roomName(rooms.find((r) => r.id === roomId)?.label);

  function moveTask(task: OperatorHousekeepingTask, to: OperatorHousekeepingTask["status"]) {
    // One task at a time. A second press while the first is on the wire would
    // replace the first mutation's callbacks, and its toast would never come.
    if (move.isPending) return;
    const room = rooms.find((r) => r.id === task.roomId) ?? null;
    const name = roomName(task.roomLabel);
    move.mutate(
      { task, to, room },
      {
        onSuccess: (outcome) => {
          if (outcome.kind === "room-failed") {
            toast(`Task done. But the room board still shows ${name} as before — open Rooms and tap its status.`, "warn");
            return;
          }
          if (to === "in_progress") toast(`${name}: cleaning started.`, "ok");
          else if (to === "pending") toast(`${name} is back on the list.`, "ok");
          else if (outcome.kind === "both") {
            const now = to === "done" && task.taskType === "inspection" ? "inspected" : "clean";
            toast(`${name} is ${now}. The front desk can see it.`, "ok");
          } else toast(`${name}: done.`, "ok");
        },
        onError: toastError,
      },
    );
  }

  function setRoomStatus(room: OperatorRoom, to: HousekeepingStatus) {
    if (setRoom.isPending) return;
    setRoom.mutate(
      { roomId: room.id, housekeeping: to },
      {
        onSuccess: () => {
          toast(`${roomName(room.label)}: ${ROOM_STATUS[to].label}. The front desk can see it.`, "ok");
          setSheetRoomId(null);
        },
        onError: toastError,
      },
    );
  }

  function openReport(roomId: string) {
    setSheetRoomId(null);
    setDraft({ ...EMPTY_FAULT, roomId });
    setTab("report");
  }

  function sendReport() {
    if (!draft.roomId || !draft.category) {
      toast(draft.roomId ? "Tap what is wrong first." : "Tap the room first.", "warn");
      return;
    }
    const kind = FAULTS.find((f) => f.value === draft.category)?.label ?? "Fault";
    const name = labelOf(draft.roomId);
    const note = draft.note.trim();
    report.mutate(
      {
        roomId: draft.roomId,
        category: draft.category,
        title: `${kind} — ${name}`,
        description: note ? note : undefined,
        priority: draft.urgent ? "urgent" : "normal",
      },
      {
        onSuccess: () => {
          toast(`Sent. Maintenance can see ${name} now.`, "ok");
          setDraft(EMPTY_FAULT);
          setTab("tasks");
        },
        // The draft stays, so a refused or lost report can be sent again
        // without typing it twice.
        onError: toastError,
      },
    );
  }

  const nav: { key: Tab; icon: string; label: string; n?: number }[] = [
    { key: "tasks", icon: "sparkles", label: "My tasks", n: myOpen },
    { key: "rooms", icon: "bed-double", label: "Rooms" },
    ...(mayReport ? [{ key: "report" as const, icon: "wrench", label: "Report" }] : []),
  ];

  // A tab the role cannot open falls back to the list rather than rendering it.
  const view: Tab = tab === "report" && !mayReport ? "tasks" : tab;

  // Read from the live list, so a refetch while it is open shows the truth.
  const sheetRoom = view === "rooms" && sheetRoomId ? (rooms.find((r) => r.id === sheetRoomId) ?? null) : null;

  let body: ReactNode;
  if (status === "loading" || (resolved && (tasksQuery.isPending || roomsQuery.isPending))) {
    body = (
      <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading">
        <Skeleton height={26} />
        <Skeleton height={150} delay={60} />
        <Skeleton height={150} delay={120} />
      </div>
    );
  } else if (!resolved) {
    body = (
      <LoadFailed onRetry={() => window.location.reload()}>
        We couldn&apos;t reach the server, so we can&apos;t show your rooms. Your tasks are still
        there — try again.
      </LoadFailed>
    );
  } else if (tasksQuery.isError || roomsQuery.isError) {
    body = (
      <LoadFailed
        onRetry={() => {
          void tasksQuery.refetch();
          void roomsQuery.refetch();
        }}
        retrying={tasksQuery.isFetching || roomsQuery.isFetching}
      >
        We couldn&apos;t load your rooms. Nothing is lost — this is on our side. Try again.
      </LoadFailed>
    );
  } else if (view === "tasks") {
    body = (
      <TaskList
        tasks={tasks}
        rooms={rooms}
        meId={meId}
        maySet={maySet}
        mayReport={mayReport}
        busyTaskId={move.isPending ? (move.variables?.task.id ?? null) : null}
        onMove={moveTask}
        onReport={openReport}
      />
    );
  } else if (view === "rooms") {
    body = (
      <RoomList rooms={rooms} onOpen={setSheetRoomId} />
    );
  } else {
    body = (
      <FaultReport
        rooms={rooms}
        draft={draft}
        onChange={setDraft}
        sending={report.isPending}
        onSend={sendReport}
      />
    );
  }

  return (
    /* The frame is `.pms-phone` in pms-tokens.css so it can drop away below
       640px — on a real phone the simulated bezel is overflow. */
    <div className="pms-phone-stage">
      <div className="pms-phone" data-surface="housekeeper-phone">
        <header className="flex items-center gap-2.5 border-b border-line px-5 pt-3.5 pb-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-bold text-ink">{placeName}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {firstName ? `${firstName} · Housekeeping` : "Housekeeping"}
            </span>
          </span>
          {/*
            The housekeeper's ONLY way out (F-S01). `AppShell` never renders
            the sidebar for this surface, so the sign out that lives there is
            unreachable for exactly the people most likely to be on a shared
            handset. `pending` rather than `disabled`: a dead-looking button is
            how somebody walks away believing they signed out.
          */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            shape="pill"
            onClick={signOut}
            pending={signingOut}
            aria-label={signingOut ? "Signing out" : "Sign out"}
            title={signingOut ? "Signing out…" : "Sign out"}
            className="size-11 text-muted-foreground"
          >
            <Icon name="log-out" size={20} />
          </Button>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-4 pb-6">{body}</main>

        {sheetRoom && (
          <RoomSheet
            room={sheetRoom}
            maySet={maySet}
            mayReport={mayReport}
            busy={setRoom.isPending && setRoom.variables?.roomId === sheetRoom.id}
            onSet={setRoomStatus}
            onReport={openReport}
            onClose={() => setSheetRoomId(null)}
          />
        )}

        <nav
          className="flex gap-1.5 border-t border-line2 bg-panel px-2.5 pt-2 pb-3.5"
          aria-label="Phone sections"
        >
          {nav.map((b) => {
            const on = view === b.key;
            return (
              <Button
                key={b.key}
                type="button"
                variant="ghost"
                shape="rounded"
                size="lg"
                aria-current={on ? "page" : undefined}
                data-tab={b.key}
                onClick={() => {
                  setSheetRoomId(null);
                  setTab(b.key);
                }}
                className={cn(
                  "h-auto min-h-14 flex-1 flex-col gap-0.5 py-1.5",
                  on ? "bg-accent-soft text-accent-text" : "text-sidebar-foreground",
                )}
              >
                <Icon name={b.icon} size={22} />
                <span className="text-xs font-semibold">
                  {b.label}
                  {b.n ? ` (${b.n})` : ""}
                </span>
              </Button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
