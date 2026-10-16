import { screens } from "@injishi/data";
import type {
  BrokerDispute,
  BrokerEarning,
  BrokerKpi,
  BrokerLead,
  BrokerRegistration,
  Placement,
} from "@injishi/data/fixtures/public";
import type { Metadata } from "next";
import { BrokerWorkView } from "@/features/public/BrokerWorkView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.BrokerWork.pageTitle };

export default async function BrokerWorkPage() {
  const persona = await requirePersona("BrokerWork");
  const [registrations, kpis, placements, leads, earnings, disputes] = await Promise.all([
    getCollection<BrokerRegistration>("public.brokerRegistrations"),
    getCollection<BrokerKpi>("public.brokerKpis"),
    getCollection<Placement>("public.placements"),
    getCollection<BrokerLead>("public.brokerLeads"),
    getCollection<BrokerEarning>("public.brokerEarnings"),
    getCollection<BrokerDispute>("public.brokerDisputes"),
  ]);
  return <BrokerWorkView persona={persona} data={{ registrations, kpis, placements, leads, earnings, disputes }} />;
}
