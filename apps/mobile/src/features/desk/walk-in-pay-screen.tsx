import { router } from "expo-router";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Dock,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  TestMoneyTag,
  Text,
  Timeline,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useConfirmPayment, usePaymentWait, useResendPrompt } from "./data";
import type { DeskPaymentWait } from "./types";
import { backOr, DoneMark, PAYMENT_OFFLINE, WaitMark } from "./ui";

/**
 * `desk-walkin-pay`: an honest payment wait. What was sent, what the guest must do, and that a
 * screenshot is not proof: only MTN's confirmation counts. Test money until a gateway is live. In the
 * sample, pressing the steps plays MTN's confirmation.
 */
export function WalkInPayScreen() {
  const { pay } = useScreenParams("desk-walkin-pay");
  const query = usePaymentWait(pay);
  const wait = query.data;
  const confirm = useConfirmPayment();
  const resend = useResendPrompt();
  const toast = useToast();
  const toReceipt = (payId: string) => router.replace(href("desk-paid", { pay: payId }));

  const dock = !wait ? undefined : wait.paid ? (
    <Dock>
      <Button icon="Receipt" onPress={() => toReceipt(wait.id)}>
        See the receipt
      </Button>
    </Dock>
  ) : (
    <Dock>
      <View className="flex-row gap-2.5">
        <Button
          variant="secondary"
          size="md"
          className="flex-1"
          isDisabled={resend.isPending}
          onPress={() =>
            resend.mutate(wait.id, { onSuccess: () => toast.show({ icon: "Smartphone", message: wait.resentLine }) })
          }
        >
          Resend prompt
        </Button>
        <Button
          variant="outline"
          size="md"
          className="flex-1"
          isDisabled={confirm.isPending}
          onPress={() => confirm.mutate({ payId: wait.id, method: "cash" }, { onSuccess: (payId) => toReceipt(payId) })}
        >
          Take cash instead
        </Button>
      </View>
    </Dock>
  );

  return (
    <Screen
      header={<NavBar title="Waiting for payment" onBack={backOr(href("desk-walkin"))} right={<TestMoneyTag />} />}
      dock={dock}
    >
      <QueryView query={query} offlineNote={PAYMENT_OFFLINE} data={wait} loading={<WaitSkeleton />}>
        {(w) => (
          <Waiting
            wait={w}
            onConfirmed={() =>
              confirm.mutate(
                { payId: w.id },
                {
                  onSuccess: (payId) => {
                    toast.show({ icon: "CircleCheck", message: "Payment confirmed", haptic: "success" });
                    toReceipt(payId);
                  },
                },
              )
            }
          />
        )}
      </QueryView>
    </Screen>
  );
}

function Waiting({ wait, onConfirmed }: { wait: DeskPaymentWait; onConfirmed: () => void }) {
  return (
    <View className="gap-5 px-4 pt-4">
      {wait.paid ? <DoneMark /> : <WaitMark icon="Smartphone" />}
      <View className="items-center">
        <Text role="title2" className="text-center">
          {wait.title}
        </Text>
        <Text role="body" tone="muted" className="mt-2 text-center">
          {wait.body}
        </Text>
      </View>
      <Text role="display" tabular className="text-center">
        {rwf(wait.amount)}
      </Text>
      <Card
        onPress={wait.paid ? undefined : onConfirmed}
        accessibilityLabel={`${wait.steps.map((s) => `${s.title}, ${s.detail}`).join(". ")}. Sample: press when the guest has paid.`}
      >
        <Timeline steps={wait.steps} />
      </Card>
      <Banner tone="warning" icon="Key" title={wait.hold.title} body={wait.hold.body} />
    </View>
  );
}

function WaitSkeleton() {
  return (
    <LoadingView label="Loading the payment" className="items-center px-4 pt-6">
      <LoadingBone className="size-24 rounded-4xl" />
      <LoadingBone className="h-6 w-3/4" />
      <LoadingBone className="h-4 w-full" />
      <LoadingBone className="h-10 w-1/2" />
      <LoadingBone className="h-44 w-full rounded-3xl" />
      <LoadingBone className="h-16 w-full rounded-2xl" />
    </LoadingView>
  );
}
