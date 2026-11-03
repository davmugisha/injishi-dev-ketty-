import { rnSpace } from "@injishi/design-tokens";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, type ListRenderItem, Platform, View } from "react-native";
import { Banner, Button, EmptyView, FilterChips, IconButton, Screen, SearchBar, Spinner, Text } from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { type ExploreMore, useExploreList } from "./data";
import { useExploreIntent } from "./explore-intent";
import { ExploreBones, StayCardView } from "./explore-parts";
import { type ExploreIntent, intentParams } from "./intent";
import type { ExploreData, StayCard } from "./types";
import { searchSheetParams } from "./where-field";

/** The prototype's filter chips: a kind of stay, or what it offers. */
const FILTERS = [
  { value: "all", label: "All stays" },
  { value: "hotel", label: "Hotel" },
  { value: "lodge", label: "Lodge" },
  { value: "tented_camp", label: "Tented camp" },
  { value: "lakeView", label: "Lake view", icon: "Sun" },
  { value: "breakfast", label: "Breakfast" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

function matches(stay: StayCard, filter: Filter): boolean {
  return filter === "all" || stay.type === filter || stay.tags.includes(filter);
}

/** The list's own scrolling, as the kit's `Screen` scrolls a body: padded at the foot, growing to fill. */
const LIST_CONTENT = { paddingBottom: rnSpace[5], flexGrow: 1 } as const;

/** How near the end (in screens) the next page is asked for, as the list before this port did. */
const END_THRESHOLD = 0.6;

const renderStay: ListRenderItem<StayCard> = ({ item }) => (
  <View className="px-4">
    <StayCardView stay={item} />
  </View>
);

/** 24 between two cards, the prototype's gap. */
function CardGap() {
  return <View className="h-6" />;
}

/**
 * Explore (prototype `guest-explore`): stays across Rwanda from the app, verified businesses only.
 * The search pill opens dates and guests (and, there, where); chips narrow the kind of stay; each card
 * shows how it books before it is opened, and its heart saves it. Map shows the same stays as price
 * pins. In api mode the next page loads as the list nears its end.
 */
export function ExploreScreen() {
  const [intent] = useExploreIntent();
  const list = useExploreList(intent);
  return (
    // Once there are stays the list scrolls itself, so it hears its end; the skeleton and an error
    // scroll in the screen's own body.
    <Screen scroll={list.data === undefined}>
      <QueryView query={list.query} data={list.data} offlineNote={null} loading={<ExploreBones />}>
        {(data) => <ExploreBody data={data} intent={intent} more={list.more} />}
      </QueryView>
    </Screen>
  );
}

function ExploreBody({ data, intent, more }: { data: ExploreData; intent: ExploreIntent; more: ExploreMore }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = data.stays.filter((stay) => matches(stay, filter));
  const count = filter === "all" ? data.total : shown.length;
  // The dates and guests sheet, setting the search rather than a stay's dates; it starts from this one.
  const openSearch = () => router.push(href("guest-dates", searchSheetParams(intent, data)));
  return (
    <FlatList
      data={shown}
      keyExtractor={(stay) => stay.slug}
      renderItem={renderStay}
      ItemSeparatorComponent={CardGap}
      ListHeaderComponent={
        <>
          <View className="px-4 pt-2">
            <SearchBar
              title={data.search.title}
              subtitle={data.search.subtitle}
              onPress={openSearch}
              trailing={<IconButton icon="Sliders" label="Dates and guests" variant="surface" onPress={openSearch} />}
            />
          </View>
          <FilterChips label="Kind of stay" options={FILTERS} value={filter} onChange={setFilter} className="mt-1" />
          <View className="flex-row items-center justify-between gap-3 px-4 pt-1">
            <Text role="callout" tone="muted" className="shrink" accessibilityLiveRegion="polite">
              <Text role="callout" strong>
                {count === 1 ? "1 stay" : `${count} stays`}
              </Text>{" "}
              · verified businesses only
            </Text>
            <Button
              size="sm"
              variant="outline"
              icon="MapPin"
              onPress={() => router.push(href("guest-explore-map", intentParams(intent)))}
              accessibilityLabel="Show these stays on a map"
            >
              Map
            </Button>
          </View>
          {shown.length > 0 ? <View className="h-3" /> : null}
        </>
      }
      ListEmptyComponent={
        data.stays.length > 0 ? (
          <EmptyView
            icon="Magnifier"
            title="No stays match"
            body="Nothing in this search matches that filter yet. Try another kind of stay."
            action={{ label: "Show all stays", onPress: () => setFilter("all") }}
          />
        ) : (
          <EmptyView
            icon="House"
            title="No stays here yet"
            body="Stays show here the moment a verified business publishes them. Try another place or other dates."
            action={{ label: "Change the search", icon: "Magnifier", onPress: openSearch }}
            secondary={{ label: "Start over", onPress: () => router.replace(href("guest-explore")) }}
          />
        )
      }
      ListFooterComponent={more.loading || more.error ? <MoreFooter more={more} /> : undefined}
      onEndReached={more.load}
      onEndReachedThreshold={END_THRESHOLD}
      className="flex-1"
      contentContainerStyle={LIST_CONTENT}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
    />
  );
}

/** The list's foot while the next page loads, or when it did not: a spinner, or a banner to try again. */
function MoreFooter({ more }: { more: ExploreMore }) {
  if (more.error) {
    return (
      <View className="px-4 pt-6">
        <Banner
          tone="danger"
          icon="CloudSlash"
          title="More stays didn't load"
          body="Check your signal, then tap to try again."
          onPress={more.retry}
        />
      </View>
    );
  }
  return (
    <View className="items-center pt-6">
      <Spinner label="Loading more stays" />
    </View>
  );
}
