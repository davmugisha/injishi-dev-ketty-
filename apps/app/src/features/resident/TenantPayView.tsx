"use client";

import {
  ArrowDownToLine,
  Check,
  ChevronLeft,
  CircleCheckFill,
  Comments,
  Hourglass,
  Smartphone,
  TriangleExclamation,
} from "@gravity-ui/icons";
import { Alert, Button, Card, Description, Input, Label, TextField, toast } from "@heroui/react";
import { RadioButtonGroup, Segment, Timeline } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { PaymentIntent, PayNetwork, RentCharge, Tenancy } from "@injishi/data/fixtures/resident";
import { formatRwf, KeyValueList, LinkButton, PhoneBody, PhoneTop } from "@injishi/ui";
import { useState } from "react";
import { PhoneSheet } from "@/components/phone/PhoneSheet";
import { downloadText, IconCircle, maskPhone, PhoneToasts, ResidentTitle, renderSection, ToneChip } from "./parts";

export type PayState = "pending" | "verified" | "unknown";

const STATUS = {
  pending: { tone: "accent", icon: "phone", title: "Approve on your phone", chip: "Pending", chipTone: "info" },
  verified: {
    tone: "success",
    icon: "check",
    title: "Payment verified",
    chip: "Verified",
    chipTone: "success",
  },
  unknown: {
    tone: "warning",
    icon: "wait",
    title: "We’re checking with the provider",
    chip: "Result unknown",
    chipTone: "warning",
  },
} as const;

/** Pay rent by mobile money: amount, network, confirm sheet, then pending / verified / unknown (artifact: TenantPay). */
export function TenantPayView({
  tenancy,
  charge,
  intent,
  networks,
  state,
}: {
  tenancy: Tenancy;
  charge: RentCharge;
  intent: PaymentIntent;
  networks: PayNetwork[];
  state: PayState;
}) {
  const [step, setStep] = useState<"form" | "confirm" | "status">("status");
  const [mode, setMode] = useState<"full" | "part">("full");
  const [part, setPart] = useState(String(intent.partDefault));
  const [netId, setNetId] = useState(networks[0]?.id ?? "mtn");
  const [phone, setPhone] = useState(intent.phone);

  const rent = charge.amount;
  const partNum = Math.max(intent.minPart, Math.min(rent, Number(part) || 0));
  const amount = mode === "full" ? rent : partNum;
  const network = networks.find((n) => n.id === netId) ?? networks[0];
  const netName = network?.name ?? "MTN MoMo";
  const providerRef = network?.providerRef ?? "";
  const amountStr = formatRwf(amount);
  const forText = mode === "full" ? `${charge.month} rent, in full` : `${charge.month} rent, part payment`;
  const status = STATUS[state];
  const onStatus = step === "status";

  // Paying rent by mobile money is not wired: a payment attempt cannot carry rent yet (the data map's
  // resident.paymentIntents). Say so rather than show a prompt that was never sent.
  const payUnavailable = () => {
    setStep("form");
    toast.danger(
      "Paying rent in the app is not available yet. Nothing was charged. Pay by bank or at the office and management records it.",
    );
  };

  const saveReceipt = () => {
    downloadText(`receipt-${intent.id}.txt`, [
      "Payment receipt",
      "Not a tax invoice",
      `Amount: ${amountStr}`,
      `For: ${forText}`,
      `Paid to: ${tenancy.landlord}`,
      `Network: ${netName}`,
      `Provider ref: ${providerRef}`,
      `Verified: ${intent.verifiedAt} by ${netName}`,
      `Payment ID: ${intent.id}`,
    ]);
  };

  return (
    <>
      <PhoneTop>
        {onStatus ? (
          <Button isIconOnly variant="ghost" aria-label="Payment details" onPress={() => setStep("form")}>
            <ChevronLeft className="size-5" />
          </Button>
        ) : null}
        <ResidentTitle title="Pay rent" sub={`${tenancy.unit} · lease ${tenancy.id} · to ${tenancy.landlord}`} />
      </PhoneTop>

      <PhoneBody>
        {onStatus ? (
          <>
            <Card render={renderSection} aria-live="polite" className="items-center gap-[14px] px-4 py-5 text-center">
              <IconCircle tone={status.tone}>
                {status.icon === "phone" ? <Smartphone /> : null}
                {status.icon === "check" ? <CircleCheckFill /> : null}
                {status.icon === "wait" ? <Hourglass /> : null}
              </IconCircle>
              <div className="flex flex-col items-center gap-1">
                <h1 className="text-[20px] leading-[26px] font-[650]">{status.title}</h1>
                <p className="text-[14px] leading-5 text-muted">
                  {state === "pending"
                    ? `Enter your ${netName} PIN in the prompt to pay ${amountStr}.`
                    : state === "verified"
                      ? `${netName} confirmed your payment. Your rent balance is updated.`
                      : `${netName} has not told us the result yet. Do not pay again.`}
                </p>
              </div>
              <ToneChip tone={status.chipTone}>{status.chip}</ToneChip>
            </Card>

            {state === "pending" ? (
              <>
                <Timeline size="sm" density="compact" aria-label="Payment progress">
                  <Timeline.Item status="success">
                    <Timeline.Rail>
                      <Timeline.Marker>
                        <Check />
                      </Timeline.Marker>
                      <Timeline.Connector />
                    </Timeline.Rail>
                    <Timeline.Content className="flex flex-col">
                      <span className="font-medium">Request sent to {netName}</span>
                      <span className="text-[12px] text-muted">{intent.requestedAt}</span>
                    </Timeline.Content>
                  </Timeline.Item>
                  <Timeline.Item status="current">
                    <Timeline.Rail>
                      <Timeline.Marker />
                      <Timeline.Connector />
                    </Timeline.Rail>
                    <Timeline.Content className="flex flex-col">
                      <span className="font-medium">Waiting for you to approve</span>
                      <span className="text-[12px] text-muted">The prompt expires at {intent.expiresAt}</span>
                    </Timeline.Content>
                  </Timeline.Item>
                  <Timeline.Item status="default">
                    <Timeline.Rail>
                      <Timeline.Marker />
                      <Timeline.Connector />
                    </Timeline.Rail>
                    <Timeline.Content className="flex flex-col">
                      <span className="font-medium">Confirmed by {netName}</span>
                      <span className="text-[12px] text-muted">Only then is your rent marked paid</span>
                    </Timeline.Content>
                  </Timeline.Item>
                </Timeline>
                <Card variant="secondary" className="px-[14px] py-3">
                  <details>
                    <summary className="cursor-pointer text-[14px] font-medium">I did not get a prompt</summary>
                    <p className="mt-2 text-[13px] leading-[19px] text-muted">
                      Check your approvals in the {netName} menu. Please do not start a second payment while this one is
                      waiting; if it expires, you can try again.
                    </p>
                  </details>
                </Card>
              </>
            ) : null}

            {state === "verified" ? (
              <Card render={renderSection} aria-labelledby="rc-h" className="gap-[10px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="rc-h" className="text-[15px] font-semibold">
                    Payment receipt
                  </h2>
                  <span className="text-[11px] text-muted">Not a tax invoice</span>
                </div>
                <KeyValueList
                  items={[
                    { label: "Amount", value: <span className="tabular">{amountStr}</span> },
                    { label: "For", value: forText },
                    { label: "Paid to", value: tenancy.landlord },
                    { label: "Network", value: netName },
                    { label: "Provider ref", value: <span className="tabular">{providerRef}</span> },
                    { label: "Verified", value: `${intent.verifiedAt} by ${netName}` },
                    { label: "Payment ID", value: <span className="tabular">{intent.id}</span> },
                  ]}
                />
              </Card>
            ) : null}

            {state === "unknown" ? (
              <Alert status="warning">
                <Alert.Indicator>
                  <TriangleExclamation />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Do not pay again</Alert.Title>
                  <Alert.Description>
                    If money left your account, it is safe and will be matched to your rent. We check with {netName}{" "}
                    every {intent.recheckMinutes} minutes and will tell you the result here and by email.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}

            {state !== "verified" ? (
              <Card variant="secondary" className="px-4 py-[14px]">
                <KeyValueList
                  items={[
                    { label: "Amount", value: <span className="tabular">{amountStr}</span> },
                    { label: "For", value: forText },
                    {
                      label: "From",
                      value: (
                        <span className="tabular">
                          {netName} · {maskPhone(phone)}
                        </span>
                      ),
                    },
                    { label: "Payment ID", value: <span className="tabular">{intent.id}</span> },
                  ]}
                />
              </Card>
            ) : null}

            {state === "verified" ? (
              <div className="flex gap-2">
                <Button variant="secondary" size="lg" className="flex-1" onPress={saveReceipt}>
                  <ArrowDownToLine className="size-4" />
                  Receipt
                </Button>
                <LinkButton href={screenHref("TenantHome")} size="lg" className="flex-1">
                  Done
                </LinkButton>
              </div>
            ) : null}
            {state === "unknown" ? (
              <LinkButton href={screenHref("TenantHome")} variant="secondary" size="lg" fullWidth>
                <Comments className="size-4" />
                Message management
              </LinkButton>
            ) : null}
          </>
        ) : (
          <>
            <Card variant="secondary" className="gap-0.5 px-4 py-[14px]">
              <span className="text-[12px] text-muted">
                {charge.month} rent · due {charge.due}
              </span>
              <span className="text-[22px] leading-7 font-[650] tabular">{formatRwf(rent)}</span>
            </Card>

            <div className="flex flex-col gap-2">
              <span id="amt-l" className="text-[15px] leading-[22px] font-semibold">
                Amount
              </span>
              <RadioButtonGroup
                aria-labelledby="amt-l"
                value={mode}
                onChange={(value) => {
                  if (value === "full" || value === "part") setMode(value);
                }}
                className="flex w-full flex-col gap-2"
              >
                <RadioButtonGroup.Item value="full" className="w-full justify-start gap-3 px-4 py-[14px] text-left">
                  <RadioButtonGroup.Indicator>
                    <CircleCheckFill className="size-4" />
                  </RadioButtonGroup.Indicator>
                  <RadioButtonGroup.ItemContent className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-semibold">Full rent · {formatRwf(rent)}</span>
                    <span className="text-[12px] leading-4 text-muted">Closes {charge.month} rent once verified</span>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
                <RadioButtonGroup.Item value="part" className="w-full justify-start gap-3 px-4 py-[14px] text-left">
                  <RadioButtonGroup.Indicator>
                    <CircleCheckFill className="size-4" />
                  </RadioButtonGroup.Indicator>
                  <RadioButtonGroup.ItemContent className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-semibold">Part payment</span>
                    <span className="text-[12px] leading-4 text-muted">Pay some now; the rest stays due</span>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
              </RadioButtonGroup>
              {mode === "part" ? (
                <TextField
                  fullWidth
                  value={part}
                  onChange={(value) => setPart(value.replace(/[^0-9]/g, ""))}
                  className="gap-1"
                >
                  <Label htmlFor="part-amt">Amount to pay now (RWF)</Label>
                  <Input id="part-amt" className="tabular" inputMode="numeric" />
                  <Description>
                    The remaining {formatRwf(rent - partNum)} stays due on {charge.dueShort}. A part payment never
                    closes the month.
                  </Description>
                </TextField>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label id="net-l">Mobile money network</Label>
              <Segment
                aria-labelledby="net-l"
                selectedKey={netId}
                onSelectionChange={(key) => {
                  if (key) setNetId(String(key));
                }}
                className="w-full"
              >
                {networks.map((n, i) => (
                  <Segment.Item key={n.id} id={n.id} className="flex-1">
                    {i > 0 ? <Segment.Separator /> : null}
                    {n.name}
                  </Segment.Item>
                ))}
              </Segment>
            </div>

            <TextField fullWidth type="tel" value={phone} onChange={setPhone} className="gap-1">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" className="tabular" inputMode="tel" />
              <Description>You will get a prompt on this phone to approve with your PIN.</Description>
            </TextField>

            <Button variant="primary" size="lg" fullWidth onPress={() => setStep("confirm")}>
              Continue
            </Button>
            <p className="text-center text-[12px] leading-4 text-muted">
              Paid to {tenancy.landlord} · {tenancy.landlordTin}. Your caution deposit is separate and is not used for
              rent.
            </p>
          </>
        )}
      </PhoneBody>

      <PhoneSheet
        isOpen={step === "confirm"}
        onOpenChange={(next) => setStep(next ? "confirm" : "form")}
        heading="Confirm payment"
      >
        <KeyValueList
          items={[
            { label: "Amount", value: <span className="tabular">{amountStr}</span> },
            { label: "For", value: forText },
            { label: "To", value: tenancy.landlord },
            { label: "Network", value: netName },
            { label: "Phone", value: <span className="tabular">{maskPhone(phone)}</span> },
          ]}
        />
        <p className="text-[12px] leading-4 text-muted">Your network may charge its usual fee. Injishi adds no fee.</p>
        <Button variant="primary" size="lg" fullWidth onPress={payUnavailable}>
          Pay {amountStr}
        </Button>
        <Button variant="ghost" fullWidth onPress={() => setStep("form")}>
          Back
        </Button>
      </PhoneSheet>
      <PhoneToasts />
    </>
  );
}
