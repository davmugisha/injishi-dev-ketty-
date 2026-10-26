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

/** Today in Kigali as the page heads it, and the greeting for the hour there. */
function kigaliToday(now: Date): { label: string; greeting: string } {
  const label = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Kigali",
  });
  const hour = Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Kigali" }));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return { label: label.replace(",", ""), greeting };
}

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
  return (
    <BrokerWorkView
      persona={persona}
      data={{ registrations, kpis, placements, leads, earnings, disputes }}
      today={kigaliToday(new Date())}
    />
  );
}
