import {
  type EasingName,
  easingCurves,
  type MotionStep,
  motionMs,
  type RnSpaceStep,
  rnSpace,
} from "@injishi/design-tokens";
import palette from "@injishi/design-tokens/native.json";
import Constants from "expo-constants";
import { Redirect, useFocusEffect } from "expo-router";
import { Card } from "heroui-native";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Uniwind, useCSSVariable, useUniwind } from "uniwind";
import {
  Button,
  buttonVariants,
  Chip,
  chipTones,
  EmptyView,
  ErrorView,
  Icon,
  IconButton,
  iconSizes,
  LoadingBone,
  LoadingView,
  metrics,
  PressArea,
  Row,
  RowAvatar,
  RowIcon,
  RowThumb,
  TestMoneyBanner,
  TestMoneyTag,
  Text,
  type TextRole,
  textRoles,
  textTones,
  UiSurface,
} from "@/components/ui";
import { appVariantFrom, designSystemAllowed } from "@/lib/app-variant";
import { haptic } from "@/lib/haptics";
import { paymentsMode } from "@/lib/payments-mode";
import { useReduceMotion } from "@/lib/use-reduce-motion";

/**
 * The design system preview (mobile spec 0002, AC-17, D-x): every colour role of the phone's
 * palette in the current theme, the type roles, the spacing steps, the corners, the motion steps,
 * every primitive in every variant, tone and size, and the state views, with a Light, Dark, System
 * switch.
 *
 * Development and preview builds only, by the build's variant; anything else, an unknown variant
 * included, goes to the start screen, a deep link too. The gate lives here, so the route file stays
 * one line. Placeholder words only: no names, prices or records.
 */
export default function DesignSystemScreen() {
  if (!designSystemAllowed(appVariantFrom(Constants.expoConfig?.extra))) return <Redirect href="/" />;
  return <DesignSystem />;
}

type Mode = "light" | "dark" | "system";
const MODES: { mode: Mode; label: string }[] = [
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
  { mode: "system", label: "System" },
];

/** Three fixed lengths: short, 40 characters and 80 characters (AC-9). */
const SAMPLES = [
  "Sample",
  "Placeholder text, forty characters long.",
  "Placeholder text that runs to eighty characters, so each role shows its wrapping",
] as const;

const THUMB = require("../../../assets/icon.png");

/** Every step of the 4 dp grid (D-v), in the package's order. */
const SPACE_STEPS = Object.keys(rnSpace).map(Number) as RnSpaceStep[];

/**
 * The corners the phone draws (D-u). HeroUI derives each step from the save's `--radius`; fields
 * take the save's `--field-radius`. `use` names what draws with it, read from HeroUI Native's
 * stylesheets and the kit.
 */
const CORNERS = [
  { className: "rounded-md", variable: "--radius-md", use: "Small boxes: the colour swatches above" },
  { className: "rounded-lg", variable: "--radius-lg", use: "Checkboxes, row tiles, thumbnails, skeleton bones" },
  { className: "rounded-xl", variable: "--radius-xl", use: "Small chips, sliders, the tiles and sections here" },
  { className: "rounded-2xl", variable: "--radius-2xl", use: "Chips, menus" },
  { className: "rounded-3xl", variable: "--radius-3xl", use: "Buttons at md, cards, dialogs, alerts" },
  { className: "rounded-4xl", variable: "--radius-4xl", use: "Buttons at lg, avatars, bottom sheets" },
  { className: "rounded-field", variable: "--radius-field", use: "Inputs and selects" },
  { className: "rounded-full", variable: null, use: "Icon buttons, press feedback" },
] as const;

const MOTION_STEPS = Object.keys(motionMs) as MotionStep[];
const CURVES = Object.keys(easingCurves) as EasingName[];

/** The motion demos' dot. */
const DOT = rnSpace[6];

/** The loading demo's three list rows. */
const LIST_BONES = ["first", "second", "third"] as const;

function DesignSystem() {
  const { theme } = useUniwind();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [mode, setMode] = useState<Mode>("system");
  const [picked, setPicked] = useState<string>("accent");
  const [pressCount, setPressCount] = useState(0);
  const pressed = () => setPressCount((n) => n + 1);

  // Leaving the screen hands the theme back to the phone's own setting.
  useFocusEffect(
    useCallback(
      () => () => {
        Uniwind.setTheme("system");
      },
      [],
    ),
  );

  const choose = (next: Mode) => {
    setMode(next);
    Uniwind.setTheme(next);
  };

  return (
    // A plain View, as on the other screens: Uniwind reads `className` on React Native's own
    // components only, so a SafeAreaView kept the navigator's grey behind the content.
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="gap-6 px-4"
        contentContainerStyle={{ paddingTop: insets.top + rnSpace[4], paddingBottom: insets.bottom + rnSpace[4] }}
      >
        <View className="gap-1">
          <Text role="micro" tone="muted" caps>
            Development and preview only
          </Text>
          <Text role="title1">Design system</Text>
          <Text role="callout" tone="muted">
            Leaving this screen sets the theme back to follow the phone.
          </Text>
        </View>

        <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
          {MODES.map(({ mode: option, label }) => (
            <Chip key={option} label={label} selected={option === mode} onPress={() => choose(option)} />
          ))}
        </View>

        <Section title={`Colour roles, ${theme}`}>
          {Object.entries(palette[theme]).map(([role, hex]) => (
            <View key={role} className="flex-row items-center gap-3">
              <View
                className="rounded-md border border-border"
                style={{ width: metrics.iconTile, height: metrics.iconTile, backgroundColor: hex }}
              />
              <View className="flex-1">
                <Text role="callout">{role}</Text>
                <Text role="caption" tone="muted">
                  {hex}
                </Text>
              </View>
            </View>
          ))}
        </Section>

        <Section title="Type roles">
          {(Object.keys(textRoles) as TextRole[]).map((role) => (
            <View key={role} className="gap-1 border-b border-separator pb-3">
              <Text role="micro" tone="muted" caps>
                {role}
              </Text>
              {SAMPLES.map((sample) => (
                <Text key={sample} role={role}>
                  {sample}
                </Text>
              ))}
            </View>
          ))}
        </Section>

        <Section title="Spacing, the 4 dp grid">
          {SPACE_STEPS.map((step) => (
            <View key={step} className="flex-row items-center gap-3">
              <View className="min-w-10">
                <Text role="callout">{step}</Text>
              </View>
              <View className="h-3 rounded-sm bg-accent" style={{ width: rnSpace[step] }} />
              <Text role="caption" tone="muted">
                {rnSpace[step]} dp
              </Text>
            </View>
          ))}
        </Section>

        <Section title="Corners">
          <Label>From the save</Label>
          <View>
            <CssLength variable="--radius" />
            <CssLength variable="--field-radius" />
          </View>
          <Text role="callout" tone="muted">
            HeroUI derives every step below from these two.
          </Text>
          {CORNERS.map(({ className, variable, use }) => (
            <View key={className} className="flex-row items-center gap-3">
              <View className={`h-16 w-16 border border-accent bg-accent-soft ${className}`} />
              <View className="flex-1">
                <Text role="callout">{className}</Text>
                {variable ? (
                  <CssLength variable={variable} />
                ) : (
                  <Text role="caption" tone="muted">
                    A circle: half the side, no variable
                  </Text>
                )}
                <Text role="caption" tone="muted">
                  {use}
                </Text>
              </View>
            </View>
          ))}
        </Section>

        <Section title="Motion">
          <Text role="callout" tone="muted">
            {reduceMotion
              ? "Reduce Motion is on, so these demos stay still."
              : "Tap a track to send its dot across, and again to bring it back."}
          </Text>
          <Label>Five durations, on the settle curve</Label>
          {MOTION_STEPS.map((step) => (
            <MotionDemo
              key={step}
              title={step}
              detail={`${motionMs[step]} ms`}
              step={step}
              curve="settle"
              still={reduceMotion}
            />
          ))}
          <Label>{`Four curves, over arrive (${motionMs.arrive} ms)`}</Label>
          {CURVES.map((curve) => (
            <MotionDemo
              key={curve}
              title={curve}
              detail={easingCurves[curve].join(", ")}
              step="arrive"
              curve={curve}
              still={reduceMotion}
            />
          ))}
        </Section>

        <Section title="Icons">
          <Label>Six sizes</Label>
          <View className="flex-row flex-wrap items-end gap-4">
            {iconSizes.map((size) => (
              <View key={size} className="items-center gap-1">
                <Icon name="House" size={size} />
                <Text role="caption" tone="muted">
                  {size}
                </Text>
              </View>
            ))}
          </View>
          <Label>Eight tones</Label>
          <View className="flex-row flex-wrap gap-3">
            {(Object.keys(textTones) as (keyof typeof textTones)[]).map((tone) => (
              <View
                key={tone}
                className={`items-center gap-1 rounded-lg p-2 ${tone === "onAccent" ? "bg-accent" : ""}`}
              >
                <Icon name="CircleCheck" size={24} tone={tone} />
                <Text role="caption" tone={tone}>
                  {tone}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Buttons">
          <Label>Every variant, md (48)</Label>
          {buttonVariants.map((variant) => (
            <Button key={variant} variant={variant} size="md" onPress={pressed}>
              {variant}
            </Button>
          ))}
          <Label>Every variant with an icon, lg (56)</Label>
          {buttonVariants.map((variant) => (
            <Button key={variant} variant={variant} size="lg" icon="ArrowRight" onPress={pressed}>
              {variant}
            </Button>
          ))}
          <Label>Long labels wrap; the button grows</Label>
          <Button onPress={pressed}>{SAMPLES[1]}</Button>
          <Button variant="secondary" onPress={pressed}>
            {SAMPLES[2]}
          </Button>
          <Button isDisabled onPress={pressed}>
            Disabled
          </Button>
          <Label>Inside a staff surface (default 56)</Label>
          <UiSurface kind="staff">
            <Button onPress={pressed}>Staff default</Button>
          </UiSurface>
          <Label>Outside any surface (default 48)</Label>
          <Button onPress={pressed}>Default</Button>
          <Text role="caption" tone="muted">
            Presses: {pressCount}
          </Text>
        </Section>

        <Section title="Icon buttons">
          <View className="flex-row flex-wrap gap-2">
            <IconButton icon="Bell" label="Sample action one" onPress={pressed} />
            <IconButton icon="Gear" label="Sample action two" tone="accent" onPress={pressed} />
            <IconButton icon="TrashBin" label="Sample action three" tone="danger" onPress={pressed} />
            <IconButton icon="Xmark" label="Sample action four" tone="muted" onPress={pressed} />
          </View>
        </Section>

        <Section title="Chips">
          <Label>Six tones, each with a word</Label>
          <View className="flex-row flex-wrap gap-2">
            {chipTones.map((tone) => (
              <Chip key={tone} tone={tone} label={tone} />
            ))}
          </View>
          <Label>With an icon</Label>
          <View className="flex-row flex-wrap gap-2">
            <Chip tone="success" icon="CircleCheck" label="Done" />
            <Chip tone="warning" icon="Clock" label="Waiting" />
            <Chip tone="danger" icon="TriangleExclamation" label="Blocked" />
            <Chip tone="info" icon="CircleInfo" label="Note" />
          </View>
          <Label>Selectable (ticks); the selected one is solid accent</Label>
          <View className="flex-row flex-wrap gap-2">
            {chipTones.map((tone) => (
              <Chip key={tone} tone={tone} label={tone} selected={picked === tone} onPress={() => setPicked(tone)} />
            ))}
          </View>
          <Label>A long chip label</Label>
          <View className="flex-row flex-wrap gap-2">
            <Chip tone="accent" label={SAMPLES[1]} />
          </View>
        </Section>

        <Section title="Rows" flush>
          <Row
            leading={<RowIcon name="Bell" tone="accent" />}
            title="Row title"
            subtitle="Subtitle text"
            trailing={<Text role="callout">Value</Text>}
            chevron
            onPress={pressed}
          />
          <Row leading={<RowAvatar />} title="Row with an avatar" subtitle="Subtitle text" chevron onPress={pressed} />
          <Row leading={<RowThumb source={THUMB} />} title="Row with a thumbnail" subtitle="Subtitle text" />
          <Row
            leading={<RowIcon name="CircleInfo" tone="info" />}
            title={SAMPLES[2]}
            subtitle={SAMPLES[1]}
            trailing={<Chip tone="success" label="Done" />}
          />
          <Row title="A row with only a title" onPress={pressed} />
        </Section>

        <Section title="Pressable card and tile">
          <PressArea onPress={pressed} accessibilityLabel="Sample card" className="overflow-hidden rounded-3xl">
            <Card variant="secondary">
              <Card.Body className="gap-1">
                <Text role="headline">Pressable card</Text>
                <Text role="callout" tone="muted">
                  Shrinks to 0.97 while pressed; under Reduce Motion it shows the pressed colour instead.
                </Text>
              </Card.Body>
            </Card>
          </PressArea>
          <View className="flex-row gap-3">
            {(["accent", "success"] as const).map((tone) => (
              <PressArea
                key={tone}
                onPress={pressed}
                accessibilityLabel={`Sample tile, ${tone}`}
                className="flex-1 items-start gap-2 overflow-hidden rounded-xl bg-surface-secondary p-4"
              >
                <RowIcon name="LayoutCells" tone={tone} />
                <Text role="headline">Tile</Text>
              </PressArea>
            ))}
          </View>
          <Text role="caption" tone="muted">
            Reduce Motion is {reduceMotion ? "on" : "off"}.
          </Text>
        </Section>

        <Section title="Haptics">
          <Text role="callout" tone="muted">
            The selectable chips above tick. These buzz; a plain button stays silent.
          </Text>
          <Button variant="secondary" onPress={haptic.selection}>
            Selection tick
          </Button>
          <Button variant="secondary" onPress={haptic.success}>
            Success buzz
          </Button>
          <Button variant="dangerSoft" onPress={haptic.error}>
            Error buzz
          </Button>
          <Button variant="outline" onPress={pressed}>
            Plain button, silent
          </Button>
        </Section>

        <Section title="State views">
          <Label>Loading: bones in the shape of a short list</Label>
          <Text role="callout" tone="muted">
            {reduceMotion ? "Reduce Motion is on, so the bones hold still." : "The bones shimmer while loading."}
          </Text>
          <LoadingView label="Loading the sample list">
            <LoadingBone className="h-8 w-3/5" />
            {LIST_BONES.map((key) => (
              <View key={key} className="flex-row items-center gap-3">
                <LoadingBone style={{ width: metrics.iconTile, height: metrics.iconTile }} />
                <View className="flex-1 gap-2">
                  <LoadingBone className="h-4 w-4/5" />
                  <LoadingBone className="h-3 w-1/2" />
                </View>
              </View>
            ))}
          </LoadingView>

          <Label>Empty: a next step, and an optional link</Label>
          <EmptyView
            icon="Tray"
            title="Nothing here yet"
            body={SAMPLES[2]}
            action={{ label: "Primary action", icon: "Plus", onPress: pressed }}
            secondary={{ label: "Secondary link", onPress: pressed }}
          />

          <Label>Error: the cause, a retry, an optional footnote</Label>
          <ErrorView
            icon="CloudSlash"
            title="Could not load this"
            body="Placeholder cause: the connection dropped. Nothing changed."
            onRetry={pressed}
            footnote={SAMPLES[1]}
          />

          <Label>{`Test money, while payments are ${paymentsMode}`}</Label>
          <Text role="callout" tone="muted">
            Shown in every build today; under live payments the tag and banner render nothing.
          </Text>
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text role="title3">Sheet title</Text>
            </View>
            <TestMoneyTag />
          </View>
          <TestMoneyBanner />
          <TestMoneyBanner detail={SAMPLES[2]} />
          <Text role="caption" tone="muted">
            Presses: {pressCount}
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, flush = false, children }: { title: string; flush?: boolean; children: ReactNode }) {
  return (
    <View className={`gap-3 overflow-hidden rounded-xl bg-surface ${flush ? "py-4" : "p-4"}`}>
      <View className={flush ? "px-4" : undefined}>
        <Text role="title3">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <Text role="micro" tone="muted" caps>
      {children}
    </Text>
  );
}

/** A length from the stylesheet, as Uniwind resolves it in the current theme (D-u). */
function CssLength({ variable }: { variable: string }) {
  const value = useCSSVariable(variable);
  const shown = value === undefined ? "not resolved" : typeof value === "number" ? `${value} dp` : value;
  return (
    <Text role="caption" tone="muted">
      {variable}: {shown}
    </Text>
  );
}

/**
 * One motion token, moving on tap: a dot crosses its track over `step`'s duration on `curve`, and
 * a second tap brings it back. Under Reduce Motion the dot goes home at once and the track does not
 * take presses.
 */
function MotionDemo({
  title,
  detail,
  step,
  curve,
  still,
}: {
  title: string;
  detail: string;
  step: MotionStep;
  curve: EasingName;
  still: boolean;
}) {
  // `progress` runs 0 to 1 (a little past 1 on the spring curve); `travel` is the track's free width.
  const progress = useSharedValue(0);
  const travel = useSharedValue(0);
  const dot = useAnimatedStyle(() => ({ transform: [{ translateX: progress.get() * travel.get() }] }));

  useEffect(() => {
    if (still) progress.set(0);
  }, [still, progress]);

  const play = () => {
    const to = progress.get() < 0.5 ? 1 : 0;
    const [x1, y1, x2, y2] = easingCurves[curve];
    progress.set(withTiming(to, { duration: motionMs[step], easing: Easing.bezier(x1, y1, x2, y2) }));
  };

  return (
    <View className="gap-1">
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-2">
        <Text role="headline">{title}</Text>
        <Text role="caption" tone="muted">
          {detail}
        </Text>
      </View>
      <PressArea
        feedback="native"
        onPress={play}
        isDisabled={still}
        accessibilityLabel={`Play ${title}, ${detail}`}
        className="justify-center overflow-hidden rounded-full bg-surface-secondary"
      >
        {/* The margin leaves room for the spring curve's overshoot inside the clipped track. */}
        <View className="mx-4" onLayout={(event) => travel.set(event.nativeEvent.layout.width - DOT)}>
          <Animated.View style={[{ width: DOT, height: DOT }, dot]}>
            <View className="flex-1 rounded-full bg-accent" />
          </Animated.View>
        </View>
      </PressArea>
    </View>
  );
}
