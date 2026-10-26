"use server";

import { screenHref } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import * as admin from "@/server/mutations/admin";

/**
 * The money desk's commands (073-gtbank-payments AC-15, AC-20, AC-21). Each checks the screen is the
 * person's, calls the API through `server/mutations/admin.ts`, and refreshes the desk. A refusal comes back
 * as words, never as an error nobody can read: the API's own message says why (a different person must
 * approve, the payment is no longer owed, your role cannot do this).
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

async function run(act: () => Promise<unknown>): Promise<ActionResult> {
  await requirePersona("AdminMoney");
  try {
    await act();
    revalidatePath(screenHref("AdminMoney"));
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.forbidden) return { ok: false, error: `Not allowed: ${error.message}` };
      return { ok: false, error: error.message };
    }
    if (error instanceof admin.AdminMoneyRefusal) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError) return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

const ctx = () => requestContext();

export async function pullPaymentAction(paymentId: string): Promise<ActionResult> {
  return run(async () => admin.pullPayment(await ctx(), paymentId));
}

export async function resolvePaymentAction(
  paymentId: string,
  outcome: "failed" | "stands",
  note: string,
): Promise<ActionResult> {
  return run(async () => admin.resolvePayment(await ctx(), paymentId, outcome, note));
}

export async function requestOverrideAction(
  paymentId: string,
  action: admin.OverrideAction,
  reason: string,
): Promise<ActionResult> {
  return run(async () => admin.requestOverride(await ctx(), paymentId, action, reason));
}

export async function requestTreasuryAdjustmentAction(input: {
  amountRwf: number;
  bankReference: string;
  reason: string;
}): Promise<ActionResult> {
  return run(async () => admin.requestTreasuryAdjustment(await ctx(), input));
}

export async function decideOverrideAction(overrideId: string, verdict: "approve" | "reject"): Promise<ActionResult> {
  return run(async () => admin.decideOverride(await ctx(), overrideId, verdict));
}
