import "../global.css";
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  useFonts,
} from "@expo-google-fonts/figtree";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { type HeroUINativeConfig, HeroUINativeProvider, useThemeColor } from "heroui-native";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";
import { DataProvider } from "@/data/data-provider";
import { SessionProvider } from "@/lib/session";
import { initStore } from "@/lib/store";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { OVERLAY_OPTIONS } from "@/proto/app-stack";

// The splash (drawn by the native build, on the theme's background) stays up until the fonts are
// ready, the root background is set and the first screen has laid out (mobile spec 0002, D-w).
SplashScreen.preventAutoHideAsync().catch(() => {});

// The embedded database is created and seeded from @injishi/data before the first render.
initStore();

// HeroUI's own text grows with the phone's font size up to 2x, the cap the UI kit's Text
// uses for every role but chrome (mobile spec 0002, D-k).
const TEXT_PROPS: HeroUINativeConfig["textProps"] = { maxFontSizeMultiplier: 2 };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  // Under Reduce Motion nothing animates, live (D-q, D-ab); the pressables show the pressed colour.
  const reduceMotion = useReduceMotion();
  const config = useMemo<HeroUINativeConfig>(
    () => ({ textProps: TEXT_PROPS, animation: reduceMotion ? "disable-all" : undefined }),
    [reduceMotion],
  );
  // Fonts that fail to load leave the system font, never a blank app (AC-7).
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HeroUINativeProvider config={config}>
          <ThemeChrome>
            <SessionProvider>
              <DataProvider>
                <StatusBar style="auto" />
                <Stack screenOptions={{ headerShown: false, contentStyle: { flex: 1 } }}>
                  {/* The prototype's root modals draw their own scrim and sheet over the app beneath. */}
                  <Stack.Screen name="switcher" options={OVERLAY_OPTIONS} />
                  <Stack.Screen name="test-money" options={OVERLAY_OPTIONS} />
                </Stack>
              </DataProvider>
            </SessionProvider>
          </ThemeChrome>
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Everything behind the screens follows the theme (mobile spec 0002, D-w, AC-7): the window's own
 * background through expo-system-ui, and the navigator's through a theme built from the palette,
 * so no default grey or white shows between the splash, a transition and the first screen. Once
 * both are in place and the root has laid out, the splash goes.
 */
function ThemeChrome({ children }: { children: ReactNode }) {
  const { theme } = useUniwind();
  const [background, surface, foreground, border, accent, danger] = useThemeColor([
    "background",
    "surface",
    "foreground",
    "border",
    "accent",
    "danger",
  ]);
  const [backgroundSet, setBackgroundSet] = useState(false);
  const [laidOut, setLaidOut] = useState(false);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(background)
      .catch(() => {})
      .finally(() => setBackgroundSet(true));
  }, [background]);

  useEffect(() => {
    if (backgroundSet && laidOut) SplashScreen.hideAsync().catch(() => {});
  }, [backgroundSet, laidOut]);

  const navigationTheme = useMemo(() => {
    const base = theme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background,
        card: surface,
        text: foreground,
        border,
        primary: accent,
        notification: danger,
      },
    };
  }, [theme, background, surface, foreground, border, accent, danger]);

  return (
    <ThemeProvider value={navigationTheme}>
      <View className="flex-1 bg-background" onLayout={() => setLaidOut(true)}>
        {children}
      </View>
    </ThemeProvider>
  );
}
