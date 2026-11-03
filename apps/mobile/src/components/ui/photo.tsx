import { motionMs, rnSpace } from "@injishi/design-tokens";
import { Image, type ImageProps } from "expo-image";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { ScopedTheme, useCSSVariable } from "uniwind";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { OnPhoto } from "./ground";
import { metrics } from "./metrics";
import { useSvgId } from "./svg";

/**
 * The prototype's photo scrims, as stops down the photo: `[offset, opacity]`, with `page` for a
 * stop that fades into the page itself.
 *
 * - `hero`: `.hero::after`, dark at the top for the status bar, clear in the middle, dark at the foot.
 * - `bleed`: `.gx-bleed::after`, the guest home: a deeper foot under the greeting.
 * - `fade`: `.hero-fade::after`, a deep foot that melts into the page.
 * - `bottom`: `.gx-photo-up::after`, clear above 40%, dark at the foot under a caption.
 * - `top`: dark at the top only, under a row of glass buttons.
 */
const SCRIMS = {
  hero: [
    [0, 0.5],
    [0.28, 0],
    [0.55, 0],
    [1, 0.55],
  ],
  bleed: [
    [0, 0.55],
    [0.26, 0],
    [0.48, 0.05],
    [0.78, 0.62],
    [1, 0.78],
  ],
  fade: [
    [0, 0.55],
    [0.3, 0],
    [0.64, 0.6],
    [0.82, 0.3],
    [1, "page"],
  ],
  bottom: [
    [0.4, 0],
    [1, 0.7],
  ],
  top: [
    [0, 0.5],
    [0.32, 0],
  ],
} as const satisfies Record<string, readonly (readonly [number, number | "page"])[]>;

export type PhotoScrimPreset = keyof typeof SCRIMS;

/**
 * A photo's gradient scrim, so light words stay legible on any picture. Drawn with
 * react-native-svg in the dark theme's `background` (the prototype's deep teal shade), whatever the
 * phone's theme; `fade`'s last stop is the page's own `background`. Fills its parent; decoration.
 */
export function PhotoScrim({ preset = "hero" }: { preset?: PhotoScrimPreset }) {
  const page = useCSSVariable("--color-background");
  return (
    <ScopedTheme theme="dark">
      <ScrimLayer preset={preset} page={String(page)} />
    </ScopedTheme>
  );
}

function ScrimLayer({ preset, page }: { preset: PhotoScrimPreset; page: string }) {
  const shade = String(useCSSVariable("--color-background"));
  const id = useSvgId("scrim");
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {SCRIMS[preset].map(([offset, alpha]) => (
            <Stop
              key={offset}
              offset={offset}
              stopColor={alpha === "page" ? page : shade}
              stopOpacity={alpha === "page" ? 1 : alpha}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill={`url(#${id})`} />
    </Svg>
  );
}

const RADIUS = {
  none: "",
  sm: "rounded-xl",
  md: "rounded-2xl",
  lg: "rounded-3xl",
  full: "rounded-full",
} as const;

export type PhotoProps = {
  /** A bundled photo (`protoImages[...]`), a URI, or an expo-image source. */
  source: ImageProps["source"];
  /** A fixed height (`metrics.photo.card`). Without it, `aspect` sets the height from the width. */
  height?: number;
  /** Width over height, e.g. `1` for a square thumbnail, `4 / 3`. */
  aspect?: number;
  /** A fixed width, for a thumbnail beside text (`metrics.photo.thumb`). Otherwise it fills its parent. */
  width?: number;
  /** `lg` (24, a card photo) by default; `sm` 12 and `md` 16 for thumbnails; `none` inside a clipped card. */
  radius?: keyof typeof RADIUS;
  /** A scrim for words on the photo. Default none; `bottom` under a caption. */
  scrim?: PhotoScrimPreset;
  /** Read aloud. Without it the photo is decoration (the words beside it name it). */
  label?: string;
  /** Overlay corners and foot, in the photo's light ink: chips top left, a heart top right, dots or a caption at the foot. */
  topLeft?: ReactNode;
  topRight?: ReactNode;
  bottom?: ReactNode;
  /** Anything else over the photo, positioned by the caller (`absolute`), in the light ink. */
  children?: ReactNode;
  /** Which part of the picture to keep when it is cropped. Default the centre; a portrait `top`. */
  focus?: ImageProps["contentPosition"];
  /** Layout only. */
  className?: string;
};

/**
 * `.img` and the prototype's photo cards (`.gx-pcard .ph-im`, `.gx-photo-up`): a cropped photo on
 * the third surface while it loads, rounded and clipped, with optional overlay slots. Words and
 * controls in the slots draw in the dark theme's roles, light in both themes.
 */
export function Photo({
  source,
  height,
  aspect,
  width,
  radius = "lg",
  scrim,
  label,
  topLeft,
  topRight,
  bottom,
  children,
  focus,
  className,
}: PhotoProps) {
  const reduceMotion = useReduceMotion();
  const hasOverlay = Boolean(topLeft || topRight || bottom || children);
  return (
    <View
      className={["overflow-hidden bg-surface-tertiary", RADIUS[radius], className].filter(Boolean).join(" ")}
      style={{ height, width, aspectRatio: height ? undefined : aspect }}
    >
      {/* The label sits on the picture, not the box, so the controls over it stay reachable. */}
      <Image
        source={source}
        contentFit="cover"
        contentPosition={focus}
        transition={reduceMotion ? 0 : motionMs.settle}
        accessible={Boolean(label)}
        accessibilityRole={label ? "image" : undefined}
        accessibilityLabel={label}
        style={StyleSheet.absoluteFill}
      />
      {scrim ? <PhotoScrim preset={scrim} /> : null}
      {hasOverlay ? (
        <OnPhoto>
          {children}
          {topLeft ? <View className="absolute left-3 top-3 flex-row gap-1.5">{topLeft}</View> : null}
          {topRight ? <View className="absolute right-2.5 top-2.5">{topRight}</View> : null}
          {bottom ? <View className="absolute inset-x-3 bottom-3">{bottom}</View> : null}
        </OnPhoto>
      ) : null}
    </View>
  );
}

export type PhotoHeroProps = {
  source: ImageProps["source"];
  /** Default `metrics.photo.hero` (300); the guest home's greeting uses `metrics.photo.bleed`. */
  height?: number;
  /** Default `hero`; `bleed` for a greeting at the foot; `fade` to melt into the page. */
  scrim?: PhotoScrimPreset;
  /**
   * A row at the top, below the status bar (glass buttons, a place pill): space between, 16 in.
   * Pair it with `Screen bleed`, so the photo runs under the status bar.
   */
  top?: ReactNode;
  /** The foot: an eyebrow chip, a title, a line under it, 16 in and 24 up from the bottom. */
  children?: ReactNode;
  /** Read aloud. Without it the photo is decoration. */
  label?: string;
  /** `false` when the hero does not start at the top of the screen: no status bar room above `top`. */
  underStatusBar?: boolean;
  focus?: ImageProps["contentPosition"];
};

/**
 * `.hero` / `.gx-bleed`: a full-width photo under the status bar with its scrim, a top row of
 * controls and words at the foot, all in the photo's light ink. The next card may overlap its
 * foot (`-mt-5`), as the prototype's `.gx-lift` does.
 */
export function PhotoHero({
  source,
  height = metrics.photo.hero,
  scrim = "hero",
  top,
  children,
  label,
  underStatusBar = true,
  focus,
}: PhotoHeroProps) {
  const insets = useSafeAreaInsets();
  return (
    <Photo source={source} height={height} radius="none" scrim={scrim} label={label} focus={focus}>
      <View className="flex-1 justify-between pb-6" style={{ pointerEvents: "box-none" }}>
        <View
          className="flex-row items-center justify-between gap-2 px-4"
          style={{ paddingTop: (underStatusBar ? insets.top : 0) + rnSpace[2], pointerEvents: "box-none" }}
        >
          {top}
        </View>
        <View className="gap-1 px-4" style={{ pointerEvents: "box-none" }}>
          {children}
        </View>
      </View>
    </Photo>
  );
}
