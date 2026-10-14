import { screenHref } from "@injishi/data";
import type { GuestStayRecord, KeyAccessPoint, KeyEvent, KeyHelpNote } from "@injishi/data/fixtures/guest";
import { Link, useLocalSearchParams } from "expo-router";
import { Button, Card, Chip, ListGroup, Spinner } from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody } from "@/components/phone";
import { getCollection } from "@/lib/store";
import {
  GuestTimeline,
  GuestTop,
  IconRow,
  IconTile,
  InitialsAvatar,
  includes,
  param,
  ScreenHeading,
  SectionTitle,
  SoftChip,
  StatusAlert,
  StatusDot,
  useGuestLang,
} from "./ui";

export type KeyMode = "active" | "provisioning" | "revoked" | "unavailable";
const MODES = ["active", "provisioning", "revoked", "unavailable"] as const;

const TITLES = { en: "Your key", rw: "Urufunguzo rwawe", fr: "Votre clé" } as const;

const SUBS: Record<KeyMode, string> = {
  active: "Hold your phone near the lock on room 204 and tap.",
  provisioning: "Almost there. Your key appears here as soon as it’s confirmed.",
  revoked: "Room moves change your key automatically.",
  unavailable: "This room uses a key card instead.",
};

/** Guest · digital key (artifact: GuestKey). `?state=` is active, provisioning, revoked or unavailable. */
export default function GuestKeyScreen() {
  const stateParam = param(useLocalSearchParams<{ state?: string }>().state);
  const state: KeyMode = includes(MODES, stateParam) ? stateParam : "active";
  const stays = getCollection<GuestStayRecord>("guest.stays");
  const events = getCollection<KeyEvent>("guest.keyEvents");
  const access = getCollection<KeyAccessPoint>("guest.keyAccess");
  const help = getCollection<KeyHelpNote>("guest.keyHelp");
  const stay = stays[0];

  const [lang, setLang] = useGuestLang();
  const [opened, setOpened] = useState(false);
  const [checks, setChecks] = useState(0);

  if (!stay || !events.length) return null;

  const revoked = state === "revoked";
  const room = revoked ? stay.move.to : stay.room;
  const roomType = revoked ? stay.move.toType : `${stay.roomType} · ${stay.floor}`;
  const showKey = state === "active" || revoked;
  const scenario = state === "provisioning" ? "issuing" : revoked ? "revoked" : "active";
  const base = events.filter((event) => event.scenario === scenario);
  const activity = opened
    ? [
        {
          id: "just-opened",
          status: "success" as const,
          icon: "LockOpen",
          title: `Room ${room} opened`,
          detail: "Thu 15 Oct, 19:42 · confirmed by the lock",
        },
        ...base,
      ]
    : base;
  const notes = help.filter((note) => note.mode === state);

  return (
    <>
      <GuestTop
        lead={<InitialsAvatar initials={stay.initials} label={stay.property} />}
        title={stay.property}
        sub={`Room ${room} · stay ${stay.id}`}
        lang={lang}
        onLang={setLang}
      />
      <PhoneBody>
        <View className="gap-[14px]">
          <ScreenHeading title={TITLES[lang]} sub={SUBS[state]} />

          {revoked ? (
            <StatusAlert
              status="warning"
              icon="ArrowRightArrowLeft"
              title={`Your old key stopped working; your new key for ${stay.move.to} is ready`}
              description={`You moved from room ${stay.move.from} to ${stay.move.to} at ${stay.move.at}. The lock system confirmed the ${stay.move.from} key was cancelled at ${stay.move.cancelledAt}. Your bill and requests moved with you.`}
            />
          ) : null}

          {showKey ? (
            <Card className="items-center gap-4 px-4 py-5">
              <View className="w-full flex-row items-start justify-between gap-3">
                <View>
                  <Text accessibilityRole="header" className="text-[22px] leading-7 font-semibold text-foreground">
                    Room {room}
                  </Text>
                  <Text className="text-[13px] leading-[18px] text-muted">{roomType}</Text>
                </View>
                <Chip variant="soft" color="success">
                  <StatusDot tone="success" />
                  <Chip.Label>{revoked ? "Ready" : "Active"}</Chip.Label>
                </Chip>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={opened ? `Room ${room} unlocked. Tap to unlock again` : `Unlock room ${room}`}
                onPress={() => setOpened((value) => !value)}
                className={`size-44 items-center justify-center gap-2.5 rounded-full ${opened ? "bg-default" : "bg-accent"}`}
              >
                <Icon name={opened ? "LockOpen" : "Key"} size={44} tone={opened ? "foreground" : "accent-foreground"} />
                <Text className={`text-base font-semibold ${opened ? "text-foreground" : "text-accent-foreground"}`}>
                  {opened ? "Unlocked" : "Tap to unlock"}
                </Text>
              </Pressable>
              <Text
                accessibilityRole="text"
                className="max-w-[280px] text-center text-[13px] leading-[18px] text-foreground"
              >
                {opened
                  ? "Door unlocked, confirmed by the lock at 19:42. It locks again after 5 seconds."
                  : "Hold your phone within 10 cm of the lock with Bluetooth on."}
              </Text>
              <View className="flex-row items-center justify-center gap-1.5">
                <Icon name="Clock" size={14} tone="muted" />
                <Text className="text-xs text-muted">
                  Valid until {stay.keyValidUntil} · uses Bluetooth, no data needed
                </Text>
              </View>
            </Card>
          ) : null}

          {revoked ? (
            <Card variant="secondary" className="flex-row items-start gap-3 p-3 opacity-80">
              <IconTile name="Lock" />
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="font-semibold text-foreground">Room {stay.move.from} key</Text>
                <Text className="text-xs leading-4 text-muted">
                  Cancelled {stay.move.cancelledAt} after your room move · confirmed by the lock system
                </Text>
              </View>
              <SoftChip label="Cancelled" icon="Ban" />
            </Card>
          ) : null}

          {state === "provisioning" ? (
            <>
              <Card className="items-center gap-3.5 px-4 py-5">
                <Spinner size="lg" accessibilityLabel="Waiting for the lock system" />
                <View className="max-w-[290px] items-center gap-1">
                  <Text
                    accessibilityRole="header"
                    className="text-center text-[18px] leading-6 font-semibold text-foreground"
                  >
                    Your key is being issued
                  </Text>
                  <Text className="text-center text-[13px] leading-[18px] text-muted">
                    You checked in at {stay.keyRequestedAt}. We’ve asked the lock system for a key to room {stay.room}{" "}
                    and are waiting for it to confirm. This usually takes under a minute.
                  </Text>
                </View>
                <Button variant="secondary" isDisabled className="size-44 flex-col gap-2.5 rounded-full">
                  <Icon name="Lock" size={40} />
                  <Button.Label>Not ready yet</Button.Label>
                </Button>
                <Text className="text-xs text-muted">
                  {checks > 0
                    ? `Checked again at 15:1${3 + checks} · still waiting for the lock system`
                    : `Requested at ${stay.keyRequestedAt}`}
                </Text>
                <View className="w-full flex-row gap-2">
                  <Button variant="secondary" className="flex-1" onPress={() => setChecks((n) => Math.min(n + 1, 6))}>
                    <Icon name="ArrowsRotateRight" />
                    <Button.Label>Check again</Button.Label>
                  </Button>
                  <Link href={screenHref("GuestRequests") as never} asChild>
                    <Button variant="ghost" className="flex-1">
                      <Button.Label>Ask the desk</Button.Label>
                    </Button>
                  </Link>
                </View>
              </Card>
              <GuestTimeline label="Key progress" items={events.filter((event) => event.scenario === "issuing")} />
            </>
          ) : null}

          {state === "unavailable" ? (
            <>
              <Card accessibilityLabel="Key card" className="items-center gap-3 p-5">
                <IconTile name="Key" />
                <Text accessibilityRole="header" className="text-center text-base font-semibold text-foreground">
                  Collect your key card at the front desk
                </Text>
                <Text className="text-center text-[13px] leading-[18px] text-muted">
                  Room {stay.room} doesn’t have a digital lock, so there’s no phone key for this stay. Your key card is
                  ready at reception.
                </Text>
                <Link href={screenHref("GuestRequests") as never} asChild>
                  <Button variant="secondary">
                    <Icon name="Comments" />
                    <Button.Label>Message the front desk</Button.Label>
                  </Button>
                </Link>
              </Card>
              <Card variant="secondary" className="flex-row items-start gap-3 p-3.5">
                <IconTile name="Handset" />
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text className="font-semibold text-foreground">Lost your card?</Text>
                  <Text className="text-xs leading-4 text-muted">
                    Call +250 788 300 420 any time. We cancel the lost card at the desk and make you a new one.
                  </Text>
                </View>
              </Card>
            </>
          ) : null}

          {showKey ? (
            <>
              <View className="gap-2">
                <SectionTitle>Also Opens</SectionTitle>
                <ListGroup accessibilityLabel="Also opens">
                  {access.map((point, index) => (
                    <View key={point.id}>
                      {index > 0 ? <View className="mx-4 h-px bg-separator" /> : null}
                      <ListGroup.Item>
                        <ListGroup.ItemPrefix>
                          <Icon name={point.icon} tone="muted" />
                        </ListGroup.ItemPrefix>
                        <ListGroup.ItemContent>
                          <ListGroup.ItemTitle>{point.title}</ListGroup.ItemTitle>
                          <ListGroup.ItemDescription>{point.text}</ListGroup.ItemDescription>
                        </ListGroup.ItemContent>
                      </ListGroup.Item>
                    </View>
                  ))}
                </ListGroup>
              </View>
              <Card className="gap-2.5 p-4">
                <SectionTitle>Key Activity</SectionTitle>
                <GuestTimeline items={activity} />
              </Card>
            </>
          ) : null}

          <Card variant="secondary" className="gap-2.5 px-4 py-3.5">
            <Text accessibilityRole="header" className="text-sm leading-5 font-semibold text-foreground">
              Good to Know
            </Text>
            {notes.map((note) => (
              <IconRow key={note.id} icon={note.icon} text={note.text} />
            ))}
          </Card>
        </View>
      </PhoneBody>
    </>
  );
}
