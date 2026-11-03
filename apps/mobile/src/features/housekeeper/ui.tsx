// What the staff phone screens share, built on the UI kit only: navigation with a way home, the header
// with the outbox chip (`.sx-head`), a room's row (`.sx-room`), the big state tile of a confirmation,
// a ticking clock, and skeleton bones.

import { type Href, router } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { View } from "react-native";
import {
  Avatar,
  Card,
  Chip,
  Icon,
  IconButton,
  type IconName,
  ListGroup,
  LoadingBone,
  metrics,
  PressArea,
  roomStatusLook,
  StatusPill,
  Text,
} from "@/components/ui";
import { protoImages } from "@/proto/images";
import { href } from "@/proto/screens";
import { useSurface } from "@/proto/surface";
import type { RoomLine, StaffApp, StaffPerson, SyncState } from "./types";

/** Which staff app this screen is mounted in (Me, schedule, PIN and hours are shared): the housekeeper's by default. */
export function useStaffApp(): StaffApp {
  const surface = useSurface();
  return surface === "supervisor" || surface === "technician" ? surface : "housekeeper";
}

/**
 * Back, as the prototype's arrow: the screen underneath when there is one, else `to` (a screen opened on
 * its own, from a link or the launcher, still has a way home).
 */
export function backOr(to: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(to);
}

/** Opens a screen in another tab or the outer stack, with that tab's root underneath for back. */
export function openScreen(to: Href) {
  router.push(to, { withAnchor: true });
}

/** Switches to a tab's root. */
export function openTab(to: Href) {
  router.navigate(to, { withAnchor: true });
}

/** A portrait, or the initials on the person's tint. */
export function PersonAvatar({ person, size }: { person: StaffPerson; size: "m" | "xl" }) {
  return (
    <Avatar
      size={size}
      source={person.portrait ? protoImages[person.portrait] : undefined}
      name={person.fullName}
      tone={person.tone}
    />
  );
}

/** The outbox chip: what waits on this phone, opening the outbox. */
export function SyncChip({ sync }: { sync: SyncState }) {
  return (
    <PressArea
      onPress={() => router.push(href("shared-outbox"))}
      accessibilityRole="button"
      accessibilityLabel={`${sync.label}. Open what is on this phone.`}
      className="justify-center"
    >
      <Chip
        label={sync.label}
        tone={sync.tone}
        icon={sync.tone === "success" ? "CloudCheck" : sync.tone === "danger" ? "CircleExclamation" : "CloudSlash"}
        size="lg"
      />
    </PressArea>
  );
}

/** `.sx-head`: her portrait (opens Me), name and floor, the outbox chip and the bell. */
export function StaffHeader({
  person,
  sync,
  hasInbox,
}: {
  person: StaffPerson;
  sync: SyncState;
  hasInbox: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2.5 px-4 pb-3 pt-1">
      <PressArea
        onPress={() => router.navigate(href("hk-me"))}
        accessibilityRole="button"
        accessibilityLabel={`${person.name}. Open Me.`}
        className="justify-center"
      >
        <PersonAvatar person={person} size="m" />
      </PressArea>
      <View className="flex-1">
        <Text role="headline" strong numberOfLines={1}>
          {person.name}
        </Text>
        {person.place ? (
          <Text role="caption" tone="muted" numberOfLines={1}>
            {person.place}
          </Text>
        ) : null}
      </View>
      <SyncChip sync={sync} />
      {hasInbox ? (
        <IconButton
          icon="Bell"
          label="Notifications"
          variant="surface"
          dot
          onPress={() => router.push(href("shared-notifs"))}
        />
      ) : null}
    </View>
  );
}

/** What a room's row says aloud: number, words, then its state. */
function spokenRoom(line: RoomLine): string {
  const state = line.later ? "Later" : (line.statusLabel ?? roomStatusLook[line.status].word);
  return [`Room ${line.room}`, line.title, line.detail, state].filter(Boolean).join(", ");
}

/** `.sx-room`: the room number large, two lines, and its state (a pill, or a quiet Later chip). */
export function RoomRow({ line, onPress }: { line: RoomLine; onPress?: () => void }) {
  const body = (
    <View className="flex-row items-center gap-3 px-3.5 py-2.5" style={{ minHeight: metrics.rowLarge }}>
      <Text role="title2" tabular className="w-12">
        {line.room}
      </Text>
      <View className="flex-1 gap-0.5">
        <Text role="callout" strong>
          {line.title}
        </Text>
        {line.detail ? (
          <Text role="caption" tone="muted">
            {line.detail}
          </Text>
        ) : null}
      </View>
      {line.later ? <Chip label="Later" /> : <StatusPill status={line.status} label={line.statusLabel} />}
    </View>
  );
  if (!onPress) return body;
  return (
    <PressArea onPress={onPress} feedback="native" accessibilityLabel={spokenRoom(line)} className="overflow-hidden">
      {body}
    </PressArea>
  );
}

/** A `.list` of rooms, each opening its task. */
export function RoomList({ lines, onOpen }: { lines: readonly RoomLine[]; onOpen: (room: string) => void }) {
  return (
    <ListGroup className="mx-4">
      {lines.map((line) => (
        <RoomRow key={line.room} line={line} onPress={() => onOpen(line.room)} />
      ))}
    </ListGroup>
  );
}

/** The confirmation's big tile, title and line (`204 is clean`, `Saved on this phone`). */
export function StateHero({
  icon,
  tone,
  title,
  body,
}: {
  icon: IconName;
  tone: "success" | "warning";
  title: string;
  body: string;
}) {
  return (
    <View className="items-center gap-4 px-6 pt-2">
      <Card tone={tone} padding="none" className="size-24">
        <View className="flex-1 items-center justify-center">
          <Icon name={icon} size={40} />
        </View>
      </Card>
      <View className="items-center gap-2">
        <Text role="title1" className="text-center">
          {title}
        </Text>
        <Text role="body" tone="muted" className="text-center">
          {body}
        </Text>
      </View>
    </View>
  );
}

/** A small accent link that is a button (`.link`), with its 48 press area. */
export function TextLink({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <PressArea
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      className="justify-center self-center px-2"
    >
      <Text role="callout" strong tone="accent">
        {label}
      </Text>
    </PressArea>
  );
}

/** The time now, read again every second while `running`, for a clock on screen. */
export function useTicker(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [running]);
  return now;
}

/** "18:42": minutes and seconds, or hours too past an hour. */
export function clockWords(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

/** A stack of bones 16 in, for the skeletons. */
export function Bones({ children }: { children: ReactNode }) {
  return <View className="gap-3 px-4">{children}</View>;
}

/** A row-shaped list of bones. */
export function ListBones({ rows }: { rows: number }) {
  return (
    <View className="gap-px overflow-hidden rounded-3xl">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a bone is a position
        <LoadingBone key={i} className="h-16 rounded-none" />
      ))}
    </View>
  );
}
