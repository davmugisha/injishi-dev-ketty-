import { rnSpace } from "@injishi/design-tokens";
import Constants from "expo-constants";
import { Redirect, router } from "expo-router";
import { Input, TextField } from "heroui-native";
import { useMemo, useState } from "react";
import { SectionList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Uniwind, useUniwind } from "uniwind";
import { Chip, IconButton, Row, RowIcon, Text } from "@/components/ui";
import { appVariantFrom, designSystemAllowed } from "@/lib/app-variant";
import { isMock } from "@/lib/data-mode";
import {
  APP_KEYS,
  APP_LABELS,
  type AppKey,
  appHome,
  href,
  SCREEN_IDS,
  SCREENS,
  type ScreenApp,
  type ScreenDef,
  type ScreenId,
} from "./screens";
import { protoSession, protoSignIn, setProtoRole } from "./session";

/** The groups in the prototype's order: the shared screens, then each app. */
const GROUPS: readonly ScreenApp[] = ["shared", ...APP_KEYS];

/** Long enough for the parent's navigator to mount before its sheet is pushed over it. */
const OVER_DELAY_MS = 300;

const KIND_WORDS: Record<ScreenDef["kind"], string> = {
  root: "screen",
  modal: "modal",
  tab: "tab",
  tabstack: "in a tab",
  stack: "screen",
  sheet: "sheet",
  state: "state",
};

function subtitleOf(screen: ScreenDef): string {
  const where = screen.over
    ? `${KIND_WORDS[screen.kind]} over ${screen.over}`
    : screen.of
      ? `${screen.of} ${KIND_WORDS[screen.kind]}`
      : KIND_WORDS[screen.kind];
  return `${screen.id} · ${where}`;
}

/** With its anchors: a screen inside a tab opens over that tab's root, a stack screen over the tabs. */
const WITH_ANCHOR = { withAnchor: true } as const;

/**
 * Open a prototype screen as the prototype shows it. The app's role is set first (a shared screen keeps
 * the current one, and opens inside that app when it has a place there). A sheet or modal opens over
 * its parent screen; a state opens its screen with the state forced.
 */
function openScreen(id: ScreenId): void {
  const screen = SCREENS[id];
  if (screen.app !== "shared") setProtoRole(screen.app);
  const role = protoSession().role ?? undefined;
  const target = href(id, undefined, { app: screen.app === "shared" ? role : undefined });
  if (screen.over) {
    router.push(href(screen.over, undefined, { app: role }), WITH_ANCHOR);
    setTimeout(() => router.push(target, WITH_ANCHOR), OVER_DELAY_MS);
    return;
  }
  router.push(target, WITH_ANCHOR);
}

function signInAs(app: AppKey): void {
  protoSignIn(app);
  router.push(appHome(app), WITH_ANCHOR);
}

type Mode = "system" | "light" | "dark";

/** Sample data builds, and development and preview builds; a production build never lists the screens. */
const LAUNCHER_ALLOWED = isMock || designSystemAllowed(appVariantFrom(Constants.expoConfig?.extra));

/**
 * `/dev/prototype` (proto-ui, sample data mode): every prototype screen by app, in the prototype's order,
 * with a search, the theme, and a way to sign in as each app's person. Nothing here needs an account or
 * a backend; a screen not built yet opens as its placeholder.
 */
export function LauncherScreen() {
  if (!LAUNCHER_ALLOWED) return <Redirect href="/" />;
  return <Launcher />;
}

function Launcher() {
  const insets = useSafeAreaInsets();
  const { theme, hasAdaptiveThemes } = useUniwind();
  // The choice outlives the screen (browse the apps in dark), so it is read back from Uniwind.
  const mode: Mode = hasAdaptiveThemes ? "system" : theme === "dark" ? "dark" : "light";
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (screen: ScreenDef) => {
      const haystack = `${screen.id} ${screen.title} ${APP_LABELS[screen.app]}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    };
    return GROUPS.map((group) => ({
      group,
      data: SCREEN_IDS.map((id) => SCREENS[id]).filter((s) => s.app === group && matches(s)),
    })).filter((section) => section.data.length > 0);
  }, [query]);

  const choose = (next: Mode) => Uniwind.setTheme(next);

  const header = (
    <View className="gap-6 pb-2">
      <View className="gap-2">
        <Text role="micro" caps tone="muted">
          Theme
        </Text>
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
          {(["system", "light", "dark"] as const).map((option) => (
            <Chip
              key={option}
              label={option === "system" ? `Phone (${theme})` : option === "light" ? "Light" : "Dark"}
              selected={mode === option}
              onPress={() => choose(option)}
            />
          ))}
        </View>
        <Text role="caption" tone="muted">
          The manager app always draws dark, as the prototype shows it.
        </Text>
      </View>
      <View className="gap-1">
        <Text role="micro" caps tone="muted">
          Sign in as
        </Text>
        <View className="-mx-4">
          {APP_KEYS.map((app) => (
            <Row
              key={app}
              leading={<RowIcon name="Person" />}
              title={APP_LABELS[app]}
              subtitle={`Signed in, the ${APP_LABELS[app].toLowerCase()} app opens`}
              chevron
              onPress={() => signInAs(app)}
            />
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <View className="gap-3 px-4 pb-3" style={{ paddingTop: insets.top + rnSpace[2] }}>
        <View className="flex-row items-center gap-2">
          {router.canGoBack() ? <IconButton icon="ArrowLeft" label="Back" onPress={() => router.back()} /> : null}
          <View className="flex-1">
            <Text role="title2">Prototype screens</Text>
            <Text role="caption" tone="muted">
              {`${SCREEN_IDS.length} screens, sample data, no account needed`}
            </Text>
          </View>
        </View>
        <TextField>
          <Input
            placeholder="Search by title or id"
            accessibilityLabel="Search screens"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </TextField>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(screen) => screen.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: rnSpace[4], paddingBottom: insets.bottom + rnSpace[8] }}
        ListHeaderComponent={query ? undefined : header}
        ListEmptyComponent={
          <Text role="callout" tone="muted" className="py-6 text-center">
            No screen matches that search.
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <Text role="micro" caps tone="muted" className="pt-6 pb-1">
            {`${APP_LABELS[section.group]} · ${section.data.length}`}
          </Text>
        )}
        renderItem={({ item }) => (
          <View className="-mx-4">
            <Row title={item.title} subtitle={subtitleOf(item)} chevron onPress={() => openScreen(item.id)} />
          </View>
        )}
      />
    </View>
  );
}
