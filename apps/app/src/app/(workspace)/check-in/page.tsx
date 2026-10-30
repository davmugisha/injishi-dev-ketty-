import { screens } from "@injishi/data";
import type { CheckInFile } from "@injishi/data/fixtures/frontdesk";
import { ActionLink, EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { CheckInView } from "@/features/frontdesk/CheckInView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument, requestContext } from "@/server/data";
import { deskPropertyName } from "@/server/sources/frontdesk";

export const metadata: Metadata = { title: screens.CheckIn.pageTitle };

/**
 * The desk's open check-in: `?booking=BK-…` names the arrival (Today's Check in buttons send it);
 * without it, the next guest expected today.
 */
export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const persona = await requirePersona("CheckIn");
  const { booking } = await searchParams;
  const file = booking
    ? await getDocument<CheckInFile>("frontdesk.checkIns", booking)
    : (await getCollection<CheckInFile>("frontdesk.checkIns"))[0];
  // Nobody to check in: today's arrivals are all in, or the booking named is not one waiting at the desk.
  if (!file) {
    return (
      <PageContent>
        <PageHeader title={screens.CheckIn.pageTitle} />
        <EmptyBlock
          icon={booking ? "CalendarXmark" : "CircleCheck"}
          title={booking ? `${booking} is not waiting to check in` : "Nobody is due to arrive"}
          description={
            booking
              ? "It may be checked in already, cancelled, or due another day. Its dates and status are in Reservations."
              : "Every guest expected today has checked in. A guest with a booking checks in from Today on the front desk; a guest without one is a walk-in."
          }
          action={
            <span className="flex flex-wrap justify-center gap-2">
              <ActionLink href="/front-desk" icon="ArrowLeft">
                Front desk
              </ActionLink>
              <ActionLink
                href={booking ? `/reservations?booking=${encodeURIComponent(booking)}` : "/reservations"}
                icon="Calendar"
              >
                Reservations
              </ActionLink>
            </span>
          }
        />
      </PageContent>
    );
  }
  // The property is the desk's own read (the same board the check-in file came from).
  const property = await deskPropertyName(await requestContext());
  return <CheckInView key={file.id} persona={persona} file={file} property={property} />;
}
