import { screens } from "@injishi/data";
import type {
  ComplianceEvent,
  OwnerDecision,
  OwnerInsight,
  OwnerKpi,
  OwnerProperty,
  RevenueDay,
} from "@injishi/data/fixtures/platform";
import type { Metadata } from "next";
import { OwnerHomeView, type SetupDue } from "@/features/platform/OwnerHomeView";
import { currentAccount, requirePersona } from "@/lib/session";
import { setupPath } from "@/lib/setup-path";
import { getCollection, requestContext } from "@/server/data";
import { readSetup } from "@/server/mutations/setup";
import { holdsSampleData } from "@/server/sample-data";

/**
 * The owner's businesses that are not on the marketplace yet, read the way the setup page reads them, so
 * the home says the same thing the setup page will. A business whose read fails is left out rather than
 * taking the whole home down with it.
 */
async function setupDue(): Promise<SetupDue[]> {
  const account = await currentAccount();
  const ctx = await requestContext();
  const businesses = (account?.workspaces ?? []).filter(
    (w) => w.kind === "business" && (w.registrationStatus !== "active" || w.permissions.includes("listing.manage")),
  );
  const due = await Promise.all(
    businesses.map(async (w): Promise<SetupDue | null> => {
      try {
        const setup = await readSetup(ctx, w.workspaceId);
        if (setup.open && setup.published) return null;
        return {
          workspaceId: w.workspaceId,
          businessName: setup.businessName,
          notApproved: !setup.open,
          inReview: setup.open && !setup.approved,
          // What is still missing besides approval, in the setup page's own words.
          missing: setup.open ? setup.blockers.filter((b) => !/approved/i.test(b)) : [],
          href: setupPath(w.workspaceId),
        };
      } catch {
        return null;
      }
    }),
  );
  return due.filter((d): d is SetupDue => d !== null);
}

export const metadata: Metadata = { title: screens.OwnerHome.pageTitle };

export default async function OwnerHomePage() {
  const persona = await requirePersona("OwnerHome");
  // Decisions and insights have no live source yet, so they come from the fixture store: the demo's pay run,
  // refund and rate change. A real owner is shown none rather than a stranger's.
  const sample = await holdsSampleData();
  const [kpis, decisions, revenueDays, properties, insights, compliance, due] = await Promise.all([
    getCollection<OwnerKpi>("platform.ownerKpis"),
    sample ? getCollection<OwnerDecision>("platform.ownerDecisions") : [],
    getCollection<RevenueDay>("platform.revenueDays"),
    getCollection<OwnerProperty>("platform.ownerProperties"),
    sample ? getCollection<OwnerInsight>("platform.ownerInsights") : [],
    getCollection<ComplianceEvent>("platform.ownerCompliance"),
    setupDue(),
  ]);
  return (
    <OwnerHomeView
      persona={persona}
      data={{ kpis, decisions, revenueDays, properties, insights, compliance }}
      setupDue={due}
    />
  );
}
