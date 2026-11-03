import { AppTabs, type TabSpec } from "@/components/tab-bar";
import { useDeskTabBadges } from "@/features/desk/tab-badges";
import type { TabFolder } from "@/proto/screens";

/** The desk app's tab bar, in the prototype's order (`TABS.desk`); each tab is its own Stack. */
const TABS: readonly TabSpec<TabFolder<"desk">>[] = [
  { folder: "(today)", label: "Today", icon: "House" },
  { folder: "rooms", label: "Tents", icon: "LayoutCells" },
  { folder: "walk-in", label: "Walk-in", icon: "Plus" },
  { folder: "money", label: "Money", icon: "Wallet" },
  { folder: "me", label: "Me", icon: "Person" },
];

export default function DeskTabsLayout() {
  const badges = useDeskTabBadges();
  return <AppTabs app="desk" tabs={TABS} badges={badges} />;
}
