import { kigaliToday } from "@injishi/contracts";
import { screenHref, screens } from "@injishi/data";
import { ActionLink, EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { NewLeaseView } from "@/features/leases/NewLeaseView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { can, landlordScope, rentalProperties, rentalsProfile, rentalUnits } from "@/server/rentals/client";

export const metadata: Metadata = { title: screens.LeaseNew.pageTitle };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A new lease on a vacant unit; `?unit=<id>` picks the unit (from the Units page). */
export default async function NewLeasePage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; start?: string }>;
}) {
  await requirePersona("LeaseNew");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="New lease" />;
  if (!can(scope, "lease.manage")) {
    return (
      <PageContent>
        <PageHeader title="New lease" />
        <EmptyBlock
          icon="FileText"
          title="You can't draft leases here"
          description="Ask the owner of the business to let you manage leases."
          action={
            <ActionLink href={screenHref("Leases")} icon="ArrowLeft">
              Back to leases
            </ActionLink>
          }
        />
      </PageContent>
    );
  }
  const { unit, start } = await searchParams;
  const today = kigaliToday();
  const [vacant, properties, profile] = await Promise.all([
    rentalUnits("vacant"),
    rentalProperties(),
    rentalsProfile(),
  ]);
  return (
    <NewLeaseView
      // Only units that can be let now: vacant and not off market.
      units={vacant.units
        .filter((u) => u.state === "active")
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))}
      properties={properties.properties}
      profile={profile}
      today={today}
      initialUnitId={unit && UUID.test(unit) ? unit : null}
      // A day chosen on the calendar starts the lease there; never a day gone.
      initialStart={start && /^\d{4}-\d{2}-\d{2}$/.test(start) && start >= today ? start : null}
      canSign={can(scope, "lease.sign")}
    />
  );
}

export const dynamic = "force-dynamic";
