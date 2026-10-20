import { screens } from "@injishi/data";
import type { PayNetwork, RentCharge, Tenancy } from "@injishi/data/fixtures/resident";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type PayState, TenantPayView } from "@/features/resident/TenantPayView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.TenantPay.pageTitle };

function payState(value: string | undefined): PayState {
  if (value === "verified" || value === "unknown" || value === "pending") return value;
  return "pending";
}

/**
 * Opens on the tenant's own rent charge for this month, whatever the month is. It no longer reads the sample
 * payment intent (resident.paymentIntents): matching that sample's "2026-10" to the live charge made the page
 * a 404 from November, and its phone number and part amount were a stranger's. A tenant with nothing due this
 * month sees that, not a 404.
 */
export default async function TenantPayPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const persona = await requirePersona("TenantPay");
  const { state } = await searchParams;
  const [tenancies, charges, networks] = await Promise.all([
    getCollection<Tenancy>("resident.tenancies"),
    getCollection<RentCharge>("resident.rentCharges"),
    getCollection<PayNetwork>("resident.payNetworks"),
  ]);
  const tenancy = tenancies.find((t) => t.persona === persona.id) ?? tenancies[0];
  if (!tenancy || !networks.length) notFound();
  const charge = charges.find((c) => c.lease === tenancy.id) ?? null;
  return <TenantPayView tenancy={tenancy} charge={charge} networks={networks} state={payState(state)} />;
}
