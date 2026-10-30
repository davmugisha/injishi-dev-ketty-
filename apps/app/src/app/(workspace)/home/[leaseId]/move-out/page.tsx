import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantMoveOutView } from "@/features/move-outs/TenantMoveOutView";
import { requirePersona } from "@/lib/session";
import { tenancyMoveOut } from "@/server/tenant/move-out";
import { isLeaseId, mineOrNull, tenancyDetail } from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.TenantMoveOut.pageTitle };

/** The tenant's Moving out on one home: notice, where it stands, the deposit. */
export default async function TenancyMoveOutPage({ params }: { params: Promise<{ leaseId: string }> }) {
  await requirePersona("TenantMoveOut");
  const { leaseId } = await params;
  if (!isLeaseId(leaseId)) notFound();
  const [tenancy, view] = await Promise.all([mineOrNull(tenancyDetail(leaseId)), mineOrNull(tenancyMoveOut(leaseId))]);
  if (!tenancy || !view) notFound();
  return <TenantMoveOutView tenancy={tenancy} view={view} />;
}

export const dynamic = "force-dynamic";
