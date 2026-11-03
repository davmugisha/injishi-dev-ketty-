import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  Choice,
  Dock,
  Field,
  Icon,
  Input,
  LoadingBone,
  Radio,
  Screen,
  ScreenHeader,
  TestMoneyTag,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useRentPayment, useStartPayment } from "./data";
import type { PayMethodId, PayView } from "./types";
import { CardBone, MONEY_OFFLINE, MonthBlock, Skeleton, useNotify } from "./ui";

/** The least a part payment can be, in francs. */
const MIN_PART = 1_000;

/**
 * `res-pay` (the Pay tab): full or part payment and the mobile money network on one screen, the
 * number masked, test money until a gateway is live (X4). Continue keeps the choice and opens
 * Confirm payment. `?amount=part` (Home's "Part") opens on a part payment. Its error state is the
 * prototype's `shared-error`.
 */
export function PayScreen() {
  const query = useRentPayment();
  const view = query.data;
  const { amount: openOn } = useScreenParams("res-pay");
  const [kind, setKind] = useState<"full" | "part" | null>(openOn === "part" ? "part" : null);
  const [method, setMethod] = useState<PayMethodId | null>(null);
  const [partText, setPartText] = useState("");
  const [airtelText, setAirtelText] = useState("");
  const start = useStartPayment();
  const notify = useNotify();

  // Home's "Part" opens this tab on a part payment, also when the tab is already open.
  useEffect(() => {
    if (openOn === "part") setKind("part");
  }, [openOn]);

  // A payment went through (the balance moved): the tab stays mounted, so its choices start again.
  const [balanceSeen, setBalanceSeen] = useState(view?.balance);
  if (view?.balance !== balanceSeen) {
    setBalanceSeen(view?.balance);
    setKind(null);
    setPartText("");
  }

  const form = view && !view.paid ? view : null;
  const chosenKind = kind ?? form?.draft.kind ?? "full";
  const chosenMethod = method ?? form?.draft.method ?? "mtn";
  const part = Number(partText.replace(/\D/g, ""));
  const airtel = form?.methods.find((m) => m.id === "airtel");
  const needsNumber = chosenMethod === "airtel" && !airtel?.number;
  const numberOk = !needsNumber || airtelText.replace(/\D/g, "").length === 10;
  const partError =
    form && chosenKind === "part" && partText !== "" && (part < MIN_PART || part >= form.balance)
      ? `Type an amount from ${rwf(MIN_PART)} up to ${rwf(form.balance - 1)}. Paying it all? Choose Full amount.`
      : undefined;
  const ready = Boolean(form) && numberOk && (chosenKind === "full" || (part >= MIN_PART && !partError));

  const proceed = () => {
    if (!form) return;
    start.mutate(
      {
        kind: chosenKind,
        amount: chosenKind === "full" ? form.balance : part,
        method: chosenMethod,
        newNumber: needsNumber ? airtelText : null,
      },
      { onSuccess: () => router.push(href("res-pay-confirm")), onError: notify.failed },
    );
  };

  return (
    <Screen
      dock={
        form ? (
          <Dock>
            <Button size="lg" isDisabled={!ready || start.isPending} onPress={proceed}>
              Continue
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <ScreenHeader title="Pay rent" right={view ? <TestMoneyTag /> : undefined} />
      <QueryView query={query} data={view} loading={<PaySkeleton />} offlineNote={MONEY_OFFLINE}>
        {(data) =>
          data.paid ? (
            <PaidCard paid={data.paid} />
          ) : (
            <View className="gap-4 px-4">
              <Card>
                <View className="flex-row items-center gap-3">
                  <MonthBlock month={data.month} day={data.day} />
                  <View className="flex-1 gap-0.5">
                    <Text role="headline">{data.title}</Text>
                    <Text role="callout" tone="muted">
                      {data.payee}
                    </Text>
                  </View>
                  <Text role="callout" strong tabular>
                    {rwf(data.balance)}
                  </Text>
                </View>
              </Card>

              <View className="gap-2">
                <Text role="callout" strong>
                  How much
                </Text>
                <Choice
                  title="Full amount"
                  subtitle={data.clears}
                  selected={chosenKind === "full"}
                  onPress={() => setKind("full")}
                  trailing={
                    <Text role="callout" strong tabular>
                      {data.balance.toLocaleString("en-US")}
                    </Text>
                  }
                />
                <Choice
                  title="Part payment"
                  subtitle="Pay some now; the rest stays due"
                  selected={chosenKind === "part"}
                  onPress={() => setKind("part")}
                />
                {chosenKind === "part" ? (
                  <Field
                    label="Amount to pay now"
                    hint={
                      part >= MIN_PART && part < data.balance
                        ? `The rest, ${rwf(data.balance - part)}, stays due ${data.due}.`
                        : `The rest stays due ${data.due}.`
                    }
                    error={partError}
                  >
                    <Input
                      value={partText}
                      onChangeText={(text) => setPartText(text.replace(/[^\d,]/g, ""))}
                      keyboardType="number-pad"
                      placeholder="400,000"
                      leading={
                        <Text role="callout" strong tone="muted">
                          RWF
                        </Text>
                      }
                    />
                  </Field>
                ) : null}
              </View>

              <View className="gap-2">
                <Text role="callout" strong>
                  Mobile money
                </Text>
                <View className="flex-row gap-2.5">
                  {data.methods.map((m) => (
                    <MethodChoice
                      key={m.id}
                      name={m.name}
                      number={m.number}
                      selected={chosenMethod === m.id}
                      onPress={() => setMethod(m.id)}
                    />
                  ))}
                </View>
                {needsNumber ? (
                  <Field label="Airtel Money number" hint="10 digits, starting 073. It is saved for next time.">
                    <Input
                      value={airtelText}
                      onChangeText={setAirtelText}
                      keyboardType="phone-pad"
                      placeholder="0733 000 000"
                      leading="Smartphone"
                    />
                  </Field>
                ) : (
                  <Text role="caption" tone="muted">
                    You get a prompt on this phone and approve it with your PIN.
                  </Text>
                )}
              </View>
            </View>
          )
        }
      </QueryView>
    </Screen>
  );
}

/** `.choice` in a column: the network over its masked number, the radio at the top right. */
function MethodChoice({
  name,
  number,
  selected,
  onPress,
}: {
  name: string;
  number: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <View className="flex-1">
      <Choice
        indicator="none"
        title={name}
        subtitle={number ?? "Add a number"}
        selected={selected}
        onPress={onPress}
        trailing={<Radio selected={selected} />}
      />
    </View>
  );
}

/** The Pay tab once the month is paid: no form, the receipt and the statements instead. */
function PaidCard({ paid }: { paid: NonNullable<PayView["paid"]> }) {
  return (
    <View className="gap-3 px-4">
      <Card tone="success" padding="lg">
        <View className="gap-2">
          <Icon name="CircleCheck" size={32} />
          <Text role="title3">{paid.title}</Text>
          <Text role="callout">{paid.body}</Text>
        </View>
      </Card>
      <Button
        variant="secondary"
        icon="Receipt"
        onPress={() => router.push(href("res-receipt", { id: paid.receiptId }))}
      >
        See the receipt
      </Button>
      <Button variant="outline" icon="FileText" onPress={() => router.push(href("res-payments"))}>
        Payments and statements
      </Button>
    </View>
  );
}

function PaySkeleton() {
  return (
    <Skeleton label="Loading your rent">
      <CardBone size="sm" />
      <LoadingBone className="h-4 w-1/4" />
      <LoadingBone className="h-16 rounded-2xl" />
      <LoadingBone className="h-16 rounded-2xl" />
      <LoadingBone className="h-4 w-1/3" />
      <View className="flex-row gap-2.5">
        <LoadingBone className="h-20 flex-1 rounded-2xl" />
        <LoadingBone className="h-20 flex-1 rounded-2xl" />
      </View>
    </Skeleton>
  );
}
