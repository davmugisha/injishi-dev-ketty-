/**
 * Writes for the admin area, through the API: the money queue's pull, resolve and the two signer
 * overrides (073-gtbank-payments AC-15, AC-20, AC-21). Plain functions, so the server actions in
 * features/admin and the verify flows both call them.
 *
 * Every rule is the API's, and its refusal travels back unchanged: who may request, that a different
 * super admin must approve, what state a payment must be in. The only refusals worded here are the
 * ones a request must not even be sent with.
 */
import { randomUUID } from "node:crypto";
import type { SourceContext } from "../sources/types";

export class AdminMoneyRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminMoneyRefusal";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function id(value: string, what: string): string {
  if (!UUID.test(value)) throw new AdminMoneyRefusal(`That ${what} is not on the money desk.`);
  return value;
}

function words(text: string, what: string): string {
  const trimmed = text.trim();
  if (trimmed.length < 5) throw new AdminMoneyRefusal(`Say ${what}.`);
  return trimmed.slice(0, 1000);
}

export type OverrideAction = "resend_disbursement" | "confirm_received" | "cancel_service" | "write_off";

/** Ask the bank about one payment and apply its answer once. Moves no money. */
export async function pullPayment(ctx: SourceContext, paymentId: string): Promise<{ before: string; after: string }> {
  return ctx.api.post(`/api/v1/admin/finance/payments/${id(paymentId, "payment")}/pull`, {});
}

/** Close what moves no money: an unknown payment as failed, or a reversal that stands. */
export async function resolvePayment(
  ctx: SourceContext,
  paymentId: string,
  outcome: "failed" | "stands",
  note: string,
): Promise<void> {
  await ctx.api.post(`/api/v1/admin/finance/payments/${id(paymentId, "payment")}/resolve`, {
    outcome,
    note: words(note, "what you checked and why"),
  });
}

/** The first signature on a two person act. */
export async function requestOverride(
  ctx: SourceContext,
  paymentId: string,
  action: OverrideAction,
  reason: string,
): Promise<void> {
  await ctx.api.post(`/api/v1/admin/finance/payments/${id(paymentId, "payment")}/overrides`, {
    action,
    reason: words(reason, "why this needs a second person"),
  });
}

/** A deposit or a bank debit, waiting on a second super admin. One key per press. */
export async function requestTreasuryAdjustment(
  ctx: SourceContext,
  input: { amountRwf: number; bankReference: string; reason: string },
): Promise<void> {
  if (!Number.isInteger(input.amountRwf) || input.amountRwf === 0) {
    throw new AdminMoneyRefusal("An adjustment moves a whole, non zero number of francs.");
  }
  if (input.bankReference.trim().length < 3) throw new AdminMoneyRefusal("Give the reference on the bank statement.");
  await ctx.api.post(
    "/api/v1/admin/finance/treasury-adjustments",
    { amountRwf: input.amountRwf, bankReference: input.bankReference.trim(), reason: words(input.reason, "what this is") },
    { idempotencyKey: randomUUID() },
  );
}

/** The second signature: approve or reject a waiting request. */
export async function decideOverride(ctx: SourceContext, overrideId: string, verdict: "approve" | "reject"): Promise<void> {
  await ctx.api.post(`/api/v1/admin/money-overrides/${id(overrideId, "request")}/${verdict}`, {});
}
