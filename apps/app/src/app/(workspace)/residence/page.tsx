import { screens } from "@injishi/data";
import type {
  ArrearsBucket,
  HomeKpi,
  HomeTicket,
  LeaseFiling,
  RenewalNotice,
  RentBucket,
  ResidenceBlock,
  ResidenceUnit,
  ServiceTicket,
  Vacancy,
} from "@injishi/data/fixtures/residence";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { ResidenceHomeView } from "@/features/residence/ResidenceHomeView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.ResidenceHome.pageTitle };

export default async function ResidenceHomePage() {
  const persona = await requirePersona("ResidenceHome");
  const [kpis, rent, aging, vacancies, blocks, units, renewals, homeTickets, tickets, filings] = await Promise.all([
    getCollection<HomeKpi>("residence.homeKpis"),
    getCollection<RentBucket>("residence.rentBuckets"),
    getCollection<ArrearsBucket>("residence.arrearsAging"),
    getCollection<Vacancy>("residence.vacancies"),
    getCollection<ResidenceBlock>("residence.blocks"),
    getCollection<ResidenceUnit>("residence.units"),
    getCollection<RenewalNotice>("residence.renewals"),
    getCollection<HomeTicket>("residence.homeTickets"),
    getCollection<ServiceTicket>("residence.tickets"),
    getCollection<LeaseFiling>("residence.filings"),
  ]);
  return (
    <ResidenceHomeView
      persona={persona}
      data={{ kpis, rent, aging, vacancies, blocks, units, renewals, homeTickets, tickets, filings }}
    />
  );
}
