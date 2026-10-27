import { kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantOverviewView } from "@/features/tenant/TenantOverviewView";
import { requirePersona } from "@/lib/session";
import { isLeaseId, mineOrNull, tenancyCharges, tenancyDetail, tenancyPayments } from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.TenantLeaseHome.pageTitle };

/** One home's overview: what is owed with Pay (`?pay=1` opens it), the lease, the landlord. */
export default async function TenancyHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ leaseId: string }>;
  searchParams: Promise<{ pay?: string }>;
}) {
  await requirePersona("TenantLeaseHome");
  const { leaseId } = await params;
  if (!isLeaseId(leaseId)) notFound();
  const tenancy = await mineOrNull(tenancyDetail(leaseId));
  if (!tenancy) notFound();
  const [charges, payments, { pay }] = await Promise.all([
    mineOrNull(tenancyCharges(leaseId)),
    mineOrNull(tenancyPayments(leaseId)),
    searchParams,
  ]);
  return (
    <TenantOverviewView
      tenancy={tenancy}
      charges={charges}
      payments={payments?.payments ?? []}
      firstName={tenancy.tenant.fullName.trim().split(/\s+/)[0] ?? ""}
      today={kigaliToday()}
      openPay={pay === "1"}
    />
  );
}

export const dynamic = "force-dynamic";
