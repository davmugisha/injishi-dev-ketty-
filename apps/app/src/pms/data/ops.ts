"use client";

/**
 * The client for the rest of `/api/v1/ops/*` (ADR-012 steps 4 and 5).
 *
 * `reservations.ts` proved the shape; this file repeats it for the other nine
 * commands rather than inventing a second one. Everything here follows the same
 * four rules:
 *
 *   1. a read throws on failure, so a query can tell "the desk is empty" from
 *      "we never heard back" (AC-13);
 *   2. every response is parsed against its contract, so a drift is caught here
 *      rather than three components later as an undefined field;
 *   3. a command returns the row as it now stands, and the cache is patched
 *      from that answer rather than from an optimistic guess;
 *   4. a command that moves money sends an `Idempotency-Key` (AC-14), and the
 *      key is generated once per attempt rather than per retry, which is the
 *      whole point of it.
 *
 * Nothing here decides a permission. `useCapability` reads the resolved array
 * for the buttons; `WorkspaceGuard` is the control.
 */

import {
  type AddAmenityRequest,
  type AdvanceHousekeepingTaskRequest,
  type AdvanceLeaseRequest,
  type AdvanceServiceOrderRequest,
  type AdvanceTicketRequest,
  type AssignRoomRequest,
  type CheckInRequest,
  OperatorAmenityList,
  type OperatorDepartment,
  OperatorDepartmentList,
  type OperatorDeposit,
  OperatorFolioDetail,
  OperatorFolioList,
  type OperatorHousekeepingTask,
  OperatorHousekeepingTaskList,
  OperatorDepositList,
  type OperatorLease,
  OperatorProperty,
  OperatorPropertyList,
  OperatorRatePlanList,
  OperatorLeaseList,
  OperatorMessageList,
  type OperatorMessage,
  type OperatorRentCharge,
  OperatorRentRoll,
  OperatorRevenue,
  type OperatorRoom,
  type OperatorRoomAssignment,
  OperatorRoomAssignmentList,
  OperatorServiceCatalog,
  type OperatorServiceItem,
  type OperatorServiceOrder,
  OperatorServiceOrderList,
  OperatorRoomList,
  type OperatorStay,
  OperatorStayList,
  WalkInRequest,
  OperatorRoleList,
  type OperatorRolePermissions,
  type SetRolePermissionsRequest,
  OperatorTeamList,
  type OperatorTicket,
  OperatorThreadList,
  OperatorTicketList,
  type PostChargeRequest,
  type RaiseTicketRequest,
  type RecordRentRequest,
  type ReturnDepositRequest,
  type SendMessageRequest,
  type SetHousekeepingRequest,
  type TakePaymentRequest,
  type UpdateDepartmentRequest,
  type UpdateServiceCategoryRequest,
  type UpdateServiceItemRequest,
  type UpsertServiceItemRequest,
  type CreateServiceCategoryRequest,
  type MarkOrderPaidCashRequest,
  type MarkOrderPaidCashResult,
  RraClassificationList,
  type VoidChargeRequest,
  type CreatePropertyRequest,
} from "@injishi/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { Permission } from "../authz";
import { API_BASE, ApiError, REQUEST_TIMEOUT_MS, command } from "./api";
import { branchHeader } from "./branch";
import { useCapability } from "./capability";
import { queryKeys } from "./queries";

/**
 * Which permissions admit each operator READ (platform audit, H1).
 *
 * The server declares these on every GET — `@RequireAnyPermission(...)` on the
 * controller — and `ops-read-permissions.spec.ts` in the API pins which roles
 * each one admits. This is the client's copy of the same sets, for ONE purpose:
 * not asking. A refused read is not merely wasted here, because any 403
 * invalidates `me.workspaces` (`queries.ts`), so a hook that asked on behalf of
 * a role without the power would refetch the grant on every render cycle.
 *
 * It decides nothing. A set that drifts from the server's makes a screen either
 * ask and be refused, or not ask when it could have; `WorkspaceGuard` is still
 * the control. Keep the two in step when either changes.
 */
export const OPS_READ = {
  amenities: ["listing.manage", "amenity.manage", "unit.manage", "outlet.manage", "order.advance"],
  departments: ["department.manage", "folio.charge", "order.advance", "outlet.manage"],
  folios: ["folio.charge", "money.view"],
  housekeepingTasks: ["housekeeping.set", "task.assign"],
  outlets: ["outlet.manage", "order.advance", "menu.manage"],
  outletParties: ["outlet.manage"],
  reservations: ["reservation.approve", "reservation.assign", "stay.checkin"],
  roomAssignments: ["reservation.assign", "reservation.approve", "stay.checkin"],
  leases: ["lease.advance", "rent.record", "deposit.return"],
  rentRoll: ["rent.record", "money.view"],
  tickets: ["ticket.advance"],
  deposits: ["deposit.return", "lease.advance", "money.view"],
  revenue: ["money.view"],
  rooms: ["stay.checkin", "housekeeping.set", "reservation.assign", "listing.manage"],
  serviceCatalog: ["order.advance", "menu.manage"],
  serviceOrders: ["order.advance"],
  rraClassifications: ["menu.manage"],
  stays: ["stay.checkin", "stay.checkout", "folio.charge"],
  team: ["team.manage"],
  /** The business's own access policy. Owner only, like the roster. */
  roles: ["team.manage"],
  threads: ["message.send"],
  /** Not `/ops`, but the same rule: `InventoryController` is `listing.manage`. */
  inventory: ["listing.manage"],
} as const satisfies Record<string, readonly Permission[]>;

/**
 * May the caller make this read in the workspace in view? One of the set is
 * enough, as on the server.
 *
 * While the grant is still loading this answers false, so the query waits for
 * it rather than firing a request the answer may refuse.
 */
export function useMayRead(anyOf: readonly Permission[]): boolean {
  const { can } = useCapability();
  return anyOf.some(can);
}

/**
 * Just enough of a Zod schema to validate a response.
 *
 * Structural rather than `ZodType`, so this app does not take a direct
 * dependency on zod for one type import. `@injishi/contracts` owns the schemas
 * and ships them built; the app only ever calls `.parse`.
 */
interface Parser<T> {
  parse: (value: unknown) => T;
}

/**
 * A read that throws, and validates.
 *
 * The one wire read for this whole file, so the three things that must be true
 * of every operator read — a ceiling, a typed refusal, and a shape checked
 * against the contract — are written once rather than nine times. Exported for
 * `ebm.ts`, which reads the same way rather than growing a second copy.
 */
export async function read<T>(
  path: string,
  workspaceId: string,
  schema: Parser<T>,
  /** Read the whole business, ignoring the branch in view (ADR-054). */
  { allBranches = false }: { allBranches?: boolean } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      credentials: "include",
      headers: { "x-workspace-id": workspaceId, ...branchHeader(allBranches) },
      signal: controller.signal,
    });
    if (!res.ok) throw new ApiError(res.status, "We couldn't load that.");
    return schema.parse(await res.json());
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "We couldn't reach the server. Try again.");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A fresh key for one attempt at a money command.
 *
 * Generated at the CALL SITE of a mutation, not inside the retry, so every
 * retry of the same attempt carries the same key. A key regenerated per retry
 * would be a new command each time, which is exactly the bug the key exists to
 * prevent.
 *
 * `crypto.randomUUID` is standard in every browser this app supports. The
 * fallback is for a non secure context (plain http on a property network),
 * where it is absent — a weaker key there still beats no key at all.
 */
function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(12)}`;
}

/**
 * Shorthand: a hook that reads one workspace scoped list.
 *
 * `anyOf` is the read's entry in `OPS_READ`. A caller holding none of it never
 * sends the request (see `OPS_READ` for why a refusal is not free).
 */
function useOpsQuery<T>(
  key: readonly unknown[],
  path: string,
  workspaceId: string | null,
  schema: Parser<T>,
  anyOf: readonly Permission[],
): UseQueryResult<T> {
  const mayRead = useMayRead(anyOf);
  return useQuery({
    queryKey: key,
    queryFn: () => read(path, workspaceId as string, schema),
    enabled: workspaceId !== null && mayRead,
  });
}

// ---------------------------------------------------------------------------
// Rooms and stays
// ---------------------------------------------------------------------------

export function useRooms(workspaceId: string | null): UseQueryResult<OperatorRoomList> {
  return useOpsQuery(
    queryKeys.rooms(workspaceId),
    "/ops/rooms",
    workspaceId,
    OperatorRoomList,
    OPS_READ.rooms,
  );
}

/**
 * Set a room's housekeeping state.
 *
 * Invalidates the reservations list as well as the rooms list, because a
 * checkout dirties a room and a room going out of order changes what the desk
 * can offer. Two lists that disagree about the same room is the kind of thing
 * an operator notices immediately and trusts the app less for.
 */
export function useSetHousekeeping(
  workspaceId: string | null,
): UseMutationResult<OperatorRoom, Error, { roomId: string } & SetHousekeepingRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, ...body }) =>
      command<OperatorRoom>(`/ops/rooms/${roomId}/housekeeping`, {
        workspaceId: workspaceId as string,
        body,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.rooms(workspaceId) });
    },
  });
}

/**
 * Every stay on the property, open and closed (ADR-035, wave 2 follow-up).
 *
 * The read that did not exist. `OperatorStay` was only ever a COMMAND result —
 * check in returned one, check out returned one — so the stay record had no
 * source and showed a fixture.
 */
export function useStays(workspaceId: string | null): UseQueryResult<OperatorStayList> {
  return useOpsQuery(
    queryKeys.stays(workspaceId),
    "/ops/stays",
    workspaceId,
    OperatorStayList,
    OPS_READ.stays,
  );
}

export function useCheckIn(
  workspaceId: string | null,
): UseMutationResult<OperatorStay, Error, { bookingId: string } & CheckInRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, ...body }) =>
      command<OperatorStay>(`/ops/stays/${bookingId}/checkin`, {
        workspaceId: workspaceId as string,
        body,
      }),
    onSuccess: () => {
      // A check in changes three lists at once: the reservation becomes in
      // house, the room becomes occupied, and a STAY comes into existence.
      void client.invalidateQueries({ queryKey: queryKeys.reservations(workspaceId) });
      void client.invalidateQueries({ queryKey: queryKeys.rooms(workspaceId) });
      // Stays was missing here, and it stopped mattering the moment a screen
      // read stays to find the bill: Today and Reservations both address the
      // folio through the stay id, so without this the guest is in house and
      // "View bill" stays refused until the 60 second stale window closes.
      void client.invalidateQueries({ queryKey: queryKeys.stays(workspaceId) });
      // Check in binds the booking's bill to the new stay, which moves its one
      // address from the reservation's Payment lens to the stay's Folio lens
      // (ADR-044, D-c). A stale list would keep it on the old one for a minute.
      void client.invalidateQueries({ queryKey: queryKeys.folios(workspaceId) });
    },
  });
}

/**
 * Check a WALK IN in — somebody at the desk with no booking (ADR-035).
 *
 * A separate hook from `useCheckIn`, because it hits a separate route: check in
 * names a BOOKING in its path and a walk in has none. The two are not variants
 * of one call.
 *
 * It invalidates the same three lists, plus stays and folios: a walk in creates
 * a stay that was not there before AND the bill that goes with it, so a desk
 * that stayed on the Bills screen must see the new bill without reloading.
 */
export function useWalkIn(
  workspaceId: string | null,
): UseMutationResult<OperatorStay, Error, WalkInRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      command<OperatorStay>("/ops/stays/walk-in", {
        workspaceId: workspaceId as string,
        body,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.rooms(workspaceId) });
      void client.invalidateQueries({ queryKey: queryKeys.stays(workspaceId) });
      void client.invalidateQueries({ queryKey: queryKeys.folios(workspaceId) });
    },
  });
}

export function useCheckOut(
  workspaceId: string | null,
): UseMutationResult<OperatorStay, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (stayId: string) =>
      command<OperatorStay>(`/ops/stays/${stayId}/checkout`, {
        workspaceId: workspaceId as string,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.reservations(workspaceId) });
      void client.invalidateQueries({ queryKey: queryKeys.rooms(workspaceId) });
      // The stay just CLOSED. Without this the list still calls it open, so
      // Today keeps the departed guest on the board and offers to check them
      // out a second time — which the server refuses, correctly, and which
      // reads to the desk as the checkout not having worked.
      void client.invalidateQueries({ queryKey: queryKeys.stays(workspaceId) });
      // The bill moves too: checkout is where the folio settles.
      void client.invalidateQueries({ queryKey: queryKeys.folios(workspaceId) });
      // And checkout is where every room the booking held is let go (D-h), so
      // the room grid would otherwise keep the departed guest's hold drawn.
      void client.invalidateQueries({ queryKey: queryKeys.roomAssignments(workspaceId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Room assignment: which physical room a booking holds
// ---------------------------------------------------------------------------

/**
 * Every live hold across the property over `[from, to)` (the room grid's read).
 *
 * One request for the whole tape rather than one per reservation, which is the
 * only other way the holds could be read.
 */
export function useRoomAssignments(
  workspaceId: string | null,
  from: string,
  to: string,
): UseQueryResult<OperatorRoomAssignmentList> {
  return useOpsQuery(
    queryKeys.roomAssignmentWindow(workspaceId, from, to),
    `/ops/room-assignments?from=${from}&to=${to}`,
    workspaceId,
    OperatorRoomAssignmentList,
    OPS_READ.roomAssignments,
  );
}

/**
 * Hold a room for a booking, optionally letting another hold go.
 *
 * A MOVE IS TWO COMMANDS, AND THE ORDER IS THE SAFETY. The new room is held
 * first and the old one released only once that has landed, so a refused move
 * (the room is taken, it is the wrong type) leaves the guest exactly where they
 * were. The other order would leave them holding nothing at all.
 *
 * If the release is what fails, the guest now holds both rooms, and the error
 * says so in those words rather than as a generic refusal: it is a real state
 * the desk has to undo by hand, not a retry.
 */
export function useHoldRoom(
  workspaceId: string | null,
): UseMutationResult<
  OperatorRoomAssignment,
  Error,
  { bookingId: string; roomId: string; from?: string; to?: string; releaseAssignmentId?: string }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, roomId, from, to, releaseAssignmentId }) => {
      const body: AssignRoomRequest = { roomId, from, to };
      const held = await command<OperatorRoomAssignment>(
        `/ops/reservations/${bookingId}/assign`,
        { workspaceId: workspaceId as string, body },
      );
      if (releaseAssignmentId) {
        try {
          await command<OperatorRoomAssignment>(
            `/ops/reservations/${bookingId}/assign/${releaseAssignmentId}`,
            { workspaceId: workspaceId as string, method: "DELETE" },
          );
        } catch (error) {
          const why = error instanceof Error ? error.message : "";
          throw new ApiError(
            error instanceof ApiError ? error.status : 0,
            `Room ${held.roomLabel ?? ""} is now held, but the old room was not let go, so this guest holds both. Unassign the old one from its bar. ${why}`.replace(/\s+/g, " ").trim(),
          );
        }
      }
      return held;
    },
    // Settled, not success: a half finished move changed the server too.
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.roomAssignments(workspaceId) });
    },
  });
}

/** Let one held room go. Names the HOLD, because a split stay has several. */
export function useReleaseRoom(
  workspaceId: string | null,
): UseMutationResult<OperatorRoomAssignment, Error, { bookingId: string; assignmentId: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, assignmentId }) =>
      command<OperatorRoomAssignment>(
        `/ops/reservations/${bookingId}/assign/${assignmentId}`,
        { workspaceId: workspaceId as string, method: "DELETE" },
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.roomAssignments(workspaceId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Housekeeping tasks
// ---------------------------------------------------------------------------

/**
 * The cleaning board (ADR-035, D-f wave 1).
 *
 * A task is NOT the same thing as a room's housekeeping status, and the two
 * endpoints stay apart for that reason: `/ops/rooms` says whether a room is
 * ready to sell, `/ops/housekeeping-tasks` says what work is outstanding and
 * who is doing it. A room can be dirty with no task on it, and a task can be
 * blocked on a maintenance ticket while the room is still sellable tomorrow.
 */
export function useHousekeepingTasks(
  workspaceId: string | null,
): UseQueryResult<OperatorHousekeepingTaskList> {
  return useOpsQuery(
    queryKeys.housekeepingTasks(workspaceId),
    "/ops/housekeeping-tasks",
    workspaceId,
    OperatorHousekeepingTaskList,
    OPS_READ.housekeepingTasks,
  );
}

/**
 * Move a task along.
 *
 * Gated server side on `housekeeping.set`, NOT on `task.assign`: the person
 * doing the cleaning sends this, and a housekeeper holds the first permission
 * and not the second.
 *
 * The rooms query is invalidated alongside, because finishing a clean is what
 * makes a room sellable and the desk reads that from `/ops/rooms`.
 */
export function useAdvanceHousekeepingTask(
  workspaceId: string | null,
): UseMutationResult<
  OperatorHousekeepingTask,
  Error,
  { taskId: string } & AdvanceHousekeepingTaskRequest
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, ...body }) =>
      command<OperatorHousekeepingTask>(`/ops/housekeeping-tasks/${taskId}/advance`, {
        workspaceId: workspaceId as string,
        body,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.housekeepingTasks(workspaceId) });
      void client.invalidateQueries({ queryKey: queryKeys.rooms(workspaceId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

/**
 * The property's departments (ADR-035, D-f wave 2).
 *
 * The same rows the nav's SECTIONS are derived from (D-a), read here as a list
 * an operator can edit rather than as a set of category codes. Both come from
 * `departments`; neither is a copy of the other.
 */
export function useDepartments(
  workspaceId: string | null,
): UseQueryResult<OperatorDepartmentList> {
  return useOpsQuery(
    queryKeys.departments(workspaceId),
    "/ops/departments",
    workspaceId,
    OperatorDepartmentList,
    OPS_READ.departments,
  );
}

/**
 * Rename, reorder or retire a department.
 *
 * **The CATEGORY is not in the request and must never be.** It decides which
 * revenue account a charge posts to, so changing it would silently
 * re-attribute every shilling already booked against the department.
 * `UpdateDepartmentRequest` omits it for that reason and the server would
 * refuse it anyway.
 *
 * Invalidates `me.workspaces` as well as the department list, because retiring
 * a department can close a whole nav section: an archived `fnb` row is a
 * property with no Services door, and the grant is where that is decided.
 */
export function useUpdateDepartment(
  workspaceId: string | null,
): UseMutationResult<
  OperatorDepartment,
  Error,
  { departmentId: string } & UpdateDepartmentRequest
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ departmentId, ...body }) =>
      command<OperatorDepartment>(`/ops/departments/${departmentId}`, {
        workspaceId: workspaceId as string,
        body,
        method: "PATCH",
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.departments(workspaceId) });
      void client.invalidateQueries({ queryKey: queryKeys.meWorkspaces });
    },
  });
}

// ---------------------------------------------------------------------------
// Services: the menu, and the orders placed against it
// ---------------------------------------------------------------------------

/**
 * The whole menu, grouped by category (ADR-035, D-f wave 2).
 *
 * Grouped on the wire because that is the only way anyone reads it. A flat item
 * list would be regrouped identically by every caller, and the grouping would
 * then be a client decision that could differ per screen.
 */
export function useServiceCatalog(
  workspaceId: string | null,
): UseQueryResult<OperatorServiceCatalog> {
  return useOpsQuery(
    queryKeys.serviceCatalog(workspaceId),
    "/ops/service-catalog",
    workspaceId,
    OperatorServiceCatalog,
    OPS_READ.serviceCatalog,
  );
}

/**
 * Change a menu item: its price, whether guests may order it, whether it is
 * still offered.
 *
 * **Editing an item never rewrites a placed order.** An order snapshots the
 * name, the price and the tax code at order time (D8), so last week's bill
 * still says what last week's menu said. That is why this is safe to expose to
 * an operator mid service.
 *
 * The CATEGORY is absent from the request on purpose: moving an item to another
 * menu would move its DEPARTMENT too, and a bill already run against the old
 * one would then disagree with the new one. Archive and re-add instead.
 */
export function useUpdateServiceItem(
  workspaceId: string | null,
): UseMutationResult<
  OperatorServiceItem,
  Error,
  { itemId: string } & UpdateServiceItemRequest
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...body }) =>
      command<OperatorServiceItem>(`/ops/service-catalog/items/${itemId}`, {
        workspaceId: workspaceId as string,
        body,
        method: "PATCH",
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.serviceCatalog(workspaceId) });
    },
  });
}

/**
 * Add a menu (ADR-050 D-m). A menu may carry RRA prefills, which every item
 * added to it starts with, and may name the outlet its items sell from.
 * Answers with the whole catalog, which is what the cache is replaced with.
 */
export function useCreateServiceCategory(
  workspaceId: string | null,
): UseMutationResult<OperatorServiceCatalog, Error, CreateServiceCategoryRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      command<OperatorServiceCatalog>("/ops/service-catalog/categories", {
        workspaceId: workspaceId as string,
        body,
      }),
    onSuccess: (catalog) => {
      client.setQueryData(queryKeys.serviceCatalog(workspaceId), catalog);
    },
  });
}

/** Rename a menu, hide it from guests, or change its RRA prefills. */
export function useUpdateServiceCategory(
  workspaceId: string | null,
): UseMutationResult<
  OperatorServiceCatalog,
  Error,
  { categoryId: string } & UpdateServiceCategoryRequest
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, ...body }) =>
      command<OperatorServiceCatalog>(`/ops/service-catalog/categories/${categoryId}`, {
        workspaceId: workspaceId as string,
        body,
        method: "PATCH",
      }),
    onSuccess: (catalog) => {
      client.setQueryData(queryKeys.serviceCatalog(workspaceId), catalog);
    },
  });
}

/**
 * Add an item (ADR-050 D-m). RRA values it leaves out are prefilled from its
 * menu; the server mints its item code, and refuses to put it on sale without
 * every value a receipt needs.
 */
export function useCreateServiceItem(
  workspaceId: string | null,
): UseMutationResult<OperatorServiceCatalog, Error, UpsertServiceItemRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      command<OperatorServiceCatalog>("/ops/service-catalog/items", {
        workspaceId: workspaceId as string,
        body,
      }),
    onSuccess: (catalog) => {
      client.setQueryData(queryKeys.serviceCatalog(workspaceId), catalog);
    },
  });
}

/**
 * Search RRA's classification list for the menu's picker. Nothing is asked for
 * until the owner types, and a short term waits for a second letter: the list
 * runs to thousands of rows.
 */
export function useRraClassifications(
  workspaceId: string | null,
  q: string,
): UseQueryResult<RraClassificationList> {
  const term = q.trim();
  const mayRead = useMayRead(OPS_READ.rraClassifications);
  return useQuery({
    queryKey: queryKeys.rraClassifications(workspaceId, term),
    queryFn: () =>
      read(
        `/ops/rra/classifications?q=${encodeURIComponent(term)}`,
        workspaceId as string,
        RraClassificationList,
      ),
    enabled: workspaceId !== null && mayRead && term.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mark a pay now order paid in cash (ADR-050 D-p, AC-24). Moves money, so it
 * sends an `Idempotency-Key`, generated once per press. The amount is the total
 * the person holding the cash confirms; the server refuses anything else.
 */
export function useMarkOrderPaidCash(
  workspaceId: string | null,
): UseMutationResult<
  MarkOrderPaidCashResult,
  Error,
  { orderId: string } & MarkOrderPaidCashRequest
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, ...body }) =>
      command<MarkOrderPaidCashResult>(`/ops/service-orders/${orderId}/paid-cash`, {
        workspaceId: workspaceId as string,
        body,
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.serviceOrders(workspaceId) });
    },
  });
}

export function useServiceOrders(
  workspaceId: string | null,
): UseQueryResult<OperatorServiceOrderList> {
  return useOpsQuery(
    queryKeys.serviceOrders(workspaceId),
    "/ops/service-orders",
    workspaceId,
    OperatorServiceOrderList,
    OPS_READ.serviceOrders,
  );
}

/**
 * Move an order along its board.
 *
 * **Reaching `delivered` or `completed` posts the folio charge**, in the same
 * transaction on the server, so the bill can never disagree with the board.
 * That is why the folio is invalidated here as well: the money moved, and a
 * stay screen still showing the old balance would be the app contradicting
 * itself one click later.
 */
export function useAdvanceServiceOrder(
  workspaceId: string | null,
): UseMutationResult<
  OperatorServiceOrder,
  Error,
  { orderId: string } & AdvanceServiceOrderRequest
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, ...body }) =>
      command<OperatorServiceOrder>(`/ops/service-orders/${orderId}/advance`, {
        workspaceId: workspaceId as string,
        body,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.serviceOrders(workspaceId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Folios: the guest's one bill
// ---------------------------------------------------------------------------

/**
 * Every open bill on the property (ADR-035, D-f wave 2).
 *
 * Gated on `folio.charge` or `money.view` server side. A bill names a guest,
 * their room and what they have spent, so the desk reads it to charge and
 * Finance reads it to account; a housekeeper holding `housekeeping.set` has no
 * business reading it, and this hook does not ask on their behalf.
 */
export function useFolios(workspaceId: string | null): UseQueryResult<OperatorFolioList> {
  return useOpsQuery(
    queryKeys.folios(workspaceId),
    "/ops/folios",
    workspaceId,
    OperatorFolioList,
    OPS_READ.folios,
  );
}

/**
 * Revenue by department for one month (F-P01).
 *
 * Gated on `money.view` server side. A caller without it never makes the
 * request: the hook asks `useCapability` first, as every read here does.
 */
export function useRevenue(
  workspaceId: string | null,
  month: string | null,
): UseQueryResult<OperatorRevenue> {
  const query = month ? `?month=${month}` : "";
  return useOpsQuery(
    queryKeys.revenue(workspaceId, month),
    `/ops/revenue${query}`,
    workspaceId,
    OperatorRevenue,
    OPS_READ.revenue,
  );
}

/** One bill, with its lines. */
export function useFolio(
  workspaceId: string | null,
  folioId: string | null,
): UseQueryResult<OperatorFolioDetail> {
  const mayRead = useMayRead(OPS_READ.folios);
  return useQuery({
    queryKey: queryKeys.folio(workspaceId, folioId),
    queryFn: () =>
      read(`/ops/folios/${folioId as string}`, workspaceId as string, OperatorFolioDetail),
    enabled: workspaceId !== null && mayRead && folioId !== null,
  });
}

/**
 * Post a charge.
 *
 * `amountRwf` is TAX EXCLUSIVE (ADR-016, D-n). The server computes the tax from
 * the rate effective at post time and posts it as its own line, so an invoice
 * never has to pull the two apart again. A screen that sent a tax inclusive
 * figure would silently overcharge by the VAT rate.
 */
export function usePostCharge(
  workspaceId: string | null,
  folioId: string | null,
): UseMutationResult<OperatorFolioDetail, Error, PostChargeRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: PostChargeRequest) =>
      command<OperatorFolioDetail>(`/ops/folios/${folioId as string}/charges`, {
        workspaceId: workspaceId as string,
        body,
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.folio(workspaceId, folioId) });
      void client.invalidateQueries({ queryKey: queryKeys.folios(workspaceId) });
    },
  });
}

/**
 * Take a payment (AC-14, so it carries an `Idempotency-Key`).
 *
 * Posts a negative line and one cash ledger entry. It never posts revenue: the
 * CHARGE already did that at post time, and building it the other way round
 * would double count every shilling.
 */
export function useTakePayment(
  workspaceId: string | null,
  folioId: string | null,
): UseMutationResult<OperatorFolioDetail, Error, TakePaymentRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: TakePaymentRequest) =>
      command<OperatorFolioDetail>(`/ops/folios/${folioId as string}/payments`, {
        workspaceId: workspaceId as string,
        body,
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.folio(workspaceId, folioId) });
      void client.invalidateQueries({ queryKey: queryKeys.folios(workspaceId) });
    },
  });
}

/**
 * Void a charge.
 *
 * Posts a REVERSING line naming the original; the original row is never
 * touched. A bill therefore shows the mistake and the correction rather than
 * hiding both, which is what makes it auditable. Allowed once per charge, and a
 * void can never itself be voided.
 */
export function useVoidCharge(
  workspaceId: string | null,
  folioId: string | null,
): UseMutationResult<OperatorFolioDetail, Error, { chargeId: string } & VoidChargeRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ chargeId, ...body }) =>
      command<OperatorFolioDetail>(
        `/ops/folios/${folioId as string}/charges/${chargeId}/void`,
        { workspaceId: workspaceId as string, body },
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.folio(workspaceId, folioId) });
      void client.invalidateQueries({ queryKey: queryKeys.folios(workspaceId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Inventory: the properties, and what is sellable in them
// ---------------------------------------------------------------------------

/**
 * The properties this workspace holds (ADR-035, D-f wave 2; ADR-009).
 *
 * NOT under `/ops`. Inventory is SETUP — what exists and what may be sold —
 * while `/ops/*` is today's work, and the two are gated differently:
 * every inventory route declares `listing.manage`, which a receptionist and a
 * housekeeper do not hold.
 *
 * **This is also the answer to the property question the other screens hit.**
 * Amenities and department creation are both blocked on "which property is in
 * view", because a workspace can hold several and nothing on the grant says.
 * This read is where that list comes from when those screens are wired.
 */
// The workspace travels in the `x-workspace-id` header `useOpsQuery` sends, and
// nowhere else. The inventory reads used to demand it a second time as a query
// parameter they then discarded; ADR-053 task 18 removed that from the API.
export function useProperties(
  workspaceId: string | null,
): UseQueryResult<OperatorPropertyList> {
  return useOpsQuery(
    queryKeys.properties(workspaceId),
    "/inventory/properties",
    workspaceId,
    OperatorPropertyList,
    OPS_READ.inventory,
  );
}

/**
 * Every rate plan in this workspace (ADR-035, wave 2 follow-up).
 *
 * A room type is what the guest gets; a rate plan is the terms it sells on.
 * Read only: writing one is a pricing decision with its own rules (F-L03,
 * F-L05), not a form this wave invents.
 */
export function useRatePlans(
  workspaceId: string | null,
): UseQueryResult<OperatorRatePlanList> {
  return useOpsQuery(
    queryKeys.ratePlans(workspaceId),
    "/inventory/rate-plans",
    workspaceId,
    OperatorRatePlanList,
    OPS_READ.inventory,
  );
}

/** One property in full, with its room types. */
export function useProperty(
  workspaceId: string | null,
  propertyId: string | null,
): UseQueryResult<OperatorProperty> {
  const mayRead = useMayRead(OPS_READ.inventory);
  return useQuery({
    queryKey: queryKeys.property(workspaceId, propertyId),
    queryFn: () =>
      read(
        `/inventory/properties/${propertyId as string}`,
        workspaceId as string,
        OperatorProperty,
      ),
    enabled: workspaceId !== null && mayRead && propertyId !== null,
  });
}

/**
 * Create the first (or next) property on this business (ADR-009).
 *
 * Draft is the only create state. Publishing is a separate act. The body
 * carries `workspaceId` because `CreatePropertyRequest` extends
 * `WorkspaceScoped`; the header carries it too for `WorkspaceGuard`.
 */
export function useCreateProperty(
  workspaceId: string | null,
): UseMutationResult<
  OperatorProperty,
  Error,
  Omit<CreatePropertyRequest, "workspaceId">
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      command<OperatorProperty>("/inventory/properties", {
        workspaceId: workspaceId as string,
        body: { ...body, workspaceId: workspaceId as string },
        // A new branch is outside whichever branch is in view, so the read back
        // the API answers with would 404 under that header (ADR-054).
        allBranches: true,
      }),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: queryKeys.properties(workspaceId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// The team
// ---------------------------------------------------------------------------

/**
 * Who works at this business (ADR-035, wave 2 follow-up).
 *
 * Gated on `team.manage` server side. Every read in `/ops/*` declares who may
 * make it (audit H1), and most are open to several roles, because a
 * receptionist has to see rooms and threads to do the job. This one enumerates
 * every colleague, their email and the role each holds — that is a disclosure,
 * not operational data, and it belongs to the owner, who may change the team.
 */
export function useTeam(workspaceId: string | null): UseQueryResult<OperatorTeamList> {
  return useOpsQuery(
    queryKeys.team(workspaceId),
    "/ops/team",
    workspaceId,
    OperatorTeamList,
    OPS_READ.team,
  );
}

// ---------------------------------------------------------------------------
// What each role may do here
// ---------------------------------------------------------------------------

/**
 * The business's own access policy (ADR-055).
 *
 * Behind `team.manage` like the roster, and for the same reason: this says which
 * colleague can read the takings and which cannot, which is information about
 * people rather than operational data.
 *
 * **NOTHING IS RESOLVED HERE.** The server sends both the platform default and
 * the effective set for every role; the screen renders the difference between
 * two arrays it was given. Working a permission out from a role name in the
 * browser is exactly what `no-client-authz` fails the build on, and it is what
 * the whole model moved to the server to stop.
 */
export function useRoles(workspaceId: string | null): UseQueryResult<OperatorRoleList> {
  return useOpsQuery(
    queryKeys.roles(workspaceId),
    "/ops/roles",
    workspaceId,
    OperatorRoleList,
    OPS_READ.roles,
  );
}

/**
 * Set the whole permission set of one role.
 *
 * A PUT with the complete set rather than a toggle command: the same request
 * sent twice leaves the same policy, so a double click or a retry cannot half
 * apply an edit.
 *
 * **It invalidates `me.workspaces`, and that is not housekeeping.** The array
 * this writes is the one every screen's `useCapability` reads, so an owner who
 * withdrew `money.view` from the front desk must see their own app agree without
 * a reload — and an owner editing the role they are watching would otherwise be
 * looking at a stale answer while the server had already changed it.
 */
export function useSetRolePermissions(
  workspaceId: string | null,
): UseMutationResult<
  OperatorRolePermissions,
  Error,
  { orgRole: string } & SetRolePermissionsRequest
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orgRole, ...body }) =>
      command<OperatorRolePermissions>(`/ops/roles/${orgRole}`, {
        workspaceId: workspaceId as string,
        body,
        method: "PUT",
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.roles(workspaceId) });
      void client.invalidateQueries({ queryKey: queryKeys.meWorkspaces });
    },
  });
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

/**
 * How often an open inbox asks for new lines (demo-comms, 2026-09-14).
 *
 * There is no push channel, and the app-wide defaults (no refetch on focus, a
 * 60 second stale time) meant a guest's message reached the desk only after a
 * reload. Polling runs only while the tab is in the foreground, which is
 * TanStack Query's default for `refetchInterval`.
 */
const THREAD_LIST_POLL_MS = 15_000;
const THREAD_MESSAGES_POLL_MS = 5_000;

export function useThreads(workspaceId: string | null): UseQueryResult<OperatorThreadList> {
  const mayRead = useMayRead(OPS_READ.threads);
  return useQuery({
    queryKey: queryKeys.threads(workspaceId),
    queryFn: () => read("/ops/threads", workspaceId as string, OperatorThreadList),
    enabled: workspaceId !== null && mayRead,
    refetchInterval: THREAD_LIST_POLL_MS,
  });
}

export function useThreadMessages(
  workspaceId: string | null,
  threadId: string | null,
): UseQueryResult<OperatorMessageList> {
  const mayRead = useMayRead(OPS_READ.threads);
  return useQuery({
    queryKey: queryKeys.threadMessages(workspaceId, threadId),
    queryFn: () =>
      read(
        `/ops/threads/${threadId as string}/messages`,
        workspaceId as string,
        OperatorMessageList,
      ),
    enabled: workspaceId !== null && mayRead && threadId !== null,
    refetchInterval: THREAD_MESSAGES_POLL_MS,
  });
}

export function useSendMessage(
  workspaceId: string | null,
  threadId: string | null,
): UseMutationResult<OperatorMessage, Error, SendMessageRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SendMessageRequest) =>
      command<OperatorMessage>(`/ops/threads/${threadId as string}/messages`, {
        workspaceId: workspaceId as string,
        body,
      }),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: queryKeys.threadMessages(workspaceId, threadId),
      });
      // The inbox shows a preview and a count, so it moved too.
      void client.invalidateQueries({ queryKey: queryKeys.threads(workspaceId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Residence
// ---------------------------------------------------------------------------

/**
 * Send a line into a thread named at call time rather than at hook time.
 *
 * `useSendMessage` binds its thread when the hook is created, which fits a
 * conversation screen and not a list: the rent roll reminds whichever tenant's
 * row was pressed, so the thread travels with the call.
 */
export function useSendToThread(
  workspaceId: string | null,
): UseMutationResult<OperatorMessage, Error, { threadId: string } & SendMessageRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, ...body }) =>
      command<OperatorMessage>(`/ops/threads/${threadId}/messages`, {
        workspaceId: workspaceId as string,
        body,
      }),
    onSuccess: (_message, { threadId }) => {
      void client.invalidateQueries({ queryKey: queryKeys.threadMessages(workspaceId, threadId) });
      void client.invalidateQueries({ queryKey: queryKeys.threads(workspaceId) });
    },
  });
}

export function useLeases(workspaceId: string | null): UseQueryResult<OperatorLeaseList> {
  return useOpsQuery(
    queryKeys.leases(workspaceId),
    "/ops/leases",
    workspaceId,
    OperatorLeaseList,
    OPS_READ.leases,
  );
}

export function useAdvanceLease(
  workspaceId: string | null,
): UseMutationResult<OperatorLease, Error, { leaseId: string } & AdvanceLeaseRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ leaseId, ...body }) =>
      command<OperatorLease>(`/ops/leases/${leaseId}/advance`, {
        workspaceId: workspaceId as string,
        body,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.leases(workspaceId) });
      // Going active raises the first rent charge, and ending queues a deposit.
      void client.invalidateQueries({ queryKey: queryKeys.rentRoll(workspaceId) });
      void client.invalidateQueries({ queryKey: queryKeys.deposits(workspaceId) });
    },
  });
}

export function useRentRoll(workspaceId: string | null): UseQueryResult<OperatorRentRoll> {
  return useOpsQuery(
    queryKeys.rentRoll(workspaceId),
    "/ops/rent-roll",
    workspaceId,
    OperatorRentRoll,
    OPS_READ.rentRoll,
  );
}

/**
 * Record a rent payment (AC-14).
 *
 * The key is minted once per `mutate` call. TanStack Query retries the same
 * mutation function on a network failure, so every retry of one attempt carries
 * the same key and the server records the payment once — which is the whole
 * contract.
 */
export function useRecordRent(
  workspaceId: string | null,
): UseMutationResult<OperatorRentCharge, Error, { leaseId: string } & RecordRentRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ leaseId, ...body }) =>
      command<OperatorRentCharge>(`/ops/leases/${leaseId}/rent`, {
        workspaceId: workspaceId as string,
        body,
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.rentRoll(workspaceId) });
      void client.invalidateQueries({ queryKey: queryKeys.leases(workspaceId) });
    },
  });
}

export function useDeposits(workspaceId: string | null): UseQueryResult<OperatorDepositList> {
  return useOpsQuery(
    queryKeys.deposits(workspaceId),
    "/ops/deposits",
    workspaceId,
    OperatorDepositList,
    OPS_READ.deposits,
  );
}

/** Return a deposit, in whole or in part (AC-14). */
export function useReturnDeposit(
  workspaceId: string | null,
): UseMutationResult<OperatorDeposit, Error, { holdId: string } & ReturnDepositRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ holdId, ...body }) =>
      command<OperatorDeposit>(`/ops/deposits/${holdId}/return`, {
        workspaceId: workspaceId as string,
        body,
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.deposits(workspaceId) });
    },
  });
}

export function useTickets(workspaceId: string | null): UseQueryResult<OperatorTicketList> {
  return useOpsQuery(
    queryKeys.tickets(workspaceId),
    "/ops/tickets",
    workspaceId,
    OperatorTicketList,
    OPS_READ.tickets,
  );
}

export function useAdvanceTicket(
  workspaceId: string | null,
): UseMutationResult<OperatorTicket, Error, { ticketId: string } & AdvanceTicketRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, ...body }) =>
      command<OperatorTicket>(`/ops/tickets/${ticketId}/advance`, {
        workspaceId: workspaceId as string,
        body,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.tickets(workspaceId) });
    },
  });
}

/**
 * Report a fault (ADR-016 slice 6, AC-11).
 *
 * `POST /ops/tickets` has existed since the work order slice, and nothing in
 * the app called it: a landlord could advance a ticket but never open one, so
 * a fault phoned in by a tenant had nowhere to go. Name the lease on a
 * residence and the room on a hotel; the server refuses a ticket naming neither.
 */
export function useRaiseTicket(
  workspaceId: string | null,
): UseMutationResult<OperatorTicket, Error, RaiseTicketRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: RaiseTicketRequest) =>
      command<OperatorTicket>("/ops/tickets", {
        workspaceId: workspaceId as string,
        body,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.tickets(workspaceId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Amenities
// ---------------------------------------------------------------------------

/**
 * Scoped to a PROPERTY, not the workspace.
 *
 * A workspace can hold several properties, and "the amenities of this
 * workspace" is not a question anyone asks. The key carries the property for
 * the same reason.
 */
export function useAmenities(
  workspaceId: string | null,
  propertyId: string | null,
): UseQueryResult<OperatorAmenityList> {
  const mayRead = useMayRead(OPS_READ.amenities);
  return useQuery({
    queryKey: queryKeys.amenities(workspaceId, propertyId),
    queryFn: () =>
      read(
        `/ops/amenities?propertyId=${propertyId as string}`,
        workspaceId as string,
        OperatorAmenityList,
      ),
    enabled: workspaceId !== null && mayRead && propertyId !== null,
  });
}

/**
 * Offer an amenity, or stop offering it.
 *
 * One hook for both, because they are one decision with two answers and the
 * screen is a set of toggles. `offered` says which way the toggle went.
 */
export function useSetAmenity(
  workspaceId: string | null,
  propertyId: string | null,
): UseMutationResult<
  OperatorAmenityList,
  Error,
  { amenityCode: string; offered: boolean }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ amenityCode, offered }) => {
      const body: AddAmenityRequest = {
        propertyId: propertyId as string,
        amenityCode,
      };
      return offered
        ? command<OperatorAmenityList>("/ops/amenities", {
            workspaceId: workspaceId as string,
            body,
          })
        : command<OperatorAmenityList>(
            `/ops/amenities/${encodeURIComponent(amenityCode)}?propertyId=${propertyId as string}`,
            { workspaceId: workspaceId as string, method: "DELETE" },
          );
    },
    onSuccess: (list) => {
      // The command returns the whole list, so the cache is set from the
      // server's answer rather than invalidated and refetched.
      client.setQueryData(queryKeys.amenities(workspaceId, propertyId), list);
    },
  });
}
