import { screenHref } from "@injishi/data";
import type { PaymentIntent, PayNetwork, RentCharge, Tenancy } from "@injishi/data/fixtures/resident";
import { Link, useLocalSearchParams } from "expo-router";
import { Accordion, Button, Card, Description, Input, Label, Radio, RadioGroup, TextField } from "heroui-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody, PhoneTop } from "@/components/phone";
import { useSession } from "@/lib/session";
import { getCollection } from "@/lib/store";
import {
  downloadText,
  formatRwf,
  IconCircle,
  KeyValue,
  maskPhone,
  PhoneSheet,
  PhoneTitle,
  param,
  Segmented,
  StatusAlert,
  Timeline,
  ToneChip,
} from "./ui";

export type PayState = "pending" | "verified" | "unknown";

const STATUS = {
  pending: { tone: "accent", icon: "Smartphone", title: "Approve on your phone", chip: "Pending", chipTone: "info" },
  verified: {
    tone: "success",
    icon: "CircleCheckFill",
    title: "Payment verified",
    chip: "Verified",
    chipTone: "success",
  },
  unknown: {
    tone: "warning",
    icon: "Hourglass",
    title: "We’re checking with the provider",
    chip: "Result unknown",
    chipTone: "warning",
  },
} as const;

function payState(value: string | undefined): PayState {
  if (value === "verified" || value === "unknown" || value === "pending") return value;
  return "pending";
}

/** Pay rent by mobile money: amount, network, confirm sheet, then pending / verified / unknown (artifact: TenantPay). */
export default function TenantPayScreen() {
  const { persona } = useSession();
  const state = payState(param(useLocalSearchParams<{ state?: string }>().state));
  const [step, setStep] = useState<"form" | "confirm" | "status">("status");
  const [mode, setMode] = useState<"full" | "part">("full");
  const [part, setPart] = useState<string | null>(null);
  const [netId, setNetId] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  const tenancies = getCollection<Tenancy>("resident.tenancies");
  const charges = getCollection<RentCharge>("resident.rentCharges");
  const intents = getCollection<PaymentIntent>("resident.paymentIntents");
  const networks = getCollection<PayNetwork>("resident.payNetworks");

  const tenancy = tenancies.find((item) => item.persona === persona?.id) ?? tenancies[0];
  const charge = tenancy ? charges.find((item) => item.lease === tenancy.id) : undefined;
  const intent = charge ? intents.find((item) => item.charge === charge.id) : undefined;
  if (!tenancy || !charge || !intent || !networks.length) return null;

  const rent = charge.amount;
  const partSource = part ?? String(intent.partDefault);
  const partNum = Math.max(intent.minPart, Math.min(rent, Number(partSource) || 0));
  const amount = mode === "full" ? rent : partNum;
  const network = networks.find((item) => item.id === (netId ?? networks[0].id)) ?? networks[0];
  const netName = network.name;
  const amountStr = formatRwf(amount);
  const forText = mode === "full" ? `${charge.month} rent, in full` : `${charge.month} rent, part payment`;
  const status = STATUS[state];
  const shownPhone = phone ?? intent.phone;
  const onStatus = step === "status";

  const saveReceipt = () => {
    downloadText(`receipt-${intent.id}.txt`, [
      "Payment receipt",
      "Not a tax invoice",
      `Amount: ${amountStr}`,
      `For: ${forText}`,
      `Paid to: ${tenancy.landlord}`,
      `Network: ${netName}`,
      `Provider ref: ${network.providerRef}`,
      `Verified: ${intent.verifiedAt} by ${netName}`,
      `Payment ID: ${intent.id}`,
    ]);
  };

  const statusDesc =
    state === "pending"
      ? `Enter your ${netName} PIN in the prompt to pay ${amountStr}.`
      : state === "verified"
        ? `${netName} confirmed your payment. Your rent balance is updated.`
        : `${netName} has not told us the result yet. Do not pay again.`;

  return (
    <>
      <PhoneTop>
        {onStatus ? (
          <Button variant="ghost" isIconOnly accessibilityLabel="Payment details" onPress={() => setStep("form")}>
            <Icon name="ChevronLeft" size={20} />
          </Button>
        ) : null}
        <PhoneTitle title="Pay rent" sub={`${tenancy.unit} · lease ${tenancy.id} · to ${tenancy.landlord}`} />
      </PhoneTop>

      <PhoneBody>
        {onStatus ? (
          <>
            <Card accessibilityLiveRegion="polite" className="items-center gap-[14px] px-4 py-5">
              <IconCircle tone={status.tone} icon={status.icon} />
              <View className="items-center gap-1">
                <Text
                  accessibilityRole="header"
                  className="text-center text-[20px] leading-[26px] font-semibold text-foreground"
                >
                  {status.title}
                </Text>
                <Text className="text-center text-sm leading-5 text-muted">{statusDesc}</Text>
              </View>
              <ToneChip tone={status.chipTone}>{status.chip}</ToneChip>
            </Card>

            {state === "pending" ? (
              <>
                <Timeline
                  label="Payment progress"
                  items={[
                    {
                      id: "sent",
                      title: `Request sent to ${netName}`,
                      detail: intent.requestedAt,
                      marker: "done",
                      icon: "Check",
                    },
                    {
                      id: "wait",
                      title: "Waiting for you to approve",
                      detail: `The prompt expires at ${intent.expiresAt}`,
                      marker: "current",
                    },
                    {
                      id: "done",
                      title: `Confirmed by ${netName}`,
                      detail: "Only then is your rent marked paid",
                      marker: "idle",
                    },
                  ]}
                />
                <Card variant="secondary" className="px-[14px] py-3">
                  <Accordion selectionMode="single">
                    <Accordion.Item value="prompt">
                      <Accordion.Trigger>
                        <Text className="flex-1 text-sm font-medium text-foreground">I did not get a prompt</Text>
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                      <Accordion.Content>
                        <Text className="text-[13px] leading-[19px] text-muted">
                          Check your approvals in the {netName} menu. Please do not start a second payment while this
                          one is waiting; if it expires, you can try again.
                        </Text>
                      </Accordion.Content>
                    </Accordion.Item>
                  </Accordion>
                </Card>
              </>
            ) : null}

            {state === "verified" ? (
              <Card className="gap-[10px] p-4">
                <View className="flex-row items-center justify-between gap-3">
                  <Text accessibilityRole="header" className="text-[15px] font-semibold text-foreground">
                    Payment receipt
                  </Text>
                  <Text className="text-[11px] text-muted">Not a tax invoice</Text>
                </View>
                <KeyValue
                  items={[
                    { label: "Amount", value: amountStr },
                    { label: "For", value: forText },
                    { label: "Paid to", value: tenancy.landlord },
                    { label: "Network", value: netName },
                    { label: "Provider ref", value: network.providerRef },
                    { label: "Verified", value: `${intent.verifiedAt} by ${netName}` },
                    { label: "Payment ID", value: intent.id },
                  ]}
                />
              </Card>
            ) : null}

            {state === "unknown" ? (
              <StatusAlert
                status="warning"
                icon="TriangleExclamation"
                title="Do not pay again"
                description={`If money left your account, it is safe and will be matched to your rent. We check with ${netName} every ${intent.recheckMinutes} minutes and will tell you the result here and by email.`}
              />
            ) : null}

            {state !== "verified" ? (
              <Card variant="secondary" className="px-4 py-[14px]">
                <KeyValue
                  items={[
                    { label: "Amount", value: amountStr },
                    { label: "For", value: forText },
                    { label: "From", value: `${netName} · ${maskPhone(shownPhone)}` },
                    { label: "Payment ID", value: intent.id },
                  ]}
                />
              </Card>
            ) : null}

            {state === "verified" ? (
              <View className="flex-row gap-2">
                <Button variant="secondary" size="lg" className="min-h-12 flex-1" onPress={saveReceipt}>
                  <Icon name="ArrowDownToLine" />
                  <Button.Label>Receipt</Button.Label>
                </Button>
                <Link href={screenHref("TenantHome") as never} asChild>
                  <Button size="lg" className="min-h-12 flex-1">
                    <Button.Label>Done</Button.Label>
                  </Button>
                </Link>
              </View>
            ) : null}
            {state === "unknown" ? (
              <Link href={screenHref("TenantHome") as never} asChild>
                <Button variant="secondary" size="lg" className="w-full">
                  <Icon name="Comments" />
                  <Button.Label>Message management</Button.Label>
                </Button>
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <Card variant="secondary" className="gap-0.5 px-4 py-[14px]">
              <Text className="text-xs text-muted">
                {charge.month} rent · due {charge.due}
              </Text>
              <Text className="text-[22px] leading-7 font-semibold text-foreground">{formatRwf(rent)}</Text>
            </Card>

            <View className="gap-2">
              <Text className="text-[15px] leading-[22px] font-semibold text-foreground">Amount</Text>
              <RadioGroup
                accessibilityLabel="Amount"
                value={mode}
                onValueChange={(value) => {
                  if (value === "full" || value === "part") setMode(value);
                }}
                className="gap-2"
              >
                <RadioGroup.Item
                  value="full"
                  className="w-full flex-row items-center gap-3 rounded-2xl border border-separator bg-surface px-4 py-[14px]"
                >
                  <Radio />
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="text-sm font-semibold text-foreground">Full rent · {formatRwf(rent)}</Text>
                    <Text className="text-xs leading-4 text-muted">Closes {charge.month} rent once verified</Text>
                  </View>
                </RadioGroup.Item>
                <RadioGroup.Item
                  value="part"
                  className="w-full flex-row items-center gap-3 rounded-2xl border border-separator bg-surface px-4 py-[14px]"
                >
                  <Radio />
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="text-sm font-semibold text-foreground">Part payment</Text>
                    <Text className="text-xs leading-4 text-muted">Pay some now; the rest stays due</Text>
                  </View>
                </RadioGroup.Item>
              </RadioGroup>
              {mode === "part" ? (
                <TextField>
                  <Label>Amount to pay now (RWF)</Label>
                  <Input
                    accessibilityLabel="Amount to pay now (RWF)"
                    value={partSource}
                    onChangeText={(value) => setPart(value.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                  />
                  <Description>
                    The remaining {formatRwf(rent - partNum)} stays due on {charge.dueShort}. A part payment never
                    closes the month.
                  </Description>
                </TextField>
              ) : null}
            </View>

            <View className="gap-2">
              <Label>Mobile money network</Label>
              <Segmented
                label="Mobile money network"
                value={network.id}
                onChange={setNetId}
                items={networks.map((item) => ({ id: item.id, label: item.name }))}
              />
            </View>

            <TextField>
              <Label>Phone number</Label>
              <Input
                accessibilityLabel="Phone number"
                value={shownPhone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Description>You will get a prompt on this phone to approve with your PIN.</Description>
            </TextField>

            <Button size="lg" className="w-full" onPress={() => setStep("confirm")}>
              <Button.Label>Continue</Button.Label>
            </Button>
            <Text className="text-center text-xs leading-4 text-muted">
              Paid to {tenancy.landlord} · {tenancy.landlordTin}. Your caution deposit is separate and is not used for
              rent.
            </Text>
          </>
        )}
      </PhoneBody>

      <PhoneSheet
        isOpen={step === "confirm"}
        onOpenChange={(next) => setStep(next ? "confirm" : "form")}
        heading="Confirm payment"
      >
        <KeyValue
          items={[
            { label: "Amount", value: amountStr },
            { label: "For", value: forText },
            { label: "To", value: tenancy.landlord },
            { label: "Network", value: netName },
            { label: "Phone", value: maskPhone(shownPhone) },
          ]}
        />
        <Text className="text-xs leading-4 text-muted">
          Your network may charge its usual fee. Injishi adds no fee.
        </Text>
        <Button size="lg" className="w-full" onPress={() => setStep("status")}>
          <Button.Label>Pay {amountStr}</Button.Label>
        </Button>
        <Button variant="ghost" className="w-full" onPress={() => setStep("form")}>
          <Button.Label>Back</Button.Label>
        </Button>
      </PhoneSheet>
    </>
  );
}
