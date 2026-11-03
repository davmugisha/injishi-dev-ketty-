import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useCSSVariable } from "uniwind";
import {
  Button,
  Card,
  Chip,
  Dock,
  FixedLight,
  Icon,
  KeyValue,
  LoadingBone,
  metrics,
  NavBar,
  OnPhoto,
  PressArea,
  Screen,
  StepBar,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { protoImages } from "@/proto/images";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useAddSecondId, useConfirmId, useIdCheck } from "./data";
import type { DeskIdCheck } from "./types";
import { backOr, PushedSkeleton } from "./ui";

/** How long the stand-in camera "reads" after Retake. */
const READ_MS = 1400;

/**
 * `desk-checkin`, step 1: the phone camera replaces the ID scanner. It checks sharpness and matches
 * the booking name; the photo is stored encrypted for the guest register, never in the gallery.
 */
export function CheckInScreen() {
  const { guest } = useScreenParams("desk-checkin");
  const query = useIdCheck(guest);
  const check = query.data;
  const confirm = useConfirmId();
  const [reading, setReading] = useState(false);
  useEffect(() => {
    if (!reading) return;
    const timer = setTimeout(() => setReading(false), READ_MS);
    return () => clearTimeout(timer);
  }, [reading]);

  const next = () => {
    if (!check) return;
    confirm.mutate(check.stayId, {
      onSuccess: () => router.push(href("desk-checkin-room", { guest: check.stayId })),
    });
  };

  return (
    <Screen
      header={
        <NavBar
          title={check ? `Check-in · ${check.name}` : "Check-in"}
          subtitle="Step 1 of 2 · ID"
          onBack={backOr(href("desk-arrival", { guest }))}
        />
      }
      dock={
        check ? (
          <Dock>
            <View className="flex-row gap-2.5">
              <Button variant="secondary" className="flex-1" isDisabled={reading} onPress={() => setReading(true)}>
                Retake
              </Button>
              <Button className="flex-1" isDisabled={reading || confirm.isPending} onPress={next}>
                Continue
              </Button>
            </View>
          </Dock>
        ) : undefined
      }
    >
      <StepBar total={2} step={1} className="mx-4 mb-3 mt-1" />
      <QueryView
        query={query}
        data={check}
        loading={
          <PushedSkeleton label="Opening the camera">
            <LoadingBone className="h-72 rounded-3xl" />
          </PushedSkeleton>
        }
      >
        {(c) => <IdStep check={c} reading={reading} />}
      </QueryView>
    </Screen>
  );
}

function IdStep({ check, reading }: { check: DeskIdCheck; reading: boolean }) {
  const addId = useAddSecondId();
  const toast = useToast();
  const second = check.secondAdult;
  return (
    <>
      <IdCamera readLabel={reading ? "Reading the ID…" : check.readLabel} reading={reading} />
      <View className="mt-4 gap-3 px-4">
        <Card padding="sm">
          <KeyValue rows={check.lines} />
        </Card>
        {second ? (
          <View className="flex-row items-center justify-between gap-3">
            <Text role="callout" tone="muted" className="shrink">
              {`Second adult: ${second.name}`}
            </Text>
            {second.added ? (
              <View className="flex-row items-center gap-1" accessible accessibilityLabel="ID added">
                <Icon name="CircleCheck" size={16} tone="success" />
                <Text role="callout" strong tone="success">
                  ID added
                </Text>
              </View>
            ) : (
              <PressArea
                onPress={() =>
                  addId.mutate(check.stayId, {
                    onSuccess: () => toast.show({ icon: "CircleCheck", message: `${second.name}'s ID added` }),
                  })
                }
                accessibilityLabel={`Add ID for ${second.name}`}
                className="-my-3 items-end justify-center"
              >
                <Text role="callout" strong tone="accent">
                  Add ID
                </Text>
              </PressArea>
            )}
          </View>
        ) : null}
        <Text role="caption" tone="muted">
          Stored encrypted for the guest register. Never in the phone's photo gallery.
        </Text>
      </View>
    </>
  );
}

/** How much of the desk shows through the dark ground behind the frame (`brightness(.55)`). */
const PHOTO_DIM = 0.55;
const BLUR = 2;

/**
 * `.mx-cam`: the camera stand-in (this build has no camera). The desk, blurred and dimmed, a light
 * frame around an ID card, the instruction above and the result below, all in the photo's light ink.
 */
function IdCamera({ readLabel, reading }: { readLabel: string; reading: boolean }) {
  const [backdrop] = useCSSVariable(["--color-backdrop"]);
  return (
    <OnPhoto>
      <View
        className="mx-4 overflow-hidden rounded-3xl bg-background"
        style={{ height: metrics.photo.hero }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`ID camera. ${readLabel}`}
      >
        <Image
          source={protoImages["front-desk-lakeside"]}
          contentFit="cover"
          blurRadius={BLUR}
          accessible={false}
          style={[StyleSheet.absoluteFill, { opacity: PHOTO_DIM }]}
        />
        <Text role="callout" strong className="mt-4 text-center">
          Fit the ID inside the frame
        </Text>
        <View
          className="absolute inset-x-6 top-14 h-44 rounded-2xl border-2 border-foreground p-2.5"
          style={{ boxShadow: `0 0 0 999px ${String(backdrop)}` }}
        >
          <IdCard faded={reading} />
        </View>
        {/* Its own box, so the chip (HeroUI aligns a chip to the start) centres under the frame. */}
        <View className="absolute inset-x-0 bottom-4 items-center">
          <View>
            {reading ? (
              <Chip variant="glass" icon="Hourglass" label={readLabel} />
            ) : (
              <Chip tone="success" variant="solid" icon="CircleCheck" label={readLabel} />
            )}
          </View>
        </View>
      </View>
    </OnPhoto>
  );
}

/**
 * `.idcard`: a document drawn in light ink whatever the theme, a portrait box and four lines. The
 * accent tint is translucent, so it sits on the opaque surface rather than on the dark camera.
 */
function IdCard({ faded }: { faded: boolean }) {
  return (
    <FixedLight>
      <View className={`flex-1 rounded-xl bg-surface ${faded ? "opacity-60" : ""}`}>
        <View className="flex-1 flex-row gap-3 rounded-xl bg-accent-soft p-3.5">
          <View className="w-16 items-center justify-center rounded-lg bg-surface-tertiary">
            <Icon name="Person" size={32} tone="muted" />
          </View>
          <View className="flex-1 gap-2.5 pt-1">
            <View className="h-2 w-4/5 rounded-full bg-backdrop opacity-60" />
            <View className="h-2 w-3/5 rounded-full bg-backdrop opacity-60" />
            <View className="h-2 w-2/3 rounded-full bg-backdrop opacity-60" />
            <View className="h-2 w-2/5 rounded-full bg-backdrop opacity-60" />
          </View>
        </View>
      </View>
    </FixedLight>
  );
}
