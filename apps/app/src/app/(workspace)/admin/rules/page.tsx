import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { Refused } from "@/features/admin/people/Refused";
import { type SettingsTab, SettingsView } from "@/features/admin/settings/SettingsView";
import { requirePersona } from "@/lib/session";
import { governmentBodies, staffAccess } from "@/server/admin/leaders";
import { type Search, wordOf } from "@/server/admin/list";
import { feeSchedule, platformConfiguration, psfCatalogue, psfTiers } from "@/server/admin/settings";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminRules.pageTitle };

const TABS = ["fees", "psf", "bodies", "platform"] as const;

/** Settings (2026-11-09, real records): fees and plans, PSF's levels and catalogue, government bodies, flags. */
export default async function AdminRulesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("AdminRules");
  const sp = await searchParams;
  const tab: SettingsTab = wordOf(sp.tab, TABS) ?? "fees";
  try {
    const [access, fees, tiers, catalogue, bodies, config] = await Promise.all([
      staffAccess(),
      tab === "fees" ? feeSchedule() : Promise.resolve(null),
      tab === "psf" ? psfTiers() : Promise.resolve(null),
      tab === "psf" ? psfCatalogue() : Promise.resolve(null),
      tab === "bodies" ? governmentBodies() : Promise.resolve(null),
      tab === "platform" ? platformConfiguration() : Promise.resolve(null),
    ]);
    return (
      <SettingsView
        tab={tab}
        fees={fees}
        tiers={tiers}
        catalogue={catalogue}
        bodies={bodies}
        config={config}
        canEditFees={access.permissions.includes("admin.fee.edit")}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) return <Refused code={error.code} />;
    throw error;
  }
}

export const dynamic = "force-dynamic";
