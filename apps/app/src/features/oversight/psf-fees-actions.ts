"use server";

import type { PsfOfficerFeesView } from "@injishi/contracts";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";

export type PsfFeeResult = { ok: true; value: PsfOfficerFeesView } | { ok: false; error: string };

/**
 * Set a band's price for a district (or nationally, `districtId` null), or clear it with `amountRwf`
 * null. Answers the fees as they now stand; a refusal (outside the band, outside the officer's region)
 * comes back as the API's own words.
 */
export async function setPsfFeeAction(tierCode: string, districtId: number | null, amountRwf: number | null): Promise<PsfFeeResult> {
  await requirePersona("PsfFees");
  try {
    const ctx = await requestContext();
    return { ok: true, value: await ctx.api.put<PsfOfficerFeesView>("/api/v1/oversight/psf/fees", { tierCode, districtId, amountRwf }) };
  } catch (error) {
    if (error instanceof ApiError) {
      const issue = (error.body as { issues?: { message?: string }[] } | null)?.issues?.[0]?.message;
      return { ok: false, error: issue ?? error.message };
    }
    if (error instanceof ApiUnreachableError) return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

/** A kind of business's price in a district, or null to clear it (2026-11-05). */
export async function setPsfServiceFeeAction(subsectorId: string, districtId: number, amountRwf: number | null): Promise<PsfFeeResult> {
  await requirePersona("PsfFees");
  try {
    const ctx = await requestContext();
    return { ok: true, value: await ctx.api.put<PsfOfficerFeesView>("/api/v1/oversight/psf/service-fees", { subsectorId, districtId, amountRwf }) };
  } catch (error) {
    if (error instanceof ApiError) {
      const issue = (error.body as { issues?: { message?: string }[] } | null)?.issues?.[0]?.message;
      return { ok: false, error: issue ?? error.message };
    }
    if (error instanceof ApiUnreachableError) return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}
