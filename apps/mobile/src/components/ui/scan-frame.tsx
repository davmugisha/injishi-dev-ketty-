import { easingCurves, motionMs } from "@injishi/design-tokens";
import { Image, type ImageProps } from "expo-image";
import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useCSSVariable } from "uniwind";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { OnPhoto } from "./ground";
import { metrics } from "./metrics";
import { Text } from "./text";

/** The four corner marks: which two sides each draws, and its rounded corner. */
const CORNERS = [
  { key: "tl", className: "left-0 top-0 rounded-tl-3xl border-l-4 border-t-4" },
  { key: "tr", className: "right-0 top-0 rounded-tr-3xl border-r-4 border-t-4" },
  { key: "bl", className: "bottom-0 left-0 rounded-bl-3xl border-b-4 border-l-4" },
  { key: "br", className: "bottom-0 right-0 rounded-br-3xl border-b-4 border-r-4" },
] as const;

export type ScanFrameProps = {
  /** A photo behind the frame, blurred and dimmed: the camera's view (`.gx-scan`, `.mx-cam .shot`). */
  photo?: ImageProps["source"];
  /** The instruction at the top ("Fit the ID inside the frame"). */
  label?: string;
  /** Inside the frame: a document stand-in, a `QrCode`. */
  children?: ReactNode;
  /** At the foot: a result chip ("Passport read · sharp"). */
  status?: ReactNode;
  /** The frame's side. Default 240 (`.scanframe`). */
  size?: number;
  /** Whether the scan line sweeps. Default on; it holds still under Reduce Motion. */
  scanning?: boolean;
};

/**
 * A camera stand-in (this build has no camera): a dark ground or a dimmed photo, four light corner
 * marks around a square frame and an accent scan line sweeping it, with an instruction above and a
 * result below, all in the photo's light ink. Decoration to a screen reader but for its words.
 */
export function ScanFrame({
  photo,
  label,
  children,
  status,
  size = metrics.scanFrame.size,
  scanning = true,
}: ScanFrameProps) {
  return (
    <OnPhoto>
      <View className="items-center gap-4 overflow-hidden rounded-3xl bg-background px-4 py-5">
        {photo ? (
          <Image
            source={photo}
            contentFit="cover"
            blurRadius={BLUR}
            accessible={false}
            style={[StyleSheet.absoluteFill, { opacity: PHOTO_DIM }]}
          />
        ) : null}
        {label ? (
          <Text role="callout" strong className="text-center">
            {label}
          </Text>
        ) : null}
        <Frame size={size} scanning={scanning}>
          {children}
        </Frame>
        {status ?? null}
      </View>
    </OnPhoto>
  );
}

/** The camera photo's blur and how much of it shows through the dark ground (`blur(2px) brightness(.55)`). */
const BLUR = 6;
const PHOTO_DIM = 0.55;

function Frame({ size, scanning, children }: { size: number; scanning: boolean; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const [accent] = useCSSVariable(["--color-accent"]);
  const [height, setHeight] = useState(size);
  const sweep = useSharedValue(0.48);
  useEffect(() => {
    if (reduceMotion || !scanning) {
      cancelAnimation(sweep);
      sweep.set(0.48);
      return;
    }
    sweep.set(0.15);
    sweep.set(
      withRepeat(
        withTiming(0.85, { duration: motionMs.arrive * 4, easing: Easing.bezier(...easingCurves.move) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(sweep);
  }, [reduceMotion, scanning, sweep]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: sweep.get() * height }] }));
  return (
    <View
      className="items-center justify-center"
      style={{ width: size, height: size }}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      importantForAccessibility="no-hide-descendants"
    >
      {children}
      {CORNERS.map((corner) => (
        <View
          key={corner.key}
          className={`absolute border-foreground ${corner.className}`}
          style={{ width: metrics.scanFrame.corner, height: metrics.scanFrame.corner }}
        />
      ))}
      <Animated.View
        className="absolute inset-x-3.5 top-0 rounded-full"
        style={[
          {
            height: metrics.scanFrame.stroke,
            backgroundColor: String(accent),
            boxShadow: `0 0 18px 4px ${String(accent)}`,
          },
          line,
        ]}
      />
    </View>
  );
}
