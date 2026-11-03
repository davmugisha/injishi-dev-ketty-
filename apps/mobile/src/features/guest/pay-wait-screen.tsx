import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Card,
  Dock,
  Icon,
  LoadingBone,
  LoadingView,
  NavBar,
  Ring,
  Screen,
  TestMoneyTag,
  Text,
  Timeline,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { useConfirmPayment, usePayment, useResendPrompt } from "./data";
import type { PaymentData } from "./types";

/** `ring(68, { size: 150, stroke: 9 })`: the prompt is out and the clock is running. */
const RING = { value: 68, size: 150, stroke: 9 } as const;

/**
 * Waiting for MoMo approval (prototype `guest-pay-wait`): the room is booked only when the provider
 * confirms. The wait says what is happening, how long the room is held, and warns against paying
 * twice. "I've approved, check now" asks again; the confirmed booking replaces this screen.
 */
export function PayWaitScreen() {
  const query = usePayment();
  const confirm = useConfirmPayment();
  const resend = useResendPrompt();
  const toast = useToast();
  const data = query.data;

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(href("guest-checkout"));
  };
  const check = () =>
    confirm.mutate(undefined, {
      onSuccess: () => router.replace(href("guest-booked")),
      onError: () => toast.show({ icon: "CloudSlash", message: "Couldn't check with the provider. Try again." }),
    });
  const again = () =>
    resend.mutate(undefined, {
      onSuccess: () =>
        toast.show({ icon: "Smartphone", message: `Prompt sent again to ${data?.phone ?? "your phone"}` }),
    });

  return (
    <Screen
      header={<NavBar title="Payment" subtitle={data?.id} onBack={back} />}
      dock={
        data ? (
          <Dock note="Don't pay twice: we never charge without your PIN.">
            <Button onPress={check} isDisabled={confirm.isPending}>
              I've approved, check now
            </Button>
            <Button variant="ghost" size="sm" onPress={again} isDisabled={resend.isPending}>
              No prompt? Send it again
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={data} offlineNote={null} loading={<WaitBones />}>
        {(d) => <WaitBody payment={d} />}
      </QueryView>
    </Screen>
  );
}

function WaitBody({ payment }: { payment: PaymentData }) {
  return (
    <View className="px-4">
      <View className="items-center gap-4 pt-3.5">
        <Ring value={RING.value} size={RING.size} stroke={RING.stroke} label="Waiting for your approval">
          <Icon name="Smartphone" size={40} tone="accent" />
        </Ring>
        <View className="items-center gap-2">
          <Text role="title2" className="text-center">
            Approve on your phone
          </Text>
          <Text role="body" tone="muted" className="text-center">
            We sent a prompt to{" "}
            <Text role="body" strong>
              {payment.phone}
            </Text>
            . Enter your {payment.wallet} PIN to approve{" "}
            <Text role="body" strong>
              {rwf(payment.amount)}
            </Text>
            .
          </Text>
        </View>
        <TestMoneyTag />
      </View>

      <Card className="mt-5">
        <Timeline
          steps={[
            {
              title: `Request sent to ${payment.provider}`,
              detail: `${payment.sentAt} · ${payment.id}${payment.prompts > 1 ? ` · sent ${payment.prompts} times` : ""}`,
              state: "done",
            },
            {
              title: "Waiting for your approval",
              detail: `Checked ${payment.checkedAt} · no answer yet`,
              state: "now",
              icon: "Hourglass",
            },
            {
              title: `Confirmed by ${payment.provider}`,
              detail: "Only then is your room booked",
              state: "todo",
              icon: "CircleCheck",
            },
          ]}
        />
      </Card>
      <View className="mt-3 flex-row items-center gap-1.5">
        <Icon name="Clock" size={16} tone="muted" />
        <Text role="caption" tone="muted" className="flex-1">
          The {payment.roomName} room is held for you until {payment.heldUntil}.
        </Text>
      </View>
    </View>
  );
}

function WaitBones() {
  return (
    <LoadingView label="Loading your payment" className="items-center px-4 pt-3.5">
      <LoadingBone className="rounded-full" style={{ width: RING.size, height: RING.size }} />
      <LoadingBone className="h-7 w-3/5" />
      <LoadingBone className="h-12 w-4/5" />
      <LoadingBone className="h-44 w-full rounded-3xl" />
    </LoadingView>
  );
}
