import { HostGuestTab, kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantGuestsView } from "@/features/guests/GuestsViews";
import { placeWords } from "@/features/leases/shared";
import { requirePersona } from "@/lib/session";
import { guestRelationships } from "@/server/rentals/leases";
import { isLeaseId, mineOrNull, tenancyDetail, tenantGuests } from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.TenantGuests.pageTitle };

/** A tenant's guests for one lease; `?tab=` picks arriving, staying, left or cancelled. */
export default async function TenancyGuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ leaseId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePersona("TenantGuests");
  const { leaseId } = await params;
  if (!isLeaseId(leaseId)) notFound();
  const { tab: raw } = await searchParams;
  const chosen = HostGuestTab.safeParse(raw).success ? (raw as HostGuestTab) : null;
  const [tenancy, first, relationships] = await Promise.all([
    mineOrNull(tenancyDetail(leaseId)),
    mineOrNull(tenantGuests(leaseId, chosen ?? "arriving")),
    guestRelationships(),
  ]);
  if (!tenancy || !first) notFound();
  // With no tab chosen, the page opens where the guests are: arriving, else staying now.
  const tab: HostGuestTab =
    chosen ?? (first.guests.length === 0 && (first.counts.staying ?? 0) > 0 ? "staying" : "arriving");
  const list = tab === (chosen ?? "arriving") ? first : await tenantGuests(leaseId, tab);
  return (
    <TenantGuestsView
      leaseId={leaseId}
      place={placeWords(tenancy)}
      status={tenancy.status}
      list={list}
      tab={tab}
      relationships={relationships}
      today={kigaliToday()}
    />
  );
}

export const dynamic = "force-dynamic";
