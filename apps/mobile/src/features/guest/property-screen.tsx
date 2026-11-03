import { router } from "expo-router";
import { View } from "react-native";
import { EmptyView, Icon, Screen, Text } from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useScreenParams } from "@/proto/params";
import { useStay } from "./data";
import { Facts, ReviewCard, RoomCard, StayBones, StayDock, StayHero } from "./property-parts";
import type { StayDetail } from "./types";
import { Rating } from "./ui";

/**
 * A stay's page (prototype `guest-property`): photos first, then the four facts that decide a
 * booking, the rooms for the chosen dates and a real review. The total for the stay is always in the
 * dock, with Reserve, which opens dates and guests. Api mode draws the public page (no dates, quote
 * or reviews yet); a stay that is not public says so.
 */
export function PropertyScreen() {
  const { slug } = useScreenParams("guest-property");
  const query = useStay(slug);
  const stay = query.data ?? null;
  // The photo (or its skeleton) runs under the status bar; a stay that is gone, or an error, does not.
  const bleed = query.data === undefined ? !query.error : stay !== null;
  return (
    <Screen bleed={bleed} dock={stay ? <StayDock stay={stay} /> : undefined}>
      <QueryView query={query} data={query.data} offlineNote={null} loading={<StayBones />}>
        {(page) => (page ? <StayBody stay={page} /> : <NotAvailable />)}
      </QueryView>
    </Screen>
  );
}

/** A page whose stay is hidden, unpublished or gone: one answer for all of them (AC-3). */
function NotAvailable() {
  return (
    <EmptyView
      icon="House"
      title="This stay isn't available"
      body="It may have been taken off Injishi for now. Look for another place to stay."
      action={{ label: "Back to Explore", icon: "ArrowLeft", onPress: () => router.navigate(href("guest-explore")) }}
    />
  );
}

function StayBody({ stay }: { stay: StayDetail }) {
  return (
    <>
      <StayHero stay={stay} />
      <View className="-mt-6 rounded-t-3xl bg-background px-4 pt-5">
        <View className="flex-row items-center gap-1.5">
          {stay.verified ? <Icon name="ShieldCheck" size={12} tone="success" /> : null}
          <Text role="micro" caps strong tone="muted" className="shrink">
            {stay.eyebrow}
          </Text>
        </View>
        <Text role="title2" className="mt-2">
          {stay.name}
        </Text>
        <View className="mt-1 flex-row flex-wrap items-center gap-x-1.5">
          <Rating rating={stay.rating} reviewCount={stay.reviewCount} reviewsWord />
          {stay.where ? (
            <Text role="callout" tone="muted">
              · {stay.where}
            </Text>
          ) : null}
        </View>

        {stay.facts.length > 0 ? (
          <View className="mt-4">
            <Facts facts={stay.facts} />
          </View>
        ) : null}

        {stay.about ? (
          <Text role="body" className="mt-4">
            {stay.about}
          </Text>
        ) : null}

        {stay.rooms.length > 0 ? (
          <>
            <Text role="headline" strong accessibilityRole="header" className="mb-2 mt-5">
              {stay.roomsTitle}
            </Text>
            <View className="gap-2">
              {stay.rooms.map((room) => (
                <RoomCard key={room.id} stay={stay} room={room} />
              ))}
            </View>
          </>
        ) : null}

        {stay.review ? (
          <View className="mt-4">
            <ReviewCard review={stay.review} />
          </View>
        ) : null}
      </View>
    </>
  );
}
