import { router } from "expo-router";
import { ScrollView } from "react-native";
import { EmptyView } from "@/components/ui";
import { GuestHeader } from "./ui";

/**
 * Home, before it follows a stay (mobile spec 0005, AC-2): a designed empty state that leads to Explore,
 * for everyone. Feature 28 replaces it with the Home that changes with the guest's stay.
 */
export function HomeScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="grow">
      <GuestHeader title="Home" />
      <EmptyView
        icon="Compass"
        title="Find your next stay"
        body="Search hotels, lodges and homes across Rwanda, from the lake to the city. Your stay shows here once you book."
        action={{ label: "Explore stays", icon: "Magnifier", onPress: () => router.navigate("/guest/explore") }}
      />
    </ScrollView>
  );
}
