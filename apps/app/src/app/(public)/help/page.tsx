import { screens } from "@injishi/data";
import type {
  DataProcessor,
  HelpGuide,
  IncidentUpdate,
  PolicyDoc,
  ServiceStatus,
  SupportBusiness,
} from "@injishi/data/fixtures/public";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { demoLinks, visitorOf } from "@/features/public/links";
import { PublicHelpView } from "@/features/public/PublicHelpView";
import { requireScreen } from "@/lib/session";

export const metadata: Metadata = { title: screens.PublicHelp.pageTitle };

export default async function PublicHelpPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const persona = await requireScreen("PublicHelp");
  const [guides, services, incident, policies, processors, businesses] = await Promise.all([
    getCollection<HelpGuide>("public.helpGuides"),
    getCollection<ServiceStatus>("public.serviceStatus"),
    getCollection<IncidentUpdate>("public.incidentUpdates"),
    getCollection<PolicyDoc>("public.policies"),
    getCollection<DataProcessor>("public.processors"),
    getCollection<SupportBusiness>("public.supportBusinesses"),
  ]);
  const { doc } = await searchParams;
  return (
    <PublicHelpView
      visitor={visitorOf(persona)}
      links={demoLinks(persona, ["Assistant", "Account", ...guides.map((g) => g.board)])}
      initialDoc={policies.find((p) => p.id === doc)?.id ?? "privacy"}
      data={{ guides, services, incident, policies, processors, businesses }}
    />
  );
}
