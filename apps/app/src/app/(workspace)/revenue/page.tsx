import { screens } from "@injishi/data";
import type {
  RevenueEvent,
  RevenueForecast,
  RevenueNight,
  RevenuePaceWeek,
  RevenueRecommendation,
  RevenueScenario,
} from "@injishi/data/fixtures/commercial";
import type { Metadata } from "next";
import { RevenueView } from "@/features/commercial/RevenueView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Revenue.pageTitle };

export default async function RevenuePage() {
  await requirePersona("Revenue");
  const [scenarios, nights, forecasts, events, paceWeeks, recommendations] = await Promise.all([
    getCollection<RevenueScenario>("commercial.revenueScenarios"),
    getCollection<RevenueNight>("commercial.revenueNights"),
    getCollection<RevenueForecast>("commercial.revenueForecasts"),
    getCollection<RevenueEvent>("commercial.revenueEvents"),
    getCollection<RevenuePaceWeek>("commercial.revenuePaceWeeks"),
    getCollection<RevenueRecommendation>("commercial.revenueRecommendations"),
  ]);
  return <RevenueView data={{ scenarios, nights, forecasts, events, paceWeeks, recommendations }} />;
}
