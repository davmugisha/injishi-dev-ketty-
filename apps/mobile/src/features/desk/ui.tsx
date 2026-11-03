// Parts more than one desk screen draws: the back that survives a deep link, the time block of a
// guest row, the round marks of a payment's state, and the skeleton of a pushed screen.

import { type Href, router } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { type IconName, LoadingBone, LoadingView, metrics, Text } from "@/components/ui";
// The kit's own glyph, for a mark on a fill `Icon` has no tone for (the success disc's ink).
import { Glyph } from "@/components/ui/icon";

/**
 * Back, as the prototype's back button: the previous screen, or, opened from a link with nothing
 * underneath, the screen the prototype's back names.
 */
export function backOr(fallback: Href): () => void {
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };
}

/** "Can't connect" on a money screen: unlike a check-in, a payment never waits on the phone. */
export const PAYMENT_OFFLINE = "Payments need signal: nothing is charged until it is back.";

/**
 * Done with a pushed flow: close the screens above the tabs, then show Today, whichever tab the
 * flow started from (a walk-in starts on its own tab).
 */
export function toToday(today: Href): void {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(today);
}

/** `.mx-guest .tm`: a time (or a tent) over a quiet word, in a narrow column before the name. */
export function TimeBlock({ time, label }: { time: string; label: string }) {
  return (
    <View className="items-center" style={{ width: metrics.thumb }}>
      <Text role="headline" strong tabular maxScale={1.5}>
        {time}
      </Text>
      <Text role="micro" tone="muted">
        {label}
      </Text>
    </View>
  );
}

/** The palette pairs the two marks draw in: each fill's measured ink. */
const WAIT_INK = "accent-soft-foreground";
const DONE_INK = "success-foreground";

/**
 * `.mx-wait`: the waiting mark, a 96 rounded square on the accent tint with two faint accent rings
 * around it, so the screen says "in progress" before a word is read.
 */
export function WaitMark({ icon }: { icon: IconName }) {
  return (
    <View className="items-center justify-center self-center p-6" importantForAccessibility="no-hide-descendants">
      <View className="absolute inset-0 rounded-4xl border-2 border-accent opacity-10" />
      <View className="absolute inset-3 rounded-4xl border-2 border-accent opacity-25" />
      <View className="size-24 items-center justify-center rounded-4xl bg-accent-soft">
        <Glyph name={icon} size={40} role={WAIT_INK} />
      </View>
    </View>
  );
}

/** `.mx-done`: a 96 success disc with a tick, haloed by the success tint. */
export function DoneMark() {
  return (
    <View className="self-center rounded-full bg-success-soft p-2.5" importantForAccessibility="no-hide-descendants">
      <View className="size-24 items-center justify-center rounded-full bg-success">
        <Glyph name="Check" size={40} role={DONE_INK} />
      </View>
    </View>
  );
}

/** A pushed screen still loading: a card of lines, a block and two buttons' worth of bones. */
export function PushedSkeleton({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <LoadingView label={label} className="px-4 pt-2">
      {children}
      <LoadingBone className="h-44 rounded-3xl" />
      <LoadingBone className="h-5 w-2/5" />
      <LoadingBone className="h-28 rounded-3xl" />
      <LoadingBone className="h-20 rounded-3xl" />
    </LoadingView>
  );
}
