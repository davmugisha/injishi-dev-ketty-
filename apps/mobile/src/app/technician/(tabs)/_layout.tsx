import { AppTabs, type TabSpec } from "@/components/tab-bar";
import { useTechnicianTabBadges } from "@/features/technician/tab-badges";
import type { TabFolder } from "@/proto/screens";

/** The technician app's tab bar, in the prototype's order (`TABS.technician`); each tab is its own Stack. */
const TABS: readonly TabSpec<TabFolder<"technician">>[] = [
  { folder: "(jobs)", label: "Jobs", icon: "Wrench" },
  { folder: "scan", label: "Scan", icon: "QrCode" },
  { folder: "schedule", label: "Schedule", icon: "Calendar" },
  { folder: "me", label: "Me", icon: "Person" },
];

export default function TechnicianTabsLayout() {
  const badges = useTechnicianTabBadges();
  return <AppTabs app="technician" tabs={TABS} badges={badges} />;
}
