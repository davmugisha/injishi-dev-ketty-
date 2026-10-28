import palette from "@injishi/design-tokens/native.json";
import Constants from "expo-constants";
import { Redirect, useFocusEffect } from "expo-router";
import { Card } from "heroui-native";
import { type ReactNode, useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Uniwind, useUniwind } from "uniwind";
import {
  Button,
  buttonVariants,
  Chip,
  chipTones,
  Icon,
  IconButton,
  iconSizes,
  metrics,
  PressArea,
  Row,
  RowAvatar,
  RowIcon,
  RowThumb,
  Text,
  type TextRole,
  textRoles,
  textTones,
  UiSurface,
} from "@/components/ui";
import { appVariantFrom, designSystemAllowed } from "@/lib/app-variant";
import { haptic } from "@/lib/haptics";
import { useReduceMotion } from "@/lib/use-reduce-motion";

/**
 * The design system preview (mobile spec 0002, AC-17, D-x): every colour role of the phone's
 * palette in the current theme, the type roles, and every primitive in every variant, tone and size,
 * with a Light, Dark, System switch. Milestone 4 adds the spacing, corners, motion steps and the
 * state views.
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
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
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
