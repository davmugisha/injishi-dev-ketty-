import { screens } from "@injishi/data";
import type {
  SettingsBusinessBranch,
  SettingsBusinessDomainCheck,
  SettingsBusinessNode,
  SettingsBusinessProfile,
  SettingsBusinessUnit,
} from "@injishi/data/fixtures/owner";
import type { Metadata } from "next";
import { SettingsBusinessView } from "@/features/owner/SettingsBusinessView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.SettingsBusiness.pageTitle };

export default async function SettingsBusinessPage() {
  await requirePersona("SettingsBusiness");
  const [nodes, profiles, units, checks, branches] = await Promise.all([
    getCollection<SettingsBusinessNode>("owner.settingsBusinessNodes"),
    getCollection<SettingsBusinessProfile>("owner.settingsBusinessProfiles"),
    getCollection<SettingsBusinessUnit>("owner.settingsBusinessUnits"),
    getCollection<SettingsBusinessDomainCheck>("owner.settingsBusinessDomainChecks"),
    getCollection<SettingsBusinessBranch>("owner.settingsBusinessBranches"),
  ]);
  return <SettingsBusinessView data={{ nodes, profiles, units, checks, branches }} />;
}
