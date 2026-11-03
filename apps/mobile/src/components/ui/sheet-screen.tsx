import { easingCurves, motionMs, rnSpace } from "@injishi/design-tokens";
import { router } from "expo-router";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets, useSafeAreaFrame } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { OnGround } from "./ground";
import { IconButton } from "./icon-button";
import { metrics } from "./metrics";
import { BottomInset } from "./screen";
import { Text } from "./text";

export type SheetScreenProps = {
  /** `.sheet .h3`: the sheet's heading. Leave it out to draw a custom heading as the first child. */
  title?: string;
  /** One quiet line under the title. */
  subtitle?: string;
  /** At the heading's end: a `Chip`, `TestMoneyTag`. */
  right?: ReactNode;
  /** A close button at the heading's end (`.iconbtn.plain` with a cross), as the guest dates sheet. */
  closeButton?: boolean;
  /** Replaces closing by `router.back()`, e.g. to confirm first. Called after the sheet slides away. */
  onClose?: () => void;
  /** A `Dock` at the sheet's foot, fixed while the body scrolls. */
  dock?: ReactNode;
  children: ReactNode;
  /** The tallest the sheet grows, as a share of the screen. Default 0.88 (`.sheet`'s 88%). */
  maxHeight?: number;
};

/** A drag on the heading closes the sheet past this share of its height, or at this speed (dp/s). */
const CLOSE_AT = { share: 0.25, velocity: 900 } as const;

/** The sheet's moves: it arrives across the screen, leaves faster, and snaps back from a short drag. */
const ARRIVE = { duration: motionMs.travel, easing: Easing.bezier(...easingCurves.settle) };
const FADE_IN = { duration: motionMs.settle, easing: Easing.bezier(...easingCurves.settle) };
const LEAVE = { duration: motionMs.settle, easing: Easing.bezier(...easingCurves.leave) };
const SNAP_BACK = { duration: motionMs.quick, easing: Easing.bezier(...easingCurves.settle) };

/**
 * The body of a route presented as `transparentModal` (`.scrim` + `.sheet`): a scrim in the
 * `backdrop` role over the screen below, and a sheet on the surface (the second surface in the
 * dark theme) with 32 top corners, a grabber, a heading, a scrolling body and an optional dock.
 *
 * It slides up on mount (`travel`, on the `settle` curve) while the scrim fades in. It closes,
 * sliding away first, on a press on the scrim, a drag down on the grabber and heading, the close
 * button, Android's back, and VoiceOver's escape gesture; then `router.back()` (or `onClose`).
 * Under Reduce Motion it appears and goes at once. The keyboard lifts it.
 *
 * ```tsx
 * export function HkFoundScreen() {
 *   return (
 *     <SheetScreen title="Found an item" right={<Chip tone="accent" label="Room 204" />} dock={<Dock>…</Dock>}>
 *       …
 *     </SheetScreen>
 *   );
 * }
 * ```
 */
export function SheetScreen({
  title,
  subtitle,
  right,
  closeButton = false,
  onClose,
  dock,
  children,
  maxHeight = 0.88,
}: SheetScreenProps) {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const reduceMotion = useReduceMotion();
  const offset = useSharedValue(reduceMotion ? 0 : frame.height);
  const scrim = useSharedValue(reduceMotion ? 1 : 0);
  const sheetHeight = useSharedValue(frame.height);
  const closing = useRef(false);

  const finish = useCallback(() => {
    if (onClose) onClose();
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [onClose]);

  useEffect(() => {
    if (reduceMotion) {
      offset.set(0);
      scrim.set(1);
      return;
    }
    offset.set(withTiming(0, ARRIVE));
    scrim.set(withTiming(1, FADE_IN));
  }, [offset, scrim, reduceMotion]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (reduceMotion) {
      finish();
      return;
    }
    scrim.set(withTiming(0, LEAVE));
    offset.set(
      withTiming(sheetHeight.get(), LEAVE, (done) => {
        "worklet";
        if (done) scheduleOnRN(finish);
      }),
    );
  }, [finish, offset, scrim, sheetHeight, reduceMotion]);

  // Android's back closes the sheet the same way, sliding it away first.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const pan = usePanGesture({
    activeOffsetY: [-rnSpace[2], rnSpace[2]],
    onUpdate: (event) => {
      "worklet";
      offset.set(Math.max(0, event.translationY));
    },
    onDeactivate: (event) => {
      "worklet";
      const far = event.translationY > sheetHeight.get() * CLOSE_AT.share;
      if (far || event.velocityY > CLOSE_AT.velocity) {
        scheduleOnRN(close);
      } else {
        offset.set(withTiming(0, SNAP_BACK));
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));
  const hasHeading = Boolean(title || right || closeButton);

  return (
    <OnGround ground={null}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="flex-1 bg-backdrop"
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === "web" ? undefined : "padding"}
          style={{ flex: 1, justifyContent: "flex-end", pointerEvents: "box-none" }}
        >
          <Animated.View
            accessibilityViewIsModal
            onAccessibilityEscape={close}
            onLayout={(event) => sheetHeight.set(event.nativeEvent.layout.height)}
            className="overflow-hidden rounded-t-4xl bg-surface shadow-overlay dark:bg-surface-secondary"
            style={[{ maxHeight: frame.height * maxHeight }, sheetStyle]}
          >
            <GestureDetector gesture={pan}>
              <View className="px-4 pt-2.5">
                <View className="items-center pb-3.5" importantForAccessibility="no-hide-descendants">
                  <View
                    className="rounded-full bg-separator"
                    style={{ width: metrics.grabber.width, height: metrics.grabber.height }}
                  />
                </View>
                {hasHeading ? (
                  <View className="flex-row items-start gap-3 pb-3">
                    <View className="flex-1 gap-1">
                      {title ? (
                        <Text role="title3" strong accessibilityRole="header">
                          {title}
                        </Text>
                      ) : null}
                      {subtitle ? (
                        <Text role="callout" tone="muted">
                          {subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {right}
                    {closeButton ? (
                      <View className="-my-2 -mr-2">
                        <IconButton icon="Xmark" label="Close" variant="plain" onPress={close} />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </GestureDetector>
            <ScrollView
              className="shrink"
              contentContainerClassName="px-4"
              contentContainerStyle={{ paddingBottom: dock ? rnSpace[4] : insets.bottom + rnSpace[6] }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            {dock ? <BottomInset value={insets.bottom}>{dock}</BottomInset> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </OnGround>
  );
}
