import { rnSpace } from "@injishi/design-tokens";
import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Card,
  Dock,
  FixedLight,
  KeyValue,
  LoadingBone,
  LoadingView,
  metrics,
  NavBar,
  QrCode,
  Screen,
  TestMoneyTag,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useReceipt, useSendReceipt } from "./data";
import type { DeskReceipt } from "./types";
import { backOr, DoneMark, PAYMENT_OFFLINE, toToday } from "./ui";

/** `.qrbox` small: the EBM code beside the receipt's heading. */
const RECEIPT_QR = metrics.thumb + rnSpace[4];

/**
 * `desk-paid`: only the provider's confirmation turns it green. The RRA EBM fiscal receipt goes by
 * SMS or to the guest's app, so the lodge needs no printer.
 */
export function PaidScreen() {
  const { pay } = useScreenParams("desk-paid");
  const query = useReceipt(pay);
  const receipt = query.data;

  const finish = (r: DeskReceipt) => {
    if (r.done.to === "check-in") backOr(href("desk-checkin-room", { guest: r.stayId }))();
    else toToday(href("desk-today"));
  };

  return (
    <Screen
      header={<NavBar title="" onBack={backOr(href("desk-today"))} right={<TestMoneyTag />} />}
      dock={
        receipt ? (
          <Dock>
            <Button onPress={() => finish(receipt)}>{receipt.done.label}</Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} offlineNote={PAYMENT_OFFLINE} data={receipt} loading={<PaidSkeleton />}>
        {(r) => <Receipt receipt={r} />}
      </QueryView>
    </Screen>
  );
}

function Receipt({ receipt }: { receipt: DeskReceipt }) {
  const send = useSendReceipt();
  const toast = useToast();
  return (
    <View className="gap-4 px-4">
      <DoneMark />
      <View className="items-center">
        <Text role="title2" tabular className="text-center">
          {`Paid · ${rwf(receipt.amount)}`}
        </Text>
        <Text role="callout" tone="muted" className="mt-1 text-center">
          {receipt.confirmLine}
        </Text>
      </View>
      <Card>
        <View className="flex-row items-start justify-between gap-3">
          <View className="shrink">
            <Text role="micro" tone="muted" caps strong>
              Fiscal receipt · RRA EBM
            </Text>
            <Text role="headline" strong className="mt-1">
              {receipt.heading}
            </Text>
          </View>
          <FixedLight>
            <View className="rounded-xl border border-separator bg-segment p-1.5">
              <QrCode seed={receipt.qrSeed} size={RECEIPT_QR} framed={false} label="Fiscal receipt code" />
            </View>
          </FixedLight>
        </View>
        <KeyValue rows={receipt.lines} className="mt-2" />
      </Card>
      <View className="flex-row gap-2.5">
        <Button
          variant="secondary"
          icon={receipt.smsSent ? "CircleCheck" : "Comments"}
          size="md"
          className="flex-1"
          isDisabled={send.isPending}
          onPress={() =>
            send.mutate(receipt.id, {
              onSuccess: () => toast.show({ icon: "Comments", message: `Receipt sent by SMS to ${receipt.smsTo}` }),
            })
          }
        >
          {receipt.smsSent ? "Sent by SMS" : "Send by SMS"}
        </Button>
        <Button
          variant="secondary"
          icon="QrCode"
          size="md"
          className="flex-1"
          onPress={() => router.push(href("desk-checkin-room", { guest: receipt.stayId }))}
        >
          Show app QR
        </Button>
      </View>
    </View>
  );
}

function PaidSkeleton() {
  return (
    <LoadingView label="Loading the receipt" className="items-center px-4">
      <LoadingBone className="size-24 rounded-full" />
      <LoadingBone className="h-6 w-1/2" />
      <LoadingBone className="h-4 w-4/5" />
      <LoadingBone className="h-52 w-full rounded-3xl" />
      <LoadingBone className="h-14 w-full rounded-full" />
    </LoadingView>
  );
}
