import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { RentalsSettingsView } from "@/features/rentals/settings/RentalsSettingsView";
import { NoRentalsBusiness, SETTINGS_TABS, type SettingsTab } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import {
  can,
  landlordScope,
  orNull,
  payoutAccounts,
  rentalProperties,
  rentalsProfile,
  rentalsSetup,
} from "@/server/rentals/client";

export const metadata: Metadata = { title: screens.RentalsSettings.pageTitle };

/** The landlord's settings; the section is the URL's `?tab=`. */
export default async function RentalsSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePersona("RentalsSettings");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Settings" />;
  const { tab: raw } = await searchParams;
  const tab: SettingsTab = (SETTINGS_TABS as readonly string[]).includes(raw ?? "")
    ? (raw as SettingsTab)
    : "getting-paid";
  const [profile, accounts, properties, setup] = await Promise.all([
    rentalsProfile(),
    orNull(payoutAccounts()),
    rentalProperties(),
    orNull(rentalsSetup()),
  ]);
  return (
    <RentalsSettingsView
      tab={tab}
      profile={profile}
      accounts={accounts?.accounts ?? null}
      properties={properties.properties}
      setup={setup}
      can={{
        payouts: can(scope, "payout.manage"),
        location: can(scope, "listing.manage"),
        leaseDefaults: can(scope, "lease.manage"),
        signatory: can(scope, "lease.sign"),
        brokers: can(scope, "lease.manage"),
      }}
    />
  );
}

export const dynamic = "force-dynamic";
