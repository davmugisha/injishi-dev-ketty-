import { rnSpace } from "@injishi/design-tokens";
import { useFocusEffect } from "expo-router";
import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { setStatusBarStyle } from "expo-status-bar";
import { createContext, type ReactNode, type Ref, useCallback, useContext, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable, useUniwind } from "uniwind";
import { OnGround } from "./ground";
import { metrics } from "./metrics";
import { Text } from "./text";

/**
 * How far the bottom of a screen sits from the phone's home indicator: the safe area inset, or 0
 * when a tab bar is below (the tab bar takes the inset). `Dock` and `Composer` pad by it; outside
 * a `Screen` (a sheet) it is the safe area inset.
 */
const BottomInsetContext = createContext<number | null>(null);

export function useBottomInset(): number {
  const own = useContext(BottomInsetContext);
  const insets = useSafeAreaInsets();
  return own ?? insets.bottom;
}

/** Provides the bottom inset to the `Dock` or `Composer` inside, for a part that is not a `Screen`. */
export function BottomInset({ value, children }: { value: number; children: ReactNode }) {
  return <BottomInsetContext.Provider value={value}>{children}</BottomInsetContext.Provider>;
}

export type ScreenProps = {
  children: ReactNode;
  /** The body scrolls (default). `false` gives a plain flex column, for a map or a list that scrolls itself. */
  scroll?: boolean;
  /**
   * A photo under the status bar (`.gx-bleed`, a property hero): no top inset, light status bar
   * text. The `PhotoHero` at the top pads its own controls below the status bar.
   */
  bleed?: boolean;
  /** Fixed above the body, below the status bar: a `NavBar` that stays while the body scrolls. */
  header?: ReactNode;
  /** Fixed at the bottom: a `Dock` (the screen's main action). */
  dock?: ReactNode;
  /** Fixed at the bottom and lifted with the keyboard: a `Composer`. */
  footer?: ReactNode;
  /** Pull to refresh. Both or neither. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /**
   * Whether a tab bar sits below this screen. Absent, it is read from the navigator: a screen in
   * an expo-router `Tabs` layout (a tab root or a tab's own stack) has one, any other does not.
   * Set it only to override that.
   */
  tabBar?: boolean;
  /** Layout of the scrolling content, e.g. `gap-3`. It already pads the bottom. */
  contentClassName?: string;
  /** For a screen that scrolls to an element. */
  scrollRef?: Ref<ScrollViewInstance>;
};

/**
 * A page (PLAN.md, Kit: chrome). It paints the `background`, keeps the status bar clear unless
 * `bleed`, scrolls its body (with pull to refresh when given `onRefresh`), and pins an optional
 * `dock` or `footer` to the bottom. The keyboard lifts the dock and the footer.
 *
 * Bottom inset: a dock or a footer pads by the safe area, unless a tab bar is below. That is read
 * from expo-router's tab navigator (`BottomTabBarHeightContext`, present only inside `Tabs`), so a
 * tab root and a tab's stack need nothing; `tabBar` overrides it.
 *
 * Status bar: while focused, the screen sets the status bar's words to read on its ground: light
 * over a `bleed` photo (until it scrolls past a hero's height) or in the dark theme, dark otherwise.
 * A screen in a `ScopedTheme` (the manager app) follows its scope.
 */
export function Screen({
  children,
  scroll = true,
  bleed = false,
  header,
  dock,
  footer,
  refreshing = false,
  onRefresh,
  tabBar,
  contentClassName,
  scrollRef,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const hasTabBar = tabBar ?? inTabs;
  const bottomInset = hasTabBar ? 0 : insets.bottom;
  const { theme } = useUniwind();
  // Over a bleed photo the status bar is light; once the photo scrolls away it reads on the page.
  const [pastPhoto, setPastPhoto] = useState(false);
  const statusStyle = (bleed && !pastPhoto) || theme === "dark" ? "light" : "dark";
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(statusStyle);
    }, [statusStyle]),
  );
  const accent = useCSSVariable("--color-accent");
  const bottomEnd = dock || footer ? 0 : bottomInset;

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      className="flex-1"
      contentContainerClassName={contentClassName}
      contentContainerStyle={{ paddingBottom: bottomEnd + rnSpace[5], flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      onScroll={
        bleed
          ? (event) => {
              const past = event.nativeEvent.contentOffset.y > metrics.photo.hero - insets.top - metrics.header;
              if (past !== pastPhoto) setPastPhoto(past);
            }
          : undefined
      }
      scrollEventThrottle={bleed ? SCROLL_THROTTLE : undefined}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={String(accent)}
            colors={[String(accent)]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View className={["flex-1", contentClassName].filter(Boolean).join(" ")} style={{ paddingBottom: bottomEnd }}>
      {children}
    </View>
  );

  return (
    <OnGround ground={null}>
      <BottomInsetContext.Provider value={bottomInset}>
        <View className="flex-1 bg-background" style={{ paddingTop: bleed ? 0 : insets.top }}>
          <KeyboardAvoidingView
            // Android draws edge to edge (SDK 58), so the window no longer shrinks for the keyboard:
            // both platforms pad the column instead. The web's keyboard never covers the page.
            behavior={Platform.OS === "web" ? undefined : "padding"}
            style={{ flex: 1 }}
          >
            {header}
            {body}
            {dock}
            {footer}
          </KeyboardAvoidingView>
        </View>
      </BottomInsetContext.Provider>
    </OnGround>
  );
}

/** How often a bleed screen hears its scroll, in ms: once a frame is more than the status bar needs. */
const SCROLL_THROTTLE = 32;

export type DockProps = {
  /** The action: a `Button`, two in a row, or a summary line and a button. */
  children: ReactNode;
  /** `.dock .note`: one quiet centred line under the action. */
  note?: string;
  /** `.dock.clear`: no surface and no hairline, the page's ground showing through. */
  clear?: boolean;
};

/**
 * `.dock`: the bottom action area on the surface with a hairline above, padded clear of the home
 * indicator (or the tab bar). Use it as `Screen`'s `dock`, or at the end of a `SheetScreen`.
 */
export function Dock({ children, note, clear = false }: DockProps) {
  const bottom = useBottomInset();
  return (
    <OnGround ground={null}>
      <View
        className={`gap-2 px-4 pt-3 ${clear ? "" : "border-t border-separator bg-surface"}`}
        style={{ paddingBottom: bottom + rnSpace[3] }}
      >
        {children}
        {note ? (
          <Text role="caption" tone="muted" className="text-center">
            {note}
          </Text>
        ) : null}
      </View>
    </OnGround>
  );
}
