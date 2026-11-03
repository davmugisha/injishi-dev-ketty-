// What the guest's screens share: the rating and price lines, the heart that saves a stay, the
// sideways photo card (`.gx-ex`), a stay's photo or its initials, the tab header, and the sign in
// prompt with whether a real account is missing. Built on the UI kit only.

import { rnSpace } from "@injishi/design-tokens";
import { router } from "expo-router";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Card,
  Chip,
  EmptyView,
  Icon,
  IconButton,
  type IconButtonVariant,
  type IconName,
  metrics,
  Photo,
  Text,
  useToast,
} from "@/components/ui";
import { isMock } from "@/lib/data-mode";
import { useSession } from "@/lib/session";
import { useToggleSaved } from "./data";
import { PhotoPlaceholder } from "./photo";
import type { GuestPhoto } from "./types";

/** `.gx-rate`: "★ 4.6 (128)", or "New" with no star, read as one phrase. */
export function Rating({
  rating,
  reviewCount,
  reviewsWord = false,
}: {
  rating: number | null;
  reviewCount: number;
  /** "(128 reviews)", as the property page says it. */
  reviewsWord?: boolean;
}) {
  if (rating === null || reviewCount === 0) {
    return (
      <Text role="callout" strong>
        New
      </Text>
    );
  }
  const count = reviewsWord ? `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}` : String(reviewCount);
  return (
    <View
      className="flex-row items-center gap-1"
      accessible
      accessibilityLabel={`Rated ${rating.toFixed(1)} out of 5, ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`}
    >
      <Icon name="StarFill" size={12} />
      <Text role="callout" strong tabular>
        {rating.toFixed(1)}
      </Text>
      <Text role="callout" tone="muted" tabular>
        ({count})
      </Text>
    </View>
  );
}

/** `.gx-price`: "RWF 140,000 night", the figure strong and what it covers quiet. */
export function Price({ amount, note, big = false }: { amount: string; note?: string; big?: boolean }) {
  return (
    <Text role={big ? "headline" : "callout"} tone="muted" tabular>
      <Text role={big ? "title3" : "headline"} strong tabular>
        {amount}
      </Text>
      {note ? ` ${note}` : null}
    </Text>
  );
}

/**
 * `.gx-heart`: saves a stay to the account's list, or takes it off. The toast says which; in api mode,
 * where saving has no real call yet, it says that instead.
 */
export function SaveButton({
  slug,
  name,
  saved,
  variant = "glass",
}: {
  slug: string;
  name: string;
  saved: boolean;
  variant?: IconButtonVariant;
}) {
  const toggle = useToggleSaved();
  const toast = useToast();
  return (
    <IconButton
      icon={saved ? "HeartFill" : "Heart"}
      tone={saved ? "danger" : undefined}
      variant={variant}
      label={saved ? `Remove ${name} from saved` : `Save ${name}`}
      onPress={() =>
        toggle.mutate(slug, {
          onSuccess: (on) =>
            toast.show({
              icon: on ? "HeartFill" : "Heart",
              message: on ? `${name} saved` : `${name} removed from saved`,
            }),
          onError: () => toast.show({ icon: "CloudSlash", message: "Saving stays isn't connected yet" }),
        })
      }
    />
  );
}

/** Five stars, `stars` of them lit (`.gx-mini-stars`), read as "5 of 5 stars". */
export function Stars({ stars }: { stars: number }) {
  return (
    <View className="flex-row gap-0.5" accessible accessibilityLabel={`${stars} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name={n <= stars ? "StarFill" : "Star"} size={16} tone={n <= stars ? "warning" : "muted"} />
      ))}
    </View>
  );
}

/** `.gx-ex`: a photo card in a sideways row, pressable when it leads somewhere. */
export function PhotoCard({
  title,
  detail,
  photo,
  onPress,
  wide = true,
}: {
  title: string;
  detail: string;
  photo: GuestPhoto;
  onPress?: () => void;
  /** 220 wide (`.gx-ex`); the stay's Tonight row is a little narrower. */
  wide?: boolean;
}) {
  return (
    <View style={{ width: wide ? CARD_WIDE : CARD_NARROW }}>
      <Card padding="none" onPress={onPress} accessibilityLabel={onPress ? `${title}, ${detail}` : undefined}>
        <Photo source={photo} height={metrics.photo.tile} radius="none" />
        <View className="gap-0.5 px-3 pb-3 pt-2.5">
          <Text role="callout" strong numberOfLines={1}>
            {title}
          </Text>
          <Text role="caption" tone="muted" numberOfLines={2}>
            {detail}
          </Text>
        </View>
      </Card>
    </View>
  );
}

/** `.gx-ex`'s widths: a card and a bit of the next one show, so the row reads as scrolling. */
const CARD_WIDE = metrics.photo.tile * 2 - metrics.rowInset;
const CARD_NARROW = metrics.photo.tile + metrics.photo.thumb;

/** `.hscroll`: cards in a row that scrolls sideways, 16 in from the edges. */
export function SideScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4">
      {children}
    </ScrollView>
  );
}

// ---------- The tab header and sign in (the guest stay screens use them too), from the screens before
// this port, and what the tabs that need an account (Trips, Me) do in api mode.

/** A tab's title, under the status bar. */
export function GuestHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-row items-center justify-between gap-2 px-4 pb-2" style={{ paddingTop: insets.top + rnSpace[3] }}>
      <Text role="title1">{title}</Text>
      {trailing}
    </View>
  );
}

/**
 * Open sign in, keeping where to come back to (D-av): sign in, the code, the step up and Google all end
 * at the start route, which reads it once.
 */
export function useSignInFrom(path: string): () => void {
  const { setPendingReturn } = useSession();
  return useCallback(() => {
    setPendingReturn(path);
    router.push("/sign-in");
  }, [path, setPendingReturn]);
}

/**
 * Api mode with nobody signed in: a tab that needs an account (Trips, Me) offers sign in instead. The
 * sample data answers for its guest without an account, so mock mode is never signed out here.
 */
export function useSignedOut(): boolean {
  const { account } = useSession();
  return !isMock && account === null;
}

/**
 * Signed in a moment ago and now signed out (api mode): the start route, which shows the welcome again
 * (mobile spec 0005, D-b). The sample data's sign out goes there itself.
 */
export function useWelcomeAfterSignOut(): void {
  const { account, status } = useSession();
  const wasSignedIn = useRef(account !== null);
  useEffect(() => {
    if (isMock) return;
    if (account) {
      wasSignedIn.current = true;
    } else if (wasSignedIn.current && status === "signed-out") {
      wasSignedIn.current = false;
      router.replace("/");
    }
  }, [account, status]);
}

/**
 * A stay's photograph on the kit's `Photo`, or, where there is none (a trip from the API carries no
 * photo), its initials on a tint of the same shape. A badge sits top left: a glass chip on the photo,
 * a plain one on the tint.
 */
export function StayPhoto({
  source,
  name,
  height,
  width,
  radius = "lg",
  badge,
}: {
  source: GuestPhoto | null;
  /** The stay's name, for its initials. */
  name: string;
  height: number;
  /** A thumbnail's width; without it the photo fills its parent. */
  width?: number;
  /** `lg` (24) for a card photo, `md` (16) for a thumbnail. */
  radius?: "md" | "lg";
  badge?: { icon: IconName; label: string };
}) {
  if (source) {
    return (
      <Photo
        source={source}
        width={width}
        height={height}
        radius={radius}
        topLeft={badge ? <Chip variant="glass" icon={badge.icon} label={badge.label} /> : undefined}
      />
    );
  }
  return (
    <View className={`overflow-hidden ${radius === "md" ? "rounded-2xl" : "rounded-3xl"}`} style={{ width, height }}>
      <PhotoPlaceholder name={name} large={width === undefined} />
      {badge ? (
        <View className="absolute left-3 top-3">
          <Chip icon={badge.icon} label={badge.label} />
        </View>
      ) : null}
    </View>
  );
}

/** A tab that needs an account, signed out (AC-2): what it holds, and Sign in, which comes back here. */
export function SignInPrompt({
  icon,
  title,
  body,
  returnTo,
}: {
  icon: IconName;
  title: string;
  body: string;
  returnTo: string;
}) {
  const signIn = useSignInFrom(returnTo);
  return <EmptyView icon={icon} title={title} body={body} action={{ label: "Sign in", onPress: signIn }} />;
}
