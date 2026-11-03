import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantPaymentsView } from "@/features/tenant/TenantRentView";
import { requirePersona } from "@/lib/session";
import { isLeaseId, mineOrNull, tenancyCharges, tenancyDetail, tenancyPayments } from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.TenantRent.pageTitle };

/** Rent > Payments: every payment with its receipt, and Pay. */
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
  return <TenantPaymentsView tenancy={tenancy} charges={charges} payments={payments?.payments ?? []} />;
}

export const dynamic = "force-dynamic";
