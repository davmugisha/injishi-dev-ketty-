import { kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantGuestsView } from "@/features/guests/GuestsViews";
import { placeWords } from "@/features/leases/shared";
import { requirePersona } from "@/lib/session";
import { guestRelationships } from "@/server/rentals/leases";
import { isLeaseId, mineOrNull, tenancyDetail, tenantGuests } from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.TenantGuests.pageTitle };

/** A tenant's guests for one lease, every stay in one list. */
export default async function TenancyGuestsPage({ params }: { params: Promise<{ leaseId: string }> }) {
  await requirePersona("TenantGuests");
  const { leaseId } = await params;
  if (!isLeaseId(leaseId)) notFound();
  const [tenancy, list, relationships] = await Promise.all([
    mineOrNull(tenancyDetail(leaseId)),
    mineOrNull(tenantGuests(leaseId)),
    guestRelationships(),
  ]);
  if (!tenancy || !list) notFound();
  return (
    <TenantGuestsView
      leaseId={leaseId}
      place={placeWords(tenancy)}
      status={tenancy.status}
      list={list}
      relationships={relationships}
      today={kigaliToday()}
    />
  );
}

export const dynamic = "force-dynamic";
