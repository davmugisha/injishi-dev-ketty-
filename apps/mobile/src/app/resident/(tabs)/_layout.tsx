import { AppTabs, type TabSpec } from "@/components/tab-bar";
import { useResidentTabBadges } from "@/features/resident/tab-badges";
import type { TabFolder } from "@/proto/screens";

/** The resident app's tab bar, in the prototype's order (`TABS.resident`); each tab is its own Stack. */
const TABS: readonly TabSpec<TabFolder<"resident">>[] = [
  { folder: "(home)", label: "Home", icon: "House" },
  { folder: "pay", label: "Pay", icon: "Wallet" },
  { folder: "requests", label: "Requests", icon: "Wrench" },
  { folder: "building", label: "Building", icon: "Persons" },
  { folder: "me", label: "Me", icon: "Person" },
];

export default function ResidentTabsLayout() {
  const badges = useResidentTabBadges();
  return <AppTabs app="resident" tabs={TABS} badges={badges} />;
}
