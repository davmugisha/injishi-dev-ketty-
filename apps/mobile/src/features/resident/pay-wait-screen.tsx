import { easingCurves, motionMs } from "@injishi/design-tokens";
import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import {
  Banner,
  Button,
  Card,
  Dock,
  Icon,
  LoadingBone,
  NavBar,
  Screen,
  TestMoneyTag,
  Text,
  Timeline,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { href } from "@/proto/screens";
import { useConfirmPayment, usePendingPayment, useResendPrompt } from "./data";
import type { PendingView } from "./types";
import { backOr, CardBone, DockLinks, Fill, MONEY_OFFLINE, Skeleton, useNotify } from "./ui";

/**
 * `res-pay-wait`: the honest wait. Rent is marked paid only when MTN confirms; "Do not pay again"
 * stops double payments when the prompt is slow. In mock mode "I've approved, check now" is the
 * provider saying yes: the payment is recorded and its receipt opens in this screen's place.
 */
export function PayWaitScreen() {
  const query = usePendingPayment();
  const confirm = useConfirmPayment();
  const resend = useResendPrompt();
  const notify = useNotify();
  const view = query.data;

  const check = () =>
    confirm.mutate(undefined, {
      // The receipt replaces the wait, so back from it never lands on a finished wait.
      onSuccess: (id) => router.replace(href("res-receipt", { id, from: "pay" })),
      onError: notify.failed,
    });
  const promptAgain = () =>
    resend.mutate(undefined, {
      onSuccess: ({ number, expiresAt }) =>
        notify.done(`Prompt sent again to ${number}. It expires at ${expiresAt}.`, "Smartphone"),
      onError: notify.failed,
    });

  return (
    <Screen
      header={<NavBar title="Waiting for you" onBack={() => backOr(href("res-pay-confirm"))} />}
      dock={
        view ? (
          <Dock>
            <Button variant="secondary" isDisabled={confirm.isPending} onPress={check}>
              I've approved, check now
            </Button>
            <DockLinks links={[{ label: "I did not get a prompt", onPress: promptAgain }]} />
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={view} loading={<WaitSkeleton />} offlineNote={MONEY_OFFLINE}>
        {(data) => <Waiting view={data} />}
      </QueryView>
    </Screen>
  );
}

function Waiting({ view }: { view: PendingView }) {
  return (
    <View className="gap-5 px-4 pt-4">
      <Halo />
      <View className="items-center gap-2">
        <TestMoneyTag />
        <Text role="title2" className="text-center">
          Approve on your phone
        </Text>
        <Text role="body" tone="muted" className="text-center">
          {`Open the ${view.provider} prompt and enter your PIN.\nOnly then is your rent marked paid.`}
        </Text>
      </View>
      <Card>
        <Timeline
          steps={[
            {
              title: `Request sent to ${view.number}`,
              detail: `${view.sentAt} · ${rwf(view.amount)}`,
              state: "done",
            },
            {
              title: "Waiting for your approval",
              detail: `Prompt expires at ${view.expiresAt}`,
              state: "now",
              icon: "Hourglass",
            },
            {
              title: `${view.provider} confirms`,
              detail: "Your receipt appears here",
              state: "todo",
              icon: "SealCheck",
            },
          ]}
        />
      </Card>
      <Banner
        tone="warning"
        title="Do not pay again"
        body={`If you close the app, we keep checking with ${view.provider} for 15 minutes and tell you the result.`}
      />
    </View>
  );
}

/**
 * `.rx-wait`: the phone on a soft disc inside two faint rings, which breathe while the prompt is out.
 * Under Reduce Motion the rings hold still.
 */
function Halo() {
  const reduceMotion = useReduceMotion();
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(breath);
      breath.set(0);
      return;
    }
    // A slow breath, four times the `arrive` beat each way, on the curve for here-to-there.
    breath.set(
      withRepeat(
        withTiming(1, { duration: motionMs.arrive * 4, easing: Easing.bezier(...easingCurves.move) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion]);
  const outer = useAnimatedStyle(() => ({
    opacity: 0.08 + breath.get() * 0.1,
    transform: [{ scale: 0.96 + breath.get() * 0.04 }],
  }));
  const inner = useAnimatedStyle(() => ({ opacity: 0.18 + breath.get() * 0.12 }));
  return (
    <View className="size-52 items-center justify-center self-center" importantForAccessibility="no-hide-descendants">
      <Animated.View className="absolute size-52 rounded-full border-2 border-accent" style={outer} />
      <Animated.View className="absolute size-44 rounded-full border-2 border-accent" style={inner} />
      <Fill tone="accent" className="size-36 items-center justify-center rounded-full">
        <Icon name="Smartphone" size={40} />
      </Fill>
    </View>
  );
}

function WaitSkeleton() {
  return (
    <Skeleton label="Checking the payment">
      <LoadingBone className="size-36 self-center rounded-full" />
      <View className="items-center gap-2">
        <LoadingBone className="h-7 w-3/5" />
        <LoadingBone className="h-4 w-4/5" />
      </View>
      <CardBone size="lg" />
    </Skeleton>
  );
}
