import { HostGuestTab, kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { LandlordGuestsView } from "@/features/guests/GuestsViews";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { can, landlordScope } from "@/server/rentals/client";
import { guestRelationships, landlordGuests } from "@/server/rentals/leases";

export const metadata: Metadata = { title: screens.LandlordGuests.pageTitle };

/** The landlord's own guests; `?tab=` picks arriving, staying, left or cancelled. */
export default async function LandlordGuestsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePersona("LandlordGuests");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="My guests" />;
  if (!can(scope, "guest.register")) {
    return (
      <PageContent>
        <PageHeader title="My guests" />
        <EmptyBlock
          icon="PersonPlus"
          title="You can't register guests here"
          description="Ask the owner of the business to let you register guests."
        />
      </PageContent>
    );
  }
  const { tab: raw } = await searchParams;
  const chosen = HostGuestTab.safeParse(raw).success ? (raw as HostGuestTab) : null;
  const [first, relationships] = await Promise.all([landlordGuests(chosen ?? "arriving"), guestRelationships()]);
  // With no tab chosen, the page opens where the guests are: arriving, else staying now.
  const tab: HostGuestTab =
    chosen ?? (first.guests.length === 0 && (first.counts.staying ?? 0) > 0 ? "staying" : "arriving");
  const list = tab === (chosen ?? "arriving") ? first : await landlordGuests(tab);
  return <LandlordGuestsView list={list} tab={tab} relationships={relationships} today={kigaliToday()} />;
}

export const dynamic = "force-dynamic";
