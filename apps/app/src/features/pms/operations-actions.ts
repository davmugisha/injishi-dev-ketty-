"use server";

import type { BoardId } from "@injishi/data";
import type { CleaningTask, Severity } from "@injishi/data/fixtures/operations";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import * as ops from "@/server/mutations/operations";

/**
 * The operations screens' writes. Each one checks the screen is the person's, calls the API through
 * `server/mutations/operations.ts`, and refreshes the screen. A refusal comes back as words for the
 * screen's toast (an `{ ok: false, error }`), never as a thrown error the person cannot read.
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
    if (error instanceof ops.OperationsInputError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

const ctx = () => requestContext();

// ── /housekeeping ───────────────────────────────────────────────────────────────────────────────────

export async function addCleaningTaskAction(
  input: {
    room: string;
    kind: Exclude<CleaningTask["kind"], "Re-clean">;
    assignee: string | null;
    due: string;
    minutes?: number;
  },
  idempotencyKey: string,
): Promise<ActionResult<string>> {
  return run("HousekeepingBoard", "/housekeeping", async () => ops.addCleaningTask(await ctx(), input, idempotencyKey));
}

export async function assignCleaningTaskAction(taskId: string, assignee: string | null): Promise<ActionResult> {
  return run("HousekeepingBoard", "/housekeeping", async () => {
    await ops.assignCleaningTask(await ctx(), taskId, assignee);
    return undefined;
  });
}

export async function inspectCleaningTaskAction(
  taskId: string,
  result: "pass" | "fail",
  reason?: string,
): Promise<ActionResult> {
  return run("HousekeepingBoard", "/housekeeping", async () => {
    await ops.inspectCleaningTask(await ctx(), taskId, result, reason);
    return undefined;
  });
}

export async function remindEscalationAction(escalationId: string): Promise<ActionResult> {
  return run("HousekeepingBoard", "/housekeeping", async () => {
    await ops.remindEscalation(await ctx(), escalationId);
    return undefined;
  });
}

// ── /maintenance ────────────────────────────────────────────────────────────────────────────────────

export async function createWorkOrderAction(input: {
  asset: string;
  title: string;
  details?: string;
  severity: Severity;
  owner: string | null;
  requestBlock: boolean;
}): Promise<ActionResult<string>> {
  return run("Maintenance", "/maintenance", async () => ops.createWorkOrder(await ctx(), input));
}

export async function assignWorkOrderAction(reference: string, owner: string): Promise<ActionResult> {
  return run("Maintenance", "/maintenance", async () => {
    await ops.assignWorkOrder(await ctx(), reference, owner);
    return undefined;
  });
}

export async function addWorkOrderNoteAction(reference: string, note: string): Promise<ActionResult> {
  return run("Maintenance", "/maintenance", async () => {
    await ops.addWorkOrderNote(await ctx(), reference, note);
    return undefined;
  });
}

export async function decideRoomBlockAction(reference: string, decision: "approve" | "decline"): Promise<ActionResult> {
  const result = await run("Maintenance", "/maintenance", async () => {
    await ops.decideRoomBlock(await ctx(), reference, decision);
    return undefined;
  });
  // The room's tile on the housekeeping board changes with it.
  if (result.ok) revalidatePath("/housekeeping");
  return result;
}

export async function releaseRoomAction(reference: string): Promise<ActionResult> {
  const result = await run("Maintenance", "/maintenance", async () => {
    await ops.releaseRoom(await ctx(), reference);
    return undefined;
  });
  if (result.ok) revalidatePath("/housekeeping");
  return result;
}

export async function actOnSignalAction(signalId: string): Promise<ActionResult<string | null>> {
  return run("Maintenance", "/maintenance", async () => ops.actOnSignal(await ctx(), signalId));
}

export async function dismissSignalAction(signalId: string, reason: string): Promise<ActionResult> {
  return run("Maintenance", "/maintenance", async () => {
    await ops.dismissSignal(await ctx(), signalId, reason);
    return undefined;
  });
}

// ── /lost-found ─────────────────────────────────────────────────────────────────────────────────────

export async function logFoundItemAction(input: ops.NewFoundItem): Promise<ActionResult<string>> {
  return run("LostFound", "/lost-found", async () => ops.logFoundItem(await ctx(), input));
}

export async function openFoundItemClaimAction(
  reference: string,
  claim: { claimant: string; booking?: string; statement: string },
): Promise<ActionResult> {
  return run("LostFound", "/lost-found", async () => {
    await ops.openFoundItemClaim(await ctx(), reference, claim);
    return undefined;
  });
}

export async function releaseFoundItemAction(
  reference: string,
  method: "person" | "agent" | "courier",
): Promise<ActionResult> {
  return run("LostFound", "/lost-found", async () => {
    await ops.releaseFoundItem(await ctx(), reference, method);
    return undefined;
  });
}

export async function approveFoundItemDisposalAction(reference: string): Promise<ActionResult> {
  return run("LostFound", "/lost-found", async () => {
    await ops.approveFoundItemDisposal(await ctx(), reference);
    return undefined;
  });
}

export async function keepFoundItemAction(reference: string, days: number, reason: string): Promise<ActionResult> {
  return run("LostFound", "/lost-found", async () => {
    await ops.keepFoundItem(await ctx(), reference, days, reason);
    return undefined;
  });
}
