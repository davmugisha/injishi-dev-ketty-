import { kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantRentView } from "@/features/tenant/TenantRentView";
import { requirePersona } from "@/lib/session";
import { isLeaseId, mineOrNull, tenancyCharges, tenancyDetail, tenancyPayments } from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.TenantRent.pageTitle };

/** The tenant's rent: charges, payments with receipts, and Pay. */
export default async function TenancyRentPage({ params }: { params: Promise<{ leaseId: string }> }) {
  await requirePersona("TenantRent");
  const { leaseId } = await params;
  if (!isLeaseId(leaseId)) notFound();
  const [tenancy, charges, payments] = await Promise.all([
    mineOrNull(tenancyDetail(leaseId)),
    mineOrNull(tenancyCharges(leaseId)),
    mineOrNull(tenancyPayments(leaseId)),
  ]);
  if (!tenancy || !charges) notFound();
  return (
    <TenantRentView tenancy={tenancy} charges={charges} payments={payments?.payments ?? []} today={kigaliToday()} />
  );
}

export const dynamic = "force-dynamic";
