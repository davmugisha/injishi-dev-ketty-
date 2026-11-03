import { rnSpace } from "@injishi/design-tokens";
import { router } from "expo-router";
import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { ScopedTheme } from "uniwind";
import {
  Button,
  Chip,
  Field,
  FixedLight,
  Icon,
  IconButton,
  Input,
  LoadingBone,
  LoadingView,
  metrics,
  PressArea,
  ScanFrame,
  Screen,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useScanView } from "./data";
import type { ScanView } from "./types";

/**
 * `tech-scan`, S8: a camera for the Injishi tag on equipment or a room door, with a torch for dark
 * plant rooms and the tag number typed by hand when the sticker is worn. Always dark, as a camera.
 * This build has no camera: holding the frame on the unit in view reads its tag.
 */
export function ScanScreen() {
  const query = useScanView();
  return (
    <ScopedTheme theme="dark">
      <Screen>
        <QueryView query={query} data={query.data} loading={<ScanLoading />}>
          {(view) => <Scanner view={view} />}
        </QueryView>
      </Screen>
    </ScopedTheme>
  );
}

const openAsset = (tag: string) => router.push(href("tech-asset", { tag }));

function Scanner({ view }: { view: ScanView }) {
  const [torch, setTorch] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [unknown, setUnknown] = useState(false);
  // The camera takes the width it has, as a viewfinder does, up to a quarter more than the kit's frame.
  const { width } = useWindowDimensions();
  const frame = Math.min(width - rnSpace[8] * 2, metrics.scanFrame.size * 1.25);
  const open = () => {
    const tag = typed.trim().toUpperCase();
    if (!view.known.includes(tag)) {
      setUnknown(true);
      return;
    }
    setUnknown(false);
    openAsset(tag);
  };
  return (
    <View className="flex-1 gap-4 px-4 pt-2">
      <View className="gap-1">
        <Text role="title2">Scan a tag</Text>
        <Text role="callout" tone="muted">
          Point at the Injishi tag on the equipment or the room door.
        </Text>
      </View>
      <PressArea
        onPress={() => openAsset(view.inView)}
        accessibilityLabel="Read the tag in view"
        className="rounded-3xl"
      >
        <ScanFrame
          photo={view.camera}
          size={frame}
          status={
            <Chip
              variant="glass"
              size="lg"
              icon={torch ? "Bulb" : "ArrowRotateRight"}
              label={torch ? "Torch on · looking for a tag" : "Looking for a tag"}
            />
          }
        >
          <FixedLight>
            <View
              className="items-center justify-center rounded-2xl bg-surface shadow-overlay"
              style={{ width: metrics.photo.thumb, height: metrics.photo.thumb }}
            >
              <Icon name="QrCode" size={40} />
            </View>
          </FixedLight>
        </ScanFrame>
      </PressArea>
      {/* The controls sit low, under the thumb, as on a camera. */}
      <View className="flex-1" />
      <View className="flex-row items-center gap-2.5">
        <Button
          variant="onPhoto"
          icon="Pencil"
          className="flex-1"
          onPress={() => {
            setTyping((on) => !on);
            setUnknown(false);
          }}
        >
          {typing ? "Hide tag number" : "Type tag number"}
        </Button>
        <IconButton
          icon="Bulb"
          variant="glass"
          tone={torch ? "warning" : undefined}
          label={torch ? "Turn the torch off" : "Turn the torch on"}
          onPress={() => setTorch((on) => !on)}
        />
      </View>
      {typing ? (
        <View className="gap-3">
          <Field
            label="Tag number"
            hint={unknown ? undefined : "On the sticker, under the code."}
            error={unknown ? "No tag with that number here. Check the sticker and try again." : undefined}
          >
            <Input
              value={typed}
              onChangeText={(text) => {
                setTyped(text);
                setUnknown(false);
              }}
              placeholder={view.inView}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={open}
              invalid={unknown}
            />
          </Field>
          <Button variant="secondary" icon="ArrowRight" onPress={open} isDisabled={!typed.trim()}>
            Open this tag
          </Button>
        </View>
      ) : null}
      <View className="gap-2">
        <Text role="micro" caps strong tone="muted">
          Recent
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {view.recent.map((item) => (
            <PressArea
              key={item.tag}
              onPress={() => openAsset(item.tag)}
              accessibilityRole="link"
              accessibilityLabel={`Open ${item.label}`}
              className="justify-center"
            >
              <Chip variant="glass" size="lg" label={item.label} />
            </PressArea>
          ))}
        </View>
      </View>
    </View>
  );
}

function ScanLoading() {
  return (
    <LoadingView label="Starting the camera" className="px-4 pt-2">
      <View className="gap-2">
        <LoadingBone className="h-7 w-36" />
        <LoadingBone className="h-4 w-72" />
      </View>
      <LoadingBone className="h-96 rounded-3xl" />
      <LoadingBone className="h-14 rounded-full" />
      <View className="flex-row gap-2">
        <LoadingBone className="h-8 w-20 rounded-full" />
        <LoadingBone className="h-8 w-32 rounded-full" />
        <LoadingBone className="h-8 w-36 rounded-full" />
      </View>
    </LoadingView>
  );
}
