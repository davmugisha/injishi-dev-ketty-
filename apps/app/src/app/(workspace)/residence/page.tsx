import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { LandlordHomeView } from "@/features/rentals/LandlordHomeView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { currentAccount, requirePersona } from "@/lib/session";
import { can, landlordScope, orNull, rentalsOverview, rentalsSetup, rentalsSummary } from "@/server/rentals/client";

export const metadata: Metadata = { title: screens.ResidenceHome.pageTitle };

const today = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** The landlord's home: the business's figures, what needs attention, and setup until it is done. */
export default async function LandlordHomePage() {
  await requirePersona("ResidenceHome");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Home" />;
  const [account, overview, summary, setup] = await Promise.all([
    currentAccount(),
    orNull(rentalsOverview()),
    orNull(rentalsSummary()),
    orNull(rentalsSetup()),
  ]);
  return (
    <LandlordHomeView
      // The account's own name only: an address is no greeting.
      firstName={account?.user.name?.trim().split(/\s+/)[0] ?? ""}
      businessName={scope.workspace.orgName ?? account?.persona.workspace?.name ?? "Your business"}
      today={overview?.today ?? today()}
      overview={overview}
      summary={summary}
      setup={setup}
      canAddUnits={can(scope, "unit.manage")}
    />
  );
}

export const dynamic = "force-dynamic";
