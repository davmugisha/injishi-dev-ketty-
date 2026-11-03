import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Choice,
  Dock,
  Field,
  IconTile,
  Input,
  LoadingBone,
  LoadingView,
  Segmented,
  SheetScreen,
  TestMoneyTag,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { useBillPayment, usePayBill } from "./data";
import type { BillPayment, PayMethod, PayMethodId } from "./types";

type Share = "all" | "part";

const SHARES = [
  { value: "all", label: "All due now" },
  { value: "part", label: "Part" },
] as const;

/** An Airtel Money number as typed: 07 then eight digits, spaces allowed. */
const AIRTEL = /^07\d{8}$/;

/**
 * Pay the bill, a sheet over it: MoMo first, Airtel second, card honestly marked desk only. The request
 * goes to the phone and the bill is paid only when the provider confirms, on the wait screen.
 */
export function BillPayScreen() {
  const payment = useBillPayment();
  const pay = usePayBill();
  const toast = useToast();
  const [share, setShare] = useState<Share>("all");
  const [part, setPart] = useState("");
  const [method, setMethod] = useState<PayMethodId>("mtn");
  const [airtel, setAirtel] = useState("");
  const [tried, setTried] = useState(false);
  const data = payment.data;

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(href("guest-bill"));
  };

  const amount = data ? (share === "all" ? data.due : Number(part.replace(/\D/g, "")) || 0) : 0;
  const partError =
    data && share === "part" && tried && (amount < data.minimumPart || amount > data.due)
      ? `Between ${rwf(data.minimumPart)} and ${rwf(data.due)}.`
      : undefined;
  const airtelError =
    method === "airtel" && tried && !AIRTEL.test(airtel.replace(/\s/g, ""))
      ? "An Airtel number starts 07 and has 10 digits."
      : undefined;
  const provider = data?.methods.find((m) => m.id === method)?.provider ?? "MTN";

  const send = () => {
    if (!data) return;
    setTried(true);
    const okAmount = share === "all" || (amount >= data.minimumPart && amount <= data.due);
    const okNumber = method !== "airtel" || AIRTEL.test(airtel.replace(/\s/g, ""));
    if (!okAmount || !okNumber) return;
    pay.mutate(
      { amount, method },
      {
        // The wait screen takes the sheet's place, so back from it lands on the bill.
        onSuccess: () => router.replace(href("guest-pay-wait")),
        onError: () => toast.show({ icon: "CloudSlash", message: "Not sent. Try again in a moment.", haptic: "error" }),
      },
    );
  };

  return (
    <SheetScreen
      onClose={close}
      title={data ? `Pay ${rwf(amount > 0 ? amount : data.due)}` : "Pay the bill"}
      right={<TestMoneyTag />}
      dock={
        data && data.due > 0 ? (
          <Dock>
            <Button size="lg" icon="Smartphone" onPress={send} isDisabled={pay.isPending}>
              Send payment request
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView offlineNote={null} query={payment} data={data} loading={<PayBones />}>
        {(d) =>
          d.due <= 0 ? (
            <Text role="body" tone="muted" className="pb-4">
              Nothing is due now. New charges show on the bill as they post.
            </Text>
          ) : (
            <PayForm
              payment={d}
              share={share}
              onShare={setShare}
              part={part}
              onPart={setPart}
              partError={partError}
              method={method}
              onMethod={setMethod}
              airtel={airtel}
              onAirtel={setAirtel}
              airtelError={airtelError}
              provider={provider}
            />
          )
        }
      </QueryView>
    </SheetScreen>
  );
}

function PayForm({
  payment,
  share,
  onShare,
  part,
  onPart,
  partError,
  method,
  onMethod,
  airtel,
  onAirtel,
  airtelError,
  provider,
}: {
  payment: BillPayment;
  share: Share;
  onShare: (next: Share) => void;
  part: string;
  onPart: (next: string) => void;
  partError?: string;
  method: PayMethodId;
  onMethod: (next: PayMethodId) => void;
  airtel: string;
  onAirtel: (next: string) => void;
  airtelError?: string;
  provider: string;
}) {
  return (
    <View className="gap-4 pb-2">
      <Segmented label="How much" options={SHARES} value={share} onChange={onShare} />
      {share === "part" ? (
        <Field label="Amount" hint={`At least ${rwf(payment.minimumPart)}; the rest stays on the bill.`} error={partError}>
          <Input
            value={part}
            onChangeText={onPart}
            placeholder={String(payment.minimumPart)}
            keyboardType="number-pad"
            leading={
              <Text role="callout" strong tone="muted">
                RWF
              </Text>
            }
          />
        </Field>
      ) : null}
      <View accessibilityRole="radiogroup" accessibilityLabel="Pay with" className="gap-2">
        {payment.methods.map((m) => (
          <MethodChoice key={m.id} method={m} selected={method === m.id} onPress={() => onMethod(m.id)} />
        ))}
      </View>
      {method === "airtel" ? (
        <Field label="Airtel number" error={airtelError}>
          <Input value={airtel} onChangeText={onAirtel} placeholder="073 123 4567" keyboardType="phone-pad" leading="Smartphone" />
        </Field>
      ) : null}
      <Text role="callout" tone="muted">
        {`You approve on your phone. We mark it paid only when ${provider} confirms.`}
      </Text>
    </View>
  );
}

/** `.choice`: a way to pay with its mark; one the app cannot take yet is shown, dimmed and disabled. */
function MethodChoice({ method, selected, onPress }: { method: PayMethod; selected: boolean; onPress: () => void }) {
  return (
    <View className={method.available ? undefined : "opacity-50"}>
      <Choice
        title={method.title}
        subtitle={method.detail}
        selected={selected}
        onPress={onPress}
        isDisabled={!method.available}
        leading={<IconTile icon={method.icon} tone={method.tone} />}
      />
    </View>
  );
}

function PayBones() {
  return (
    <LoadingView label="Loading payment options" className="pb-4">
      <LoadingBone className="h-12 w-full rounded-2xl" />
      <LoadingBone className="h-18 w-full rounded-2xl" />
      <LoadingBone className="h-18 w-full rounded-2xl" />
      <LoadingBone className="h-18 w-full rounded-2xl" />
    </LoadingView>
  );
}
