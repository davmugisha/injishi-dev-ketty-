import { screens } from "@injishi/data";
import type { AcceptedRenewal, Lease, LeaseClause, ResidenceUnit } from "@injishi/data/fixtures/residence";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { LeasesView } from "@/features/residence/LeasesView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.Leases.pageTitle };

export default async function LeasesPage() {
  const persona = await requirePersona("Leases");
  const [leases, clauses, accepted, units] = await Promise.all([
    getCollection<Lease>("residence.leases"),
    getCollection<LeaseClause>("residence.leaseClauses"),
    getCollection<AcceptedRenewal>("residence.acceptedRenewals"),
    getCollection<ResidenceUnit>("residence.units"),
  ]);
  return <LeasesView persona={persona} data={{ leases, clauses, accepted, units }} />;
}
