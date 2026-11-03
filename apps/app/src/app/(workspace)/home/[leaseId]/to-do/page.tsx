import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantTodoView } from "@/features/tenant/TenantTodoView";
import { requirePersona } from "@/lib/session";
import { isLeaseId, mineOrNull, tenancyCharges, tenancyDetail } from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.TenantTodo.pageTitle };

/** What waits for the tenant on this home, each with its next step. */
export default async function TenancyTodoPage({ params }: { params: Promise<{ leaseId: string }> }) {
  await requirePersona("TenantTodo");
  const { leaseId } = await params;
  if (!isLeaseId(leaseId)) notFound();
  const [tenancy, charges] = await Promise.all([
    mineOrNull(tenancyDetail(leaseId)),
    mineOrNull(tenancyCharges(leaseId)),
  ]);
  if (!tenancy) notFound();
  return <TenantTodoView tenancy={tenancy} charges={charges} />;
}

export const dynamic = "force-dynamic";
