import { type GuestTrip, MyTrips } from "@injishi/contracts";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { Chip, type ChipTone, EmptyView, LoadingBone, LoadingView, Row, RowIcon, Text } from "@/components/ui";
import { getParsed } from "@/data/fetch";
import { QueryView } from "@/data/query-view";
import { useSession } from "@/lib/session";
import { GuestHeader, SignInPrompt } from "./ui";
import { BOOKING_STATUS_WORDS, stayWords } from "./words";

const STATUS_TONE: Record<GuestTrip["status"], ChipTone> = {
  pending_approval: "warning",
  confirmed: "success",
  declined: "danger",
  cancelled: "default",
  no_show: "default",
};

/**
 * Trips (mobile spec 0005, AC-2): a sign in prompt signed out; signed in, the account's bookings from
 * `GET /me/trips`, or a designed empty state when there are none. Milestone 2 groups them by stage and
 * opens a trip page with its receipt.
 */
export function TripsScreen() {
  const { account } = useSession();
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="grow">
      <GuestHeader title="Trips" />
      {account ? (
        <SignedInTrips userId={account.userId} />
      ) : (
        <SignInPrompt
          icon="Suitcase"
          title="Your trips live here"
          body="Sign in to see the stays you have booked, on this phone and on the web."
          returnTo="/guest/trips"
        />
      )}
    </ScrollView>
  );
}

function SignedInTrips({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: ["u", userId, "trips"],
    queryFn: () => getParsed(MyTrips, "/api/v1/me/trips"),
  });
  return (
    <QueryView
      query={query}
      data={query.data?.trips}
      offlineNote={null}
      loading={
        <LoadingView label="Loading your trips" className="px-4">
          <LoadingBone className="h-16" />
          <LoadingBone className="h-16" />
        </LoadingView>
      }
    >
      {(trips) =>
        trips.length === 0 ? (
          <EmptyView
            icon="Suitcase"
            title="No trips yet"
            body="When you book a stay, it shows here with its dates and reference."
            action={{ label: "Find a stay", icon: "Magnifier", onPress: () => router.navigate("/guest/explore") }}
          />
        ) : (
          <View className="gap-1 pb-6">
            {trips.map((trip) => (
              <Row
                key={trip.id}
                leading={<RowIcon name="Suitcase" tone="accent" />}
                title={trip.propertyName}
                subtitle={`${trip.roomTypeName} · ${stayWords(trip.checkIn, trip.checkOut)} · ${trip.reference}`}
                trailing={<Chip label={BOOKING_STATUS_WORDS[trip.status]} tone={STATUS_TONE[trip.status]} />}
              />
            ))}
            <Text role="caption" tone="muted" className="px-4 pt-2">
              Trip details and receipts open here soon. They are on the web meanwhile.
            </Text>
          </View>
        )
      }
    </QueryView>
  );
}
