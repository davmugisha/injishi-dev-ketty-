import { screens } from "@injishi/data";
import type {
  SettingsPoliciesCard,
  SettingsPoliciesGroup,
  SettingsPoliciesOutlet,
  SettingsPoliciesProperty,
  SettingsPoliciesTier,
  SettingsPoliciesVersion,
} from "@injishi/data/fixtures/owner";
import type { Metadata } from "next";
import { SettingsPoliciesView } from "@/features/owner/SettingsPoliciesView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.SettingsPolicies.pageTitle };

export default async function SettingsPoliciesPage() {
  await requirePersona("SettingsPolicies");
  const [groups, properties, cards, tiers, versions, outlets] = await Promise.all([
    getCollection<SettingsPoliciesGroup>("owner.settingsPoliciesGroups"),
    getCollection<SettingsPoliciesProperty>("owner.settingsPoliciesProperties"),
    getCollection<SettingsPoliciesCard>("owner.settingsPoliciesCards"),
    getCollection<SettingsPoliciesTier>("owner.settingsPoliciesTiers"),
    getCollection<SettingsPoliciesVersion>("owner.settingsPoliciesVersions"),
    getCollection<SettingsPoliciesOutlet>("owner.settingsPoliciesOutlets"),
  ]);
  return <SettingsPoliciesView data={{ groups, properties, cards, tiers, versions, outlets }} />;
}
