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
import { redirect } from "next/navigation";
import { OwnerHomeView, type SetupDue } from "@/features/platform/OwnerHomeView";
import { StayHomeView } from "@/features/pms/stays/StayHomeView";
import { currentAccount, requirePersona } from "@/lib/session";
import { setupPath } from "@/lib/setup-path";
import { ApiError } from "@/server/api";
import { getCollection, requestContext } from "@/server/data";
import { readSetup } from "@/server/mutations/setup";
import { posOutlets } from "@/server/pos";
import { holdsSampleData } from "@/server/sample-data";
import { NoWorkspaceError } from "@/server/sources/types";
import { staysActivity, staysSummary } from "@/server/stays/client";

/** Whether this person's workspace has a bar or restaurant outlet to sell from. A failed read counts as no. */
async function hasPosOutlets(): Promise<boolean> {
  try {
    return (await posOutlets(await requestContext())).length > 0;
  } catch {
    return false;
  }
}

/**
 * Whether this person's business registered as a Bar & Restaurant. A business that did has no front desk to set up:
 * its first job is its first outlet, so the owner is sent to the venue setup rather than a hotel home.
 */
async function isBarRestaurant(): Promise<boolean> {
  try {
    // The same workspace the point of sale uses, so the home and the POS can never disagree about which business this is.
    const ops = (await requestContext()).ops();
    const { properties } = await ops.get<{ properties: { id: string }[] }>("/api/v1/inventory/properties");
    const progress = await ops.get<{ businessKind?: string | null }>("/api/v1/inventory/setup", {
      query: { propertyId: properties[0]?.id },
    });
    return progress.businessKind === "bar_restaurant";
  } catch (error) {
    // No hospitality business, or one the person may not read yet (not approved), is an ordinary "no": not worth a log line.
    if (!(error instanceof ApiError) && !(error instanceof NoWorkspaceError)) {
      console.error("owner home: could not tell what kind of business this is", error);
    }
    return false;
  }
}

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
  // A stay business (guest house, lodge, hotel, apartments) gets its own home, all from the API.
  const stays = await staysSummary();
  // A business with no rooms but a bar or restaurant outlet is run from the point of sale, not a front desk.
  if (stays && stays.business.rooms === 0 && (await hasPosOutlets())) redirect("/pos/dashboard");
  // A business that registered as a Bar & Restaurant has no front desk and no rooms, and until it has an outlet no
  // stay summary either. Its home is the point of sale: the dashboard once it has an outlet, otherwise the first step,
  // creating one. Every other kind of business falls through to its own home, untouched.
  if ((!stays || stays.business.rooms === 0) && (await isBarRestaurant())) {
    redirect((await hasPosOutlets()) ? "/pos/dashboard" : "/pos/setup");
  }
  if (stays) {
    const [account, activity, due] = await Promise.all([currentAccount(), staysActivity(), setupDue()]);
    const mine = due[0] ?? null;
    return (
      <StayHomeView
        firstName={(account?.user.name ?? "").trim().split(/\s+/)[0] ?? ""}
        summary={stays}
        activity={activity}
        setup={mine ? { href: mine.href, notApproved: mine.notApproved } : null}
      />
    );
  }
  // Decisions and insights have no live source yet, so they come from the fixture store: the demo's pay run,
  // refund and rate change. Only the demo's own people see them; a real owner is shown none (2026-10-30).
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
      sample={sample}
    />
  );
}
