// Pieces the resident screens share (prototype `d-resident.mjs` CSS): the calendar block of a rent
// month, an amount with its currency, links in a dock, the eyebrow, back with a fallback, and the
// skeleton parts every screen's `LoadingView` is built from.

import { type Href, router } from "expo-router";
import { type ReactNode, useMemo } from "react";
import { View } from "react-native";
import { type IconName, LoadingBone, LoadingView, metrics, PressArea, Text, useToast } from "@/components/ui";
// The kit sets a tinted part's ground inside its own components and exports no setter. Two resident
// parts paint a fill the kit has no component for (the red call button, the waiting disc), so `Fill`
// sets the ground the same way the kit does.
import { OnGround } from "@/components/ui/ground";
import { softGround, solidGround } from "@/components/ui/tone";

/**
 * Back, as the prototype's back arrow: the previous screen when there is one, else the screen the
 * prototype names (a deep link or the launcher opened this one first).
 */
export function backOr(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

const FILLS = {
  soft: { accent: "bg-accent-soft", danger: "bg-danger-soft", surface: "bg-surface" },
  solid: { accent: "bg-accent", danger: "bg-danger", surface: "bg-surface" },
} as const;

function groundOf(tone: "accent" | "danger" | "surface", solid: boolean) {
  if (tone === "surface") return null;
  return solid ? solidGround(tone) : softGround(tone);
}

/**
 * A box on a tone's fill (soft, or `solid` as `.rx-callbtn`), whose words and glyphs without a tone
 * take the palette's measured pair for that fill, as inside a tinted `Card`. `surface` is the neutral
 * page surface again, for a part drawn on a fill (the white disc of the call button).
 */
export function Fill({
  tone,
  solid = false,
  className,
  children,
}: {
  tone: "accent" | "danger" | "surface";
  solid?: boolean;
  /** Layout and corners: `size-36 rounded-full items-center justify-center`. */
  className?: string;
  children: ReactNode;
}) {
  const fill = FILLS[solid ? "solid" : "soft"][tone];
  return (
    <OnGround ground={groundOf(tone, solid)}>
      <View className={[fill, className].filter(Boolean).join(" ")}>{children}</View>
    </OnGround>
  );
}

/**
 * The error view's last line on the money screens (`shared-error`): money needs a connection, and
 * what still works without one. The other screens keep the seam's own line (writes are kept).
 */
export const MONEY_OFFLINE = "Payments need a connection. Requests and messages still work offline.";

/** `.eyebrow`: a small capitalised label above a figure or a group. */
export function Eyebrow({ children, className }: { children: string; className?: string }) {
  return (
    <Text role="micro" tone="muted" caps strong className={className}>
      {children}
    </Text>
  );
}

/** `.rx-month .cal`: a month over a day, the date a rent was due or paid. */
export function MonthBlock({ month, day }: { month: string; day: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${day} ${month}`}
      className="h-12 w-11 items-center justify-center rounded-xl bg-surface-secondary"
    >
      <Text role="micro" tone="muted" caps strong maxScale={1.2}>
        {month}
      </Text>
      <Text role="headline" strong tabular maxScale={1.2}>
        {day}
      </Text>
    </View>
  );
}

/** `.rx-rent .amt`: "RWF" small and quiet before the figure, which is large and tabular. */
export function Amount({ value, size = "display" }: { value: number; size?: "display" | "title2" }) {
  const figure = Math.round(value).toLocaleString("en-US");
  return (
    <View accessible accessibilityLabel={`RWF ${figure}`} className="flex-row items-baseline gap-1.5">
      <Text role={size === "display" ? "headline" : "callout"} tone="muted" strong>
        RWF
      </Text>
      <Text role={size} tabular>
        {figure}
      </Text>
    </View>
  );
}

/** `.link`: accent words that act, on a 48 high press area. */
export function TextLink({
  label,
  onPress,
  size = "callout",
  className,
}: {
  label: string;
  onPress: () => void;
  size?: "callout" | "caption";
  /** Layout only: `-my-3` keeps a link from making its line 48 tall. */
  className?: string;
}) {
  return (
    <PressArea
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      className={["justify-center", className].filter(Boolean).join(" ")}
    >
      <Text role={size} strong tone="accent">
        {label}
      </Text>
    </PressArea>
  );
}

/** `.dock .note` with links in it ("I won't renew · Ask Solange a question"). */
export function DockLinks({ links }: { links: readonly { label: string; onPress: () => void }[] }) {
  return (
    <View className="-my-2 flex-row flex-wrap items-center justify-center gap-x-2">
      {links.map((link, index) => (
        <View key={link.label} className="flex-row items-center gap-2">
          {index > 0 ? (
            <Text role="caption" tone="muted">
              ·
            </Text>
          ) : null}
          <TextLink label={link.label} onPress={link.onPress} size="caption" />
        </View>
      ))}
    </View>
  );
}

/**
 * The two toasts a write ends with: what happened, or that it did not go through (in api mode every
 * write fails "Not connected yet" until the API has it).
 */
export function useNotify() {
  const toast = useToast();
  return useMemo(
    () => ({
      done(message: string, icon: IconName = "CircleCheck") {
        toast.show({ message, icon, haptic: "success" });
      },
      failed(error?: Error) {
        toast.show({
          message: error?.message.startsWith("Not connected yet")
            ? "Not connected yet. Nothing was sent."
            : "That didn't go through. Try again.",
          icon: "CircleExclamation",
          haptic: "error",
        });
      },
    }),
    [toast],
  );
}

/** A centred column of a figure and its words (`.center`), the head of a money screen. */
export function Centered({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={["items-center gap-1", className].filter(Boolean).join(" ")}>{children}</View>;
}

// ── Skeletons ───────────────────────────────────────────────────────────────

/** A loading screen's bones, 16 in from the edges, in the order the content will arrive. */
export function Skeleton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <LoadingView label={label} className="px-4 pt-2">
      {children}
    </LoadingView>
  );
}

/** A card's bone: `md` a summary card, `lg` the rent or lease card, `sm` a one-line card. */
export function CardBone({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const height = { sm: "h-16", md: "h-28", lg: "h-52" }[size];
  return <LoadingBone className={`${height} rounded-3xl`} />;
}

/** A grouped list's bone: `rows` rows of 64. */
export function ListBone({ rows = 3 }: { rows?: number }) {
  return <LoadingBone className="rounded-3xl" style={{ height: rows * metrics.rowLarge }} />;
}

/** A title's bone, with an optional line under it. */
export function TitleBone({ line = false }: { line?: boolean }) {
  return (
    <View className="gap-2">
      <LoadingBone className="h-8 w-3/5" />
      {line ? <LoadingBone className="h-4 w-4/5" /> : null}
    </View>
  );
}
