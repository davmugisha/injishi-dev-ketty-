import { router } from "expo-router";
import { View } from "react-native";
import {
  Avatar,
  Card,
  EmptyView,
  Icon,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  PressArea,
  ProgressBar,
  Screen,
  ScreenHeader,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useSignOut } from "@/features/auth/use-sign-out";
import { href } from "@/proto/screens";
import { useMe } from "./data";
import type { MeData } from "./types";
import { useSignedOut, useSignInFrom, useWelcomeAfterSignOut } from "./ui";

function toAccount() {
  router.push(href("shared-account"));
}

/**
 * Me (prototype `guest-me`): rewards up front, then saved stays, payment numbers, the saved ID and how
 * Injishi reaches the guest. Switching to a work or home place lives here too (X1), then the account
 * and help. In api mode it is the signed in account (its name and email) with Sign out, and the rows
 * without the lines nothing reads yet; signed out, it offers sign in, which comes back here.
 */
export function MeScreen() {
  const signedOut = useSignedOut();
  const query = useMe();
  useWelcomeAfterSignOut();
  return (
    <Screen>
      <ScreenHeader title="Me" />
      {signedOut ? (
        <SignedOutMe />
      ) : (
        <QueryView query={query} data={query.data} offlineNote={null} loading={<MeBones />}>
          {(me) => <MeBody me={me} />}
        </QueryView>
      )}
    </Screen>
  );
}

/** Api mode, nobody signed in: what an account is for, and Sign in, which comes back here. */
function SignedOutMe() {
  const signIn = useSignInFrom(String(href("guest-me")));
  return (
    <EmptyView
      icon="Person"
      title="Sign in to Injishi"
      body="One account for your bookings, your trips and your messages with hotels. You can look around without one."
      action={{ label: "Sign in", icon: "ArrowRightToSquare", onPress: signIn }}
      secondary={{ label: "Explore stays", onPress: () => router.navigate(href("guest-explore")) }}
    />
  );
}

function MeBody({ me }: { me: MeData }) {
  const signOut = useSignOut();
  const line = me.since ?? me.email;
  return (
    <View className="gap-4 px-4">
      <PressArea
        onPress={toAccount}
        accessibilityRole="link"
        accessibilityLabel={`${[me.name, line].filter(Boolean).join(", ")}. Account`}
        className="flex-row items-center gap-3.5"
      >
        <Avatar size="xl" name={me.name} />
        <View className="flex-1 gap-0.5">
          <Text role="title3">{me.name}</Text>
          {line ? (
            <Text role="callout" tone="muted">
              {line}
            </Text>
          ) : null}
        </View>
        <Icon name="ChevronRight" size={16} tone="muted" />
      </PressArea>

      {me.rewards ? (
        <Card tone="accent" padding="lg">
          <View className="flex-row items-center justify-between gap-3">
            <Text role="callout" strong>
              {me.rewards.name}
            </Text>
            <Icon name="Gift" size={24} />
          </View>
          <View className="mt-2 flex-row items-baseline gap-1.5" accessible>
            <Text role="display" tabular>
              {me.rewards.points.toLocaleString("en-US")}
            </Text>
            <Text role="callout" tone="muted">
              points
            </Text>
          </View>
          <ProgressBar value={me.rewards.progress} label="Towards a free late checkout" className="mt-3" />
          <Text role="caption" tone="muted" className="mt-2">
            {me.rewards.note}
          </Text>
        </Card>
      ) : null}

      <ListGroup>
        <ListItem
          icon="Heart"
          title="Saved"
          subtitle={me.saved ?? undefined}
          onPress={() => router.push(href("guest-saved"), { withAnchor: true })}
        />
        <ListItem icon="Wallet" title="Payment numbers" subtitle={me.payment ?? undefined} onPress={toAccount} />
        <ListItem
          icon="ShieldCheck"
          title="Saved ID"
          subtitle={me.savedId ?? undefined}
          onPress={() => router.push(href("guest-prearrival"))}
        />
        <ListItem icon="Bell" title="How we reach you" subtitle={me.reach ?? undefined} onPress={toAccount} />
      </ListGroup>

      <ListGroup>
        <ListItem
          icon="ArrowRightArrowLeft"
          title="Switch place"
          subtitle="Work or live somewhere on Injishi?"
          onPress={() => router.push(href("shared-switcher"))}
        />
        <ListItem icon="Person" title="Account and privacy" onPress={toAccount} />
        <ListItem icon="LifeRing" title="Help and support" onPress={() => router.push(href("shared-help"))} />
      </ListGroup>

      {me.signOut ? (
        <ListGroup>
          <ListItem icon="ArrowRightFromSquare" tone="default" title="Sign out" chevron={false} onPress={signOut} />
        </ListGroup>
      ) : null}
    </View>
  );
}

function MeBones() {
  return (
    <LoadingView label="Loading your account" className="px-4">
      <View className="flex-row items-center gap-3.5">
        <LoadingBone className="h-20 w-20 rounded-full" />
        <View className="flex-1 gap-2">
          <LoadingBone className="h-5 w-1/2" />
          <LoadingBone className="h-4 w-3/4" />
        </View>
      </View>
      <LoadingBone className="h-40 rounded-3xl" />
      <LoadingBone className="h-60 rounded-3xl" />
    </LoadingView>
  );
}
