import { router } from "expo-router";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  Dock,
  Icon,
  KeyValue,
  LoadingBone,
  NavBar,
  Ring,
  Screen,
  TestMoneyTag,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useReceipt } from "./data";
import type { Receipt } from "./types";
import { backOr, CardBone, MONEY_OFFLINE, Skeleton, useNotify } from "./ui";

/** `ring(100, { size: 92 })`: the receipt's tick, a full success ring. */
const RING = 92;

/**
 * `res-receipt`: proof of a payment, with the provider's reference and the payment ID for a
 * dispute, labelled as proof of payment and not a tax invoice. `?id=` picks the payment (default
 * the newest). Straight after paying (`?from=pay`) back and Done go Home, as the prototype does;
 * opened from the history they go back to it.
 */
export function ReceiptScreen() {
  const { id, from } = useScreenParams("res-receipt");
  const query = useReceipt(id);
  const notify = useNotify();
  const afterPaying = from === "pay";
  const leave = () => (afterPaying ? router.dismissTo(href("res-home")) : backOr(href("res-home")));

  return (
    <Screen
      header={<NavBar title="" onBack={leave} />}
      dock={
        query.data ? (
          <Dock>
            <View className="flex-row gap-2.5">
              <Button
                variant="secondary"
                icon="ArrowDownToLine"
                className="flex-1"
                onPress={() => notify.done(`Receipt ${query.data?.id} saved as a PDF`, "ArrowDownToLine")}
              >
                Save PDF
              </Button>
              <Button className="flex-1" onPress={leave}>
                Done
              </Button>
            </View>
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={query.data} loading={<ReceiptSkeleton />} offlineNote={MONEY_OFFLINE}>
        {(receipt) => <ReceiptBody receipt={receipt} />}
      </QueryView>
    </Screen>
  );
}

function ReceiptBody({ receipt }: { receipt: Receipt }) {
  return (
    <View className="gap-4 px-4">
      <View className="items-center gap-2">
        <Ring value={100} size={RING} tone="success" label="Rent paid">
          <Icon name="Check" size={40} tone="success" />
        </Ring>
        <Text role="title2" className="mt-2 text-center">
          Rent paid
        </Text>
        <Text role="body" tone="muted" className="text-center">
          {receipt.confirmed}
        </Text>
        <TestMoneyTag />
      </View>
      <Card>
        <View className="mb-1 flex-row items-center justify-between gap-3">
          <Text role="headline">Payment receipt</Text>
          <Chip label="Verified" tone="success" icon="SealCheck" />
        </View>
        <KeyValue
          rows={[
            { label: "Amount", value: rwf(receipt.amount) },
            { label: "For", value: receipt.forLabel },
            { label: "Paid to", value: receipt.payee },
            { label: "Provider ref", value: receipt.providerRef },
            { label: "Payment ID", value: receipt.id },
          ]}
        />
      </Card>
      <Banner body="Proof you paid. Not a tax invoice. Your landlord issues the fiscal receipt." />
    </View>
  );
}

function ReceiptSkeleton() {
  return (
    <Skeleton label="Loading the receipt">
      <View className="items-center gap-2">
        <LoadingBone className="size-24 rounded-full" />
        <LoadingBone className="h-7 w-2/5" />
        <LoadingBone className="h-4 w-3/5" />
      </View>
      <CardBone size="lg" />
      <CardBone size="sm" />
    </Skeleton>
  );
}
