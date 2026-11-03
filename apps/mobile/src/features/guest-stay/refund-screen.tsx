import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Dialog,
  Dock,
  Icon,
  IconTile,
  KeyValue,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  TestMoneyTag,
  Text,
  Timeline,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { useBooking, useCancelBooking } from "./data";
import type { Booking } from "./types";
import { backOr, CardBone, Eyebrow } from "./ui";

/**
 * Change or cancel (G6): exactly what cancelling costs right now and when that changes, with the refund
 * broken down, and moving the dates offered before cancelling. Cancelling asks once more, then is final.
 */
export function RefundScreen() {
  const booking = useBooking();
  const cancel = useCancelBooking();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const data = booking.data;

  const confirm = () =>
    cancel.mutate(undefined, {
      onSuccess: () => {
        setConfirming(false);
        toast.show({ icon: "CircleCheck", message: `${data?.ref ?? "The booking"} is cancelled.`, haptic: "success" });
      },
      onError: () => {
        setConfirming(false);
        toast.show({ icon: "CloudSlash", message: "Not cancelled. Try again in a moment.", haptic: "error" });
      },
    });

  const home = () => router.navigate(href("guest-home-before"));
  const dock = !data ? undefined : data.cancelledAt ? (
    <Dock>
      <Button size="lg" onPress={home}>
        Back to Home
      </Button>
    </Dock>
  ) : (
    <Dock note={data.note}>
      <View className="flex-row gap-2.5">
        <Button variant="secondary" className="flex-1" onPress={home}>
          Keep booking
        </Button>
        <Button variant="dangerSoft" className="flex-1" onPress={() => setConfirming(true)}>
          Cancel booking
        </Button>
      </View>
    </Dock>
  );

  return (
    <Screen
      dock={dock}
      header={
        <NavBar
          title="Change or cancel"
          subtitle={data ? `${data.ref} · ${data.dates}` : undefined}
          onBack={() => backOr(href("guest-home-before"))}
        />
      }
    >
      <QueryView offlineNote={null} query={booking} data={data} loading={<RefundBones />}>
        {(b) => (b.cancelledAt ? <Cancelled booking={b} /> : <CancelTerms booking={b} />)}
      </QueryView>
      {data ? (
        <Dialog
          isOpen={confirming}
          onClose={() => setConfirming(false)}
          icon="TriangleExclamation"
          tone="danger"
          title={`Cancel ${data.ref}?`}
          body="This is final. The hotel is told at once and the room goes back on sale."
          actions={
            <>
              <Button variant="danger" onPress={confirm} isDisabled={cancel.isPending}>
                {`Cancel and get ${rwf(data.back)} back`}
              </Button>
              <Button variant="ghost" onPress={() => setConfirming(false)}>
                Keep my booking
              </Button>
            </>
          }
        >
          <Refund booking={data} />
        </Dialog>
      ) : null}
    </Screen>
  );
}

function CancelTerms({ booking }: { booking: Booking }) {
  return (
    <View className="gap-4 px-4 pt-1">
      <Card raised padding="lg">
        <Eyebrow>If you cancel now</Eyebrow>
        <Text role="display" tabular className="mt-1">
          {`${rwf(booking.back)} back`}
        </Text>
        <Text role="callout" tone="muted" className="mt-2">
          {`The hotel keeps your ${rwf(booking.deposit)} deposit. Nothing more is charged.`}
        </Text>
        <View className="mt-3">
          <Banner tone="warning" icon="Clock" body={`From ${booking.changesAt} the full ${rwf(booking.total)} is due.`} />
        </View>
      </Card>
      <Card>
        <Timeline steps={booking.tiers} />
      </Card>
      <Card
        tone="flat"
        padding="sm"
        onPress={() => router.push(href("guest-chat", { thread: "reservations" }))}
        accessibilityLabel={`${booking.change.title} ${booking.change.body}`}
      >
        <View className="flex-row items-center gap-3">
          <IconTile icon="Calendar" />
          <View className="flex-1 gap-0.5">
            <Text role="body" strong>
              {booking.change.title}
            </Text>
            <Text role="callout" tone="muted">
              {booking.change.body}
            </Text>
          </View>
          <Icon name="ChevronRight" size={16} tone="muted" />
        </View>
      </Card>
    </View>
  );
}

/** The refund, line by line: what was paid, what the hotel keeps, what comes back and where to. */
function Refund({ booking }: { booking: Booking }) {
  return (
    <View className="gap-2">
      <View className="flex-row justify-end">
        <TestMoneyTag />
      </View>
      <KeyValue
        rows={[
          { label: "Deposit paid", value: rwf(booking.deposit) },
          { label: "Kept by the hotel", value: rwf(booking.deposit - booking.back), tone: "warning" },
          { label: "Back to", value: booking.payer },
        ]}
        total={{ label: "Refund", value: rwf(booking.back) }}
      />
    </View>
  );
}

function Cancelled({ booking }: { booking: Booking }) {
  return (
    <View className="gap-4 px-4 pt-1">
      <Card raised padding="lg">
        <Eyebrow>{`Cancelled at ${booking.cancelledAt ?? ""}`}</Eyebrow>
        <Text role="title1" className="mt-1">
          Booking cancelled
        </Text>
        <Text role="callout" tone="muted" className="mt-2">
          {booking.back > 0
            ? `Your refund reaches ${booking.payer} within 3 working days.`
            : "Nothing comes back: the deposit was past its free cancellation."}
        </Text>
      </Card>
      <Card>
        <Refund booking={booking} />
      </Card>
      <Text role="caption" tone="muted" className="text-center">
        The hotel has been told. Any refund goes back to the number you paid with.
      </Text>
    </View>
  );
}

function RefundBones() {
  return (
    <LoadingView label="Loading your booking" className="px-4 pt-1">
      <CardBone className="h-52" />
      <CardBone className="h-44" />
      <LoadingBone className="h-20 w-full rounded-3xl" />
    </LoadingView>
  );
}
