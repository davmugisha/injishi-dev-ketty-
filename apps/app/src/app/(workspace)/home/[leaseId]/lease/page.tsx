import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantLeaseView } from "@/features/tenant/TenantLeaseView";
import { requirePersona } from "@/lib/session";
import { isLeaseId, mineOrNull, tenancyContract, tenancyDetail, tenancyEvents } from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.TenantLease.pageTitle };

/** The tenant's lease; `?sign=1` (from the invitation) opens the signing panel while it waits for them. */
export default async function TenancyLeasePage({
  params,
  searchParams,
}: {
  params: Promise<{ leaseId: string }>;
  searchParams: Promise<{ sign?: string }>;
}) {
  await requirePersona("TenantLease");
  const { leaseId } = await params;
  if (!isLeaseId(leaseId)) notFound();
  const tenancy = await mineOrNull(tenancyDetail(leaseId));
  if (!tenancy) notFound();
  const [contract, events, { sign }] = await Promise.all([
    mineOrNull(tenancyContract(leaseId)),
    mineOrNull(tenancyEvents(leaseId)),
    searchParams,
  ]);
  return (
    <TenantLeaseView tenancy={tenancy} contract={contract} events={events?.events ?? []} openSign={sign === "1"} />
  );
}

export const dynamic = "force-dynamic";
