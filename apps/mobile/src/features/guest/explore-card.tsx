import type { ExploreCard as Card } from "@injishi/contracts";
import { router } from "expo-router";
import { View } from "react-native";
import { LoadingBone, PressArea, Text } from "@/components/ui";
import { PagerDots, PhotoPager } from "./photo-pager";
import { PhotoPill, Rating } from "./ui";
import { basisWords, bookingWords, dayWords, priceWords, ratingWords, rwf } from "./words";

/** "Gisenyi, Rubavu · Hotel", or just the type when the property is not placed. */
function whereWords(card: Card): string {
  return card.where ? `${card.where} · ${card.typeLabel}` : card.typeLabel;
}

/**
 * One result on Explore (mobile spec 0005, AC-6, prototype `guest-04-explore`): the photographs, the
 * booking badge, name and rating, where and type, and the price on the basis the API computed it.
 * Pressing it opens the property page.
 */
export function ExploreCardView({ card }: { card: Card }) {
  const badge = bookingWords(card.bookingMode, card.approvalWindowHours);
  const label = [
    card.name,
    whereWords(card),
    ratingWords(card.rating, card.reviewCount) === "New" ? "New" : `rated ${card.rating?.toFixed(1)}`,
    priceWords(card.priceRwf, card.priceBasis),
    badge,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <PressArea
      onPress={() => router.push({ pathname: "/guest/property/[slug]", params: { slug: card.slug } })}
      accessibilityLabel={label}
      accessibilityRole="link"
      className="gap-2"
    >
      <View className="overflow-hidden rounded-3xl" style={{ aspectRatio: 4 / 3 }}>
        <PhotoPager
          photos={card.photos}
          name={card.name}
          size="thumb"
          overlay={(index) => (
            <>
              {badge ? (
                <View className="absolute top-3 left-3" style={{ pointerEvents: "none" }}>
                  <PhotoPill icon={card.bookingMode === "instant_book" ? "Thunderbolt" : "Clock"} label={badge} />
                </View>
              ) : null}
              <PagerDots count={card.photos.length} index={index} />
            </>
          )}
        />
      </View>
      <View className="gap-0.5 px-1">
        <View className="flex-row items-start justify-between gap-3">
          <Text role="headline" className="flex-1">
            {card.name}
          </Text>
          <Rating rating={card.rating} reviewCount={card.reviewCount} />
        </View>
        <Text role="callout" tone="muted">
          {whereWords(card)}
        </Text>
        {card.priceRwf === null ? (
          <Text role="callout">Price on request</Text>
        ) : (
          <Text role="callout" tone="muted">
            <Text role="headline">{rwf(card.priceRwf)}</Text> {basisWords(card.priceBasis)}
          </Text>
        )}
        {card.mode === "homes" && card.unitCount ? (
          <Text role="caption" tone="muted">
            {card.unitCount === 1 ? "1 home to rent" : `${card.unitCount} homes to rent`}
            {card.availableFrom ? ` · from ${dayWords(card.availableFrom)}` : " · available now"}
          </Text>
        ) : null}
      </View>
    </PressArea>
  );
}

/** The card's skeleton: three of these while the first page loads (AC-8). */
export function ExploreCardBones() {
  return (
    <View className="gap-2">
      <LoadingBone className="rounded-3xl" style={{ aspectRatio: 4 / 3 }} />
      <LoadingBone className="h-5 w-3/5" />
      <LoadingBone className="h-4 w-2/5" />
      <LoadingBone className="h-4 w-1/3" />
    </View>
  );
}
