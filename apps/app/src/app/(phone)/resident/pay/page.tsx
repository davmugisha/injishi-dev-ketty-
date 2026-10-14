import { screens } from "@injishi/data";
import type { PaymentIntent, PayNetwork, RentCharge, Tenancy } from "@injishi/data/fixtures/resident";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type PayState, TenantPayView } from "@/features/resident/TenantPayView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.TenantPay.pageTitle };

function payState(value: string | undefined): PayState {
  if (value === "verified" || value === "unknown" || value === "pending") return value;
  return "pending";
}

export default async function TenantPayPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const persona = await requirePersona("TenantPay");
  const { state } = await searchParams;
  const [tenancies, charges, intents, networks] = await Promise.all([
    getCollection<Tenancy>("resident.tenancies"),
    getCollection<RentCharge>("resident.rentCharges"),
    getCollection<PaymentIntent>("resident.paymentIntents"),
    getCollection<PayNetwork>("resident.payNetworks"),
  ]);
  const tenancy = tenancies.find((t) => t.persona === persona.id) ?? tenancies[0];
  const charge = tenancy ? charges.find((c) => c.lease === tenancy.id) : undefined;
  const intent = charge ? intents.find((i) => i.charge === charge.id) : undefined;
  if (!tenancy || !charge || !intent || !networks.length) notFound();
  return (
    <TenantPayView tenancy={tenancy} charge={charge} intent={intent} networks={networks} state={payState(state)} />
  );
}
