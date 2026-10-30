import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { ScrollView, View } from "react-native";
import { EmptyView, Row, RowAvatar, RowIcon, Text } from "@/components/ui";
import { useSignOut } from "@/features/auth/use-sign-out";
import { useSession } from "@/lib/session";
import { GuestHeader, useSignInFrom } from "./ui";

/**
 * Me (mobile spec 0005, AC-2): Sign in when signed out; signed in, the account and Sign out. A sign out
 * returns to the start, which shows the welcome again (D-b). Your details (name and phone) join it with
 * the booking thread in milestone 2.
 */
export function MeScreen() {
  const { account, status } = useSession();
  const signIn = useSignInFrom("/guest/me");
  const signOut = useSignOut();

  // Signed in a moment ago and now signed out: the welcome again, from the start route.
  const wasSignedIn = useRef(!!account);
  useEffect(() => {
    if (account) {
      wasSignedIn.current = true;
    } else if (wasSignedIn.current && status === "signed-out") {
      wasSignedIn.current = false;
      router.replace("/");
    }
  }, [account, status]);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="grow">
      <GuestHeader title="Me" />
      {account ? (
        <View className="gap-6 pb-8">
          <Row leading={<RowAvatar />} title={account.name} subtitle={account.email} />
          <View className="gap-1">
            <Text role="micro" caps tone="muted" className="px-4">
              Account
            </Text>
            <Row leading={<RowIcon name="ArrowRightFromSquare" />} title="Sign out" chevron onPress={signOut} />
          </View>
        </View>
      ) : (
        <EmptyView
          icon="Person"
          title="Sign in to Injishi"
          body="One account for your bookings, your trips and your messages with hotels. You can look around without one."
          action={{ label: "Sign in", icon: "ArrowRightToSquare", onPress: signIn }}
          secondary={{ label: "Explore stays", onPress: () => router.navigate("/guest/explore") }}
        />
      )}
    </ScrollView>
  );
}
