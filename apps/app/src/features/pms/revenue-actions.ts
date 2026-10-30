"use server";

import { screenHref } from "@injishi/data";
import type { RevenueRecommendation } from "@injishi/data/fixtures/commercial";
import { getDocument, updateDocument } from "@injishi/db";
import { REVENUE_OVERRIDE_REASONS } from "@injishi/product-pms";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";

interface RevenueSendItem {
  id: string;
  /** Present when the manager overrode the recommended rate. */
  override?: { rate: number; reason: string; note: string };
}

/**
 * "Send to owner for approval": accepted and overridden rate recommendations wait for the owner.
 * No rate changes here — the owner approves before anything is published (persisted in the embedded DB).
 */
export async function sendRevenueChanges(items: RevenueSendItem[]): Promise<void> {
  await requirePersona("Revenue");
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Kigali",
  }).format(new Date());
  for (const item of items.slice(0, 20)) {
    if (typeof item?.id !== "string") continue;
    const rec = await getDocument<RevenueRecommendation>("commercial.revenueRecommendations", item.id);
    if (!rec || rec.scenario !== null || rec.status === "pending") continue;
    const o = item.override;
    const override =
      o && Number.isFinite(o.rate) && o.rate > 0 && REVENUE_OVERRIDE_REASONS.includes(o.reason)
        ? { rate: Math.round(o.rate), reason: o.reason, note: String(o.note ?? "").slice(0, 500) }
        : undefined;
    const rate = override
      ? new Intl.NumberFormat("en-KE", { style: "currency", currency: "RWF" }).format(override.rate)
      : "";
    await updateDocument<RevenueRecommendation>("commercial.revenueRecommendations", rec.id, {
      status: "pending",
      sentNote: override ? `Override ${rate} · sent ${time}` : `Sent ${time}`,
      ...(override ? { override } : {}),
    });
  }
  revalidatePath(screenHref("Revenue"));
}
