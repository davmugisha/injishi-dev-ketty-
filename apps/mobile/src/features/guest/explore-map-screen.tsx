import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Card,
  EmptyView,
  IconButton,
  LoadingBone,
  LoadingView,
  metrics,
  Photo,
  PlaceMap,
  Screen,
  SearchBar,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { useExplore } from "./data";
import { useExploreIntent } from "./explore-intent";
import { type ExploreIntent, intentParams } from "./intent";
import type { ExploreData, StayCard } from "./types";
import { Price, Rating } from "./ui";
import { searchSheetParams } from "./where-field";

/** "140k": a pin's price, in thousands, so the map stays readable (prototype note). */
function pinWords(stay: StayCard): string {
  if (stay.priceRwf === null) return "Ask";
  return stay.priceRwf >= 1000 ? `${Math.round(stay.priceRwf / 1000)}k` : String(stay.priceRwf);
}

/** Where the lake's name sits: a band 30% wide around the kit's lake centre. */
const LAKE_LABEL = { left: "55%", right: "15%", top: "33%", pointerEvents: "none" } as const;

/** Back to the list: the screen below when there is one, else Explore itself, on the same search. */
function toList(intent: ExploreIntent) {
  if (router.canGoBack()) router.back();
  else router.navigate(href("guest-explore", intentParams(intent)));
}

/**
 * Explore on a map (prototype `guest-explore-map`): the same stays as price pins, a saved one with
 * its heart, and one stay's card at a time at the foot, so the map stays readable on a small screen.
 * A pin picks the card; the card opens the stay.
 */
export function ExploreMapScreen() {
  const [intent] = useExploreIntent();
  const explore = useExplore(intent);
  return (
    <Screen scroll={false}>
      <QueryView query={explore} data={explore.data} offlineNote={null} loading={<MapBones />}>
        {(data) => <MapBody data={data} intent={intent} />}
      </QueryView>
    </Screen>
  );
}

function MapBody({ data, intent }: { data: ExploreData; intent: ExploreIntent }) {
  const placed = data.stays.filter((s) => s.pin);
  const [picked, setPicked] = useState<string | null>(null);
  const focus = placed.find((s) => s.slug === (picked ?? data.focus)) ?? placed[0];
  const pins = placed.map((stay) => ({
    x: stay.pin?.x ?? 50,
    y: stay.pin?.y ?? 50,
    label: pinWords(stay),
    icon: stay.saved ? ("HeartFill" as const) : undefined,
    active: stay.slug === focus?.slug,
    onPress: () => setPicked(stay.slug),
    accessibilityLabel: `${stay.name}, ${stay.priceRwf === null ? "price on request" : rwf(stay.priceRwf)}${stay.saved ? ", saved" : ""}`,
  }));
  return (
    <PlaceMap size="fill" pins={pins} label={`Map of ${placed.length} stays around Lake Kivu`}>
      {/* The lake's name on one line, centred on the kit's lake (70% across, 35% down); the kit's own
          label wraps on the web, where its zero width anchor gives the words no room. */}
      <View
        className="absolute items-center"
        style={LAKE_LABEL}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Text role="micro" caps strong tone="info" numberOfLines={1}>
          Lake Kivu
        </Text>
      </View>
      <View className="absolute inset-x-4 top-2">
        <SearchBar
          title={data.search.title}
          subtitle={data.search.subtitle}
          onPress={() => router.push(href("guest-dates", searchSheetParams(intent, data)))}
          trailing={<IconButton icon="ListUl" label="Show the list" variant="surface" onPress={() => toList(intent)} />}
        />
      </View>
      <View className="absolute inset-x-4 bottom-4">
        {focus ? (
          <FocusCard stay={focus} />
        ) : (
          <Card raised>
            <EmptyView
              icon="MapPin"
              title="Nothing on the map yet"
              body="These stays have no place on the map. The list has all of them."
              action={{ label: "Show the list", icon: "ListUl", onPress: () => toList(intent) }}
            />
          </Card>
        )}
      </View>
    </PlaceMap>
  );
}

/** The one stay the map is showing, at its foot: photo, name, place, rating and price. */
function FocusCard({ stay }: { stay: StayCard }) {
  return (
    <Card
      raised
      padding="none"
      onPress={() => router.push(href("guest-property", { slug: stay.slug }))}
      accessibilityLabel={`${stay.name}, ${stay.near}. Open the stay`}
    >
      <View className="flex-row items-center gap-3 p-2.5">
        <Photo
          source={stay.photos[0]}
          width={metrics.photo.thumb + metrics.rowInset}
          height={metrics.photo.thumb + metrics.rowInset}
          radius="md"
        />
        <View className="flex-1 gap-1">
          <Text role="headline" numberOfLines={1}>
            {stay.name}
          </Text>
          <Text role="callout" tone="muted" numberOfLines={1}>
            {stay.near}
          </Text>
          <Rating rating={stay.rating} reviewCount={stay.reviewCount} />
          {stay.priceRwf === null ? (
            <Text role="callout">Price on request</Text>
          ) : (
            <Price amount={rwf(stay.priceRwf)} note={stay.priceNote} />
          )}
        </View>
      </View>
    </Card>
  );
}

function MapBones() {
  return (
    <LoadingView label="Loading the map" className="px-4 pt-2">
      <LoadingBone className="h-14 rounded-full" />
      <LoadingBone className="h-96 rounded-3xl" />
      <LoadingBone className="h-28 rounded-3xl" />
    </LoadingView>
  );
}
