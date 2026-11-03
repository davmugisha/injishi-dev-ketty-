import { router } from "expo-router";
import { View } from "react-native";
import { Banner, Button, Card, Dock, KeyValue, LoadingBone, NavBar, Screen, TestMoneyTag, Text } from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { usePaymentConfirm, useSendPaymentRequest } from "./data";
import type { ConfirmView } from "./types";
import { backOr, CardBone, Centered, Eyebrow, MONEY_OFFLINE, Skeleton, useNotify } from "./ui";

/**
 * `res-pay-confirm`: who receives the money, with the landlord's TIN, before anything is sent. It
 * says plainly that Injishi never asks for the PIN. Sending opens the wait for the MoMo prompt.
 */
export function PayConfirmScreen() {
  const query = usePaymentConfirm();
  const send = useSendPaymentRequest();
  const notify = useNotify();
  const view = query.data;

  const sendRequest = () =>
    send.mutate(undefined, {
      onSuccess: () => router.push(href("res-pay-wait")),
      onError: notify.failed,
    });

  return (
    <Screen
      header={<NavBar title="Confirm payment" onBack={() => backOr(href("res-pay"))} />}
      dock={
        view ? (
          <Dock note="Nothing is taken until you approve on your phone.">
            <Button size="lg" isDisabled={send.isPending} onPress={sendRequest}>
              Send payment request
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={view} loading={<ConfirmSkeleton />} offlineNote={MONEY_OFFLINE}>
        {(data) => <Confirm view={data} />}
      </QueryView>
    </Screen>
  );
}

function Confirm({ view }: { view: ConfirmView }) {
  const pin = view.provider === "MTN" ? "MoMo PIN" : "Airtel Money PIN";
  return (
    <View className="gap-4 px-4 pt-2">
      <Centered>
        <Eyebrow>You are paying</Eyebrow>
        <Text role="display" tabular className="mt-1 text-center">
          {rwf(view.amount)}
        </Text>
        <Text role="callout" tone="muted" className="text-center">
          {view.forLabel}
        </Text>
        <View className="mt-2">
          <TestMoneyTag />
        </View>
      </Centered>
      <Card padding="sm">
        <KeyValue rows={view.rows} total={{ label: "Total", value: rwf(view.amount) }} />
      </Card>
      <Banner
        tone="info"
        icon="Smartphone"
        title="Keep this phone close"
        body={`${view.provider} sends a prompt in a few seconds. Approve it with your ${pin}. Injishi never asks for your PIN.`}
      />
    </View>
  );
}

function ConfirmSkeleton() {
  return (
    <Skeleton label="Loading the payment">
      <View className="items-center gap-2">
        <LoadingBone className="h-3 w-1/4" />
        <LoadingBone className="h-10 w-3/5" />
        <LoadingBone className="h-4 w-2/5" />
      </View>
      <CardBone size="lg" />
      <CardBone size="sm" />
    </Skeleton>
  );
}
