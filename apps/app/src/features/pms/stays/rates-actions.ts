"use server";

/**
 * Writes for prices and availability (2026-10-29): a run of days' price, closing and shortest stay, and a
 * room type's own terms. Checked with the schema the API checks with, sent in the business this request
 * acts in, answered in words for a toast; the calendar and the home are read again after a change.
 */
import { type RatesCalendar, RatesDaysUpdate, RatesTermsUpdate } from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { currentApi } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { staysScope } from "@/server/stays/client";

export type RatesResult = { ok: true; value: RatesCalendar } | { ok: false; error: string };

async function send(path: string, body: unknown): Promise<RatesResult> {
  const [scope, api] = await Promise.all([staysScope(), currentApi()]);
  if (!scope) return { ok: false, error: "This business lets no rooms." };
  try {
    const value = await api.put<RatesCalendar>(path, body, { workspaceId: scope.workspace.workspaceId });
    revalidatePath("/rates/calendar");
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError) return { ok: false, error: "Injishi did not answer. Try again." };
    throw error;
  }
}

export async function saveRatesDays(input: unknown): Promise<RatesResult> {
  const parsed = RatesDaysUpdate.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the days and the price." };
  return send("/api/v1/ops/rates/days", parsed.data);
}

export async function saveRatesTerms(input: unknown): Promise<RatesResult> {
  const parsed = RatesTermsUpdate.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the price and the stays." };
  return send("/api/v1/ops/rates/terms", parsed.data);
}
