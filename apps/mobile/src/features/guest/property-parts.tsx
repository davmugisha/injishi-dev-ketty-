// The property page's pieces: the photo header, the facts, the rooms, the review and the dock.

import { rnSpace } from "@injishi/design-tokens";
import { router } from "expo-router";
import { Platform, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import {
  Button,
  Card,
  Chip,
  Dock,
  Icon,
  IconButton,
  LoadingBone,
  LoadingView,
  metrics,
  Photo,
  PhotoScrim,
  PressArea,
  Text,
} from "@/components/ui";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { PhotoPager } from "./photo-pager";
import type { StayDetail, StayFact, StayRoom } from "./types";
import { Price, SaveButton, Stars } from "./ui";

/** How far the page rises over the photo, its rounded top showing the picture behind it. */
const SHEET_OVERLAP = rnSpace[6];

/** Back: the screen below, or Explore when the page was opened on its own (a shared link). */
export function backFromStay() {
  if (router.canGoBack()) router.back();
  else router.navigate(href("guest-explore"));
}

function share(stay: StayDetail) {
  // Android shares only the message, so the link rides in it there (AC-28).
  const message = Platform.OS === "ios" ? stay.name : `${stay.name}\n${stay.shareUrl}`;
  void Share.share({ url: stay.shareUrl, message, title: stay.name }).catch(() => {});
}

/** The header's height under the status bar (`.gx-bleed` on the property page). */
export function useHeroHeight(): number {
  return metrics.photo.hero + useSafeAreaInsets().top;
}

/**
 * `.gx-bleed` on the page: the stay's photographs to swipe, under the status bar, with back, share
 * and the heart on glass, the photo's caption and its place in the set at the foot.
 */
export function StayHero({ stay }: { stay: StayDetail }) {
  const insets = useSafeAreaInsets();
  const height = useHeroHeight();
  const total = stay.photos.length;
  return (
    <PhotoPager
      photos={stay.photos.map((p) => p.source)}
      height={height}
      name={stay.name}
      overlay={(index) => (
        <>
          {total > 0 ? <PhotoScrim preset="hero" /> : null}
          <View
            className="absolute inset-x-0 flex-row items-center justify-between px-2"
            style={{ top: insets.top + rnSpace[1], pointerEvents: "box-none" }}
          >
            <IconButton icon="ChevronLeft" label="Back" variant="glass" onPress={backFromStay} />
            <View className="flex-row">
              <IconButton icon="ArrowShapeTurnUpRight" label="Share" variant="glass" onPress={() => share(stay)} />
              <SaveButton slug={stay.slug} name={stay.name} saved={stay.saved} />
            </View>
          </View>
          {total > 0 ? (
            <View
              className="absolute inset-x-4 flex-row items-end justify-between gap-2"
              style={{ bottom: SHEET_OVERLAP + rnSpace[3], pointerEvents: "none" }}
            >
              <View className="shrink">
                {stay.photos[index]?.caption ? (
                  <Chip variant="glass" label={stay.photos[index]?.caption ?? ""} />
                ) : null}
              </View>
              <Chip variant="glass" icon="Picture" label={`${index + 1} / ${total}`} />
            </View>
          ) : null}
        </>
      )}
    />
  );
}

/** `.gx-hl`: the facts that decide a booking, two to a row. */
export function Facts({ facts }: { facts: readonly StayFact[] }) {
  const rows: StayFact[][] = [];
  for (let i = 0; i < facts.length; i += 2) rows.push(facts.slice(i, i + 2));
  return (
    <View className="gap-2.5">
      {rows.map((row) => (
        <View key={row.map((f) => f.title).join("|")} className="flex-row gap-2.5">
          {row.map((fact) => (
            <View
              key={fact.title}
              accessible
              className="flex-1 gap-1.5 rounded-2xl border border-separator bg-surface p-3"
            >
              <Icon name={fact.icon} size={20} tone="accent" />
              <Text role="callout" strong>
                {fact.title}
              </Text>
              {fact.detail ? (
                <Text role="caption" tone="muted">
                  {fact.detail}
                </Text>
              ) : null}
            </View>
          ))}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * `.gx-room`: one room for the dates, its photo, beds and size, the price a night and how many are
 * left. The room the dock prices is ringed in the accent; pressing a room picks it on the dates sheet.
 */
export function RoomCard({ stay, room }: { stay: StayDetail; room: StayRoom }) {
  const halo = useCSSVariable("--color-accent-soft");
  const selected = stay.roomId === room.id;
  const price = room.priceRwf === null ? "Price on request" : `${rwf(room.priceRwf)} ${room.priceNote}`;
  return (
    <PressArea
      onPress={() => router.push(href("guest-dates", { slug: stay.slug, room: room.id }))}
      accessibilityLabel={[room.name, room.detail, price, room.left !== null ? `${room.left} left` : null]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint="Choose dates for this room"
      accessibilityState={{ selected }}
      className="rounded-3xl"
      style={selected ? { boxShadow: `0 0 0 3px ${String(halo)}` } : undefined}
    >
      <View
        className={`flex-row items-center gap-3 overflow-hidden rounded-3xl border-2 bg-surface p-3 ${selected ? "border-accent" : "border-border"}`}
      >
        {room.photo ? (
          <Photo source={room.photo} width={metrics.photo.thumb} height={metrics.photo.thumb} radius="md" />
        ) : (
          <View
            className="items-center justify-center rounded-2xl bg-surface-tertiary"
            style={{ width: metrics.photo.thumb, height: metrics.photo.thumb }}
          >
            <Icon name="House" size={24} tone="muted" />
          </View>
        )}
        <View className="flex-1 gap-0.5">
          <Text role="callout" strong>
            {room.name}
          </Text>
          <Text role="caption" tone="muted">
            {room.detail}
          </Text>
          <View className="mt-2 flex-row flex-wrap items-center justify-between gap-2">
            {room.priceRwf === null ? (
              <Text role="callout">Price on request</Text>
            ) : (
              <Price amount={rwf(room.priceRwf)} note={room.priceNote} />
            )}
            {room.left !== null ? (
              <Chip tone={room.left <= 1 ? "warning" : "default"} label={`${room.left} left`} />
            ) : null}
          </View>
        </View>
      </View>
    </PressArea>
  );
}

/** A guest's review, the one the page leads with. */
export function ReviewCard({ review }: { review: NonNullable<StayDetail["review"]> }) {
  return (
    <Card>
      <View className="flex-row flex-wrap items-center gap-2">
        <Stars stars={review.stars} />
        <Text role="caption" tone="muted" className="shrink">
          {review.author}
        </Text>
      </View>
      <Text role="callout" className="mt-2">
        {review.text}
      </Text>
    </Card>
  );
}

/** The dock: the total for the stay, what it covers, and Reserve. */
export function StayDock({ stay }: { stay: StayDetail }) {
  return (
    <Dock>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text role="title3" strong tabular>
            {stay.dock.price}
          </Text>
          <Text role="caption" tone="muted">
            {stay.dock.note}
          </Text>
        </View>
        <Button
          onPress={() => router.push(href("guest-dates", { slug: stay.slug, room: stay.roomId ?? undefined }))}
          className="px-2"
        >
          Reserve
        </Button>
      </View>
    </Dock>
  );
}

/** The page on its way: the photo, the name, the facts and a room. */
export function StayBones() {
  const height = useHeroHeight();
  return (
    <LoadingView label="Loading this stay">
      <LoadingBone className="rounded-none" style={{ height }} />
      <View className="gap-3 px-4">
        <LoadingBone className="h-4 w-1/2" />
        <LoadingBone className="h-8 w-4/5" />
        <LoadingBone className="h-4 w-2/3" />
        <View className="flex-row gap-2.5">
          <LoadingBone className="h-24 flex-1 rounded-2xl" />
          <LoadingBone className="h-24 flex-1 rounded-2xl" />
        </View>
        <LoadingBone className="h-28 rounded-3xl" />
      </View>
    </LoadingView>
  );
}
