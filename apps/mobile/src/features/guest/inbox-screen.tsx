import { router } from "expo-router";
import { ScrollView } from "react-native";
import { EmptyView } from "@/components/ui";
import { useSession } from "@/lib/session";
import { GuestHeader, SignInPrompt } from "./ui";

/**
 * Inbox (mobile spec 0005, AC-2): a sign in prompt signed out, a designed empty state signed in.
 * Messages with the hotel arrive with feature 33.
 */
export function InboxScreen() {
  const { account } = useSession();
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="grow">
      <GuestHeader title="Inbox" />
      {account ? (
        <EmptyView
          icon="Comments"
          title="No messages yet"
          body="Messages from the places you stay will show here."
          action={{ label: "Find a stay", icon: "Magnifier", onPress: () => router.navigate("/guest/explore") }}
        />
      ) : (
        <SignInPrompt
          icon="Comments"
          title="Messages from hotels"
          body="Sign in to read and answer messages from the places you stay."
          returnTo="/guest/inbox"
        />
      )}
    </ScrollView>
  );
}
