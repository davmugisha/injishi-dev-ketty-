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
import type { Metadata } from "next";
import { ResidenceNothingYet } from "@/features/residence/NothingYet";
import { ResidenceHomeView } from "@/features/residence/ResidenceHomeView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { type LiveLease, residenceBuilding } from "@/server/sources/residence";

export const metadata: Metadata = { title: screens.ResidenceHome.pageTitle };

export default async function ResidenceHomePage() {
  const persona = await requirePersona("ResidenceHome");
  const [kpis, rent, aging, vacancies, blocks, units, renewals, homeTickets, tickets, filings, leases] =
    await Promise.all([
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
      getCollection<LiveLease>("residence.leases"),
    ]);
  const building = residenceBuilding(await requestContext());
  if (!units.length)
    return (
      <ResidenceNothingYet
        title="Residences"
        building={building}
        message="No units are set up for this business yet."
      />
    );
  return (
    <ResidenceHomeView
      persona={persona}
      data={{ kpis, rent, aging, vacancies, blocks, units, renewals, homeTickets, tickets, filings, leases }}
      building={building}
    />
  );
}
