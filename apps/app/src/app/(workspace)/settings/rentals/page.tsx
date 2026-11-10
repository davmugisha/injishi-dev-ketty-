import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { RentalsSettingsView } from "@/features/rentals/settings/RentalsSettingsView";
import { NoRentalsBusiness, SETTINGS_TABS, type SettingsTab } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { productOn } from "@/server/access";
import {
  can,
  landlordScope,
  orNull,
  payoutAccounts,
  rentalProperties,
  rentalsProfile,
  rentalsSetup,
  rentalsTeam,
} from "@/server/rentals/client";

export const metadata: Metadata = { title: screens.RentalsSettings.pageTitle };

/** The landlord's settings; the section is the URL's `?tab=`. */
export default async function RentalsSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePersona("RentalsSettings");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Settings" />;
  // Getting paid is Pay's (payouts and where they go), so it is shown, and read, only while Pay is on;
  // the rest of the screen is Residence's (ADR-076 G14).
  const payOn = productOn(scope.workspace.grants, "pay");
  const { tab: raw } = await searchParams;
  const asked = (SETTINGS_TABS as readonly string[]).includes(raw ?? "") ? (raw as SettingsTab) : null;
  const first: SettingsTab = payOn ? "getting-paid" : "location";
  const tab: SettingsTab = asked && (asked !== "getting-paid" || payOn) ? asked : first;
  const canTeam = can(scope, "team.manage");
  const [profile, accounts, properties, setup, team] = await Promise.all([
    rentalsProfile(),
    payOn ? orNull(payoutAccounts()) : Promise.resolve(null),
    rentalProperties(),
    orNull(rentalsSetup()),
    tab === "team" && canTeam ? orNull(rentalsTeam()) : Promise.resolve(null),
  ]);
  return (
    <RentalsSettingsView
      tab={tab}
      profile={profile}
      accounts={accounts?.accounts ?? null}
      properties={properties.properties}
      setup={setup}
      team={team}
      can={{
        payouts: can(scope, "payout.manage"),
        location: can(scope, "listing.manage"),
        leaseDefaults: can(scope, "lease.manage"),
        signatory: can(scope, "lease.sign"),
        brokers: can(scope, "lease.manage"),
        team: canTeam,
      }}
      payOn={payOn}
    />
  );
}

export const dynamic = "force-dynamic";
