import { screens } from "@injishi/data";
import type { OfficerDecision, QueueCase, QueueId, QueueKpi } from "@injishi/data/fixtures/oversight";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OfficerHomeView } from "@/features/oversight/OfficerHomeView";
import { PsfRegistrationsView } from "@/features/oversight/PsfRegistrationsView";
import { currentAccount, requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { leaderOnly, officerConsoles } from "@/server/oversight/nav";
import { readDesk } from "@/server/sources/oversight";

/** A PSF District Manager knows this page as Business approvals; other officers as their queues. */
export async function generateMetadata(): Promise<Metadata> {
  const account = await currentAccount();
  return { title: account?.persona.id === "psf" ? "PSF · Business approvals" : screens.OfficerHome.pageTitle };
}

/**
 * Officer queues, read from the registry as this officer: the businesses waiting on their field visit or their
 * approval, inside the region their assignment covers.
 */
export default async function OfficerHomePage() {
  const persona = await requirePersona("OfficerHome");
  // A local leader reviews no business: their home is the guests in their area (P5).
  if (leaderOnly(await officerConsoles())) redirect("/officer/guests");
  const ctx = await requestContext();
  const desk = await readDesk(ctx);
  // A PSF District Manager reviews registrations here too: their review is one step (0119). Holding only
  // that, they get their own focused page; one who also reviews documents or approves keeps the full desk.
  if (persona.id === "psf" && desk.review && !desk.verification && !desk.approval) {
    const [kpis, cases, decisions] = await Promise.all([
      getCollection<QueueKpi>("oversight.queueKpis"),
      getCollection<QueueCase>("oversight.cases"),
      getCollection<OfficerDecision>("oversight.recentDecisions"),
    ]);
    const psf = desk.consoles.filter((c) => c.oversightRole === "psf_membership_officer");
    return (
      <PsfRegistrationsView
        scope={[...new Set(psf.map((c) => c.scopeLabel))].join(", ") || "your district"}
        title={psf[0]?.title ?? "PSF District Manager"}
        cases={cases}
        kpis={kpis}
        decisions={decisions}
      />
    );
  }
  const cases = await getCollection<QueueCase>("oversight.cases");
  const held: QueueId[] = [];
  if (desk.verification || desk.review) held.push("verification");
  if (desk.approval) held.push("approval");
  const first = cases.find((c) => c.href && c.action === "open") ?? null;
  return <OfficerHomeView cases={cases} held={held} firstCaseHref={first?.href ?? null} />;
}

export const dynamic = "force-dynamic";
