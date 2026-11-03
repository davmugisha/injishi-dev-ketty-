import { router } from "expo-router";
import { View } from "react-native";
import { ScopedTheme } from "uniwind";
import {
  Button,
  Card,
  Dock,
  IconTile,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useDigitalKey } from "./data";
import type { DigitalKey } from "./types";
import { backOr, CardBone, SuccessMark } from "./ui";

/** How many of the lock's last confirmations the activity line shows. */
const RECENT = 3;

/**
 * Door unlocked: shown only after the lock confirms it, with the time it did and when it locks again,
 * so the guest never stands at a door wondering. Dark, as the key screen it comes from.
 */
export function KeyOpenScreen() {
  const key = useDigitalKey();
  const data = key.data;
  return (
    <ScopedTheme theme="dark">
      <Screen
        header={
          <NavBar
            title={data?.room ?? "Your key"}
            subtitle={data?.detail}
            onBack={() => backOr(href("guest-key"))}
          />
        }
        dock={
          data ? (
            <Dock clear>
              <Button size="lg" onPress={() => router.navigate(href("guest-home-stay"))}>
                Done
              </Button>
            </Dock>
          ) : undefined
        }
      >
        <QueryView offlineNote={null} query={key} data={data} loading={<KeyOpenBones />}>
          {(k) => <Unlocked digitalKey={k} />}
        </QueryView>
      </Screen>
    </ScopedTheme>
  );
}

function Unlocked({ digitalKey }: { digitalKey: DigitalKey }) {
  const confirmedAt = digitalKey.activity[0] ?? "just now";
  return (
    <View className="pt-12">
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={`Door unlocked. Confirmed by the lock at ${confirmedAt}. ${digitalKey.relock}`}
        className="items-center gap-4 px-8"
      >
        {/* A faint halo around the mark, the prototype's 22 wide glow. */}
        <View className="size-61 items-center justify-center">
          <View className="absolute size-61 rounded-full bg-success-soft opacity-30" />
          <SuccessMark icon="LockOpen" size="lg" />
        </View>
        <Text role="title1" className="mt-2 text-center">
          Door unlocked
        </Text>
        <Text role="body" tone="muted" className="text-center">
          Confirmed by the lock at {confirmedAt}. {digitalKey.relock}
        </Text>
      </View>
      <Card padding="sm" className="mx-4 mt-12">
        <View className="flex-row items-center gap-3">
          <IconTile icon="Clock" tone="default" />
          <View className="flex-1 gap-0.5">
            <Text role="body" strong>
              Key activity
            </Text>
            <Text role="callout" tone="muted">
              Opened {digitalKey.activity.slice(0, RECENT).join(" · ")}
            </Text>
          </View>
        </View>
      </Card>
    </View>
  );
}

function KeyOpenBones() {
  return (
    <LoadingView label="Waiting for the lock" className="items-center px-4 pt-12">
      <LoadingBone className="size-50 rounded-full" />
      <LoadingBone className="h-8 w-1/2" />
      <LoadingBone className="h-4 w-3/4" />
      <View className="mt-8 w-full">
        <CardBone className="h-16" />
      </View>
    </LoadingView>
  );
}
