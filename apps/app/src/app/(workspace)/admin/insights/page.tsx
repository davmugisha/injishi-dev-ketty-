import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { InsightsView } from "@/features/admin/health/HealthViews";
import { Refused } from "@/features/admin/people/Refused";
import { requirePersona } from "@/lib/session";
import { analytics } from "@/server/admin/health";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminInsights.pageTitle };

/** Insights (2026-11-09, real records): the platform's headline figures from the admin API. */
export default async function AdminInsightsPage() {
  await requirePersona("AdminInsights");
  try {
    return <InsightsView data={await analytics()} />;
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) return <Refused code={error.code} />;
    throw error;
  }
}

export const dynamic = "force-dynamic";
