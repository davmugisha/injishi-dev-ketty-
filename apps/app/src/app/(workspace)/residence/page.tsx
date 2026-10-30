import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { LandlordHomeView } from "@/features/rentals/LandlordHomeView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { currentAccount, requirePersona } from "@/lib/session";
import {
  can,
  landlordScope,
  orNull,
  rentalsOverview,
  rentalsProfile,
  rentalsSetup,
  rentalsSummary,
  rentalUnits,
} from "@/server/rentals/client";

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
  const [account, overview, summary, setup, profile, vacant] = await Promise.all([
    currentAccount(),
    orNull(rentalsOverview()),
    orNull(rentalsSummary()),
    orNull(rentalsSetup()),
    orNull(rentalsProfile()),
    orNull(rentalUnits("vacant")),
  ]);
  // The account's own name; else the signatory's, when the signatory is this person (same email).
  const email = account?.user.email?.trim().toLowerCase();
  const signatory = profile?.signatory;
  const name =
    account?.user.name?.trim() ||
    (signatory?.name && email && signatory.contactEmail?.trim().toLowerCase() === email ? signatory.name : "");
  return (
    <LandlordHomeView
      // A name only: an address is no greeting.
      firstName={name.split(/\s+/)[0] ?? ""}
      businessName={scope.workspace.orgName ?? account?.persona.workspace?.name ?? "Your business"}
      today={overview?.today ?? today()}
      overview={overview}
      summary={summary}
      setup={setup}
      // Units that can be let now, the longest empty first: the Units card's quick links to a new lease.
      vacantUnits={(vacant?.units ?? [])
        .filter((u) => u.state === "active")
        .sort(
          (a, b) =>
            (a.vacantSince ?? "9999").localeCompare(b.vacantSince ?? "9999") ||
            a.label.localeCompare(b.label, undefined, { numeric: true }),
        )
        .slice(0, 3)}
      canLease={can(scope, "lease.manage")}
      canAddUnits={can(scope, "unit.manage")}
    />
  );
}

export const dynamic = "force-dynamic";
