import { screens } from "@injishi/data";
import type { AcceptedRenewal, LeaseClause, ResidenceUnit } from "@injishi/data/fixtures/residence";
import type { Metadata } from "next";
import { LeasesView } from "@/features/residence/LeasesView";
import { ResidenceNothingYet } from "@/features/residence/NothingYet";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { type LiveLease, residenceBuilding } from "@/server/sources/residence";

export const metadata: Metadata = { title: screens.Leases.pageTitle };

export default async function LeasesPage() {
  const persona = await requirePersona("Leases");
  const [leases, clauses, accepted, units] = await Promise.all([
    getCollection<LiveLease>("residence.leases"),
    getCollection<LeaseClause>("residence.leaseClauses"),
    getCollection<AcceptedRenewal>("residence.acceptedRenewals"),
    getCollection<ResidenceUnit>("residence.units"),
  ]);
  const building = residenceBuilding(await requestContext());
  if (!leases.length)
    return (
      <ResidenceNothingYet title="Leases" building={building} message="No lease is on file for this business yet." />
    );
  return <LeasesView persona={persona} data={{ leases, clauses, accepted, units }} building={building} />;
}
