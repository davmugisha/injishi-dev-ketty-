import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  IconTile,
  Keypad,
  LoadingBone,
  LoadingView,
  NavBar,
  PinDots,
  Screen,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useSurface } from "@/proto/surface";
import { useCheckPin, usePin } from "./data";
import type { PinView } from "./types";
import { backOr } from "./ui";

/**
 * `hk-pin` (also the supervisor's and the technician's): salary is private on a shared phone, so the
 * payslips ask for a PIN or a fingerprint first. The right PIN opens hours and pay in the Me tab.
 */
export function PinScreen() {
  const surface = useSurface();
  const query = usePin();
  const check = useCheckPin();
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);

  // The PIN screen leaves the stack as the payslip opens, so back from it is Me.
  const unlock = () => router.dismissTo(href("hk-hours", undefined, { app: surface }));
  const attempt = (value: string | null) =>
    check.mutate(value, {
      onSuccess: (opens) => {
        if (opens) {
          unlock();
          return;
        }
        setWrong(true);
        setPin("");
      },
    });

  const type = (length: number) => (digit: string) => {
    if (check.isPending || pin.length >= length) return;
    const next = `${pin}${digit}`;
    setWrong(false);
    setPin(next);
    if (next.length === length) attempt(next);
  };

  return (
    <Screen header={<NavBar title="" onBack={() => backOr(href("hk-me", undefined, { app: surface }))} />}>
      <QueryView query={query} data={query.data} loading={<PinLoading />}>
        {(view) => (
          <PinBody
            view={view}
            filled={pin.length}
            wrong={wrong}
            onKey={type(view.length)}
            onDelete={() => {
              setWrong(false);
              setPin((now) => now.slice(0, -1));
            }}
            onFingerprint={() => attempt(null)}
          />
        )}
      </QueryView>
    </Screen>
  );
}

function PinBody({
  view,
  filled,
  wrong,
  onKey,
  onDelete,
  onFingerprint,
}: {
  view: PinView;
  filled: number;
  wrong: boolean;
  onKey: (digit: string) => void;
  onDelete: () => void;
  onFingerprint: () => void;
}) {
  return (
    <View>
      <View className="items-center gap-3 px-8 pt-2.5">
        <IconTile icon="ShieldKeyhole" size="lg" />
        <Text role="title2" className="text-center">
          Enter your PIN
        </Text>
        <Text role="callout" tone="muted" className="text-center">
          {view.reason}
        </Text>
        <View className="mt-3">
          <PinDots length={view.length} filled={filled} invalid={wrong} />
        </View>
        <Text role="caption" tone={wrong ? "danger" : "muted"} className="text-center" accessibilityLiveRegion="polite">
          {wrong ? "That PIN is not right. Try again." : " "}
        </Text>
      </View>
      <View className="mt-4">
        <Keypad
          onKey={onKey}
          onDelete={onDelete}
          extra={
            view.canFingerprint ? { icon: "Fingerprint", label: "Use fingerprint", onPress: onFingerprint } : undefined
          }
        />
      </View>
      <Text role="callout" tone="muted" className="mt-4 text-center">
        {view.forgot}
      </Text>
    </View>
  );
}

function PinLoading() {
  return (
    <LoadingView label="Loading">
      <View className="items-center gap-3">
        <LoadingBone className="size-12 rounded-2xl" />
        <LoadingBone className="h-7 w-44" />
        <LoadingBone className="h-4 w-56" />
        <LoadingBone className="h-4 w-24" />
      </View>
      <View className="gap-3 px-6">
        {["1", "2", "3", "4"].map((row) => (
          <View key={row} className="flex-row gap-4">
            <LoadingBone className="h-16 flex-1 rounded-full" />
            <LoadingBone className="h-16 flex-1 rounded-full" />
            <LoadingBone className="h-16 flex-1 rounded-full" />
          </View>
        ))}
      </View>
    </LoadingView>
  );
}
