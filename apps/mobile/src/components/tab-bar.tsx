import { rnSpace } from "@injishi/design-tokens";
import { type BottomTabBarProps, Tabs } from "expo-router/js-tabs";
import { Text as NativeText, View } from "react-native";
import { Icon, type IconName, PressArea, Text } from "@/components/ui";
import { roleText } from "@/components/ui/text";
import { useThemeBackground } from "@/proto/app-stack";
import { APP_LABELS, type AppKey, type TabBadges, type TabFolder } from "@/proto/screens";

/** One tab of an app's bar: its folder under `(tabs)/` (the route name), its word and its glyph. */
export interface TabSpec<F extends string = string> {
  readonly folder: F;
  readonly label: string;
  readonly icon: IconName;
}

/** The icon box the badges sit on; the prototype's 23 px glyph is the kit's 24. */
const ICON = 24;
/** The prototype's `.count` (a pill on the grid's 20) and `.tdot` (8), placed off the glyph's centre. */
const COUNT = { height: rnSpace[5], top: -6, left: ICON / 2 + 5 } as const;
const DOT = { size: rnSpace[2], top: -2, left: ICON / 2 + 8 } as const;
/** The count's figures: the `micro` role, kept at its size so they stay inside the pill. */
const COUNT_TEXT = roleText("micro");

/**
 * An app's tabs (proto-ui, PLAN.md "Routes"): expo-router's JS `Tabs`, one per folder in `tabs`, each
 * folder its own Stack, drawn with the app's bar below. Only the folders listed here become tabs.
 */
export function AppTabs<A extends AppKey>({
  app,
  tabs,
  badges,
}: {
  app: A;
  tabs: readonly TabSpec<TabFolder<A>>[];
  /** From the app's `use<App>TabBadges()`. */
  badges: TabBadges<A>;
}) {
  const background = useThemeBackground();
  const label = `${APP_LABELS[app]} app`;
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: background } }}
      tabBar={(props) => (
        <TabBar {...props} label={label} tabs={tabs} badges={badges as Partial<Record<string, number | true>>} />
      )}
    >
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.folder} name={tab.folder} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}

/**
 * The bar itself, in the prototype's look (`.tabbar`): the surface with a separator above, each tab a
 * glyph over its word, the current one in the accent; a count (`.count`) or a dot (`.tdot`) in danger
 * when the app's badges hook says so. Pressing the current tab again takes its Stack back to its root.
 */
export function TabBar({
  state,
  emitter,
  navigateToTab,
  insets,
  label,
  tabs,
  badges,
}: BottomTabBarProps & {
  label: string;
  tabs: readonly TabSpec[];
  badges: Partial<Record<string, number | true>>;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      className="flex-row border-t border-separator bg-surface"
      style={{
        paddingTop: rnSpace[1],
        paddingHorizontal: rnSpace[1],
        paddingBottom: Math.max(insets.bottom, rnSpace[2]),
      }}
    >
      {state.routes.map((route, index) => {
        const tab = tabs.find((t) => t.folder === route.name);
        if (!tab) return null;
        const focused = index === state.index;
        const badge = badges[tab.folder];
        const onPress = () => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        // Never by colour alone: a screen reader hears the count, or that something is new.
        const spoken = badge === true ? `${tab.label}, new` : badge ? `${tab.label}, ${badge} new` : tab.label;
        return (
          <PressArea
            key={route.key}
            onPress={onPress}
            feedback="native"
            accessibilityRole="tab"
            accessibilityLabel={spoken}
            accessibilityState={{ selected: focused }}
            className="flex-1 items-center justify-center overflow-hidden rounded-2xl"
          >
            <View className="items-center gap-0.5">
              <View>
                <Icon name={tab.icon} size={ICON} tone={focused ? "accent" : "muted"} />
                {badge === true ? (
                  <View
                    className="absolute rounded-full bg-danger"
                    style={{ top: DOT.top, left: DOT.left, width: DOT.size, height: DOT.size }}
                  />
                ) : badge ? (
                  <View
                    className="absolute items-center justify-center rounded-full bg-danger px-1"
                    style={{ top: COUNT.top, left: COUNT.left, minWidth: COUNT.height, height: COUNT.height }}
                  >
                    <NativeText
                      maxFontSizeMultiplier={1}
                      className={`${COUNT_TEXT.className} text-danger-foreground`}
                      style={COUNT_TEXT.style}
                    >
                      {badge > 99 ? "99+" : String(badge)}
                    </NativeText>
                  </View>
                ) : null}
              </View>
              <Text role="micro" tone={focused ? "accent" : "muted"} numberOfLines={1}>
                {tab.label}
              </Text>
            </View>
          </PressArea>
        );
      })}
    </View>
  );
}
