import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Dock,
  Icon,
  KeyValue,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  metrics,
  Screen,
  TestMoneyTag,
  Text,
  useToast,
} from "@/components/ui";
import { OnGround } from "@/components/ui/ground";
import { softGround } from "@/components/ui/tone";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useAddToCalendar, useBooked } from "./data";
import type { BookedData } from "./types";

/** The success mark (prototype: a 120 disc in a soft 14 wide halo). */
const MARK = metrics.emptyTile;
const HALO = MARK + metrics.rowInset * 2;

/** "Go to my trip": out of the booking flow, onto Home before the stay. */
function toTrip() {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(href("guest-home-before"));
}

/**
 * Booking confirmed (prototype `guest-booked`): the booking reference and the provider's reference
 * together, what is left to pay at the hotel, then the next useful step: check in early.
 */
export function BookedScreen() {
  const query = useBooked();
  const data = query.data;
  return (
    <Screen
      dock={
        data ? (
          <Dock note={`Receipt sent to ${data.email}`}>
            <Button onPress={toTrip}>Go to my trip</Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={data} offlineNote={null} loading={<BookedBones />}>
        {(d) => <BookedBody booked={d} />}
      </QueryView>
    </Screen>
  );
}

function BookedBody({ booked }: { booked: BookedData }) {
  const calendar = useAddToCalendar();
  const toast = useToast();
  return (
    <View className="px-4">
      <View className="items-center gap-5 pt-10">
        <View className="items-center justify-center" style={{ width: HALO, height: HALO }}>
          <View className="absolute inset-0 rounded-full bg-success-soft opacity-50" />
          <View
            className="items-center justify-center rounded-full bg-success-soft"
            style={{ width: MARK, height: MARK }}
          >
            <OnGround ground={softGround("success")}>
              <Icon name="CircleCheck" size={40} />
            </OnGround>
          </View>
        </View>
        <View className="items-center gap-2">
          <Text role="title1" className="text-center" accessibilityLiveRegion="polite">
            {booked.instant ? "You're booked" : "Request sent"}
          </Text>
          <Text role="body" tone="muted" className="text-center">
            {booked.stayName}
            {"\n"}
            {booked.line}
          </Text>
        </View>
        <TestMoneyTag />
      </View>

      <View className="mt-5 gap-3">
        <Card>
          <KeyValue rows={booked.rows} />
        </Card>
        <ListGroup>
          <ListItem
            icon="ShieldCheck"
            title="Check in now, skip the queue"
            subtitle="Send your ID and arrival time · 2 min"
            onPress={() => router.push(href("guest-prearrival"))}
          />
          <ListItem
            icon="Calendar"
            title="Add to calendar"
            subtitle="With the address and check-in time"
            trailing={booked.calendarAdded ? <Chip tone="success" icon="Check" label="Added" /> : undefined}
            chevron={false}
            onPress={
              booked.calendarAdded
                ? undefined
                : () =>
                    calendar.mutate(undefined, {
                      onSuccess: () => toast.show({ icon: "Calendar", message: "Added to your calendar" }),
                    })
            }
          />
        </ListGroup>
      </View>
    </View>
  );
}

function BookedBones() {
  return (
    <LoadingView label="Loading your booking" className="items-center px-4 pt-10">
      <LoadingBone className="rounded-full" style={{ width: MARK, height: MARK }} />
      <LoadingBone className="h-8 w-1/2" />
      <LoadingBone className="h-12 w-3/4" />
      <LoadingBone className="h-40 w-full rounded-3xl" />
      <LoadingBone className="h-28 w-full rounded-3xl" />
    </LoadingView>
  );
}
