/**
 * Writes for the staff phones, through the API. Plain functions: the screens' server actions and the
 * verify flows both call them. The phone names things by the ids its live sources hand it (a task id,
 * a checklist item id, a work order id); a room or place typed by a person is resolved from a fresh
 * read and never guessed. The API decides who may do what; nothing here checks a permission.
 */
import { ApiError, ApiUnreachableError, apiBaseUrl, apiOrigin } from "../api";
import { forgetOperations, readWorkOrders } from "../sources/operations";
import { forgetStaff, myFile, readPhone } from "../sources/staff";
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

/** The register's answer to "Log the item": its reference and who the register names as custodian, if anyone. */
export interface LoggedFoundItem {
  reference: string;
  /** Today's supervisor when the API named one (the item is handed to them); null when nobody is named. */
  custodianName: string | null;
}

/** "Log the item": into the lost and found register with the cleaner as finder. */
export async function logRoomFoundItem(
  ctx: SourceContext,
  taskId: string,
  input: { description: string; spot: string },
): Promise<LoggedFoundItem> {
  const description = input.description.trim();
  if (!description) throw new StaffInputError("Say what the item is.");
  const spot = input.spot.trim();
  if (!spot) throw new StaffInputError("Choose where it was found.");
  const created = await ctx
    .ops()
    .post<{ reference: string; custodianName: string | null }>(
      `/api/v1/ops/housekeeping/tasks/${encodeURIComponent(taskId)}/found-items`,
      { description, spot },
    );
  forget(ctx);
  return { reference: created.reference, custodianName: created.custodianName ?? null };
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

// ── Photos ─────────────────────────────────────────────────────────────────────────────────────────

/** What the API's attachment route stores: phone photographs only (`ATTACHMENT_MIME_TYPES`). */
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
/** `MAX_ATTACHMENT_BYTES` on the API. */
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** A photograph the API stored: the key a record names it by. */
interface UploadedPhoto {
  objectKey: string;
}

/**
 * Store one photograph from the phone (`POST /api/v1/uploads`, multipart) and return its key. It is filed as a
 * `property_photo`, the kind the attachment route keeps for a photo of a fault in a room. `attemptToken` is
 * minted once per photo on the phone, so sending the same photo again returns the same key, never a copy. The
 * key means nothing until a record names it: the inspection's failed check does (`photoObjectKey`).
 */
export async function uploadPhoto(
  ctx: SourceContext,
  photo: Blob,
  filename: string,
  attemptToken: string,
): Promise<UploadedPhoto> {
  if (!PHOTO_TYPES.has(photo.type)) throw new StaffInputError("Send a photo (JPEG, PNG, WebP or HEIC).");
  if (photo.size === 0) throw new StaffInputError("That photo is empty. Take it again.");
  if (photo.size > MAX_PHOTO_BYTES) throw new StaffInputError("A photo must be 8 MB or smaller.");
  const token = attemptToken.trim();
  if (!token || token.length > 200) throw new StaffInputError("Take the photo again.");
  const form = new FormData();
  form.set("kind", "property_photo");
  form.set("attemptToken", token);
  form.set("file", photo, filename || "photo.jpg");
  const headers: Record<string, string> = { accept: "application/json", origin: apiOrigin() };
  if (ctx.api.cookie) headers.cookie = ctx.api.cookie;
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/v1/uploads`, {
      method: "POST",
      headers,
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new ApiUnreachableError(error);
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const b = (body && typeof body === "object" ? body : {}) as { message?: unknown; code?: unknown };
    const message = Array.isArray(b.message) ? b.message.join("; ") : typeof b.message === "string" ? b.message : "";
    throw new ApiError(
      response.status,
      typeof b.code === "string" ? b.code : null,
      message || `The photo was not stored (HTTP ${response.status}).`,
      body,
    );
  }
  const key = (body as { objectKey?: unknown } | null)?.objectKey;
  if (typeof key !== "string" || !key) throw new ApiError(502, null, "The photo was not stored.", body);
  return { objectKey: key };
}

// ── Inspection ─────────────────────────────────────────────────────────────────────────────────────

export interface InspectionVerdict {
  itemId: string;
  result: "pass" | "fail";
  /** The uploaded photo of a failed check (`uploadPhoto`), when one was taken. */
  photoObjectKey?: string;
}

/**
 * "Pass" / "Fail" on a cleaned room, with the verdict each check got. Failing reopens it as a re-clean. The API
 * writes each verdict over the one already there, photo included, so a failed check that already carries a
 * photo keeps it unless a new one was taken: the key is read from the phone's own record, never invented.
 */
export async function inspectRoom(
  ctx: SourceContext,
  taskId: string,
  input: { result: "pass" | "fail"; reason?: string; checks: InspectionVerdict[] },
): Promise<void> {
  const checks: InspectionVerdict[] = input.checks.map((c) => {
    const key = c.result === "fail" ? c.photoObjectKey?.trim() : undefined;
    return key ? { itemId: c.itemId, result: c.result, photoObjectKey: key } : { itemId: c.itemId, result: c.result };
  });
  if (checks.some((c) => c.result === "fail" && !c.photoObjectKey)) {
    const kept = new Map(
      (await readPhone(ctx)).checks
        .filter((c) => c.taskId === taskId && c.result === "fail" && c.photoObjectKey)
        .map((c) => [c.itemId, c.photoObjectKey as string]),
    );
    for (const c of checks)
      if (c.result === "fail" && !c.photoObjectKey && kept.has(c.itemId)) c.photoObjectKey = kept.get(c.itemId);
  }
  await ctx.ops().post(`/api/v1/ops/housekeeping/tasks/${encodeURIComponent(taskId)}/inspection`, {
    result: input.result,
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
    checks,
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
function parseLeaveDate(text: string): string {
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
