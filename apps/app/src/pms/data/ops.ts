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
  OperatorTeamList,
  type OperatorTicket,
  OperatorThreadList,
  OperatorTicketList,
  type PostChargeRequest,
  type RecordRentRequest,
  type ReturnDepositRequest,
  type SendMessageRequest,
  type SetHousekeepingRequest,
  type TakePaymentRequest,
  type UpdateDepartmentRequest,
  type UpdateServiceItemRequest,
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
import { API_BASE, ApiError, REQUEST_TIMEOUT_MS, command } from "./api";
import { queryKeys } from "./queries";

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
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      credentials: "include",
      headers: { "x-workspace-id": workspaceId },
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

/** Shorthand: a hook that reads one workspace scoped list. */
function useOpsQuery<T>(
  key: readonly unknown[],
  path: string,
  workspaceId: string | null,
  schema: Parser<T>,
): UseQueryResult<T> {
  return useQuery({
    queryKey: key,
    queryFn: () => read(path, workspaceId as string, schema),
    enabled: workspaceId !== null,
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

export function useServiceOrders(
  workspaceId: string | null,
): UseQueryResult<OperatorServiceOrderList> {
  return useOpsQuery(
    queryKeys.serviceOrders(workspaceId),
    "/ops/service-orders",
    workspaceId,
    OperatorServiceOrderList,
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
 * Gated on `folio.charge` server side, even for the READ. That is unusual here
 * and deliberate: a bill is the one operator surface that names a guest, their
 * room and what they have spent, and a housekeeper holding `housekeeping.set`
 * has no business reading it.
 */
export function useFolios(workspaceId: string | null): UseQueryResult<OperatorFolioList> {
  return useOpsQuery(
    queryKeys.folios(workspaceId),
    "/ops/folios",
    workspaceId,
    OperatorFolioList,
  );
}

/**
 * Revenue by department for one month (F-P01).
 *
 * Gated on `money.view` server side. A caller without it should pass a null
 * workspace, so the request is never made rather than made and refused.
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
  );
}

/** One bill, with its lines. */
export function useFolio(
  workspaceId: string | null,
  folioId: string | null,
): UseQueryResult<OperatorFolioDetail> {
  return useQuery({
    queryKey: queryKeys.folio(workspaceId, folioId),
    queryFn: () =>
      read(`/ops/folios/${folioId as string}`, workspaceId as string, OperatorFolioDetail),
    enabled: workspaceId !== null && folioId !== null,
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
/**
 * WHY THE WORKSPACE IS SENT TWICE.
 *
 * The inventory routes validate a `workspaceId` QUERY parameter and then throw
 * it away: the handler binds it to `_query` and reads the real workspace from
 * `@CurrentWorkspace()`, which `WorkspaceGuard` resolved from the
 * `x-workspace-id` header. So the header is authoritative and the parameter is
 * a validation-only requirement.
 *
 * It is sent anyway rather than argued with, because the contract
 * (`PropertyQuery`, ADR-009) says a request carries it and a client that
 * omitted it would be refused with a validation error that reads like a bug in
 * this app. The redundancy is recorded in ADR-035 as owed cleanup on the API
 * side; removing it is a server change, not a client one.
 */
function withWorkspace(path: string, workspaceId: string | null): string {
  return `${path}?workspaceId=${encodeURIComponent(workspaceId ?? "")}`;
}

export function useProperties(
  workspaceId: string | null,
): UseQueryResult<OperatorPropertyList> {
  return useOpsQuery(
    queryKeys.properties(workspaceId),
    withWorkspace("/inventory/properties", workspaceId),
    workspaceId,
    OperatorPropertyList,
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
  );
}

/** One property in full, with its room types. */
export function useProperty(
  workspaceId: string | null,
  propertyId: string | null,
): UseQueryResult<OperatorProperty> {
  return useQuery({
    queryKey: queryKeys.property(workspaceId, propertyId),
    queryFn: () =>
      read(
        withWorkspace(`/inventory/properties/${propertyId as string}`, workspaceId),
        workspaceId as string,
        OperatorProperty,
      ),
    enabled: workspaceId !== null && propertyId !== null,
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
 * Gated on `team.manage` server side, for the READ. Most reads in `/ops/*`
 * need only the workspace, because a receptionist has to see rooms and threads
 * to do the job. This one enumerates every colleague, their email and the role
 * each holds — that is a disclosure, not operational data, and it belongs to
 * the two roles that may change the team.
 */
export function useTeam(workspaceId: string | null): UseQueryResult<OperatorTeamList> {
  return useOpsQuery(
    queryKeys.team(workspaceId),
    "/ops/team",
    workspaceId,
    OperatorTeamList,
  );
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export function useThreads(workspaceId: string | null): UseQueryResult<OperatorThreadList> {
  return useOpsQuery(
    queryKeys.threads(workspaceId),
    "/ops/threads",
    workspaceId,
    OperatorThreadList,
  );
}

export function useThreadMessages(
  workspaceId: string | null,
  threadId: string | null,
): UseQueryResult<OperatorMessageList> {
  return useQuery({
    queryKey: queryKeys.threadMessages(workspaceId, threadId),
    queryFn: () =>
      read(
        `/ops/threads/${threadId as string}/messages`,
        workspaceId as string,
        OperatorMessageList,
      ),
    enabled: workspaceId !== null && threadId !== null,
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

export function useLeases(workspaceId: string | null): UseQueryResult<OperatorLeaseList> {
  return useOpsQuery(
    queryKeys.leases(workspaceId),
    "/ops/leases",
    workspaceId,
    OperatorLeaseList,
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
  return useQuery({
    queryKey: queryKeys.amenities(workspaceId, propertyId),
    queryFn: () =>
      read(
        `/ops/amenities?propertyId=${propertyId as string}`,
        workspaceId as string,
        OperatorAmenityList,
      ),
    enabled: workspaceId !== null && propertyId !== null,
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
