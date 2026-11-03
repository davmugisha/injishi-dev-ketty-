// Explore's pieces: a stay's card in the list (`.gx-pcard`) and the list's skeleton.

import { router } from "expo-router";
import { View } from "react-native";
import { Chip, LoadingBone, LoadingView, metrics, PagerDots, PressArea, Text } from "@/components/ui";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { PhotoPager } from "./photo-pager";
import type { StayCard } from "./types";
import { Price, Rating, SaveButton } from "./ui";

/** Everything the card says, as one phrase for a screen reader. */
function cardLabel(stay: StayCard): string {
  return [
    stay.name,
    stay.where,
    stay.rating === null ? "New" : `rated ${stay.rating.toFixed(1)}`,
    stay.priceRwf === null ? "Price on request" : `${rwf(stay.priceRwf)} ${stay.priceNote}`,
    stay.booking?.label,
    stay.scarcity,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * One stay on Explore (prototype `guest-explore`): its photographs to swipe, how it books, the heart,
 * then the name and rating, where and what kind, and the price. Pressing it opens the stay's page.
 */
export function StayCardView({ stay }: { stay: StayCard }) {
  return (
    <View>
      <PressArea
        onPress={() => router.push(href("guest-property", { slug: stay.slug }))}
        accessibilityRole="link"
        accessibilityLabel={cardLabel(stay)}
        className="gap-2.5"
      >
        <PhotoPager
          photos={stay.photos}
          height={metrics.photo.card}
          name={stay.name}
          rounded
          overlay={(index) => (
            <>
              {stay.booking ? (
                <View className="absolute left-3 top-3" style={{ pointerEvents: "none" }}>
                  <Chip
                    variant="glass"
                    icon={stay.booking.instant ? "Thunderbolt" : "Clock"}
                    label={stay.booking.label}
                  />
                </View>
              ) : null}
              {stay.photos.length > 1 ? (
                <View className="absolute inset-x-0 bottom-3" style={{ pointerEvents: "none" }}>
                  <PagerDots count={stay.photos.length} index={index} />
                </View>
              ) : null}
            </>
          )}
        />
        <View className="gap-0.5 px-1">
          <View className="flex-row items-center justify-between gap-3">
            <Text role="headline" className="shrink">
              {stay.name}
            </Text>
            <Rating rating={stay.rating} reviewCount={stay.reviewCount} />
          </View>
          <Text role="callout" tone="muted">
            {stay.where}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
            {stay.priceRwf === null ? (
              <Text role="headline">Price on request</Text>
            ) : (
              <Price amount={rwf(stay.priceRwf)} note={stay.priceNote} />
            )}
            {stay.scarcity ? <Chip tone="warning" label={stay.scarcity} /> : null}
          </View>
        </View>
      </PressArea>
      {/* Beside the card, not inside it, so a screen reader reaches the heart on its own. */}
      <View className="absolute right-1.5 top-1.5">
        <SaveButton slug={stay.slug} name={stay.name} saved={stay.saved} />
      </View>
    </View>
  );
}

/** One card on its way: the photo, the name, the place, the price. */
export function StayCardBones() {
  return (
    <View className="gap-2">
      <LoadingBone className="rounded-3xl" style={{ height: metrics.photo.card }} />
      <LoadingBone className="h-5 w-3/5" />
      <LoadingBone className="h-4 w-2/5" />
      <LoadingBone className="h-4 w-1/3" />
    </View>
  );
}

/** Explore on its way: the search pill, the filters, the count, then two cards. */
export function ExploreBones() {
  return (
    <LoadingView label="Loading stays" className="px-4 pt-2">
      <LoadingBone className="h-14 rounded-full" />
      <View className="flex-row gap-2">
        <LoadingBone className="h-9 w-24 rounded-full" />
        <LoadingBone className="h-9 w-20 rounded-full" />
        <LoadingBone className="h-9 w-20 rounded-full" />
        <LoadingBone className="h-9 w-28 rounded-full" />
      </View>
      <LoadingBone className="h-4 w-1/2" />
      <StayCardBones />
      <StayCardBones />
    </LoadingView>
  );
}
