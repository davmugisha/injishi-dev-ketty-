import { screens } from "@injishi/data";
import type { CaptureEvent, FunnelStep, InsightArea, NorthStarStep } from "@injishi/data/fixtures/platformops";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { AdminInsightsView } from "@/features/platformops/AdminInsightsView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.AdminInsights.pageTitle };

export default async function AdminInsightsPage() {
  await requirePersona("AdminInsights");
  const [areas, steps, funnel, events] = await Promise.all([
    getCollection<InsightArea>("platformops.insightAreas"),
    getCollection<NorthStarStep>("platformops.northStarSteps"),
    getCollection<FunnelStep>("platformops.funnel"),
    getCollection<CaptureEvent>("platformops.captureEvents"),
  ]);
  return <AdminInsightsView data={{ areas, steps, funnel, events }} />;
}
