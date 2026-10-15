"use server";

import type { BoardId } from "@injishi/data";
import { screenHref } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import { ResidenceInputError } from "@/server/mutations/residence";
import * as resident from "@/server/mutations/resident";

/**
 * The tenant's writes from the phone. Each checks the screen is the person's, calls the API (which
 * proves the record is theirs), and refreshes the resident screens. A refusal comes back as words for
 * the screen's toast.
 */
export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

const SCREENS: BoardId[] = ["TenantHome", "TenantLease", "TenantRequests", "TenantPay"];

async function run<T>(board: BoardId, act: () => Promise<T>): Promise<ActionResult<T>> {
  await requirePersona(board);
  try {
    const value = await act();
    for (const screen of SCREENS) revalidatePath(screenHref(screen));
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof ResidenceInputError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

const ctx = () => requestContext();

/** Send request → `POST /me/residence/repairs`. Answers the repair's WO number. */
export async function requestRepairAction(input: {
  unit: string;
  category: string;
  description: string;
  staffMayEnter: boolean;
}): Promise<ActionResult<string>> {
  return run("TenantRequests", async () => {
    const repair = await resident.requestRepair(await ctx(), input);
    return repair.reference ?? repair.id;
  });
}

/** Get access code → `POST /me/residence/visitor-passes`. Answers the code the server minted. */
export async function registerVisitorAction(input: {
  unit: string;
  visitorName: string;
  date: string;
  time: string;
  overnight: boolean;
}): Promise<ActionResult<{ id: string; code: string }>> {
  return run("TenantRequests", async () => {
    const pass = await resident.registerVisitor(await ctx(), input);
    return { id: pass.id, code: pass.code ?? "" };
  });
}

/** Accept or Decline on the renewal offer → `POST /me/residence/offers/:id/answer`. */
export async function answerRenewalAction(offerId: string, answer: "accepted" | "declined"): Promise<ActionResult> {
  return run("TenantLease", async () => {
    await resident.answerRenewal(await ctx(), offerId, answer);
    return undefined;
  });
}

/** Send notice → `POST /me/residence/leases/:id/notice`. */
export async function giveNoticeAction(
  leaseRef: string,
  input: { moveOut: string; reason: string; note: string },
): Promise<ActionResult> {
  return run("TenantLease", async () => {
    await resident.giveNotice(await ctx(), leaseRef, input);
    return undefined;
  });
}

/** Send message → `POST /me/threads/:id/messages`. */
export async function sendMessageAction(threadId: string, text: string): Promise<ActionResult> {
  return run("TenantHome", async () => {
    await resident.sendMessage(await ctx(), threadId, text);
    return undefined;
  });
}
