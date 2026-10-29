import palette from "@injishi/design-tokens/native.json";
import { Redirect, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Uniwind, useUniwind } from "uniwind";
import { metrics, Text, type TextRole, textRoles } from "@/components/ui";

/**
 * The design system preview (mobile spec 0002, AC-17, D-x): every colour role of the
 * phone's palette in the current theme, and the type roles, with a Light, Dark, System
 * switch. Milestone 2 builds the first half; the primitives and state views join it as
 * they land.
 *
 * Development builds only. The gate lives here, so the route file stays one line;
 * milestone 3 moves it from `__DEV__` to the build variant. Placeholder words only:
 * no names, prices or records.
 */
export default function DesignSystemScreen() {
  if (!__DEV__) return <Redirect href="/" />;
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

function DesignSystem() {
  const { theme } = useUniwind();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("system");

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
            Development only
          </Text>
          <Text role="title1">Design system</Text>
          <Text role="callout" tone="muted">
            Leaving this screen sets the theme back to follow the phone.
          </Text>
        </View>

        <View accessibilityRole="radiogroup" className="flex-row gap-2">
          {MODES.map(({ mode: option, label }) => {
            const selected = option === mode;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => choose(option)}
                style={{ minHeight: metrics.touch }}
                className={`flex-1 items-center justify-center rounded-lg border px-3 ${
                  selected ? "border-accent bg-accent" : "border-border bg-surface"
                }`}
              >
                <Text role="headline" tone={selected ? "onAccent" : "default"}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
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
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3 rounded-xl bg-surface p-4">
      <Text role="title3">{title}</Text>
      {children}
    </View>
  );
}
