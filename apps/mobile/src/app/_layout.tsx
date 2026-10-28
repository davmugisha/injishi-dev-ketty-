import "../global.css";
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  useFonts,
} from "@expo-google-fonts/figtree";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type HeroUINativeConfig, HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/lib/session";
import { initStore } from "@/lib/store";

// The embedded database is created and seeded from @injishi/data before the first render.
initStore();

// HeroUI's own text grows with the phone's font size up to 2x, the cap the UI kit's Text
// uses for every role but chrome (mobile spec 0002, D-k).
const HEROUI_CONFIG: HeroUINativeConfig = { textProps: { maxFontSizeMultiplier: 2 } };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold });
  if (!fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HeroUINativeProvider config={HEROUI_CONFIG}>
          <SessionProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { flex: 1 } }} />
          </SessionProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
