"use client";

import {
  BrokerFeeCheckoutRequest,
  type BrokerFeeMethod,
  type BrokerFeePayment,
  type District,
  type Province,
  provinceLabel,
} from "@injishi/contracts";
import { CircleAlert, CircleCheck, Smartphone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@injishi/ui";

import { fetchDistricts, fetchProvinces } from "@/data/geography";
import { fetchBrokerFee, fetchBrokerFeePayment, payBrokerFee } from "@/data/registration";
import { apiResultMessage } from "@/lib/api";

import { Callout } from "./register-shell";
import { ChoiceCard, Field, SelectField, TextInput, formatRwf } from "./wizard-ui";

/** How often a waiting prompt is asked about. */
const POLL_MS = 2_000;

/**
 * The broker's last two answers (2026-10-25): the district they work in (the
 * free plan shows the homes there), and the registration fee, paid by mobile
 * money before registering. The prompt waits on the payer's phone and is
 * polled until it is approved or declined. Register sends both.
 */
export function BrokerSignup({
  busy,
  onRegister,
}: {
  busy: boolean;
  onRegister: (homeDistrictId: number, feePaymentId: string) => void;
}) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [geoError, setGeoError] = useState("");

  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<BrokerFeeMethod>("mtn_momo");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [payment, setPayment] = useState<BrokerFeePayment | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  // One key per press: a retried request of the same press is the same payment.
  const pressKey = useRef<string | null>(null);

  useEffect(() => {
    void fetchProvinces().then((r) => (r.status === "ok" ? setProvinces(r.data) : setGeoError("We couldn't load the provinces.")));
    void fetchBrokerFee().then((r) => {
      if (r.status !== "ok") return;
      setAmount(r.data.amountRwf);
      if (r.data.paid) setPayment(r.data.paid);
    });
  }, []);

  useEffect(() => {
    setDistricts([]);
    if (!provinceId) return;
    let current = true;
    void fetchDistricts(Number(provinceId)).then((r) => {
      if (!current) return;
      if (r.status === "ok") setDistricts(r.data);
      else setGeoError("We couldn't load the districts.");
    });
    return () => {
      current = false;
    };
  }, [provinceId]);

  // A prompt waiting on the phone is asked about until it is answered.
  const waiting = payment?.status === "pending";
  const paymentId = payment?.id;
  useEffect(() => {
    if (!waiting || !paymentId) return;
    const timer = setInterval(() => {
      void fetchBrokerFeePayment(paymentId).then((r) => {
        if (r.status === "ok") setPayment(r.data);
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, paymentId]);

  const pay = useCallback(async () => {
    setPhoneError("");
    setPayError("");
    const parsed = BrokerFeeCheckoutRequest.safeParse({ method, phone });
    if (!parsed.success) {
      setPhoneError(parsed.error.issues[0]?.message ?? "Enter your mobile money number.");
      return;
    }
    pressKey.current ??= crypto.randomUUID();
    setPaying(true);
    const res = await payBrokerFee(parsed.data, pressKey.current);
    setPaying(false);
    if (res.status !== "ok") {
      setPayError(apiResultMessage(res));
      return;
    }
    pressKey.current = null;
    setPayment(res.data);
  }, [method, phone]);

  const paid = payment?.status === "paid";
  const failed = payment?.status === "failed";
  const fee = amount === null ? "the fee" : formatRwf(amount);

  return (
    <div className="flex flex-col gap-6 border-t border-border pt-6">
      <section aria-labelledby="broker-district" className="flex flex-col gap-3">
        <h3 id="broker-district" className="text-base font-semibold">
          District you work in
        </h3>
        <p className="-mt-2 text-xs text-muted-foreground">The free plan shows the homes in this district.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Province" required>
            <SelectField
              value={provinceId}
              onChange={(v) => {
                setProvinceId(v);
                setDistrictId("");
              }}
              options={provinces.map((p) => ({ value: String(p.id), label: provinceLabel(p.name) }))}
              placeholder="Choose a province"
            />
          </Field>
          <Field label="District" required>
            <SelectField
              value={districtId}
              onChange={setDistrictId}
              options={districts.map((d) => ({ value: String(d.id), label: d.name }))}
              placeholder={provinceId ? "Choose a district" : "Choose a province first"}
              disabled={!provinceId}
            />
          </Field>
        </div>
        {geoError ? (
          <p className="text-sm text-destructive" role="alert">
            {geoError}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="broker-fee" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="broker-fee" className="text-base font-semibold">
            Registration fee
          </h3>
          <span className="text-lg font-semibold tabular-nums">{amount === null ? "" : formatRwf(amount)}</span>
        </div>

        {paid ? (
          <Callout tone="success" icon={<CircleCheck size={16} aria-hidden />} title="Paid">
            {payment?.methodWords}
          </Callout>
        ) : waiting ? (
          <Callout tone="info" icon={<Smartphone size={16} aria-hidden />} title="Approve the prompt on your phone">
            We sent {fee} to {payment?.methodWords}. This page updates when you approve it.
          </Callout>
        ) : (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <ChoiceCard name="broker-fee-method" value="mtn_momo" checked={method === "mtn_momo"} title="MTN MoMo" onSelect={() => setMethod("mtn_momo")} />
              <ChoiceCard
                name="broker-fee-method"
                value="airtel_money"
                checked={method === "airtel_money"}
                title="Airtel Money"
                onSelect={() => setMethod("airtel_money")}
              />
            </div>
            <Field label="Mobile money number" error={phoneError} required>
              <TextInput
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={method === "mtn_momo" ? "0788 123 456" : "0732 123 456"}
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={phoneError ? true : undefined}
              />
            </Field>
            {failed ? (
              <Callout tone="danger" icon={<CircleAlert size={16} aria-hidden />} title="The payment did not go through">
                {payment?.failureReason ?? "Nothing was taken. Try again."}
              </Callout>
            ) : null}
            {payError ? (
              <Callout tone="danger" icon={<CircleAlert size={16} aria-hidden />} title="That did not go through">
                {payError}
              </Callout>
            ) : null}
            <div>
              <Button onClick={() => void pay()} disabled={paying || amount === null}>
                {paying ? "Sending the prompt…" : failed ? "Try again" : `Pay ${fee}`}
              </Button>
            </div>
          </>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => payment && districtId && onRegister(Number(districtId), payment.id)}
          disabled={busy || !paid || !districtId}
        >
          {busy ? "Registering…" : "Register as a broker"}
        </Button>
        {!paid || !districtId ? (
          <span className="text-xs text-muted-foreground">
            {!districtId && !paid ? "Choose your district and pay the fee." : !districtId ? "Choose your district." : "Pay the fee first."}
          </span>
        ) : null}
      </div>
    </div>
  );
}
