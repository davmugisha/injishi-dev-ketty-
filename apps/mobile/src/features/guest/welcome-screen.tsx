import { Image } from "expo-image";
import { router } from "expo-router";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScopedTheme } from "uniwind";
import { Button, Icon, Text } from "@/components/ui";
import { startBrowsing } from "@/lib/welcome";

/**
 * The first thing a signed out phone shows (mobile spec 0005, AC-1, D-b), in the prototype's sign in
 * look (`shared-01-signin`): the hero, the name, and two ways in. Find a stay is remembered on the
 * device, so later starts open Explore; a sign out shows this again.
 */
export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  // The photograph takes a little over half the screen, as on the prototype.
  const heroHeight = Math.round(useWindowDimensions().height * 0.55);

  const findAStay = () => {
    startBrowsing();
    router.replace("/guest/explore");
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView bounces={false} contentContainerClassName="grow">
        {/* The hero always draws in the dark theme: light words on a dark scrim, in either mode. */}
        <ScopedTheme theme="dark">
          <View className="overflow-hidden" style={{ minHeight: heroHeight }}>
            <Image
              source={require("../../../assets/welcome-hero.jpg")}
              contentFit="cover"
              accessible={false}
              style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            />
            {/* The dark theme's backdrop as a scrim, so the words read on any part of the photograph. */}
            <View className="absolute inset-0 bg-backdrop" />
            <View className="flex-1 justify-between px-6 pb-12" style={{ paddingTop: insets.top + 16 }}>
              <View
                className="flex-row items-center gap-2"
                accessible
                accessibilityRole="header"
                accessibilityLabel="Injishi"
              >
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-overlay">
                  <Icon name="Sparkles" size={16} tone="accent" />
                </View>
                <Text role="title3">Injishi</Text>
              </View>
              <View className="gap-2">
                <Text role="display">Stays, leases and work, in one app</Text>
                <Text role="callout">Book across Rwanda, live in your home, or run your shift.</Text>
              </View>
            </View>
          </View>
        </ScopedTheme>
        <View
          className="-mt-6 grow gap-3 rounded-t-[28px] bg-background px-5 pt-6"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
        >
          <Button icon="Magnifier" onPress={findAStay}>
            Find a stay
          </Button>
          <Button variant="outline" icon="ArrowRightToSquare" onPress={() => router.push("/sign-in")}>
            Sign in
          </Button>
          <Text role="caption" tone="muted" className="text-center">
            Look around without an account. You only sign in to book.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
