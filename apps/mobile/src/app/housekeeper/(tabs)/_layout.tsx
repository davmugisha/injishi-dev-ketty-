import { AppTabs, type TabSpec } from "@/components/tab-bar";
import { useHousekeeperTabBadges } from "@/features/housekeeper/tab-badges";
import type { TabFolder } from "@/proto/screens";

/** The housekeeper app's tab bar, in the prototype's order (`TABS.housekeeper`); each tab is its own Stack. */
const TABS: readonly TabSpec<TabFolder<"housekeeper">>[] = [
  { folder: "(today)", label: "Today", icon: "House" },
  { folder: "rooms", label: "Rooms", icon: "LayoutCells" },
  { folder: "schedule", label: "Schedule", icon: "Calendar" },
  { folder: "me", label: "Me", icon: "Person" },
];

export default function HousekeeperTabsLayout() {
  const badges = useHousekeeperTabBadges();
  return <AppTabs app="housekeeper" tabs={TABS} badges={badges} />;
}
