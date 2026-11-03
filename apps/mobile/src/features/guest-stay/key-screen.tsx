import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { ScopedTheme, useCSSVariable } from "uniwind";
import {
  Button,
  Dialog,
  Icon,
  IconButton,
  ListGroup,
  ListItem,
  LiveDot,
  LoadingBone,
  LoadingView,
  NavBar,
  PressArea,
  Screen,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { haptic } from "@/lib/haptics";
import { href } from "@/proto/screens";
import { useDigitalKey, useUnlockDoor } from "./data";
import type { DigitalKey } from "./types";
import { backOr, Eyebrow, ListBones } from "./ui";

/** How long the phone talks to the lock before it confirms: the guest sees it working, never a guess. */
const LOCK_HANDSHAKE_MS = 900;

/**
 * The digital key, full screen and dark: one huge target, the window it works in, what else it opens,
 * and the key card fallback. Tapping the key opens the door, and the next screen shows the lock's answer.
 */
export function KeyScreen() {
  const key = useDigitalKey();
  const unlock = useUnlockDoor();
  const toast = useToast();
  const [about, setAbout] = useState(false);
  const [opening, setOpening] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const open = () => {
    if (opening) return;
    setOpening(true);
    timer.current = setTimeout(() => {
      unlock.mutate(undefined, {
        onSuccess: () => {
          haptic.success();
          setOpening(false);
          router.push(href("guest-key-open"));
        },
        onError: () => {
          setOpening(false);
          toast.show({
            icon: "LockOpen",
            message: "The lock didn't answer. Try again, or ask the desk for a key card.",
            haptic: "error",
          });
        },
      });
    }, LOCK_HANDSHAKE_MS);
  };

  const data = key.data;
  return (
    <ScopedTheme theme="dark">
      <Screen
        header={
          <NavBar
            title={data?.room ?? "Your key"}
            subtitle={data?.detail}
            onBack={() => backOr(href("guest-home-stay"))}
            right={
              data ? (
                <IconButton icon="CircleInfo" label="How the key works" variant="plain" onPress={() => setAbout(true)} />
              ) : undefined
            }
          />
        }
      >
        <QueryView offlineNote={null} query={key} data={data} loading={<KeyBones />}>
          {(k) => <KeyBody digitalKey={k} opening={opening} onOpen={open} />}
        </QueryView>
        <Dialog
          isOpen={about}
          onClose={() => setAbout(false)}
          icon="Key"
          title="How your key works"
          body={data?.about}
          actions={<Button onPress={() => setAbout(false)}>Got it</Button>}
        />
      </Screen>
    </ScopedTheme>
  );
}

function KeyBody({ digitalKey, opening, onOpen }: { digitalKey: DigitalKey; opening: boolean; onOpen: () => void }) {
  return (
    <View className="pt-6">
      <View className="items-center">
        <KeyButton room={digitalKey.room} opening={opening} onPress={onOpen} />
        <Text role="body" tone="muted" className="mt-6 px-10 text-center">
          {digitalKey.hint}
        </Text>
        <View className="mt-2.5 flex-row items-center justify-center gap-2">
          <LiveDot />
          <Text role="callout">{digitalKey.validUntil}</Text>
        </View>
      </View>
      <View className="mt-6 gap-2 px-4">
        <Eyebrow>Also opens</Eyebrow>
        <ListGroup>
          {digitalKey.alsoOpens.map((door) => (
            <ListItem key={door.title} icon={door.icon} tone="default" title={door.title} subtitle={door.detail} />
          ))}
        </ListGroup>
        <Text role="caption" tone="muted" className="mt-2 text-center">
          {digitalKey.fallback}
        </Text>
      </View>
    </View>
  );
}

/**
 * `.gx-keybtn`: a 200 accent disc lit from above, inside two faint rings, drawn in SVG from the
 * theme's accent, read live, so the disc is the same teal in every scope. The whole disc is the target.
 */
function KeyButton({ room, opening, onPress }: { room: string; opening: boolean; onPress: () => void }) {
  const [accent, light] = useCSSVariable(["--color-accent", "--color-accent-foreground"]);
  return (
    <View className="size-70 items-center justify-center">
      {/* In grid steps (4 each): the box is 70 across, the rings 59 and 69. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 70 70" accessible={false}>
        <Circle cx="35" cy="35" r="34.6" fill="none" stroke={String(accent)} strokeOpacity={0.1} strokeWidth="0.4" />
        <Circle cx="35" cy="35" r="29.5" fill="none" stroke={String(accent)} strokeOpacity={0.22} strokeWidth="0.4" />
      </Svg>
      <PressArea
        onPress={onPress}
        isDisabled={opening}
        accessibilityLabel={opening ? `Opening ${room}` : `Unlock ${room}`}
        accessibilityHint="Hold the phone near the lock"
        accessibilityState={{ busy: opening }}
        className="size-50 items-center justify-center rounded-full"
        style={{ boxShadow: `0 24px 60px -18px ${String(accent)}` }}
      >
        {/* The disc moves with the press: it is drawn inside the press area. */}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 50 50" accessible={false}>
          <Defs>
            <RadialGradient id="guest-key-glow" cx="50%" cy="35%" r="65%">
              <Stop offset="0" stopColor={String(light)} stopOpacity={0.3} />
              <Stop offset="1" stopColor={String(light)} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="25" cy="25" r="25" fill={String(accent)} />
          <Circle cx="25" cy="25" r="25" fill="url(#guest-key-glow)" />
        </Svg>
        <Icon name={opening ? "LockOpen" : "Key"} size={40} tone="onAccent" />
        <Text role="headline" strong tone="onAccent" className="mt-2">
          {opening ? "Opening…" : "Tap to unlock"}
        </Text>
      </PressArea>
    </View>
  );
}

function KeyBones() {
  return (
    <LoadingView label="Loading your key" className="items-center px-4 pt-6">
      <LoadingBone className="size-50 rounded-full" />
      <LoadingBone className="h-4 w-3/4" />
      <LoadingBone className="h-4 w-1/2" />
      <View className="w-full">
        <ListBones rows={2} />
      </View>
    </LoadingView>
  );
}
