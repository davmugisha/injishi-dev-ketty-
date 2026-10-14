import { screens } from "@injishi/data";
import type {
  ComplianceEvent,
  OwnerDecision,
  OwnerInsight,
  OwnerKpi,
  OwnerProperty,
  RevenueDay,
} from "@injishi/data/fixtures/platform";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { OwnerHomeView } from "@/features/platform/OwnerHomeView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.OwnerHome.pageTitle };

export default async function OwnerHomePage() {
  const persona = await requirePersona("OwnerHome");
  const [kpis, decisions, revenueDays, properties, insights, compliance] = await Promise.all([
    getCollection<OwnerKpi>("platform.ownerKpis"),
    getCollection<OwnerDecision>("platform.ownerDecisions"),
    getCollection<RevenueDay>("platform.revenueDays"),
    getCollection<OwnerProperty>("platform.ownerProperties"),
    getCollection<OwnerInsight>("platform.ownerInsights"),
    getCollection<ComplianceEvent>("platform.ownerCompliance"),
  ]);
  return <OwnerHomeView persona={persona} data={{ kpis, decisions, revenueDays, properties, insights, compliance }} />;
}
