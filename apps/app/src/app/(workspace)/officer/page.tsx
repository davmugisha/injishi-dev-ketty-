import { screens } from "@injishi/data";
import type {
  DistrictOfficer,
  MandateExclusion,
  MandateFact,
  MandateRule,
  MandateState,
  MandateStateId,
  OfficerDecision,
  OfficerPermission,
  QueueCase,
  QueueKpi,
} from "@injishi/data/fixtures/oversight";
import type { Metadata } from "next";
import { OfficerHomeView } from "@/features/oversight/OfficerHomeView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.OfficerHome.pageTitle };

const MANDATES: readonly MandateStateId[] = ["verified", "expiring", "suspended"];

/** Officer queues. `?mandate=verified|expiring|suspended` shows each state of the mandate (default verified). */
export default async function OfficerHomePage({ searchParams }: { searchParams: Promise<{ mandate?: string }> }) {
  const persona = await requirePersona("OfficerHome");
  const [states, facts, exclusions, officers, permissions, kpis, cases, decisions, rules] = await Promise.all([
    getCollection<MandateState>("oversight.mandateStates"),
    getCollection<MandateFact>("oversight.mandateFacts"),
    getCollection<MandateExclusion>("oversight.mandateExclusions"),
    getCollection<DistrictOfficer>("oversight.officers"),
    getCollection<OfficerPermission>("oversight.permissions"),
    getCollection<QueueKpi>("oversight.queueKpis"),
    getCollection<QueueCase>("oversight.cases"),
    getCollection<OfficerDecision>("oversight.recentDecisions"),
    getCollection<MandateRule>("oversight.mandateRules"),
  ]);
  const { mandate } = await searchParams;
  const id = MANDATES.find((m) => m === mandate) ?? "verified";
  const state = states.find((s) => s.id === id) ?? states[0];
  // What is delegated to the signed-in officer is their own assignment, as District administration records it.
  const self = officers.find((o) => o.isSelf);
  const granted = (self?.permissions ?? [])
    .map((p) => permissions.find((x) => x.id === p)?.label)
    .filter((label): label is string => !!label);
  return (
    <OfficerHomeView
      key={id}
      persona={persona}
      state={state}
      data={{ facts, granted, exclusions, kpis, cases, decisions, rules }}
    />
  );
}
