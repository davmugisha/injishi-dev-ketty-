/**
 * Writes for Me (/me): what a person asks for on their own staff file, through `/me/work/:employeeId`
 * (ADR-058, 058-self-service). The API answers for the caller's own file only: any other id is 404,
 * so the id the page sends cannot reach somebody else's file. Plain functions; every refusal is the
 * API's (an ApiError) or a `MeInputError` in words the page shows.
 */
import type { SourceContext } from "../sources/types";

export class MeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeInputError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function file(employeeId: string): string {
  if (!UUID.test(employeeId)) throw new MeInputError("This page has no staff file to write to.");
  return `/api/v1/me/work/${employeeId}`;
}

/** A photo or a PDF, checked before it travels: the API checks it again by its first bytes. */
function upload(value: FormDataEntryValue | null, what: string, required: boolean): File | null {
  if (!(value instanceof File) || value.size === 0) {
    if (required) throw new MeInputError(`Choose a photo or a PDF of the ${what} first.`);
    return null;
  }
  if (value.size > MAX_FILE_BYTES) throw new MeInputError("A photo or a PDF must be 10 MB or smaller.");
  return value;
}

/** Leave, from a first to a last day; the manager decides first, then HR. */
export async function askLeave(
  ctx: SourceContext,
  employeeId: string,
  input: { leaveTypeId: string; startsOn: string; endsOn: string; reason: string },
): Promise<void> {
  if (!input.leaveTypeId) throw new MeInputError("Choose the kind of leave.");
  if (!ISO_DAY.test(input.startsOn) || !ISO_DAY.test(input.endsOn))
    throw new MeInputError("Choose the first and the last day.");
  if (input.endsOn < input.startsOn) throw new MeInputError("The last day comes before the first.");
  await ctx.api.post(`${file(employeeId)}/leave/requests`, {
    leaveTypeId: input.leaveTypeId,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    ...(input.reason.trim() ? { reason: input.reason.trim() } : {}),
  });
}

/** Days on top of what a kind of leave gives. Nothing is added until it is approved. */
export async function askExtraDays(
  ctx: SourceContext,
  employeeId: string,
  input: { leaveTypeId: string; days: number; reason: string },
): Promise<void> {
  if (!(input.days > 0) || input.days * 2 !== Math.round(input.days * 2))
    throw new MeInputError("Ask for whole or half days.");
  if (input.reason.trim().length < 3) throw new MeInputError("Say why you need them.");
  await ctx.api.post(`${file(employeeId)}/leave/allocation-requests`, {
    kind: "extra",
    leaveTypeId: input.leaveTypeId,
    days: input.days,
    reason: input.reason.trim(),
  });
}

/** A swap of one day's shift: the colleague says yes first, then the manager decides. */
export async function askSwap(ctx: SourceContext, employeeId: string, day: string, colleagueId: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new MeInputError("Choose the day.");
  await ctx.api.post(`${file(employeeId)}/shift-requests`, {
    kind: "swap",
    swapEmployeeId: colleagueId,
    from: day,
    to: day,
    reason: "Can you take this shift for me?",
  });
}

/** Say yes or no to a swap a colleague asked. */
export async function answerSwap(
  ctx: SourceContext,
  employeeId: string,
  requestId: string,
  answer: "accept" | "decline",
): Promise<void> {
  if (!UUID.test(requestId)) throw new MeInputError("This cannot be answered here.");
  await ctx.api.post(`${file(employeeId)}/shift-requests/${requestId}/${answer}`, {});
}

/** Ask for a different shift on a day. */
export async function askShiftChange(
  ctx: SourceContext,
  employeeId: string,
  day: string,
  shiftTemplateId: string,
  reason: string,
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new MeInputError("Choose the day.");
  await ctx.api.post(`${file(employeeId)}/shift-requests`, {
    kind: "change",
    shiftTemplateId,
    from: day,
    to: day,
    reason: reason.trim() || "Can I work this shift instead?",
  });
}

/** Ask to join a rotation from a day. */
export async function askRotation(
  ctx: SourceContext,
  employeeId: string,
  rotationPatternId: string,
  from: string,
  reason: string,
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new MeInputError("Choose the day to start.");
  await ctx.api.post(`${file(employeeId)}/shift-requests`, {
    kind: "rotation",
    rotationPatternId,
    from,
    to: from,
    reason: reason.trim() || "Can I join this rotation?",
  });
}

/** Take back something still waiting: `leave:`, `extra:`, `shift:` or `fix:` and its id. */
export async function cancelMine(ctx: SourceContext, employeeId: string, requestId: string): Promise<void> {
  const [kind, id] = requestId.split(":");
  const path =
    kind === "leave"
      ? "leave/requests"
      : kind === "extra"
        ? "leave/allocation-requests"
        : kind === "shift"
          ? "shift-requests"
          : kind === "fix"
            ? "attendance/requests"
            : null;
  if (!path || !id || !UUID.test(id)) throw new MeInputError("This cannot be cancelled here.");
  await ctx.api.post(`${file(employeeId)}/${path}/${id}/cancel`, {});
}

/** Money back: an amount and what it was for, with the receipt if there is one. One key per press. */
export async function askClaim(ctx: SourceContext, employeeId: string, form: FormData): Promise<void> {
  const base = file(employeeId);
  const amountRwf = Number(String(form.get("amount") ?? "").replace(/[^0-9]/g, ""));
  const reason = String(form.get("reason") ?? "").trim();
  if (!Number.isInteger(amountRwf) || amountRwf <= 0) throw new MeInputError("Write the amount in francs.");
  if (reason.length < 3) throw new MeInputError("Say what it was for.");
  const receipt = upload(form.get("receipt"), "receipt", false);
  let receiptKey: string | null = null;
  if (receipt) {
    const body = new FormData();
    body.append("file", receipt, receipt.name || "receipt.jpg");
    receiptKey = (await ctx.api.post<{ key: string }>(`${base}/files`, body)).key;
  }
  const idempotencyKey = String(form.get("key") ?? "").trim() || crypto.randomUUID();
  await ctx.api.post(`${base}/claims`, { kind: "reimbursement", amountRwf, reason, receiptKey }, { idempotencyKey });
}

export async function cancelClaim(ctx: SourceContext, employeeId: string, claimId: string): Promise<void> {
  if (!UUID.test(claimId)) throw new MeInputError("This cannot be taken back here.");
  await ctx.api.post(`${file(employeeId)}/claims/${claimId}/cancel`, {});
}

/** A document: the file first, then the document that names it (one HR asked for, or a new title). */
export async function handInDocument(ctx: SourceContext, employeeId: string, form: FormData): Promise<void> {
  const base = file(employeeId);
  const chosen = upload(form.get("file"), "document", true) as File;
  const documentId = String(form.get("documentId") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  if (!documentId && title.length < 2) throw new MeInputError("Say what the document is.");
  const body = new FormData();
  body.append("file", chosen, chosen.name || "document.jpg");
  const stored = await ctx.api.post<{ key: string }>(`${base}/documents/files`, body);
  await ctx.api.post(
    `${base}/documents`,
    documentId ? { documentId, fileKey: stored.key } : { title, fileKey: stored.key },
  );
}

/** Tick a checklist task that is the person's own to do, or untick it. */
export async function tickTask(ctx: SourceContext, employeeId: string, taskId: string, done: boolean): Promise<void> {
  if (!UUID.test(taskId)) throw new MeInputError("That task is not on your checklist.");
  await ctx.api.post(`${file(employeeId)}/checklists/tasks/${taskId}/${done ? "done" : "undo"}`);
}

/** "07:05" on a day in Kigali as an instant; an out time before the in time is the next day. */
function kigaliInstant(day: string, time: string, after?: string): string {
  if (!/^\d{2}:\d{2}$/.test(time)) throw new MeInputError("Write the times as hours and minutes.");
  const at = new Date(`${day}T${time}:00+02:00`);
  if (after && at.toISOString() <= after) at.setUTCDate(at.getUTCDate() + 1);
  return at.toISOString();
}

/**
 * Ask a supervisor to put a day's times right. With no record named, the day's own record is looked up,
 * so a day that has one is corrected; a day with none asks for a missing record to be written.
 */
export async function askFix(
  ctx: SourceContext,
  employeeId: string,
  input: { recordId: string | null; workDate: string; inAt: string; outAt: string; reason: string },
): Promise<void> {
  if (!ISO_DAY.test(input.workDate)) throw new MeInputError("Choose the day.");
  if (input.reason.trim().length < 3) throw new MeInputError("Say what happened.");
  const clockInAt = kigaliInstant(input.workDate, input.inAt);
  const clockOutAt = kigaliInstant(input.workDate, input.outAt, clockInAt);
  const base = file(employeeId);
  let recordId = input.recordId;
  if (!recordId) {
    const { records } = await ctx.api.get<{ records: { id: string; status: string }[] }>(`${base}/attendance`, {
      query: { from: input.workDate, to: input.workDate },
    });
    recordId = records.find((r) => r.status !== "superseded")?.id ?? null;
  }
  await ctx.api.post(`${base}/attendance/requests`, {
    workDate: input.workDate,
    clockInAt,
    clockOutAt,
    recordId,
    reason: input.reason.trim(),
  });
}

/** Change one's own kiosk PIN; the current one proves who is asking. */
export async function changePin(
  ctx: SourceContext,
  employeeId: string,
  input: { currentPin: string; pin: string },
): Promise<void> {
  if (!/^\d{4,6}$/.test(input.currentPin) || !/^\d{4,6}$/.test(input.pin))
    throw new MeInputError("Both PINs are 4 to 6 digits.");
  if (input.currentPin === input.pin) throw new MeInputError("Choose a PIN that is not the one you have.");
  await ctx.api.put(`${file(employeeId)}/kiosk-pin`, input);
}

/** Where the phone says it is, as the browser reports it. */
export interface ClockFix {
  lat: number;
  lng: number;
  accuracyM: number;
}

/**
 * Clock in or out from the person's own phone or computer: where it is, and the
 * code from the entrance tablet when they scanned one. The branch's rules
 * decide; a refusal comes back as the API's sentence.
 */
export async function clock(
  ctx: SourceContext,
  employeeId: string,
  direction: "in" | "out",
  input: { fix: ClockFix | null; code?: string },
): Promise<{ validated: boolean; pendingReason: string | null }> {
  const fix =
    input.fix && Number.isFinite(input.fix.lat) && Number.isFinite(input.fix.lng)
      ? { lat: input.fix.lat, lng: input.fix.lng, accuracyM: Math.max(0, Math.round(input.fix.accuracyM)) }
      : {};
  const code = input.code?.trim();
  return ctx.api.post(`${file(employeeId)}/clock-${direction}`, { ...fix, ...(code ? { code } : {}) });
}
