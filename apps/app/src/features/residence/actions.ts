"use server";

import type { BoardId } from "@injishi/data";
import { screenHref } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import * as residence from "@/server/mutations/residence";
import { NoWorkspaceError } from "@/server/sources/types";

/**
 * The residence manager's writes. Each checks the screen is the person's, calls the API through
 * `server/mutations/residence.ts`, and refreshes the residence screens (they read one building). A
 * refusal comes back as words for the screen's toast, never as an error the person cannot read.
 */
export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

/** Every screen that draws the building: a write on one changes what the others show. */
const SCREENS: BoardId[] = ["ResidenceHome", "ResidenceService", "RentRoll", "Leases", "Applicants", "MoveOuts"];

async function run<T>(board: BoardId, act: () => Promise<T>): Promise<ActionResult<T>> {
  await requirePersona(board);
  try {
    const value = await act();
    for (const screen of SCREENS) revalidatePath(screenHref(screen));
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.forbidden) return { ok: false, error: `Not allowed: ${error.message}` };
      return { ok: false, error: error.message };
    }
    if (error instanceof residence.ResidenceInputError) return { ok: false, error: error.message };
    if (error instanceof NoWorkspaceError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

const ctx = () => requestContext();

// ── Maintenance and visitors ───────────────────────────────────────────────────────────────────────

/** New ticket → `POST /ops/residence/repairs`. Answers the WO number. */
export async function createTicketAction(input: {
  unit: string;
  title: string;
  category: string;
  entry: string;
}): Promise<ActionResult<string>> {
  return run("ResidenceService", async () => {
    const created = await residence.raiseRepair(await ctx(), {
      unit: input.unit,
      title: input.title,
      category: residence.REPAIR_CATEGORY[input.category] ?? "other",
      staffMayEnter: input.entry.startsWith("Yes") ? true : input.entry.startsWith("Only") ? false : null,
    });
    return created.reference ?? created.id;
  });
}

/** The ticket's status segment → `POST /ops/residence/repairs/:id/move`. */
export async function moveTicketAction(ref: string, to: "assigned" | "progress" | "done"): Promise<ActionResult> {
  return run("ResidenceService", async () => {
    await residence.moveRepair(
      await ctx(),
      ref,
      to === "progress" ? "in_progress" : to === "done" ? "resolved" : "assigned",
    );
    return undefined;
  });
}

/** Send in the ticket's thread: a reply to the resident, or an internal note. */
export async function writeOnTicketAction(ref: string, text: string, internal: boolean): Promise<ActionResult> {
  return run("ResidenceService", async () => {
    await residence.writeOnRepair(await ctx(), ref, text, internal);
    return undefined;
  });
}

/** Pre-register a visitor → `POST /ops/residence/visitor-passes`. Answers the gate code. */
export async function preregisterVisitorAction(input: {
  unit: string;
  name: string;
  window: string;
}): Promise<ActionResult<{ id: string; code: string }>> {
  return run("ResidenceService", async () => {
    const pass = await residence.preregisterVisitor(await ctx(), {
      unit: input.unit,
      visitorName: input.name,
      window: input.window,
    });
    return { id: pass.id, code: pass.code ?? "" };
  });
}

/** Approve or decline a gate or overnight request → `POST /ops/residence/access-requests/:id/decision`. */
export async function decideAccessAction(id: string, decision: "approved" | "declined"): Promise<ActionResult> {
  return run("ResidenceService", async () => {
    await residence.decideAccessRequest(await ctx(), id, decision);
    return undefined;
  });
}

// ── Rent roll ──────────────────────────────────────────────────────────────────────────────────────

/** Save as pending → `POST /ops/residence/rent-payments` with the press's Idempotency-Key. */
export async function recordPaymentAction(
  input: { unit: string; amountRwf: number; method: string; providerRef: string },
  idempotencyKey: string,
): Promise<ActionResult> {
  return run("RentRoll", async () => {
    const method = residence.PAYMENT_METHOD[input.method];
    if (!method) throw new residence.ResidenceInputError(`"${input.method}" is not a payment method.`);
    await residence.recordRentPayment(
      await ctx(),
      { unit: input.unit, amountRwf: input.amountRwf, method, providerRef: input.providerRef },
      idempotencyKey,
    );
    return undefined;
  });
}

/** Send reminders → `POST /ops/residence/rent-reminders`. Answers how many were logged. */
export async function remindResidentsAction(units: string[], message: string): Promise<ActionResult<number>> {
  return run("RentRoll", async () => (await residence.remindResidents(await ctx(), units, message)).length);
}

// ── Leases ─────────────────────────────────────────────────────────────────────────────────────────

export async function withdrawOfferAction(leaseRef: string): Promise<ActionResult> {
  return run("Leases", async () => {
    await residence.withdrawOffer(await ctx(), leaseRef);
    return undefined;
  });
}

export async function remindAboutOfferAction(leaseRef: string): Promise<ActionResult> {
  return run("Leases", async () => {
    await residence.remindAboutOffer(await ctx(), leaseRef);
    return undefined;
  });
}

// ── Move-outs ──────────────────────────────────────────────────────────────────────────────────────

/** Record a notice → `POST /ops/residence/notices`. */
export async function recordNoticeAction(input: {
  unit: string;
  received: string;
  movesOut: string;
  channel: string;
}): Promise<ActionResult> {
  return run("MoveOuts", async () => {
    await residence.recordNotice(await ctx(), input);
    return undefined;
  });
}

// ── Applicants ─────────────────────────────────────────────────────────────────────────────────────

/** A screening tick → `PUT /ops/residence/applications/:id/screening` (the whole set). */
export async function recordScreeningAction(applicationId: string, checks: boolean[]): Promise<ActionResult> {
  return run("Applicants", async () => {
    await residence.recordScreening(await ctx(), applicationId, checks);
    return undefined;
  });
}

/** Decline with reason → `POST /ops/residence/applications/:id/decline`. */
export async function declineApplicationAction(applicationId: string, reason: string): Promise<ActionResult> {
  return run("Applicants", async () => {
    await residence.declineApplication(await ctx(), applicationId, reason);
    return undefined;
  });
}

/** Create the lease draft → `POST /ops/residence/applications/:id/convert`. Answers its lease number. */
export async function convertToLeaseAction(
  applicationId: string,
  input: { start: string; term: string; rent: string; deposit: string; notice: string },
): Promise<ActionResult<string>> {
  return run("Applicants", async () => {
    const draft = await residence.convertToLeaseDraft(await ctx(), applicationId, input);
    return draft.reference ?? draft.id;
  });
}
