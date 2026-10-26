"use client";

import { CircleCheckFill } from "@gravity-ui/icons";
import { Button, Card, Description, Input, Label, TextField, toast } from "@heroui/react";
import { RadioButtonGroup, Segment } from "@heroui-pro/react";
import type { PayNetwork, RentCharge, Tenancy } from "@injishi/data/fixtures/resident";
import { formatRwf, KeyValueList, PhoneBody, PhoneTop } from "@injishi/ui";
import { useState } from "react";
import { PhoneSheet } from "@/components/phone/PhoneSheet";
import { maskPhone, PhoneToasts, ResidentTitle } from "./parts";

export type PayState = "pending" | "verified" | "unknown";

/**
 * Pay rent by mobile money: amount, network, confirm sheet (artifact: TenantPay). Paying is not wired: a payment
 * attempt cannot carry rent yet (the data map's resident.paymentIntents), so the screen opens on the form, Pay
 * says it is not available and nothing is charged. It never shows a prompt, a pending payment or a receipt that
 * was not real; `state` (the prototype's `?state=` variants) is accepted and ignored for that reason. The phone and
 * the part amount start empty: they are the tenant's to type, never a sample payment's. `charge` is this month's
 * live charge, or null when nothing is due.
 */
export function TenantPayView({
  tenancy,
  charge,
  networks,
}: {
  tenancy: Tenancy;
  charge: RentCharge | null;
  networks: PayNetwork[];
  state?: PayState;
}) {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [mode, setMode] = useState<"full" | "part">("full");
  const [part, setPart] = useState("");
  const [netId, setNetId] = useState(networks[0]?.id ?? "mtn");
  const [phone, setPhone] = useState("");

  const rent = charge?.amount ?? 0;
  const partNum = Math.max(0, Math.min(rent, Number(part) || 0));
  const amount = mode === "full" ? rent : partNum;
  const network = networks.find((n) => n.id === netId) ?? networks[0];
  const netName = network?.name ?? "MTN MoMo";
  const amountStr = formatRwf(amount);
  const forText = mode === "full" ? `${charge?.month} rent, in full` : `${charge?.month} rent, part payment`;

  // Paying rent by mobile money is not wired: a payment attempt cannot carry rent yet (the data map's
  // resident.paymentIntents). Say so rather than show a prompt that was never sent.
  const payUnavailable = () => {
    setStep("form");
    toast.warning(
      "Paying rent in the app is not available yet. Nothing was charged. Pay by bank or at the office and management records it.",
    );
  };

  return (
    <>
      <PhoneTop>
        <ResidentTitle title="Pay rent" sub={`${tenancy.unit} · lease ${tenancy.id} · to ${tenancy.landlord}`} />
      </PhoneTop>

      {!charge || rent === 0 ? (
        <PhoneBody>
          <Card variant="secondary" className="gap-0.5 px-4 py-[14px]">
            <span className="text-[12px] text-muted">
              {charge ? `${charge.month} rent · ${charge.status}` : "This month"}
            </span>
            <span className="text-[22px] leading-7 font-[650]">Nothing to pay</span>
            <span className="text-[12px] leading-4 text-muted">
              {charge
                ? "This month’s rent has no balance left on your lease."
                : "Management has not raised a rent charge on your lease for this month."}
            </span>
          </Card>
        </PhoneBody>
      ) : (
        <PhoneBody>
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
                <Input id="part-amt" className="tabular" inputMode="numeric" placeholder="0" />
                <Description>
                  The remaining {formatRwf(rent - partNum)} stays due on {charge.dueShort}. A part payment never closes
                  the month.
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
            <Input id="phone" className="tabular" inputMode="tel" placeholder="07X XXX XXXX" />
            <Description>Paying in the app is not available yet, so no prompt is sent.</Description>
          </TextField>

          <Button variant="primary" size="lg" fullWidth onPress={() => setStep("confirm")}>
            Continue
          </Button>
          <p className="text-center text-[12px] leading-4 text-muted">
            Paid to {tenancy.landlord} · {tenancy.landlordTin}. Your caution deposit is separate and is not used for
            rent.
          </p>
        </PhoneBody>
      )}

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
            { label: "Phone", value: <span className="tabular">{phone.trim() ? maskPhone(phone) : "Not given"}</span> },
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
