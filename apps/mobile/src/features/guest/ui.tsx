// What the guest screens share (mobile spec 0005): the tab header, the sign in prompt with its way
// back, the pill drawn over a photograph, and the rating line. Built on the UI kit only.

import { router } from "expo-router";
import { type ReactNode, useCallback } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyView, Icon, type IconName, Text } from "@/components/ui";
import { useSession } from "@/lib/session";
import { ratingWords } from "./words";

/** A tab's title, under the status bar. */
export function GuestHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-row items-center justify-between gap-2 px-4 pb-2" style={{ paddingTop: insets.top + 12 }}>
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

/** A short label over a photograph ("Instant booking", "1 / 24"), on the theme's overlay surface. */
export function PhotoPill({ icon, label }: { icon?: IconName; label: string }) {
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full bg-overlay px-2.5 py-1">
      {icon ? <Icon name={icon} size={12} /> : null}
      <Text role="caption" maxScale={1.5}>
        {label}
      </Text>
    </View>
  );
}

/** "★ 4.6 (128)", or "New" with no star, read as one phrase. */
export function Rating({ rating, reviewCount }: { rating: number | null; reviewCount: number }) {
  const rated = rating !== null && reviewCount > 0;
  const words = ratingWords(rating, reviewCount);
  return (
    <View
      className="flex-row items-center gap-1"
      accessible
      accessibilityLabel={
        rated
          ? `Rated ${rating?.toFixed(1)} out of 5, ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`
          : "New, no reviews yet"
      }
    >
      {rated ? <Icon name="StarFill" size={16} /> : null}
      <Text role="callout">{words}</Text>
    </View>
  );
}
