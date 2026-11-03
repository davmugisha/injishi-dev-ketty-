import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import {
  Button,
  Card,
  Dock,
  Icon,
  LoadingBone,
  metrics,
  NavBar,
  PressArea,
  QrCode,
  Screen,
  StepBar,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useFinishCheckIn, useRequestBalance, useTentStep } from "./data";
import type { DeskTentStep, TentOption } from "./types";
import { backOr, PushedSkeleton, toToday } from "./ui";

/**
 * `desk-checkin-room`, step 2: assign the tent, then the guest scans the QR to claim the stay in her
 * own app (G4): key, bill, Wi-Fi and menu without typing a code. A balance can be taken now or left
 * for check-out.
 */
export function CheckInRoomScreen() {
  const { guest } = useScreenParams("desk-checkin-room");
  const query = useTentStep(guest);
  const step = query.data;
  const [picked, setPicked] = useState<string | null>(null);
  const tent = picked ?? step?.suggested ?? "";
  const finish = useFinishCheckIn();
  const toast = useToast();

  const done = () => {
    if (!step) return;
    if (step.inHouse) {
      toToday(href("desk-today"));
      return;
    }
    finish.mutate(
      { stayId: step.stayId, tent },
      {
        onSuccess: () => {
          toast.show({ icon: "CircleCheck", message: `${step.name} is checked in to ${tent}`, haptic: "success" });
          toToday(href("desk-today"));
        },
      },
    );
  };

  return (
    <Screen
      header={
        <NavBar
          title={step ? `Check-in · ${step.name}` : "Check-in"}
          subtitle="Step 2 of 2 · tent and app"
          onBack={backOr(href("desk-checkin", { guest }))}
        />
      }
      dock={
        step ? (
          <Dock>
            <Button icon="Check" isDisabled={!tent || finish.isPending} onPress={done}>
              {step.inHouse ? `Done · ${tent}` : `Finish check-in · ${tent}`}
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <StepBar total={2} step={2} className="mx-4 mb-3 mt-1" />
      <QueryView
        query={query}
        data={step}
        loading={
          <PushedSkeleton label="Loading the tents">
            <LoadingBone className="h-20 rounded-2xl" />
          </PushedSkeleton>
        }
      >
        {(s) => <TentStep step={s} tent={tent} onPick={setPicked} />}
      </QueryView>
    </Screen>
  );
}

function TentStep({ step, tent, onPick }: { step: DeskTentStep; tent: string; onPick: (id: string) => void }) {
  const take = useRequestBalance();
  return (
    <View className="gap-4 px-4">
      <View>
        <View className="mb-2 flex-row items-baseline justify-between gap-3">
          <Text role="headline" strong>
            {step.kindLabel}
          </Text>
          <Text role="caption" tone="muted">
            {step.readyLine}
          </Text>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel={`${step.kindLabel}s`} className="flex-row gap-2">
          {step.options.map((option) => (
            <TentPick
              key={option.id}
              option={option}
              selected={option.id === tent}
              isDisabled={step.inHouse}
              onPress={() => onPick(option.id)}
            />
          ))}
        </View>
      </View>
      <Card>
        <View className="items-center">
          <Text role="headline" strong className="text-center">
            {step.scanTitle}
          </Text>
          <Text role="callout" tone="muted" className="mt-1 text-center">
            {step.scanBody}
          </Text>
          <PressArea
            onPress={() => router.push(href("guest-claim"))}
            accessibilityLabel={`Guest QR for ${step.name}, ${tent}`}
            accessibilityHint="Shows what the guest sees after scanning it"
            className="mt-3 overflow-hidden rounded-3xl"
          >
            <QrCode seed={`${step.qrSeed}-${tent.replace("-", "")}`} label={`Guest QR for ${step.name}`} />
          </PressArea>
          <Text role="caption" tone="muted" className="mt-2 text-center">
            {`${step.codeLead} `}
            <Text role="caption" strong tone="default">
              {step.code}
            </Text>
            {` ${step.codeTail}`}
          </Text>
        </View>
      </Card>
      {step.balance ? (
        <Card padding="sm">
          <View className="flex-row items-center justify-between gap-3">
            <View className="shrink">
              <Text role="callout" strong tabular>
                {`Balance ${rwf(step.balance.amount)}`}
              </Text>
              <Text role="caption" tone="muted">
                {step.balance.note}
              </Text>
            </View>
            <Button
              size="sm"
              variant="outline"
              isDisabled={take.isPending}
              onPress={() =>
                take.mutate(step.stayId, {
                  onSuccess: (payId) => router.push(href("desk-walkin-pay", { pay: payId })),
                })
              }
            >
              Take now
            </Button>
          </View>
        </Card>
      ) : (
        <Card padding="sm">
          <View className="flex-row items-center gap-2" accessible>
            <Icon name="CircleCheck" size={20} tone="success" />
            <Text role="callout" strong className="shrink">
              {step.paidNote}
            </Text>
          </View>
        </Card>
      )}
    </View>
  );
}

/**
 * `.mx-tent`: one tent in the picker. Picked: the accent line on the accent tint with a soft ring;
 * not free: dimmed with its state, and not pressable. Read aloud as a radio button with its state.
 */
function TentPick({
  option,
  selected,
  isDisabled,
  onPress,
}: {
  option: TentOption;
  selected: boolean;
  isDisabled: boolean;
  onPress: () => void;
}) {
  const [ring] = useCSSVariable(["--color-accent-soft"]);
  return (
    <PressArea
      onPress={onPress}
      isDisabled={isDisabled || !option.available}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${option.id}, ${option.note}`}
      className="flex-1 rounded-2xl"
      style={selected ? { boxShadow: `0 0 0 3px ${String(ring)}` } : undefined}
    >
      <View
        className={[
          "gap-0.5 rounded-2xl border-2 p-2.5",
          selected ? "border-accent bg-accent-soft" : "border-separator bg-surface",
          option.available ? "" : "opacity-40",
        ].join(" ")}
        style={{ minHeight: metrics.roomCell }}
      >
        <Text role="title3" strong tabular maxScale={1.5}>
          {option.id}
        </Text>
        <Text role="micro" tone={selected ? "accent" : "muted"} numberOfLines={2}>
          {option.note}
        </Text>
      </View>
    </PressArea>
  );
}
