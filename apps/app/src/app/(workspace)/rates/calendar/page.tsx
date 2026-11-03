import { letsLongStays } from "@injishi/contracts";
import { homeHref, screens } from "@injishi/data";
import { ActionLink, EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { StayPricesView } from "@/features/pms/stays/StayPricesView";
import { requirePersona } from "@/lib/session";
import { ratesCalendar, ratesSpecialDates, staysSummary } from "@/server/stays/client";

export const metadata: Metadata = { title: screens.AvailabilityCalendar.pageTitle };

export default async function AvailabilityCalendarPage() {
  const persona = await requirePersona("AvailabilityCalendar");
  // A stay business's prices, live (2026-10-30): its room types' terms (a one day read) and special dates.
  const summary = await staysSummary();
  const [calendar, special] = summary
    ? await Promise.all([ratesCalendar(summary.today, summary.today), ratesSpecialDates()])
    : [null, null];
  if (summary && calendar) {
    return (
      <StayPricesView
        roomTypes={calendar.roomTypes}
        ranges={special?.ranges ?? []}
        today={calendar.today}
        longStays={letsLongStays(summary.business.kind)}
      />
    );
  }
  // Prices open with a stay business that is open for bookings; until then there is nothing to price.
  return (
    <PageContent>
      <PageHeader title={screens.AvailabilityCalendar.pageTitle} />
      <EmptyBlock
        icon="Tag"
        title="Prices open with your business"
        description="Set room prices once your business is approved."
        action={
          <ActionLink href={homeHref(persona.id)} icon="ArrowLeft">
            Back
          </ActionLink>
        }
      />
    </PageContent>
  );
}
