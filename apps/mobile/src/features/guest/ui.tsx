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
  description?: string;
  children?: ReactNode;
}) {
  const tone = status === "default" ? "foreground" : status;
  return (
    <Alert status={status}>
      <Alert.Indicator>{indicator ?? (icon ? <Icon name={icon} tone={tone} /> : null)}</Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {description ? <Alert.Description>{description}</Alert.Description> : null}
        {children}
      </Alert.Content>
    </Alert>
  );
}

export function PhoneSheet({
  isOpen,
  onOpenChange,
  heading,
  description,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  heading: string;
  description?: string;
  children: ReactNode;
}) {
  // Mounted while closed on purpose: heroui-native snaps the sheet up when `isOpen` turns true, so a
  // sheet first mounted already open stays parked below the screen. heroui-native keeps a closed
  // sheet out of the paint itself.
  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["88%"]}
          enableOverDrag={false}
          enableDynamicSizing={false}
          contentContainerClassName="h-full"
        >
          <BottomSheetScrollView contentContainerClassName="gap-[14px] px-5 pt-2 pb-8">
            <BottomSheet.Title>{heading}</BottomSheet.Title>
            {description ? <BottomSheet.Description>{description}</BottomSheet.Description> : null}
            {children}
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

const STEP_TONE: Record<GuestStepStatus, "success" | "accent" | "muted" | "warning"> = {
  success: "success",
  current: "accent",
  default: "muted",
  warning: "warning",
};

export function GuestTimeline({
  label,
  items,
}: {
  label?: string;
  items: { id: string; status: GuestStepStatus; icon: string; title: string; detail: string }[];
}) {
  return (
    <View accessibilityLabel={label} className="gap-0">
      {items.map((item, index) => (
        <View key={item.id} className="flex-row gap-[10px]">
          <View className="w-6 items-center">
            <View className="size-6 items-center justify-center rounded-full bg-default">
              <Icon name={item.icon} size={12} tone={STEP_TONE[item.status]} />
            </View>
            {index < items.length - 1 ? <View className="w-px flex-1 bg-separator" /> : null}
          </View>
          <View className="min-w-0 flex-1 pb-3">
            <Text className="text-sm font-medium text-foreground">{item.title}</Text>
            {item.detail ? <Text className="text-xs leading-4 text-muted">{item.detail}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export function StepDots({
  label,
  steps,
  current,
  onStep,
}: {
  label: string;
  steps: { id: string; label: string }[];
  current: number;
  onStep?: (index: number) => void;
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
