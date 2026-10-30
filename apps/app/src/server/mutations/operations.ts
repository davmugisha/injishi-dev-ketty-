/**
 * Writes for the operations area, through the API. Plain functions: the screens' server actions and the
 * verify flows both call them. The screens name things the way people do (room "204", work order
 * "WO-318", item "LF-26-041", a person's name); these resolve them to the API's ids from a fresh read
 * and never guess. The API decides who may do what; nothing here checks a permission.
 */
import type { CleaningTask, Severity } from "@injishi/data/fixtures/operations";
import {
  type ApiBoard,
  type ApiFoundItem,
  type ApiFoundItemList,
  type ApiWorkOrder,
  type ApiWorkOrderList,
  forgetOperations,
} from "../sources/operations";
import type { SourceContext } from "../sources/types";

/** A plain-words refusal raised before the API is asked (an unknown room, an unreadable time). */
export class OperationsInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationsInputError";
  }
}

const KIND_TYPE: Record<Exclude<CleaningTask["kind"], "Re-clean">, string> = {
  Checkout: "checkout_clean",
  Stayover: "stayover_clean",
  "Deep clean": "deep_clean",
  Turndown: "turndown",
};
const PRIORITY: Record<Severity, string> = { Critical: "urgent", High: "high", Normal: "normal", Low: "low" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** An instant at a Kigali clock time on a Kigali day ("2026-10-15", "15:00"). */
function kigaliInstant(day: string, time: string): string {
  const [h, m] = time.split(":");
  return new Date(`${day}T${h?.padStart(2, "0")}:${m}:00+02:00`).toISOString();
}

async function board(ctx: SourceContext): Promise<ApiBoard> {
  return ctx.ops().get<ApiBoard>("/api/v1/ops/housekeeping/board");
}

// ── Housekeeping ───────────────────────────────────────────────────────────────────────────────────

interface NewCleaningTask {
  /** The room's label, "204". */
  room: string;
  kind: Exclude<CleaningTask["kind"], "Re-clean">;
  /** The assignee's user id (the board's staff ids), or null to leave it unassigned. */
  assignee: string | null;
  /** As typed: "By 15:00". A clock time in it becomes the due time. */
  due: string;
  minutes?: number;
}

/** "Add task": put a room on the board by hand. Returns the new task's id. */
export async function addCleaningTask(
  ctx: SourceContext,
  input: NewCleaningTask,
  idempotencyKey?: string,
): Promise<string> {
  const { rooms } = await board(ctx);
  const room = rooms.find((r) => r.label === input.room);
  if (!room) throw new OperationsInputError(`Room ${input.room} is not on this property's board.`);
  const time = input.due.match(/\b(\d{1,2}):(\d{2})\b/);
  const created = await ctx.ops().post<{ id: string }>(
    "/api/v1/ops/housekeeping-tasks",
    {
      roomId: room.id,
      taskType: KIND_TYPE[input.kind],
      ...(input.assignee ? { assignedToUserId: input.assignee } : {}),
      note: input.due.trim(),
      ...(time ? { dueAt: kigaliInstant(ctx.today.iso, `${time[1]}:${time[2]}`) } : {}),
      ...(input.minutes ? { estimatedMinutes: Math.round(input.minutes) } : {}),
    },
    idempotencyKey ? { idempotencyKey } : {},
  );
  forgetOperations(ctx);
  return created.id;
}

/** "Assign": give a task to someone on today's sheet (or take it off them with null). */
export async function assignCleaningTask(ctx: SourceContext, taskId: string, assignee: string | null): Promise<void> {
  await ctx.ops().post(`/api/v1/ops/housekeeping/tasks/${encodeURIComponent(taskId)}/assign`, {
    assignedToUserId: assignee,
  });
  forgetOperations(ctx);
}

/** "Pass" / "Fail": inspect a cleaned room. Failing reopens it as a re-clean with the reason. */
export async function inspectCleaningTask(
  ctx: SourceContext,
  taskId: string,
  result: "pass" | "fail",
  reason?: string,
): Promise<void> {
  await ctx.ops().post(`/api/v1/ops/housekeeping/tasks/${encodeURIComponent(taskId)}/inspection`, {
    result,
    ...(reason ? { reason } : {}),
  });
  forgetOperations(ctx);
}

/** "Record a reminder for 207": the API keeps it on the escalation. Nothing delivers it to the supervisor yet. */
export async function remindEscalation(ctx: SourceContext, escalationId: string): Promise<void> {
  await ctx.ops().post(`/api/v1/ops/housekeeping/escalations/${encodeURIComponent(escalationId)}/remind`, {});
  forgetOperations(ctx);
}

// ── Maintenance ────────────────────────────────────────────────────────────────────────────────────

async function workOrders(ctx: SourceContext): Promise<ApiWorkOrderList> {
  return ctx.ops().get<ApiWorkOrderList>("/api/v1/ops/work-orders");
}

async function workOrder(
  ctx: SourceContext,
  reference: string,
): Promise<{ order: ApiWorkOrder; list: ApiWorkOrderList }> {
  const list = await workOrders(ctx);
  const order = list.workOrders.find((o) => o.reference === reference);
  if (!order) throw new OperationsInputError(`There is no work order ${reference} here.`);
  return { order, list };
}

/** A name from the owner picker: a staff member who has worked orders here, else an outside firm. */
function assigneeFor(list: ApiWorkOrderList, name: string): { userId: string } | { contractor: string } {
  const known = list.assignees.find((a) => a.name === name);
  if (known?.userId) return { userId: known.userId };
  return { contractor: name };
}

interface NewWorkOrder {
  /** "Room 302", "Lake Bar", "Generator". */
  asset: string;
  title: string;
  details?: string;
  severity: Severity;
  /** A name from the owner picker, or null. */
  owner: string | null;
  /** Ask for the room to come off sale while the work is done. */
  requestBlock: boolean;
}

/** "New work order". Returns its reference ("WO-330"). */
export async function createWorkOrder(ctx: SourceContext, input: NewWorkOrder): Promise<string> {
  const list = input.owner ? await workOrders(ctx) : null;
  const created = await ctx.ops().post<ApiWorkOrder>("/api/v1/ops/work-orders", {
    location: input.asset.trim(),
    title: input.title.trim(),
    ...(input.details?.trim() ? { description: input.details.trim() } : {}),
    priority: PRIORITY[input.severity],
    ...(input.owner && list ? { assignee: assigneeFor(list, input.owner) } : {}),
    ...(input.requestBlock ? { requestBlock: { reason: input.details?.trim() || input.title.trim() } } : {}),
  });
  forgetOperations(ctx);
  return created.reference;
}

/** "Assign to Jean-Paul Niyonsaba". */
export async function assignWorkOrder(ctx: SourceContext, reference: string, owner: string): Promise<void> {
  const { order, list } = await workOrder(ctx, reference);
  await ctx.ops().post(`/api/v1/ops/work-orders/${order.id}/assign`, assigneeFor(list, owner));
  forgetOperations(ctx);
}

/** "Save note". */
export async function addWorkOrderNote(ctx: SourceContext, reference: string, note: string): Promise<void> {
  const { order } = await workOrder(ctx, reference);
  await ctx.ops().post(`/api/v1/ops/work-orders/${order.id}/notes`, { note: note.trim() });
  forgetOperations(ctx);
}

/** "Approve block" / "Decline". Approval takes the room off sale at once. */
export async function decideRoomBlock(
  ctx: SourceContext,
  reference: string,
  decision: "approve" | "decline",
  note?: string,
): Promise<void> {
  const { order } = await workOrder(ctx, reference);
  await ctx.ops().post(`/api/v1/ops/work-orders/${order.id}/block/decision`, {
    decision,
    ...(note ? { note } : {}),
  });
  forgetOperations(ctx);
}

/** "Release room": back on sale, once the repair is closed and housekeeping has passed the room. */
export async function releaseRoom(ctx: SourceContext, reference: string): Promise<void> {
  const { order } = await workOrder(ctx, reference);
  await ctx.ops().post(`/api/v1/ops/work-orders/${order.id}/release`, {});
  forgetOperations(ctx);
}

/** "Create work order" on a condition signal. Returns the new order's reference. */
export async function actOnSignal(ctx: SourceContext, signalId: string): Promise<string | null> {
  const signal = await ctx
    .ops()
    .post<{ workOrderReference: string | null }>(
      `/api/v1/ops/condition-signals/${encodeURIComponent(signalId)}/work-order`,
      {},
    );
  forgetOperations(ctx);
  return signal.workOrderReference;
}

/** "Dismiss" a condition signal, with the reason chosen. */
export async function dismissSignal(ctx: SourceContext, signalId: string, reason: string): Promise<void> {
  await ctx.ops().post(`/api/v1/ops/condition-signals/${encodeURIComponent(signalId)}/dismiss`, { reason });
  forgetOperations(ctx);
}

// ── Lost and found ─────────────────────────────────────────────────────────────────────────────────

async function foundItems(ctx: SourceContext): Promise<ApiFoundItemList> {
  return ctx.ops().get<ApiFoundItemList>("/api/v1/ops/found-items");
}

async function foundItem(
  ctx: SourceContext,
  reference: string,
): Promise<{ item: ApiFoundItem; list: ApiFoundItemList }> {
  const list = await foundItems(ctx);
  const item = list.items.find((i) => i.reference === reference);
  if (!item) throw new OperationsInputError(`There is no item ${reference} in the register.`);
  return { item, list };
}

const CATEGORY: Record<string, string> = {
  Electronics: "electronics",
  Jewellery: "jewellery",
  Clothing: "clothing",
  Accessories: "accessories",
  Documents: "documents",
  Cash: "cash",
  Other: "other",
};

/** "15 Oct 2026, 12:20" (as the intake form shows it, Kigali time) → an instant. */
function parseFoundAt(text: string): string {
  const m = text.trim().match(/^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4}),? (\d{1,2}):(\d{2})$/);
  const month = m ? MONTHS.indexOf(m[2] as string) : -1;
  if (!m || month < 0) throw new OperationsInputError(`Write when it was found as “15 Oct 2026, 12:20”.`);
  const day = `${m[3]}-${String(month + 1).padStart(2, "0")}-${(m[1] as string).padStart(2, "0")}`;
  return kigaliInstant(day, `${m[4]}:${m[5]}`);
}

export interface NewFoundItem {
  description: string;
  /** "Electronics", as the form lists it. */
  category: string;
  valuable: boolean;
  /** "Room 309", "Lobby". */
  area: string;
  spot?: string;
  /** "15 Oct 2026, 12:20". */
  foundAt: string;
  /** The finder's name, as the person picked or typed it. */
  foundBy: string;
  /**
   * The custodian the person picked on the form: themselves, or someone already holding items on the register.
   * Never taken from sample data; a name that is not the signed-in person or on the register is refused.
   */
  custodian?: string | null;
  storage?: string;
}

/**
 * "Log item": a new entry in the register. Returns its reference ("LF-26-042").
 *
 * No photo count is sent: the register stores no photographs (`POST /uploads` takes no found-item kind and the
 * intake takes no key), so naming "3 photos" on the custody log would record pictures nobody kept.
 */
export async function logFoundItem(ctx: SourceContext, input: NewFoundItem): Promise<string> {
  const list = await foundItems(ctx);
  // The signed-in person by the name the screen showed them, else someone the register already names.
  const me = ctx.account?.user ?? null;
  const myNames = new Set([ctx.persona?.name, me?.name].filter((n): n is string => Boolean(n?.trim())));
  const person = (name: string | null | undefined) => {
    const n = name?.trim();
    if (!n) return undefined;
    if (me && myNames.has(n)) return me.id;
    return list.people.find((p) => p.name === n)?.userId;
  };
  if (!input.foundBy.trim()) throw new OperationsInputError("Say who found the item.");
  if (!input.area.trim()) throw new OperationsInputError("Say in which room or area it was found.");
  const foundByUserId = person(input.foundBy);
  const custodianUserId = person(input.custodian);
  if (input.custodian?.trim() && !custodianUserId) {
    throw new OperationsInputError(
      `${input.custodian.trim()} does not hold items on this register. Choose yourself or someone who does.`,
    );
  }
  const created = await ctx.ops().post<ApiFoundItem>("/api/v1/ops/found-items", {
    description: input.description.trim(),
    category: CATEGORY[input.category] ?? "other",
    valuable: input.valuable,
    foundLocation: input.area.trim(),
    ...(input.spot?.trim() ? { foundSpot: input.spot.trim() } : {}),
    foundAt: parseFoundAt(input.foundAt),
    foundByName: input.foundBy.trim(),
    ...(foundByUserId ? { foundByUserId } : {}),
    ...(custodianUserId ? { custodianUserId } : {}),
    ...(input.storage ? { storageLocation: input.storage } : {}),
  });
  forgetOperations(ctx);
  return created.reference;
}

/** "Open claim" on an item in storage. */
export async function openFoundItemClaim(
  ctx: SourceContext,
  reference: string,
  claim: { claimant: string; booking?: string; statement: string },
): Promise<void> {
  const { item } = await foundItem(ctx, reference);
  await ctx.ops().post(`/api/v1/ops/found-items/${item.id}/claim`, {
    claimantName: claim.claimant.trim(),
    ...(claim.booking?.trim() ? { bookingReference: claim.booking.trim() } : {}),
    statement: claim.statement.trim(),
  });
  forgetOperations(ctx);
}

const METHOD = { person: "in_person", agent: "authorised_person", courier: "courier" } as const;

/** "Release to …": both checks are ticked on the screen before the button is enabled. */
export async function releaseFoundItem(
  ctx: SourceContext,
  reference: string,
  method: keyof typeof METHOD,
): Promise<void> {
  const { item } = await foundItem(ctx, reference);
  await ctx.ops().post(`/api/v1/ops/found-items/${item.id}/release`, {
    method: METHOD[method],
    descriptionMatched: true,
    idChecked: true,
  });
  forgetOperations(ctx);
}

/** Propose disposal of an item held past its retention (the custodian's act; a second person approves). */
export async function proposeFoundItemDisposal(ctx: SourceContext, reference: string, note: string): Promise<void> {
  const { item } = await foundItem(ctx, reference);
  await ctx.ops().post(`/api/v1/ops/found-items/${item.id}/disposal`, { note });
  forgetOperations(ctx);
}

/** "Approve disposal": the second person. */
export async function approveFoundItemDisposal(ctx: SourceContext, reference: string): Promise<void> {
  const { item } = await foundItem(ctx, reference);
  await ctx.ops().post(`/api/v1/ops/found-items/${item.id}/disposal/approve`, {});
  forgetOperations(ctx);
}

/** "Keep 30 more days". A pending disposal is withdrawn by it. */
export async function keepFoundItem(
  ctx: SourceContext,
  reference: string,
  days: number,
  reason: string,
): Promise<void> {
  const { item } = await foundItem(ctx, reference);
  await ctx.ops().post(`/api/v1/ops/found-items/${item.id}/retention`, { days, reason });
  forgetOperations(ctx);
}
