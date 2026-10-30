"use server";

import { screenHref } from "@injishi/data";
import type { RatesInventoryRatePlan } from "@injishi/data/fixtures/commercial";
import { getDocument, updateDocument } from "@injishi/db";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";

const PLANS = "commercial.ratesInventoryRatePlans";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "10:52" in hotel time (Kigali). */
function hotelTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Kigali",
  }).format(date);
}

/**
 * Schedule a rate plan's draft version (or send it to the owner when the plan's rates are negotiated).
 * Requires an audit note; saved with the manager's name and time. Current rates stay in force until then.
 */
export async function scheduleRatesInventoryChange(
  planId: string,
  draft: { note: string; from: string; to: string | null },
): Promise<void> {
  const persona = await requirePersona("RatesInventory");
  const note = draft.note.trim();
  if (!note || !ISO_DATE.test(draft.from) || (draft.to !== null && !ISO_DATE.test(draft.to))) return;
  const plan = await getDocument<RatesInventoryRatePlan>(PLANS, planId);
  if (!plan || plan.pendingChange) return;
  await updateDocument<RatesInventoryRatePlan>(PLANS, planId, {
    draftNote: draft.note,
    draftFrom: draft.from,
    draftTo: draft.to,
    pendingChange: { note, from: draft.from, to: draft.to, by: persona.name, at: hotelTime(new Date()) },
  });
  revalidatePath(screenHref("RatesInventory"));
}

/** Discard the draft: withdraw a scheduled change and clear the audit note. */
export async function discardRatesInventoryChange(planId: string): Promise<void> {
  await requirePersona("RatesInventory");
  await updateDocument<RatesInventoryRatePlan>(PLANS, planId, { draftNote: "", pendingChange: null });
  revalidatePath(screenHref("RatesInventory"));
}
