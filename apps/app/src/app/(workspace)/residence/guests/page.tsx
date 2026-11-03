import { kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { LandlordGuestsView } from "@/features/guests/GuestsViews";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { can, landlordScope } from "@/server/rentals/client";
import { guestRelationships, landlordGuests } from "@/server/rentals/leases";

export const metadata: Metadata = { title: screens.LandlordGuests.pageTitle };

/** The landlord's own guests, every stay in one list. */
export default async function LandlordGuestsPage() {
  await requirePersona("LandlordGuests");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="My guests" />;
  if (!can(scope, "guest.register")) {
    return (
      <PageContent>
        <PageHeader title="My guests" />
        <EmptyBlock icon="PersonPlus" title="You can't register guests here" />
      </PageContent>
    );
  }
  const [list, relationships] = await Promise.all([landlordGuests(), guestRelationships()]);
  return <LandlordGuestsView list={list} relationships={relationships} today={kigaliToday()} />;
}

export const dynamic = "force-dynamic";
