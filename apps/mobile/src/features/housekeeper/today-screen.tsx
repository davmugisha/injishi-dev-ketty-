import { router } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  Divider,
  Dock,
  Icon,
  IconTile,
  LiveDot,
  LoadingBone,
  LoadingView,
  Ring,
  Screen,
  Section,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useClockIn, useClockOut, useStartRoom, useToday, useToggleBreak } from "./data";
import type { NextRoom, ShiftCard, TodayRooms, TodayView } from "./types";
import { Bones, openScreen, openTab, RoomList, StaffHeader, TextLink } from "./ui";

/**
 * The housekeeper's Today: `hk-clockin` before the shift (`phase=before-shift`, or no open clock in) and
 * `hk-today` on it (S1, S2, X3). Before: the shift card, the location check, the briefing and one big
 * clock in. On shift: progress, the briefing and one big next room button. In api mode the shift is the
 * real one (`GET /me/work/:id/today`) and a punch goes through the outbox.
 */
export function TodayScreen() {
  const { phase } = useScreenParams("hk-today");
  const { query, data } = useToday(phase);
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const toast = useToast();
  // One tap is one punch: the card changes at once, so a second tap would be a second punch.
  const [busy, setBusy] = useState(false);
  const busyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hold = () => {
    setBusy(true);
    if (busyTimer.current) clearTimeout(busyTimer.current);
    busyTimer.current = setTimeout(() => setBusy(false), 1_000);
  };

  const punchIn = (today: TodayView) => {
    if (busy) return;
    hold();
    clockIn.mutate(
      { employeeId: today.employeeId, at: today.clockInAt },
      {
        onSuccess: () => {
          toast.show({ icon: "CircleCheck", message: today.clockInAt ? `Clocked in at ${today.clockInAt}` : "Clocked in" });
          // The clock in shown on its own (`phase=before-shift`) hands over to the shift.
          if (phase) router.replace(href("hk-today"));
        },
        onError: (error) => toast.show({ icon: "CircleExclamation", message: error.message, haptic: "error" }),
      },
    );
  };

  const punchOut = (today: TodayView) => {
    if (busy) return;
    hold();
    clockOut.mutate(
      { employeeId: today.employeeId },
      {
        onSuccess: () => toast.show({ icon: "FloppyDisk", message: "Clocked out. Saved on this phone." }),
        onError: (error) => toast.show({ icon: "CircleExclamation", message: error.message, haptic: "error" }),
      },
    );
  };

  // Only a pull shows the spinner; a read again after a tap stays quiet.
  const [pulling, setPulling] = useState(false);
  const pull = () => {
    setPulling(true);
    void query.refetch().finally(() => setPulling(false));
  };

  // The dock clocks in before the shift; there is nothing to punch on without a file or today's copy.
  const canPunch =
    data !== undefined && !data.onShift && data.shift?.kind !== "not-set-up" && data.shift?.kind !== "stale";
  return (
    <Screen
      dock={
        data && canPunch ? <ClockInDock today={data} busy={busy} onClockIn={() => punchIn(data)} /> : undefined
      }
      refreshing={pulling}
      onRefresh={pull}
    >
      <QueryView query={query} data={data} loading={<TodayLoading />}>
        {(today) =>
          today.onShift ? (
            <OnShift today={today} busy={busy} onClockOut={() => punchOut(today)} />
          ) : (
            <BeforeShift today={today} onRetry={() => void query.refetch()} />
          )
        }
      </QueryView>
    </Screen>
  );
}

function AsOfLine({ at }: { at: string | null }) {
  if (!at) return null;
  return (
    <View className="mx-4 mb-2 flex-row items-center gap-2" accessibilityRole="text">
      <Icon name="CloudSlash" size={16} tone="muted" />
      <Text role="caption" tone="muted">
        {`As of ${at} · can't connect`}
      </Text>
    </View>
  );
}

// ---------- before the shift (hk-clockin)

function BeforeShift({ today, onRetry }: { today: TodayView; onRetry: () => void }) {
  return (
    <View>
      <StaffHeader person={today.person} sync={today.sync} hasInbox={today.hasInbox} />
      <AsOfLine at={today.asOf} />
      <View className="gap-1 px-4">
        <Text role="micro" tone="muted" caps strong>
          {today.day}
        </Text>
        <Text role="title1">{today.firstName ? `${today.greeting},\n${today.firstName}` : today.greeting}</Text>
      </View>
      {today.shift ? <ShiftCardView shift={today.shift} onRetry={onRetry} /> : null}
      {today.briefing ? (
        <Banner
          tone="info"
          className="mx-4 mt-3"
          title={`Briefing from ${today.briefing.from}`}
          body={today.briefing.body}
        />
      ) : null}
      {today.rooms ? <RoomsSummary rooms={today.rooms} /> : null}
    </View>
  );
}

function ShiftCardView({ shift, onRetry }: { shift: ShiftCard; onRetry: () => void }) {
  switch (shift.kind) {
    case "before":
      return (
        <Card raised className="mx-4 mt-4">
          <View className="flex-row items-center justify-between gap-3">
            <Text role="micro" tone="muted" caps strong>
              Your shift
            </Text>
            <Chip tone="accent" label={shift.chip} />
          </View>
          <Text role="display" tabular className="mt-2">
            {shift.span}
          </Text>
          <Text role="callout" tone="muted" className="mt-1">
            {shift.detail}
          </Text>
          {shift.location ? (
            <>
              <Divider className="mt-3" />
              <View className="mt-3 flex-row items-center gap-3">
                <Icon name="MapPin" tone="success" />
                <View className="flex-1">
                  <Text role="callout" strong>
                    {shift.location.title}
                  </Text>
                  <Text role="caption" tone="muted">
                    {shift.location.detail}
                  </Text>
                </View>
                <LiveDot label="Location checked" />
              </View>
            </>
          ) : null}
        </Card>
      );
    case "no-shift":
      return (
        <ShiftNote
          title="No shift on the roster today"
          body="You can still clock in. Your manager sees it."
          titleRole="title2"
        />
      );
    case "clocked-out":
      return (
        <Card raised className="mx-4 mt-4">
          <View className="flex-row items-center justify-between gap-3">
            <Text role="micro" tone="muted" caps strong>
              Your shift
            </Text>
            <Chip label="Clocked out" />
          </View>
          <Text role="title1" tabular className="mt-2">
            {`Clocked out at ${shift.at}`}
          </Text>
          {shift.saved ? <SavedLine /> : null}
        </Card>
      );
    case "not-set-up":
      return <ShiftNote title="Clock in isn't set up here." body="Ask your manager." titleRole="title3" />;
    case "stale":
      return (
        <Card raised className="mx-4 mt-4 gap-3">
          <IconTile icon="CloudSlash" tone="warning" />
          <View className="gap-1">
            <Text role="title3">Connect to load today</Text>
            <Text role="callout" tone="muted">
              The copy on this phone is from an earlier day. Connect to load today's shift.
            </Text>
          </View>
          <Button variant="secondary" icon="ArrowRotateRight" onPress={onRetry}>
            Try again
          </Button>
        </Card>
      );
  }
}

function ShiftNote({ title, body, titleRole }: { title: string; body: string; titleRole: "title2" | "title3" }) {
  return (
    <Card raised className="mx-4 mt-4 gap-1">
      <Text role="micro" tone="muted" caps strong>
        Your shift
      </Text>
      <Text role={titleRole} className="mt-1">
        {title}
      </Text>
      <Text role="callout" tone="muted">
        {body}
      </Text>
    </Card>
  );
}

function SavedLine() {
  return (
    <View className="mt-2 flex-row items-center gap-2">
      <Icon name="FloppyDisk" size={16} tone="warning" />
      <Text role="caption" tone="warning">
        Saved on this phone · sends when there's signal
      </Text>
    </View>
  );
}

function RoomsSummary({ rooms }: { rooms: TodayRooms }) {
  return (
    <Card padding="sm" className="mx-4 mt-3">
      <View className="flex-row items-center gap-3">
        <IconTile icon="LayoutCells" />
        <View className="flex-1">
          <Text role="headline" strong>
            {`${rooms.total} rooms on your list`}
          </Text>
          <Text role="caption" tone="muted">
            {rooms.mix}
          </Text>
        </View>
        <TextLink label="See" accessibilityLabel="See my rooms" onPress={() => openTab(href("hk-rooms"))} />
      </View>
    </Card>
  );
}

function ClockInDock({ today, busy, onClockIn }: { today: TodayView; busy: boolean; onClockIn: () => void }) {
  const toast = useToast();
  return (
    <Dock>
      <Button variant="deep" icon="Clock" isDisabled={busy} onPress={onClockIn}>
        {today.clockInAt ? `Clock in at ${today.clockInAt}` : "Clock in again"}
      </Button>
      <View className="items-center">
        <Text role="caption" tone="muted" className="text-center">
          No signal? The time is saved on this phone and sent later.
        </Text>
        <TextLink
          label="Use kiosk PIN"
          onPress={() =>
            toast.show({
              icon: "Smartphone",
              message: "At the staff entrance kiosk, type your staff number and PIN.",
            })
          }
        />
      </View>
    </Dock>
  );
}

// ---------- on shift (hk-today)

function OnShift({ today, busy, onClockOut }: { today: TodayView; busy: boolean; onClockOut: () => void }) {
  const shift = today.onShift;
  const toggleBreak = useToggleBreak();
  const startRoom = useStartRoom();
  if (!shift) return null;
  const rooms = today.rooms;
  // A row only opens its room; the big button starts the next one (its clock starts).
  const open = (room: string) => openScreen(href("hk-task", { room }));
  const start = (room: string) => {
    startRoom.mutate(room);
    open(room);
  };
  return (
    <View>
      <StaffHeader person={today.person} sync={today.sync} hasInbox={today.hasInbox} />
      <AsOfLine at={today.asOf} />
      <Card tone="accent" className="mx-4">
        <View className="flex-row items-center gap-3.5">
          <View className="flex-1 gap-0.5">
            <Text role="title3" strong>
              {shift.breakSince ? `On a break since ${shift.breakSince}` : `On shift since ${shift.since}`}
            </Text>
            <Text role="caption" tone="muted">
              {shift.detail}
            </Text>
            {shift.saved ? (
              <Text role="caption">Saved on this phone · sends when there's signal</Text>
            ) : null}
            {shift.confirmLater ? <Text role="caption">Your manager will confirm this clock in.</Text> : null}
            {shift.canBreak ? (
              <View className="mt-1 flex-row">
                <Chip
                  variant="glass"
                  size="lg"
                  icon="Cup"
                  label={shift.breakSince ? "End break" : "Start break"}
                  selected={Boolean(shift.breakSince)}
                  onPress={() => toggleBreak.mutate()}
                />
              </View>
            ) : null}
          </View>
          {rooms && rooms.total > 0 ? (
            <Ring
              value={(rooms.done / rooms.total) * 100}
              size={80}
              label={`${rooms.done} of ${rooms.total} rooms done`}
            >
              <Text role="title3" strong tabular>
                {`${rooms.done}/${rooms.total}`}
              </Text>
              <Text role="micro" tone="muted">
                rooms
              </Text>
            </Ring>
          ) : null}
        </View>
      </Card>
      {today.briefing ? (
        <Banner
          tone="info"
          className="mx-4 mt-3"
          title={`${today.briefing.from} · ${today.briefing.at}`}
          body={today.briefing.short}
        />
      ) : null}
      {rooms ? <RoomsToday rooms={rooms} onOpen={open} onStart={start} /> : null}
      <View className="mt-4 gap-1 px-4">
        {today.canReport ? (
          <Button variant="outline" icon="TriangleExclamation" onPress={() => router.push(href("hk-report"))}>
            Report a problem
          </Button>
        ) : null}
        <Button variant="ghost" icon="ArrowRightFromSquare" isDisabled={busy} onPress={onClockOut}>
          Clock out
        </Button>
      </View>
    </View>
  );
}

function RoomsToday({
  rooms,
  onOpen,
  onStart,
}: {
  rooms: TodayRooms;
  onOpen: (room: string) => void;
  onStart: (room: string) => void;
}) {
  return (
    <>
      {rooms.next ? (
        <NextRoomCard next={rooms.next} onStart={() => onStart(rooms.next?.room ?? "")} />
      ) : (
        <Card tone="success" className="mx-4 mt-3">
          <View className="flex-row items-center gap-3">
            <Icon name="CircleCheck" size={24} />
            <View className="flex-1">
              <Text role="headline" strong>
                Every room on your list is clean
              </Text>
              <Text role="caption">Beatrice inspects them next.</Text>
            </View>
          </View>
        </Card>
      )}
      {rooms.upcoming.length > 0 ? (
        <>
          <Section title="Then" detail={`${rooms.more} more`} />
          <RoomList lines={rooms.upcoming} onOpen={onOpen} />
        </>
      ) : null}
      {rooms.done > 0 ? (
        <Card
          tone="flat"
          padding="sm"
          className="mx-4 mt-3"
          onPress={() => openTab(href("hk-rooms"))}
          accessibilityLabel={`${rooms.done} done: ${rooms.doneRooms.join(", ")}. Open My rooms.`}
        >
          <View className="flex-row items-center gap-3">
            <Icon name="CircleCheck" tone="success" />
            <Text role="callout" className="flex-1">
              <Text role="callout" strong>
                {`${rooms.done} done`}
              </Text>
              {` · ${rooms.doneRooms.join(", ")}`}
            </Text>
            <Icon name="ChevronRight" size={16} tone="muted" />
          </View>
        </Card>
      ) : null}
    </>
  );
}

function NextRoomCard({ next, onStart }: { next: NextRoom; onStart: () => void }) {
  return (
    <Card raised className="mx-4 mt-3">
      <View className="flex-row items-start justify-between gap-3">
        <View>
          <Text role="micro" tone="muted" caps strong>
            Next room
          </Text>
          <Text role="display" tabular className="mt-1">
            {next.room}
          </Text>
        </View>
        {next.arrival ? <Chip tone="danger" size="lg" icon="Clock" label={`Arrival ${next.arrival}`} /> : null}
      </View>
      <Text role="callout" tone="muted" className="mt-2">
        {next.detail}
      </Text>
      {next.chips.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {next.chips.map((chip) => (
            <Chip key={chip.label} label={chip.label} tone={chip.tone} icon={chip.icon} />
          ))}
        </View>
      ) : null}
      <View className="mt-4">
        <Button icon="CirclePlay" onPress={onStart}>
          {`Start cleaning ${next.room}`}
        </Button>
      </View>
    </Card>
  );
}

// ---------- loading

function TodayLoading() {
  return (
    <LoadingView label="Loading your day">
      <View className="flex-row items-center gap-2.5 px-4 pt-1">
        <LoadingBone className="size-10 rounded-full" />
        <View className="flex-1 gap-1.5">
          <LoadingBone className="h-4 w-28" />
          <LoadingBone className="h-3 w-20" />
        </View>
        <LoadingBone className="h-8 w-24 rounded-full" />
      </View>
      <Bones>
        <LoadingBone className="h-28 rounded-3xl" />
        <LoadingBone className="h-16 rounded-2xl" />
        <LoadingBone className="h-56 rounded-3xl" />
        <LoadingBone className="h-40 rounded-3xl" />
      </Bones>
    </LoadingView>
  );
}
