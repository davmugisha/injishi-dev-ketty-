import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantChargesView } from "@/features/tenant/TenantRentView";
import { requirePersona } from "@/lib/session";
import { isLeaseId, mineOrNull, tenancyCharges, tenancyDetail } from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.TenantCharges.pageTitle };

/** Rent > Charges: every rent and deposit charge, and Pay. */
export default async function TenancyChargesPage({ params }: { params: Promise<{ leaseId: string }> }) {
  await requirePersona("TenantCharges");
  const { leaseId } = await params;
  if (!isLeaseId(leaseId)) notFound();
  const [tenancy, charges] = await Promise.all([
    mineOrNull(tenancyDetail(leaseId)),
    mineOrNull(tenancyCharges(leaseId)),
  ]);
  if (!tenancy || !charges) notFound();
  return <TenantChargesView tenancy={tenancy} charges={charges} />;
}

export const dynamic = "force-dynamic";
