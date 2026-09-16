"use client";

/**
 * The housekeeper's phone, on the API (F-P04).
 *
 * Everything the phone reads or writes goes through here, and every call lands
 * on the same rows the desk reads, so a room marked clean on the phone is clean
 * on the Room grid at the desk:
 *
 *   GET  /ops/housekeeping-tasks            the cleaning list (no permission)
 *   POST /ops/housekeeping-tasks/:id/advance start or finish (`housekeeping.set`)
 *   GET  /ops/rooms                         the room board (no permission)
 *   POST /ops/rooms/:id/housekeeping        one tap status (`housekeeping.set`)
 *   POST /ops/tickets                       report a fault (`ticket.advance`)
 *
 * The two lists reuse the query keys `ops.ts` uses, so the desk's Cleaning
 * board and this phone share one cache and one invalidation. They add what a
 * handset needs that a desk does not: a phone is carried between rooms and
 * picked up again, so it refetches on focus and every 30 seconds rather than
 * trusting a list read ten minutes and three rooms ago.
 *
 * Nothing here decides a permission. `useCapability` reads the server's array
 * for the buttons; `WorkspaceGuard` refuses the call.
 */

import {
  type HousekeepingStatus,
  type HousekeepingTaskType,
  type OperatorHousekeepingTask,
  OperatorHousekeepingTaskList,
  type OperatorRoom,
  OperatorRoomList,
  type OperatorTicket,
  type RaiseTicketRequest,
} from "@injishi/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { API_BASE, REQUEST_TIMEOUT_MS, command } from "./api";
import { read } from "./ops";
import { queryKeys } from "./queries";

/** A list carried between rooms goes stale faster than one on a desk. */
const PHONE_REFRESH_MS = 30_000;

export function usePhoneTasks(
  workspaceId: string | null,
): UseQueryResult<OperatorHousekeepingTaskList> {
  return useQuery({
    queryKey: queryKeys.housekeepingTasks(workspaceId),
    queryFn: () =>
      read("/ops/housekeeping-tasks", workspaceId as string, OperatorHousekeepingTaskList),
    enabled: workspaceId !== null,
    refetchInterval: PHONE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}

export function usePhoneRooms(workspaceId: string | null): UseQueryResult<OperatorRoomList> {
  return useQuery({
    queryKey: queryKeys.rooms(workspaceId),
    queryFn: () => read("/ops/rooms", workspaceId as string, OperatorRoomList),
    enabled: workspaceId !== null,
    refetchInterval: PHONE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}

/** The signed-in person, as the auth server knows them. */
export interface SessionPerson {
  id: string;
  name: string | null;
}

/**
 * Who is holding the phone, so "my tasks" can mean mine.
 *
 * Read from Better Auth's own `get-session`, because `/me/profile` carries a
 * name and no id, and a task names its housekeeper by id. Null when there is
 * no answer: the list then shows every open task rather than guessing whose
 * they are, which is still true, just less sorted.
 */
export function useSessionPerson(): UseQueryResult<SessionPerson | null> {
  return useQuery({
    queryKey: ["auth", "session-person"] as const,
    queryFn: async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(`${API_BASE}/api/auth/get-session`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { user?: { id?: unknown; name?: unknown } } | null;
        const id = body?.user?.id;
        if (typeof id !== "string") return null;
        const name = body?.user?.name;
        return { id, name: typeof name === "string" ? name : null };
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * What a finished task makes the room.
 *
 * Finishing a task and the room's status are two rows (`housekeeping_tasks`
 * and `rooms.housekeeping`), and the server moves only the first. A cleaner who
 * taps Finish means "this room is clean", and the desk sells from the second
 * row, so the phone sends both. A turndown is done in an occupied room that was
 * already clean, so it changes nothing.
 */
export function roomAfter(taskType: HousekeepingTaskType): HousekeepingStatus | null {
  if (taskType === "turndown") return null;
  if (taskType === "inspection") return "inspected";
  return "clean";
}

export type FinishOutcome =
  /** The task is done and the room says so. */
  | { kind: "both"; task: OperatorHousekeepingTask }
  /** The task is done; the room needed no change. */
  | { kind: "task"; task: OperatorHousekeepingTask }
  /** The task is done, but the room update was refused or lost. */
  | { kind: "room-failed"; task: OperatorHousekeepingTask; error: unknown };

/**
 * Move a task on. For `done`, also bring the room to where the clean left it.
 *
 * No Idempotency-Key: the advance route does not read one, and does not need
 * one. A repeat of a move that already happened answers with the task as it
 * stands, so a double tap or a replay is harmless.
 */
export function useMoveTask(
  workspaceId: string | null,
): UseMutationResult<
  FinishOutcome,
  Error,
  { task: OperatorHousekeepingTask; to: OperatorHousekeepingTask["status"]; room: OperatorRoom | null }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ task, to, room }) => {
      const moved = await command<OperatorHousekeepingTask>(
        `/ops/housekeeping-tasks/${task.id}/advance`,
        { workspaceId: workspaceId as string, body: { to } },
      );
      const target = to === "done" ? roomAfter(task.taskType) : null;
      // An out of order room stays out of order: tidying it must not put it
      // back on the board as ready.
      if (!target || !room || room.housekeeping === target || room.housekeeping === "out_of_order") {
        return { kind: "task", task: moved };
      }
      try {
        await command<OperatorRoom>(`/ops/rooms/${task.roomId}/housekeeping`, {
          workspaceId: workspaceId as string,
          body: { housekeeping: target },
        });
        return { kind: "both", task: moved };
      } catch (error) {
        return { kind: "room-failed", task: moved, error };
      }
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.housekeepingTasks(workspaceId) });
      void client.invalidateQueries({ queryKey: queryKeys.rooms(workspaceId) });
    },
  });
}

/** One tap on a room's status. */
export function useSetRoomStatus(
  workspaceId: string | null,
): UseMutationResult<OperatorRoom, Error, { roomId: string; housekeeping: HousekeepingStatus }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, housekeeping }) =>
      command<OperatorRoom>(`/ops/rooms/${roomId}/housekeeping`, {
        workspaceId: workspaceId as string,
        body: { housekeeping },
      }),
    onSuccess: (room) => {
      // Patch from the server's answer at once, then confirm with a refetch.
      client.setQueryData<OperatorRoomList>(queryKeys.rooms(workspaceId), (old) =>
        old ? { rooms: old.rooms.map((r) => (r.id === room.id ? room : r)) } : old,
      );
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.rooms(workspaceId) });
    },
  });
}

/**
 * Report a fault in a room, onto the maintenance board.
 *
 * The route takes no Idempotency-Key, so a retry after a lost answer can make a
 * second ticket. The form guards the double tap (the button is pending while
 * the call is out) and says "check before sending again" when the answer was
 * lost; that is the whole of the protection available today.
 */
export function useReportFault(
  workspaceId: string | null,
): UseMutationResult<OperatorTicket, Error, RaiseTicketRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      command<OperatorTicket>("/ops/tickets", { workspaceId: workspaceId as string, body }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.tickets(workspaceId) });
    },
  });
}
