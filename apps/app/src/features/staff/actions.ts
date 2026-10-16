"use server";

import type { BoardId } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import * as staff from "@/server/mutations/staff";

/**
 * The staff phones' writes. Each one checks the screen is the person's, calls the API through
 * `server/mutations/staff.ts`, and refreshes the screen. A refusal comes back as words for the screen's
 * toast (an `{ ok: false, error }`), never as a thrown error the person cannot read.
 */
export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

async function run<T>(board: BoardId, path: string, act: () => Promise<T>): Promise<ActionResult<T>> {
  await requirePersona(board);
  try {
    const value = await act();
    revalidatePath(path);
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.forbidden) return { ok: false, error: `Not allowed: ${error.message}` };
      return { ok: false, error: error.message };
    }
    if (error instanceof staff.StaffInputError) return { ok: false, error: error.message };
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
): Promise<ActionResult<string>> {
  return run("StaffTask", "/staff/task", async () => staff.logRoomFoundItem(await ctx(), taskId, input));
}

// ── /staff/report ───────────────────────────────────────────────────────────────────────────────────

export async function reportProblemAction(input: staff.NewProblemReport): Promise<ActionResult<string>> {
  return run("StaffReport", "/staff/report", async () => staff.reportProblem(await ctx(), input));
}

// ── /staff/inspect ──────────────────────────────────────────────────────────────────────────────────

export async function inspectRoomAction(
  taskId: string,
  input: { result: "pass" | "fail"; reason?: string; checks: { itemId: string; result: "pass" | "fail" }[] },
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

export async function cancelRequestAction(requestId: string): Promise<ActionResult> {
  return run("StaffSchedule", "/staff/schedule", async () => done(staff.cancelRequest(await ctx(), requestId)));
}
