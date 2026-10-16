/**
 * Writes for the staff phones, through the API. Plain functions: the screens' server actions and the
 * verify flows both call them. The phone names things by the ids its live sources hand it (a task id,
 * a checklist item id, a work order id); a room or place typed by a person is resolved from a fresh
 * read and never guessed. The API decides who may do what; nothing here checks a permission.
 */
import { forgetOperations, readWorkOrders } from "../sources/operations";
import { forgetStaff, myFile } from "../sources/staff";
import type { SourceContext } from "../sources/types";
import { advanceHousekeepingTask } from "./platform";

/** A plain-words refusal raised before the API is asked (an unreadable date, an unknown place). */
export class StaffInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffInputError";
  }
}

const forget = (ctx: SourceContext) => {
  forgetStaff(ctx);
  forgetOperations(ctx);
};

// ── The cleaner's room ─────────────────────────────────────────────────────────────────────────────

/** "Start cleaning room 204" / "Mark clean". */
export async function moveRoomTask(ctx: SourceContext, taskId: string, to: "in_progress" | "done"): Promise<void> {
  await advanceHousekeepingTask(ctx, taskId, to);
  forget(ctx);
}

/** Tick (or untick) one cleaning step on the room's task. */
export async function setRoomCheck(ctx: SourceContext, taskId: string, itemId: string, done: boolean): Promise<void> {
  await ctx.ops().post(`/api/v1/ops/housekeeping/tasks/${encodeURIComponent(taskId)}/checks`, { itemId, done });
  forget(ctx);
}

/** "Send count to front desk": what was used, one line per item. A report, never a charge. */
export async function sendMinibarCount(
  ctx: SourceContext,
  taskId: string,
  counts: { itemId: string; used: number }[],
): Promise<void> {
  await ctx.ops().post(`/api/v1/ops/housekeeping/tasks/${encodeURIComponent(taskId)}/minibar`, { counts });
  forget(ctx);
}

/** "Log the item": into the lost and found register with the cleaner as finder. Returns its reference. */
export async function logRoomFoundItem(
  ctx: SourceContext,
  taskId: string,
  input: { description: string; spot: string },
): Promise<string> {
  const created = await ctx
    .ops()
    .post<{ reference: string }>(`/api/v1/ops/housekeeping/tasks/${encodeURIComponent(taskId)}/found-items`, {
      description: input.description.trim(),
      spot: input.spot.trim(),
    });
  forget(ctx);
  return created.reference;
}

// ── Reporting a problem ────────────────────────────────────────────────────────────────────────────

/** The phone's category buttons (staff.problemCategories) as the API's maintenance categories. */
const CATEGORY: Record<string, string> = {
  plumbing: "plumbing",
  electrical: "electrical",
  ac: "hvac",
  furniture: "furniture",
  safety: "safety",
  other: "other",
};
/** The phone's urgency buttons (staff.urgencyLevels) as the API's priorities. */
const PRIORITY: Record<string, string> = { urgent: "urgent", today: "high", low: "low" };

export interface NewProblemReport {
  /** The place as the phone lists it: a room label ("204") or a space ("Corridor F2"). */
  place: string;
  isRoom: boolean;
  category: string;
  urgency: string;
  description: string;
  /** Ask a manager to take the room off sale while it is fixed (a room only). */
  askBlock: boolean;
}

/** "Send to maintenance". Returns the new work order's reference ("WO-330"). */
export async function reportProblem(ctx: SourceContext, input: NewProblemReport): Promise<string> {
  const description = input.description.trim();
  if (!description) throw new StaffInputError("Say what is wrong.");
  const priority = PRIORITY[input.urgency];
  if (!priority) throw new StaffInputError("Choose how urgent it is.");
  const location = input.isRoom ? `Room ${input.place}` : input.place;
  const title =
    description
      .split(/[.!?\n]/)[0]
      ?.trim()
      .slice(0, 120) || description.slice(0, 120);
  const created = await ctx.ops().post<{ reference: string }>("/api/v1/ops/work-orders", {
    location,
    title,
    description,
    category: CATEGORY[input.category] ?? "other",
    priority,
    ...(input.askBlock && input.isRoom ? { requestBlock: { reason: title } } : {}),
  });
  forget(ctx);
  return created.reference;
}

// ── Inspection ─────────────────────────────────────────────────────────────────────────────────────

/** "Pass" / "Fail" on a cleaned room, with the verdict each check got. Failing reopens it as a re-clean. */
export async function inspectRoom(
  ctx: SourceContext,
  taskId: string,
  input: { result: "pass" | "fail"; reason?: string; checks: { itemId: string; result: "pass" | "fail" }[] },
): Promise<void> {
  await ctx.ops().post(`/api/v1/ops/housekeeping/tasks/${encodeURIComponent(taskId)}/inspection`, {
    result: input.result,
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
    checks: input.checks,
  });
  forget(ctx);
}

// ── The technician's work orders ───────────────────────────────────────────────────────────────────

/** Take an order nobody holds onto the caller's own list (the board's assign route). */
async function takeIfFree(ctx: SourceContext, orderId: string): Promise<void> {
  const list = await readWorkOrders(ctx);
  const order = list.workOrders.find((o) => o.id === orderId);
  if (!order) throw new StaffInputError("This work order is no longer open.");
  const userId = ctx.account?.user.id;
  if (!userId || order.assignedToUserId === userId) return;
  if (order.assignedToUserId || order.assignedContractor)
    throw new StaffInputError("This work order is on someone else's list.");
  await ctx.ops().post(`/api/v1/ops/work-orders/${orderId}/assign`, { userId });
}

/** "Start work": take the order if nobody holds it, then put it in progress. */
export async function startWorkOrder(ctx: SourceContext, orderId: string): Promise<void> {
  await takeIfFree(ctx, orderId);
  await ctx.ops().post(`/api/v1/ops/work-orders/${orderId}/start`, {});
  forget(ctx);
}

/** The repair timer: start or stop the caller's own session. */
export async function setWorkOrderTimer(ctx: SourceContext, orderId: string, running: boolean): Promise<void> {
  if (running) await takeIfFree(ctx, orderId);
  await ctx.ops().post(`/api/v1/ops/work-orders/${orderId}/timer`, { running });
  forget(ctx);
}

/** "Add note". */
export async function noteWorkOrder(ctx: SourceContext, orderId: string, note: string): Promise<void> {
  if (!note.trim()) throw new StaffInputError("Write the note first.");
  await ctx.ops().post(`/api/v1/ops/work-orders/${orderId}/notes`, { note: note.trim() });
  forget(ctx);
}

/** "Mark fixed": what was done, and whether to ask for the room to go back on sale. */
export async function resolveWorkOrder(
  ctx: SourceContext,
  orderId: string,
  input: { fix: string; askRelease: boolean },
): Promise<void> {
  if (!input.fix.trim()) throw new StaffInputError("Say what you did.");
  await ctx.ops().post(`/api/v1/ops/work-orders/${orderId}/resolve`, {
    fix: input.fix.trim(),
    askRelease: input.askRelease,
  });
  forget(ctx);
}

// ── Leave and requests (the caller's own file) ─────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tue 15 Dec 2026" or "15 Dec 2026" (as the leave form shows a date) → "2026-12-15". */
export function parseLeaveDate(text: string): string {
  const m = text.trim().match(/(\d{1,2}) ([A-Z][a-z]{2})[a-z]* (\d{4})$/);
  const month = m ? MONTHS.indexOf(m[2] as string) : -1;
  if (!m || month < 0) throw new StaffInputError(`Write the date as “15 Dec 2026”.`);
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${(m[1] as string).padStart(2, "0")}`;
}

/** "Send request" for leave. Returns the new request's id. */
export async function askLeave(
  ctx: SourceContext,
  input: { leaveTypeId: string; from: string; to: string; reason?: string },
): Promise<string> {
  const { employeeId } = await myFile(ctx);
  const startsOn = parseLeaveDate(input.from);
  const endsOn = parseLeaveDate(input.to);
  if (endsOn < startsOn) throw new StaffInputError("The last day comes before the first.");
  const created = await ctx.api.post<{ id: string }>(`/api/v1/me/work/${employeeId}/leave/requests`, {
    leaveTypeId: input.leaveTypeId,
    startsOn,
    endsOn,
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
  });
  forgetStaff(ctx);
  return created.id;
}

/** "Cancel request": a staff.requests id, `leave:<id>` or `shift:<id>`. */
export async function cancelRequest(ctx: SourceContext, requestId: string): Promise<void> {
  const [kind, id] = requestId.split(":");
  if (!id || (kind !== "leave" && kind !== "shift"))
    throw new StaffInputError("This request cannot be cancelled here.");
  const { employeeId } = await myFile(ctx);
  const path = kind === "leave" ? "leave/requests" : "shift-requests";
  await ctx.api.post(`/api/v1/me/work/${employeeId}/${path}/${encodeURIComponent(id)}/cancel`, {});
  forgetStaff(ctx);
}
