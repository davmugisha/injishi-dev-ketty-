import { AppTabs, type TabSpec } from "@/components/tab-bar";
import { useSupervisorTabBadges } from "@/features/supervisor/tab-badges";
import type { TabFolder } from "@/proto/screens";

/** The supervisor app's tab bar, in the prototype's order (`TABS.supervisor`); each tab is its own Stack. */
const TABS: readonly TabSpec<TabFolder<"supervisor">>[] = [
  { folder: "(floor)", label: "Floor", icon: "LayoutCells" },
  { folder: "inspect", label: "Inspect", icon: "CheckDouble" },
  { folder: "team", label: "Team", icon: "Persons" },
  { folder: "me", label: "Me", icon: "Person" },
];

export default function SupervisorTabsLayout() {
  const badges = useSupervisorTabBadges();
  return <AppTabs app="supervisor" tabs={TABS} badges={badges} />;
}
