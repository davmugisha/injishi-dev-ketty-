import { View } from "react-native";
import { LoadingBone, LoadingView, Screen } from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { useGuestHome } from "./data";
import { AfterHome, BeforeHome, StayHome } from "./home-phases";
import type { HomePhase } from "./types";

const PHASES: readonly HomePhase[] = ["before", "stay", "after"];

/** The `phase` param as a phase; anything else is the stay, the tab's own default. */
function phaseOf(value: string | undefined): HomePhase {
  return PHASES.find((p) => p === value) ?? "stay";
}

/**
 * Home (prototype `guest-home-before`, `guest-home-stay`, `guest-home-after`): one tab that follows
 * the trip. Before the stay it leads with check-in, during it with the key, Wi-Fi, ordering and the
 * bill, after it with the receipt, the review and booking again. The URL's `phase` picks which; a
 * press on the tab is the stay. Its skeleton is the prototype's `shared-loading`.
 */
export function HomeScreen() {
  const { phase } = useScreenParams("guest-home-stay");
  const home = useGuestHome(phaseOf(phase));
  // Before and during the stay the photo runs under the status bar; after it, the page has a title.
  const bleed = home.data !== undefined && home.data.phase !== "after";
  return (
    <Screen bleed={bleed}>
      <QueryView query={home} data={home.data} offlineNote={null} loading={<HomeBones />}>
        {(data) =>
          data.phase === "before" ? (
            <BeforeHome home={data} />
          ) : data.phase === "stay" ? (
            <StayHome home={data} />
          ) : (
            <AfterHome home={data} />
          )
        }
      </QueryView>
    </Screen>
  );
}

/**
 * The shape of Home on its way (`shared-loading`): a title, the big card, four tiles, a row, a section
 * heading and two cards side by side. Never a lone spinner.
 */
function HomeBones() {
  return (
    <LoadingView label="Loading your trip" className="px-4 pt-2">
      <LoadingBone className="h-8 w-3/5" />
      <LoadingBone className="h-56 rounded-3xl" />
      <View className="flex-row gap-2.5">
        {TILES.map((key) => (
          <LoadingBone key={key} className="aspect-square flex-1 rounded-3xl" />
        ))}
      </View>
      <LoadingBone className="h-16 rounded-3xl" />
      <LoadingBone className="h-5 w-2/5" />
      <View className="flex-row gap-3">
        <LoadingBone className="h-36 flex-1 rounded-3xl" />
        <LoadingBone className="h-36 flex-1 rounded-3xl" />
      </View>
    </LoadingView>
  );
}

const TILES = ["order", "wifi", "ask", "bill"] as const;
