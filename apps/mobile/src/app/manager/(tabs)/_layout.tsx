import { AppTabs, type TabSpec } from "@/components/tab-bar";
import { useManagerTabBadges } from "@/features/manager/tab-badges";
import type { TabFolder } from "@/proto/screens";

/** The manager app's tab bar, in the prototype's order (`TABS.manager`); each tab is its own Stack. */
const TABS: readonly TabSpec<TabFolder<"manager">>[] = [
  { folder: "(today)", label: "Today", icon: "ChartColumn" },
  { folder: "approvals", label: "Approvals", icon: "CheckDouble" },
  { folder: "inbox", label: "Inbox", icon: "Comments" },
  { folder: "me", label: "Me", icon: "Person" },
];

export default function ManagerTabsLayout() {
  const badges = useManagerTabBadges();
  return <AppTabs app="manager" tabs={TABS} badges={badges} />;
}
