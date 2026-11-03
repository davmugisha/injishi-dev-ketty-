"use server";

import type { PsfPaymentReminderResult } from "@injishi/contracts";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";

export type PsfReminderResult = { ok: true; value: PsfPaymentReminderResult } | { ok: false; error: string };

/**
 * Remind one business, or every one waiting in the officer's region, that its PSF application waits for
 * its payment (2026-11-02). The API sends an email and a text with the link to pay, once a day at most.
 */
export async function sendPaymentRemindersAction(orgId?: string): Promise<PsfReminderResult> {
  await requirePersona("PsfRegister");
  try {
    const ctx = await requestContext();
    return { ok: true, value: await ctx.api.post<PsfPaymentReminderResult>("/api/v1/oversight/psf/payment-reminders", orgId ? { orgId } : {}) };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError) return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}
