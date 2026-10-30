import { screens } from "@injishi/data";
import type {
  MandateExclusion,
  MandateFact,
  MandateRule,
  MandateState,
  MandateStateId,
  OfficerDecision,
  QueueCase,
  QueueId,
  QueueKpi,
} from "@injishi/data/fixtures/oversight";
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

const MANDATES: readonly MandateStateId[] = ["verified", "expiring", "suspended"];

const ROLE_LABEL: Record<string, string> = {
  business_field_verifier: "Verify businesses in the field",
  business_approver: "Approve or reject verified businesses",
  tax_compliance_officer: "View and flag tax compliance",
  psf_membership_officer: "Decide PSF membership, and review registrations in one step",
};

/** "Friday 23 October 2026", the day in Kigali. */
function longDay(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
}

/**
 * Officer queues, read from the registry as this officer: the businesses waiting on their field visit or their
 * approval, inside the region their assignment covers. `?mandate=` still shows each state of the mandate.
 */
export default async function OfficerHomePage({ searchParams }: { searchParams: Promise<{ mandate?: string }> }) {
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

  const [states, facts, exclusions, kpis, cases, decisions, rules] = await Promise.all([
    getCollection<MandateState>("oversight.mandateStates"),
    getCollection<MandateFact>("oversight.mandateFacts"),
    getCollection<MandateExclusion>("oversight.mandateExclusions"),
    getCollection<QueueKpi>("oversight.queueKpis"),
    getCollection<QueueCase>("oversight.cases"),
    getCollection<OfficerDecision>("oversight.recentDecisions"),
    getCollection<MandateRule>("oversight.mandateRules"),
  ]);
  const { mandate } = await searchParams;
  const id = MANDATES.find((m) => m === mandate) ?? "verified";
  const state = states.find((s) => s.id === id) ?? states[0];
  const granted = [...new Set(desk.consoles.map((c) => ROLE_LABEL[c.oversightRole] ?? c.oversightRole))];
  const held: QueueId[] = [];
  if (desk.verification || desk.review) held.push("verification");
  if (desk.approval) held.push("approval");
  const institution = desk.consoles[0]?.bodyName ?? persona.org;
  const scope = [...new Set(desk.consoles.map((c) => c.scopeLabel))].join(", ") || "no jurisdiction";
  const first = cases.find((c) => c.href && c.action === "open") ?? cases.find((c) => c.href);
  return (
    <OfficerHomeView
      key={id}
      persona={persona}
      state={state}
      data={{
        facts,
        granted,
        exclusions,
        kpis,
        cases,
        decisions,
        rules,
        institution,
        scope,
        today: longDay(ctx.now),
        held,
        firstCaseHref: first?.href ?? null,
      }}
    />
  );
}
