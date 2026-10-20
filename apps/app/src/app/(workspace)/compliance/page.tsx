import { screens } from "@injishi/data";
import type {
  ComplianceAccess,
  ComplianceDataRequest,
  ComplianceKpi,
  ComplianceLicence,
  ComplianceMembership,
  ComplianceReportingGate,
  ComplianceSubmission,
} from "@injishi/data/fixtures/owner";
import type { Metadata } from "next";
import { ComplianceView } from "@/features/owner/ComplianceView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Compliance.pageTitle };

export default async function CompliancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePersona("Compliance");
  const [kpis, submissions, licences, memberships, gates, access, requests] = await Promise.all([
    getCollection<ComplianceKpi>("owner.complianceKpis"),
    getCollection<ComplianceSubmission>("owner.complianceSubmissions"),
    getCollection<ComplianceLicence>("owner.complianceLicences"),
    getCollection<ComplianceMembership>("owner.complianceMemberships"),
    getCollection<ComplianceReportingGate>("owner.complianceReportingGates"),
    getCollection<ComplianceAccess>("owner.complianceAccessLog"),
    getCollection<ComplianceDataRequest>("owner.complianceDataRequests"),
  ]);
  const { tab } = await searchParams;
  return (
    <ComplianceView
      initialTab={tab === "privacy" ? "privacy" : "licences"}
      data={{ kpis, submissions, licences, memberships, gates, access, requests }}
    />
  );
}
