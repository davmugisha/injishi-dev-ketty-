import { kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantFaultsView } from "@/features/faults/TenantFaultsView";
import { requirePersona } from "@/lib/session";
import { tenantFaults } from "@/server/tenant/faults";
import { isLeaseId, mineOrNull, tenancyDetail } from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.TenantFaults.pageTitle };

/** The tenant's faults on one home: the list, Report a fault, and `?fault=` opens one. */
export default async function TenancyFaultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ leaseId: string }>;
  searchParams: Promise<{ fault?: string }>;
}) {
  await requirePersona("TenantFaults");
  const { leaseId } = await params;
  if (!isLeaseId(leaseId)) notFound();
  const [tenancy, faults, query] = await Promise.all([
    mineOrNull(tenancyDetail(leaseId)),
    mineOrNull(tenantFaults(leaseId)),
    searchParams,
  ]);
  if (!tenancy || !faults) notFound();
  return (
    <TenantFaultsView
      tenancy={tenancy}
      items={faults.items}
      today={kigaliToday()}
      openId={isLeaseId(query.fault) ? query.fault : null}
    />
  );
}

export const dynamic = "force-dynamic";
