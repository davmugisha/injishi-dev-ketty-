import { router } from "expo-router";
import { View } from "react-native";
import {
  Banner,
  Card,
  Chip,
  EmptyView,
  IconButton,
  IconTile,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  metrics,
  PressArea,
  Screen,
  ScreenHeader,
  Section,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useTrips } from "./data";
import type { PastTrip, TripsData, UpcomingTrip } from "./types";
import { SignInPrompt, StayPhoto, useSignedOut } from "./ui";

function toClaim() {
  router.push(href("guest-claim"));
}

/**
 * Trips (prototype `guest-trips`): upcoming and past stays in one list, the next one with its
 * check-in progress, past ones with the points they earned and Book again. A walk-in guest adds a
 * stay by scanning the desk's QR. With no trips at all it is the prototype's `shared-empty`. In api
 * mode they are the account's own bookings (`GET /me/trips`); signed out, it offers sign in, which
 * comes back here.
 */
export function TripsScreen() {
  const signedOut = useSignedOut();
  const query = useTrips();
  const data = query.data;
  const any = data !== undefined && data.upcoming.length + data.past.length > 0;
  return (
    <Screen>
      <ScreenHeader
        title="Trips"
        right={
          any ? (
            <>
              <IconButton icon="QrCode" label="Scan the desk QR" variant="surface" onPress={toClaim} />
              <IconButton
                icon="Heart"
                label="Saved stays"
                variant="surface"
                onPress={() => router.push(href("guest-saved"))}
              />
            </>
          ) : undefined
        }
      />
      {signedOut ? (
        <SignInPrompt
          icon="Suitcase"
          title="Your trips live here"
          body="Sign in to see the stays you have booked, on this phone and on the web."
          returnTo={String(href("guest-trips"))}
        />
      ) : (
        <QueryView query={query} data={data} offlineNote={null} loading={<TripsBones />}>
          {(d) => (d.upcoming.length + d.past.length > 0 ? <TripsBody trips={d} /> : <NoTrips />)}
        </QueryView>
      )}
    </Screen>
  );
}

/** `shared-empty`: no trips yet, and the next useful step. */
function NoTrips() {
  return (
    <EmptyView
      icon="Suitcase"
      title="No trips yet"
      body="Book a stay and it shows here, with your key, bill and directions."
      action={{ label: "Explore stays", icon: "Magnifier", onPress: () => router.navigate(href("guest-explore")) }}
      secondary={{ label: "Already at a hotel? Scan the desk QR", onPress: toClaim }}
    />
  );
}

function TripsBody({ trips }: { trips: TripsData }) {
  return (
    <>
      {trips.upcoming.length > 0 ? (
        <View className="gap-3 px-4">
          <Text role="micro" caps strong tone="muted" accessibilityRole="header">
            Upcoming
          </Text>
          {trips.upcoming.map((trip) => (
            <Upcoming key={trip.reference} trip={trip} />
          ))}
        </View>
      ) : null}
      {trips.past.length > 0 ? (
        <>
          <Section title="Past" />
          <ListGroup className="mx-4">
            {trips.past.map((trip) => (
              <Past key={trip.reference} trip={trip} />
            ))}
          </ListGroup>
        </>
      ) : null}
      <View className="px-4 pt-4">
        <Card tone="flat" padding="sm" onPress={toClaim} accessibilityLabel="Walked in without a booking? Scan the QR at the desk to add the stay here.">
          <View className="flex-row items-center gap-3">
            <IconTile icon="QrCode" />
            <View className="flex-1 gap-0.5">
              <Text role="callout" strong>
                Walked in without a booking?
              </Text>
              <Text role="caption" tone="muted">
                Scan the QR at the desk to add the stay here.
              </Text>
            </View>
          </View>
        </Card>
      </View>
    </>
  );
}

/** The next stay: its photo with the countdown, name, dates and status, then check-in progress. */
function Upcoming({ trip }: { trip: UpcomingTrip }) {
  const status = trip.confirmed ? "Confirmed" : "Waiting for the host";
  return (
    <View className="gap-3">
      <PressArea
        onPress={() => router.navigate(href("guest-home-before"))}
        accessibilityLabel={`${trip.hotel}, ${trip.line}, ${trip.countdown}, ${status}`}
        className="gap-2.5"
      >
        <StayPhoto
          source={trip.photo}
          name={trip.hotel}
          height={metrics.photo.card - metrics.rowInset * 2.5}
          badge={{ icon: "Calendar", label: trip.countdown }}
        />
        <View className="flex-row items-center justify-between gap-3 px-1">
          <View className="flex-1 gap-0.5">
            <Text role="headline">{trip.hotel}</Text>
            <Text role="callout" tone="muted">
              {trip.line}
            </Text>
          </View>
          <Chip
            tone={trip.confirmed ? "success" : "warning"}
            icon={trip.confirmed ? "CircleCheck" : "Clock"}
            label={status}
          />
        </View>
      </PressArea>
      {trip.checkIn ? (
        <Banner
          icon="ShieldCheck"
          title={trip.checkIn.title}
          body={trip.checkIn.detail}
          onPress={() => router.push(href("guest-prearrival"))}
        />
      ) : null}
    </View>
  );
}

/** A past stay: reviewed, or Book again (when the stay has a page to book on). */
function Past({ trip }: { trip: PastTrip }) {
  const slug = trip.slug;
  const open = trip.reviewed
    ? () => router.navigate(href("guest-home-after"))
    : slug
      ? () => router.push(href("guest-property", { slug }))
      : undefined;
  return (
    <ListItem
      size="lg"
      leading={
        <StayPhoto
          source={trip.photo}
          name={trip.hotel}
          width={metrics.rowLarge}
          height={metrics.rowLarge}
          radius="md"
        />
      }
      title={trip.hotel}
      subtitle={trip.detail}
      chevron={false}
      trailing={
        trip.reviewed ? (
          <Chip tone="success" label="Reviewed" />
        ) : slug ? (
          <Text role="callout" strong tone="accent">
            Book again
          </Text>
        ) : undefined
      }
      accessibilityLabel={[trip.hotel, trip.detail, trip.reviewed ? "reviewed" : slug ? "book again" : null]
        .filter(Boolean)
        .join(", ")}
      onPress={open}
    />
  );
}

function TripsBones() {
  return (
    <LoadingView label="Loading your trips" className="px-4">
      <LoadingBone className="h-3 w-1/4" />
      <LoadingBone className="h-44 rounded-3xl" />
      <LoadingBone className="h-5 w-3/5" />
      <LoadingBone className="h-14 rounded-2xl" />
      <LoadingBone className="h-36 rounded-3xl" />
    </LoadingView>
  );
}
