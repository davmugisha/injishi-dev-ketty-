import { rnSpace } from "@injishi/design-tokens";
import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Row, RowIcon, Text } from "@/components/ui";
import { isMock } from "@/lib/data-mode";
import { PROTO_LINKS } from "./links";
import { APP_LABELS, href, SCREEN_IDS, SCREENS, type ScreenId } from "./screens";
import { useSurface } from "./surface";

/** Among screens sharing one route (Home before, during and after a stay), the one the URL's params pick. */
function useVariant(id: ScreenId): ScreenId {
  const params = useLocalSearchParams();
  const base = SCREENS[id];
  const match = SCREEN_IDS.find((other) => {
    const candidate = SCREENS[other];
    const wanted = Object.entries(candidate.params);
    return (
      candidate.path === base.path &&
      candidate.kind === base.kind &&
      wanted.length > 0 &&
      wanted.every(([key, value]) => params[key] === value)
    );
  });
  return match ?? id;
}

/**
 * A screen the wave 2 leaves have not built yet (proto-ui). It says which prototype screen belongs here
 * and offers every link the prototype draws from it, so the app can be walked end to end before the
 * screens exist. A sheet or modal draws as a plain sheet over a scrim that closes it.
 */
export function ProtoTodo({ id }: { id: ScreenId }) {
  const shown = useVariant(id);
  const screen = SCREENS[shown];
  const surface = useSurface();
  const insets = useSafeAreaInsets();
  const overlay = screen.kind === "sheet" || screen.kind === "modal";
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const open = (target: ScreenId) => {
    const to = href(target, undefined, { app: surface });
    // A tab root is reached by switching to it; anything else is pushed, so back returns here. With its
    // anchors, a screen in a tab not opened yet still has that tab's root underneath.
    if (SCREENS[target].kind === "tab") router.navigate(to, { withAnchor: true });
    else router.push(to, { withAnchor: true });
  };

  const body: ReactNode = (
    <View className="gap-6">
      <View className="gap-2">
        <Text role="micro" caps tone="muted">
          {`${APP_LABELS[screen.app]} · ${shown}`}
        </Text>
        <Text role="title2">{screen.title}</Text>
        <Text role="callout" tone="muted">
          Not built yet. This placeholder stands in until the screen is built from the prototype.
        </Text>
      </View>
      {PROTO_LINKS[shown].length > 0 ? (
        <View className="gap-1">
          <Text role="micro" caps tone="muted">
            Goes to
          </Text>
          <View className="-mx-4">
            {PROTO_LINKS[shown].map((target) => (
              <Row
                key={target}
                leading={<RowIcon name="ArrowRight" />}
                title={SCREENS[target].title}
                subtitle={target}
                chevron
                onPress={() => open(target)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {isMock ? (
        <View className="-mx-4">
          <Row
            leading={<RowIcon name="LayoutCells" />}
            title="All prototype screens"
            chevron
            onPress={() => router.push("/dev/prototype")}
          />
        </View>
      ) : null}
    </View>
  );

  if (overlay) {
    return (
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={back}
          className="absolute inset-0 bg-backdrop"
        />
        <View
          className="rounded-t-3xl bg-surface px-4"
          style={{ paddingTop: rnSpace[3], paddingBottom: insets.bottom + rnSpace[6] }}
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-separator" />
          {body}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 px-4"
      contentContainerStyle={{ paddingTop: insets.top + rnSpace[2], paddingBottom: rnSpace[8] }}
    >
      {router.canGoBack() ? (
        <View className="-ml-2 flex-row">
          <IconButton icon="ArrowLeft" label="Back" onPress={back} />
        </View>
      ) : null}
      {body}
    </ScrollView>
  );
}
