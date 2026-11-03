import { AppTabs, type TabSpec } from "@/components/tab-bar";
import { useGuestTabBadges } from "@/features/guest/tab-badges";
import type { TabFolder } from "@/proto/screens";

/** The guest app's tab bar, in the prototype's order (`TABS.guest`); each tab is its own Stack. */
const TABS: readonly TabSpec<TabFolder<"guest">>[] = [
  { folder: "(home)", label: "Home", icon: "House" },
  { folder: "explore", label: "Explore", icon: "Magnifier" },
  { folder: "trips", label: "Trips", icon: "Suitcase" },
  { folder: "inbox", label: "Inbox", icon: "Comments" },
  { folder: "me", label: "Me", icon: "Person" },
];

export default function GuestTabsLayout() {
  const badges = useGuestTabBadges();
  return <AppTabs app="guest" tabs={TABS} badges={badges} />;
}
