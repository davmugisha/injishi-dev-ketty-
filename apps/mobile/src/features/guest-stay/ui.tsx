// What the guest stay screens share: back with a way home, the quiet eyebrow over a list, an accent link,
// a request's status chip, the round icon of a thread, bill figures and the skeleton bones. Built on the
// UI kit only.

import { type Href, router } from "expo-router";
import { Linking, View } from "react-native";
import {
  Card,
  Chip,
  Icon,
  type IconName,
  IconTile,
  LoadingBone,
  metrics,
  PressArea,
  Text,
  type Tone,
} from "@/components/ui";
import { rwf } from "@/lib/money";
import type { RequestStatus } from "./types";

/**
 * Back, as the prototype's arrow: the screen underneath when there is one, else `to` (a screen opened on
 * its own, from a link or the launcher, still has a way home).
 */
export function backOr(to: Href) {
  if (router.canGoBack()) router.back();
  else router.navigate(to);
}

/** Opens a screen in another tab or the outer stack, with that tab's root underneath for back. */
export function openScreen(to: Href) {
  router.push(to, { withAnchor: true });
}

/** Opens the phone's dialler on a number; a phone with none (the web preview) does nothing. */
export function callPhone(phone: string) {
  Linking.openURL(`tel:${phone}`).catch(() => {});
}

/** `.eyebrow`: a quiet capitalised heading over a list or a group of choices. */
export function Eyebrow({ children, className }: { children: string; className?: string }) {
  return (
    <Text role="micro" tone="muted" caps strong className={className}>
      {children}
    </Text>
  );
}

/** `.link`: accent words that open something, in a 48 high press area. */
export function TextLink({ label, onPress, hint }: { label: string; onPress: () => void; hint?: string }) {
  return (
    <PressArea
      onPress={onPress}
      accessibilityRole="link"
      accessibilityHint={hint}
      className="justify-center self-center overflow-hidden rounded-full px-2"
    >
      <Text role="callout" strong tone="accent" className="text-center">
        {label}
      </Text>
    </PressArea>
  );
}

/** A request's state as a tone and a word: never the colour alone. */
export const REQUEST_LOOK: Record<RequestStatus, { tone: Tone; label: string }> = {
  sent: { tone: "warning", label: "Sent" },
  "on-the-way": { tone: "info", label: "On the way" },
  done: { tone: "success", label: "Done" },
};

export function RequestChip({ status }: { status: RequestStatus }) {
  const look = REQUEST_LOOK[status];
  // Its own box: HeroUI aligns a chip to the start, and in a row it should centre.
  return (
    <View>
      <Chip tone={look.tone} label={look.label} />
    </View>
  );
}

/**
 * `.ava` holding an icon: a round soft disc, the mark of a desk or a service in the inbox. The kit's
 * icon tile, clipped round, so the glyph keeps the ink the palette measured on that tint.
 */
export function RoundIcon({ icon }: { icon: IconName }) {
  return (
    <View className="overflow-hidden rounded-full" style={{ width: metrics.avatar, height: metrics.avatar }}>
      <IconTile icon={icon} />
    </View>
  );
}

/** A bill line's figure without the currency ("140,000", "−140,000"): the total above names it. */
export function figure(amount: number): string {
  const digits = rwf(Math.abs(amount)).replace("RWF ", "");
  return amount < 0 ? `−${digits}` : digits;
}

/**
 * A soft success circle with a large mark: a linked stay, an open door. A success `Card` clipped round,
 * so the mark takes the tint's measured ink.
 */
export function SuccessMark({ icon, size }: { icon: IconName; size: "md" | "lg" }) {
  return (
    <View className={`overflow-hidden rounded-full ${size === "lg" ? "size-50" : "size-28"}`}>
      <Card tone="success" padding="none" className="flex-1">
        <View className="flex-1 items-center justify-center">
          <View style={{ transform: [{ scale: size === "lg" ? MARK_SCALE : 1 }] }}>
            <Icon name={icon} size={40} />
          </View>
        </View>
      </Card>
    </View>
  );
}

/** The prototype draws the open lock at 64; the kit's icons stop at 40, so the large mark scales up. */
const MARK_SCALE = 1.6;

// ---------- Skeleton bones, shaped like the screens

/** A list card of `rows` rows, each an icon tile and two lines. */
export function ListBones({ rows }: { rows: number }) {
  return (
    <View className="gap-3 rounded-3xl border border-separator p-3.5">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a bone is only a position
        <View key={i} className="flex-row items-center gap-3">
          <LoadingBone className="size-10 rounded-xl" />
          <View className="flex-1 gap-2">
            <LoadingBone className="h-3.5 w-3/5" />
            <LoadingBone className="h-3 w-4/5" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** A heading block: an eyebrow, a big line, a quiet line. */
export function HeadingBones() {
  return (
    <View className="gap-2.5">
      <LoadingBone className="h-3 w-1/4" />
      <LoadingBone className="h-8 w-1/2" />
      <LoadingBone className="h-3.5 w-3/4" />
    </View>
  );
}

/** A card's worth of bone. */
export function CardBone({ className }: { className: string }) {
  return <LoadingBone className={`w-full rounded-3xl ${className}`} />;
}
