import { Slot, usePathname } from "expo-router";
import { View } from "react-native";
import { TabBar } from "@/components/phone";
import { GUEST_TABS, guestTabOf } from "@/features/guest/tabs";

/** The guest's five tabs (mobile spec 0005, D-c): Home, Explore, Trips, Inbox and Me. */
export default function GuestTabsLayout() {
  const pathname = usePathname();
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      <TabBar label="Guest app" tabs={GUEST_TABS} current={guestTabOf(pathname)} />
    </View>
  );
}
