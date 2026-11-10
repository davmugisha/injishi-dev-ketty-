"use server";

import type { BoardId } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import { askTicket, type HelpTopicId, replyTicket, sendSelfReview } from "@/server/mutations/hr-desk";
import * as staff from "@/server/mutations/staff";
import { NoWorkspaceError } from "@/server/sources/types";

/**
 * The staff phones' writes. Each one checks the screen is the person's, calls the API through
 * `server/mutations/staff.ts`, and refreshes the screen. A refusal comes back as words for the screen's
 * toast (an `{ ok: false, error }`), never as a thrown error the person cannot read.
 */
export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

/** `path` is the screen to refresh after a write; null for a step that changes no record on its own (a photo upload). */
async function run<T>(board: BoardId, path: string | null, act: () => Promise<T>): Promise<ActionResult<T>> {
  await requirePersona(board);
  try {
    const value = await act();
    if (path) revalidatePath(path);
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.forbidden) return { ok: false, error: `Not allowed: ${error.message}` };
      return { ok: false, error: error.message };
    }
    if (error instanceof staff.StaffInputError) return { ok: false, error: error.message };
    if (error instanceof NoWorkspaceError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

const ctx = () => requestContext();
const done = async (p: Promise<unknown>) => {
  await p;
  return undefined;
};

// ── /staff/task ─────────────────────────────────────────────────────────────────────────────────────

export async function moveRoomTaskAction(taskId: string, to: "in_progress" | "done"): Promise<ActionResult> {
  return run("StaffTask", "/staff/task", async () => done(staff.moveRoomTask(await ctx(), taskId, to)));
}

export async function setRoomCheckAction(taskId: string, itemId: string, on: boolean): Promise<ActionResult> {
  return run("StaffTask", "/staff/task", async () => done(staff.setRoomCheck(await ctx(), taskId, itemId, on)));
}

export async function sendMinibarCountAction(
  taskId: string,
  counts: { itemId: string; used: number }[],
): Promise<ActionResult> {
  return run("StaffTask", "/staff/task", async () => done(staff.sendMinibarCount(await ctx(), taskId, counts)));
}

export async function logRoomFoundItemAction(
  taskId: string,
  input: { description: string; spot: string },
): Promise<ActionResult<staff.LoggedFoundItem>> {
  return run("StaffTask", "/staff/task", async () => staff.logRoomFoundItem(await ctx(), taskId, input));
}

// ── /staff/report ───────────────────────────────────────────────────────────────────────────────────

export async function reportProblemAction(input: staff.NewProblemReport): Promise<ActionResult<string>> {
  return run("StaffReport", "/staff/report", async () => staff.reportProblem(await ctx(), input));
}

// ── /staff/inspect ──────────────────────────────────────────────────────────────────────────────────

/**
 * A photo of a failed check, taken on the supervisor's phone: stored by the API (`POST /api/v1/uploads`) and
 * answered with its key, which the inspection then names on the check. The form carries `photo` (the shrunk
 * file) and `attemptToken` (one per photo, so a retry returns the same key).
 */
export async function uploadInspectionPhotoAction(form: FormData): Promise<ActionResult<string>> {
  return run("InspectRoom", null, async () => {
    const photo = form.get("photo");
    const token = form.get("attemptToken");
    if (!(photo instanceof Blob)) throw new staff.StaffInputError("Take the photo first.");
    const name = photo instanceof File ? photo.name : "photo.jpg";
    const uploaded = await staff.uploadPhoto(await ctx(), photo, name, typeof token === "string" ? token : "");
    return uploaded.objectKey;
  });
}

export async function inspectRoomAction(
  taskId: string,
  input: { result: "pass" | "fail"; reason?: string; checks: staff.InspectionVerdict[] },
): Promise<ActionResult> {
  return run("InspectRoom", "/staff/inspect", async () => done(staff.inspectRoom(await ctx(), taskId, input)));
}

// ── /staff/work-orders ──────────────────────────────────────────────────────────────────────────────

export async function startWorkOrderAction(orderId: string): Promise<ActionResult> {
  return run("TechWorkOrders", "/staff/work-orders", async () => done(staff.startWorkOrder(await ctx(), orderId)));
}

export async function setWorkOrderTimerAction(orderId: string, running: boolean): Promise<ActionResult> {
  return run("TechWorkOrders", "/staff/work-orders", async () =>
    done(staff.setWorkOrderTimer(await ctx(), orderId, running)),
  );
}

export async function noteWorkOrderAction(orderId: string, note: string): Promise<ActionResult> {
  return run("TechWorkOrders", "/staff/work-orders", async () => done(staff.noteWorkOrder(await ctx(), orderId, note)));
}

export async function resolveWorkOrderAction(
  orderId: string,
  input: { fix: string; askRelease: boolean },
): Promise<ActionResult> {
  return run("TechWorkOrders", "/staff/work-orders", async () =>
    done(staff.resolveWorkOrder(await ctx(), orderId, input)),
  );
}

// ── /staff/schedule ─────────────────────────────────────────────────────────────────────────────────

export async function askLeaveAction(input: {
  leaveTypeId: string;
  from: string;
  to: string;
  reason?: string;
}): Promise<ActionResult<string>> {
  return run("StaffSchedule", "/staff/schedule", async () => staff.askLeave(await ctx(), input));
}

export async function askSwapAction(day: string, colleagueId: string): Promise<ActionResult<string>> {
  return run("StaffSchedule", "/staff/schedule", async () => staff.askSwap(await ctx(), day, colleagueId));
}

export async function checkPayslipPinAction(pin: string): Promise<ActionResult> {
  return run("StaffMe", "/staff/me", async () => done(staff.checkPayslipPin(await ctx(), pin)));
}

export async function askShiftChangeAction(
  day: string,
  shiftTemplateId: string,
  reason: string,
): Promise<ActionResult> {
  return run("StaffSchedule", "/staff/schedule", async () =>
    done(staff.askShiftChange(await ctx(), day, shiftTemplateId, reason)),
  );
}

export async function askRotationAction(
  rotationPatternId: string,
  from: string,
  reason: string,
): Promise<ActionResult> {
  return run("StaffSchedule", "/staff/schedule", async () =>
    done(staff.askRotation(await ctx(), rotationPatternId, from, reason)),
  );
}

export async function answerSwapAction(requestId: string, answer: "accept" | "decline"): Promise<ActionResult> {
  return run("StaffSchedule", "/staff/schedule", async () => done(staff.answerSwap(await ctx(), requestId, answer)));
}

// ── /staff/me ─────────────────────────────────────────────────────────────────────────────────────

/** A document's photo and what it is (or which document HR asked for), as the sheet's form sends it. */
export async function handInDocumentAction(form: FormData): Promise<ActionResult> {
  return run("StaffMe", "/staff/me", async () => done(staff.handInDocument(await ctx(), form)));
}

export async function askClaimAction(form: FormData): Promise<ActionResult> {
  return run("StaffMe", "/staff/me", async () => done(staff.askClaim(await ctx(), form)));
}

export async function cancelClaimAction(claimId: string): Promise<ActionResult> {
  return run("StaffMe", "/staff/me", async () => done(staff.cancelClaim(await ctx(), claimId)));
}

export async function askExtraDaysAction(input: {
  leaveTypeId: string;
  days: number;
  reason: string;
}): Promise<ActionResult> {
  return run("StaffMe", "/staff/me", async () => done(staff.askExtraDays(await ctx(), input)));
}

export async function cancelRequestAction(requestId: string): Promise<ActionResult> {
  const result = await run("StaffSchedule", "/staff/schedule", async () =>
    done(staff.cancelRequest(await ctx(), requestId)),
  );
  // Me lists clock corrections too.
  revalidatePath("/staff/me");
  return result;
}

/** Ask for a day's clock times to be put right, or a day with no record to be written. */
export async function askFixAction(input: {
  workDate: string;
  inAt: string;
  outAt: string;
  reason: string;
}): Promise<ActionResult> {
  const result = await run("StaffMe", "/staff/me", async () => done(staff.askFix(await ctx(), input)));
  revalidatePath("/staff/schedule");
  return result;
}

/** Ask HR or IT from the phone: the topic, and the question as typed (its first line is the subject). */
export async function askHelpAction(topic: string, text: string): Promise<ActionResult> {
  return run("StaffMe", "/staff/me", async () => {
    const body = text.trim();
    if (body.length < 2) throw new staff.StaffInputError("Write your question.");
    const map: Record<string, HelpTopicId> = {
      pay: "pay",
      leave: "leave",
      uniform: "uniform",
      phone: "it",
      documents: "documents",
    };
    const subject = body.split(/\r?\n/)[0].slice(0, 80);
    await askTicket(await ctx(), { topic: map[topic] ?? "other", subject, body });
    return undefined;
  });
}

/** Write again on a question to HR; a resolved one opens again. */
export async function replyHelpAction(ticketId: string, text: string): Promise<ActionResult> {
  return run("StaffMe", "/staff/me", async () => {
    const body = text.trim();
    if (body.length < 2) throw new staff.StaffInputError("Write your reply.");
    await replyTicket(await ctx(), ticketId, body);
    return undefined;
  });
}

/** The person's own part of their review. */
export async function sendSelfReviewAction(reviewId: string, note: string): Promise<ActionResult> {
  return run("StaffMe", "/staff/me", async () => {
    const words = note.trim();
    if (words.length < 3) throw new staff.StaffInputError("Write a few words.");
    await sendSelfReview(await ctx(), reviewId, words);
    return undefined;
  });
}
