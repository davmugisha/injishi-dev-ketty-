import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Choice,
  Dock,
  Icon,
  IconTile,
  KeyValue,
  LiveDot,
  LoadingBone,
  LoadingView,
  metrics,
  NavBar,
  Photo,
  Screen,
  TestMoneyTag,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { useCheckout, useStartPayment } from "./data";
import type { CheckoutData, PayMethod, PayMethodId } from "./types";

/** Each wallet's mark: MTN's yellow, Airtel's red, a card in grey. */
const METHOD_LOOK = {
  mtn: { icon: "Smartphone", tone: "warning" },
  airtel: { icon: "Smartphone", tone: "danger" },
  card: { icon: "CreditCard", tone: "default" },
} as const;

/** The wallet's own word for the payment, on the button and in the note. */
const WALLET: Record<PayMethodId, string> = { mtn: "MoMo", airtel: "Airtel Money", card: "card" };

const THUMB = metrics.photo.thumb - metrics.rowInset;

/**
 * Confirm and pay (prototype `guest-checkout`): the stay, the total, the deposit paid now and what is
 * paid at the hotel, the wallet, and what cancelling costs and when, all before paying. Card is listed
 * honestly as not in the app yet. Paying sends the prompt and opens the wait for approval.
 */
export function CheckoutScreen() {
  const query = useCheckout();
  const pay = useStartPayment();
  const toast = useToast();
  const [picked, setPicked] = useState<PayMethodId>("mtn");
  const data = query.data;
  const method = data?.methods.find((m) => m.id === picked) ?? data?.methods[0];

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(href("guest-property", { slug: data?.slug }));
  };
  const start = (m: PayMethod) =>
    pay.mutate(m.id, {
      onSuccess: () => router.push(href("guest-pay-wait")),
      onError: () => toast.show({ icon: "CloudSlash", message: "Paying isn't connected yet" }),
    });

  return (
    <Screen
      header={<NavBar title="Confirm and pay" subtitle={data?.confirmNote} onBack={back} />}
      dock={data && method ? <PayDock data={data} method={method} busy={pay.isPending} onPay={start} /> : undefined}
    >
      <QueryView query={query} data={data} offlineNote={null} loading={<CheckoutBones />}>
        {(d) => <CheckoutBody data={d} picked={picked} onPick={setPicked} />}
      </QueryView>
    </Screen>
  );
}

function PayDock({
  data,
  method,
  busy,
  onPay,
}: {
  data: CheckoutData;
  method: PayMethod;
  busy: boolean;
  onPay: (m: PayMethod) => void;
}) {
  if (!method.ready) {
    return (
      <Dock note="It's kept on your account for next time.">
        <Button variant="secondary" icon="Plus" onPress={() => router.push(href("shared-account"))}>
          {`Add an ${method.name} number`}
        </Button>
      </Dock>
    );
  }
  return (
    <Dock note={`You approve it on your phone with your ${WALLET[method.id]} PIN.`}>
      <Button icon="Smartphone" isDisabled={busy} onPress={() => onPay(method)}>
        {`Pay ${rwf(data.deposit)} with ${WALLET[method.id]}`}
      </Button>
    </Dock>
  );
}

function CheckoutBody({
  data,
  picked,
  onPick,
}: {
  data: CheckoutData;
  picked: PayMethodId;
  onPick: (id: PayMethodId) => void;
}) {
  return (
    <View className="gap-3 px-4 pt-1">
      <Card padding="sm">
        <View className="flex-row items-center gap-3">
          <Photo source={data.photo} width={THUMB} height={THUMB} radius="md" />
          <View className="flex-1 gap-0.5">
            <Text role="headline">{data.stayName}</Text>
            <Text role="callout" tone="muted">
              {data.roomLine}
            </Text>
            <Text role="callout" strong className="mt-1">
              {data.datesLine}
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <KeyValue rows={data.lines} total={{ label: "Total", value: rwf(data.total) }} />
        <View className="mt-3">
          <Banner tone="info" icon="Wallet" title={`Pay ${rwf(data.deposit)} now`} body={data.depositNote} />
        </View>
      </Card>

      <View className="mt-1 flex-row items-center justify-between gap-3">
        <Text role="headline" strong accessibilityRole="header">
          Pay with
        </Text>
        <TestMoneyTag />
      </View>
      <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="Pay with">
        {data.methods.map((m) => (
          <View key={m.id} className={m.offered ? undefined : "opacity-60"}>
            <Choice
              title={m.name}
              subtitle={m.detail}
              selected={m.offered && m.id === picked}
              isDisabled={!m.offered}
              onPress={() => onPick(m.id)}
              leading={<IconTile icon={METHOD_LOOK[m.id].icon} tone={METHOD_LOOK[m.id].tone} />}
            />
          </View>
        ))}
      </View>

      <Card>
        <Text role="headline" strong accessibilityRole="header">
          If your plans change
        </Text>
        <View className="mt-3 flex-row gap-1" style={{ height: metrics.progress.md }} importantForAccessibility="no">
          {data.tiers.map((t) => (
            <View key={t.key} className={`rounded-sm ${TIER_FILL[t.tone]}`} style={{ flex: t.weight }} />
          ))}
        </View>
        <View className="mt-3 gap-2">
          {data.tiers.map((t) => (
            <View key={t.key} className="flex-row items-start gap-2" accessible>
              <View className="pt-0.5">
                <LiveDot tone={t.tone} />
              </View>
              <Text role="callout" tone="muted" className="flex-1">
                <Text role="callout" strong>
                  {t.title}
                </Text>{" "}
                {t.when}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <View className="flex-row items-center gap-1.5">
        <Icon name="ShieldCheck" size={16} tone="success" />
        <Text role="caption" tone="muted" className="flex-1">
          Your deposit is held by Injishi until you check in.
        </Text>
      </View>
    </View>
  );
}

const TIER_FILL = { success: "bg-success", warning: "bg-warning", danger: "bg-danger" } as const;

function CheckoutBones() {
  return (
    <LoadingView label="Loading your booking" className="px-4 pt-1">
      <LoadingBone className="h-24 rounded-3xl" />
      <LoadingBone className="h-48 rounded-3xl" />
      <LoadingBone className="h-5 w-1/3" />
      <LoadingBone className="h-16 rounded-2xl" />
      <LoadingBone className="h-16 rounded-2xl" />
    </LoadingView>
  );
}
