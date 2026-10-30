"use client";

import { CircleInfo, Clock } from "@gravity-ui/icons";
import { Alert, Button, Card, Input, Label, TextField, toast } from "@heroui/react";
import type {
  ReservationChangeAsk,
  ReservationChangeForm,
  ReservationChangeQuote,
  ReservationChangeResult,
} from "@injishi/contracts";
import { formatRwf } from "@injishi/ui";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePmsActions } from "../mount.tsx";
import { ChoiceSelect, plural } from "./shared.tsx";

type Settle = "bill" | "momo";

/** Nine national digits → the network they belong to (078/079 MTN, 072/073 Airtel), or null. */
function networkOf(msisdn: string): "mtn_momo" | "airtel_money" | null {
  if (/^7[89]\d{7}$/.test(msisdn)) return "mtn_momo";
  if (/^7[23]\d{7}$/.test(msisdn)) return "airtel_money";
  return null;
}

/** "0788 123 456", "+250 788…", "788123456" → "788123456". */
const nationalDigits = (raw: string) => raw.replace(/\D/g, "").replace(/^250/, "").replace(/^0/, "");

const COUNTS = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

/**
 * Change a confirmed reservation from the desk (2026-10-30): its dates, its room type, its party. The
 * price is the platform's, re-quoted as the desk edits; nothing moves until Save. Costing more, the desk
 * chooses: the difference on the guest's bill, or a MoMo request to the guest, and the change applies once
 * they pay. Costing less, the difference stays on the bill as credit, and what is left is refunded at
 * check out.
 */
export function ReservationChange({
  bookingRef,
  onBack,
  onDone,
}: {
  bookingRef: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const { loadReservationChange, previewReservationChange, saveReservationChange, checkReservationChange } =
    usePmsActions();
  const [form, setForm] = useState<ReservationChangeForm | null>(null);
  const [loadError, setLoadError] = useState("");
  const [ask, setAsk] = useState<ReservationChangeAsk | null>(null);
  const [quote, setQuote] = useState<ReservationChangeQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [settle, setSettle] = useState<Settle>("bill");
  const [phone, setPhone] = useState("");
  const [waiting, setWaiting] = useState<ReservationChangeResult | null>(null);
  const [busy, startBusy] = useTransition();
  const token = useRef<string>("");

  useEffect(() => {
    let live = true;
    void loadReservationChange(bookingRef).then((r) => {
      if (!live) return;
      if (!r.ok) return setLoadError(r.error);
      setForm(r.value);
      setAsk(r.value.current);
    });
    return () => {
      live = false;
    };
  }, [bookingRef]);

  // Re-price after the desk stops editing for a moment.
  useEffect(() => {
    if (!ask || !form) return;
    const same = JSON.stringify(ask) === JSON.stringify(form.current);
    if (same) return setQuote(null);
    setQuoting(true);
    const t = setTimeout(() => {
      void previewReservationChange(bookingRef, ask).then((r) => {
        setQuoting(false);
        if (r.ok) setQuote(r.value);
        else setQuote({ ...emptyQuote, problems: [r.error] });
      });
    }, 350);
    return () => clearTimeout(t);
  }, [ask, form, bookingRef]);

  // While the guest is asked to pay, look every few seconds; the change applies the moment it lands.
  useEffect(() => {
    if (waiting?.status !== "awaiting_payment" || !waiting.attempt) return;
    const t = setTimeout(() => {
      void checkReservationChange(bookingRef, waiting.attempt?.attemptToken ?? "").then((r) => {
        if (!r.ok) return toast.danger(r.error);
        setWaiting(r.value);
        if (r.value.status === "applied") {
          toast.success(`${bookingRef} changed · the guest paid ${formatRwf(r.value.differenceRwf)}`);
          onDone();
        }
      });
    }, 3000);
    return () => clearTimeout(t);
  }, [waiting, bookingRef, onDone]);

  if (loadError) {
    return (
      <Alert status="danger">
        <Alert.Content>
          <Alert.Title>The change form did not open</Alert.Title>
          <Alert.Description>{loadError}</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }
  if (!form || !ask) {
    return <div className="h-40 animate-pulse rounded-2xl bg-default" aria-busy="true" />;
  }

  const blocked = form.problems.length > 0;
  const room = form.roomTypes.find((r) => r.id === ask.roomTypeId) ?? null;
  const names = form.roomTypes.map((r) => r.name);
  const maxAdults = Math.max(1, room?.maxAdults ?? room?.capacity ?? 1);
  const maxChildren = Math.max(0, Math.min(room?.maxChildren ?? room?.capacity ?? 0, (room?.capacity ?? 1) - 1));
  const diff = quote?.differenceRwf ?? 0;
  const canSave = !!quote && quote.problems.length === 0 && quote.available && !quoting && !busy;
  const digits = nationalDigits(phone);
  const network = networkOf(digits);
  const momo = diff > 0 && settle === "momo";
  const set = (patch: Partial<ReservationChangeAsk>) => setAsk((a) => (a ? { ...a, ...patch } : a));

  const save = () =>
    startBusy(async () => {
      if (momo && !network) {
        toast.danger("Enter the guest's MTN or Airtel mobile money number.");
        return;
      }
      token.current = token.current || crypto.randomUUID();
      const r = await saveReservationChange(bookingRef, {
        ...ask,
        ...(diff > 0 ? { settlement: settle } : {}),
        ...(momo && network
          ? { instrument: { kind: "mobile_money" as const, network, msisdn: digits }, attemptToken: token.current }
          : {}),
      });
      if (!r.ok) {
        toast.danger(`${bookingRef} was not changed: ${r.error}`);
        return;
      }
      if (r.value.status === "applied") {
        toast.success(
          diff > 0
            ? `${bookingRef} changed · ${formatRwf(diff)} added to the guest's bill`
            : diff < 0
              ? `${bookingRef} changed · ${formatRwf(-diff)} kept as credit on the bill`
              : `${bookingRef} changed`,
        );
        onDone();
        return;
      }
      if (r.value.status === "abandoned") {
        toast.danger(r.value.attempt?.failureReason ?? "The guest's payment did not go through. Nothing was changed.");
        token.current = "";
        return;
      }
      setWaiting(r.value);
    });

  if (waiting && waiting.status !== "applied") {
    const ended = waiting.status === "abandoned" || (waiting.attempt && waiting.attempt.state !== "prompting");
    return (
      <Card variant="secondary" className="gap-3 p-3.5">
        <span className="flex items-center gap-2 font-semibold">
          <Clock className="size-4" aria-hidden="true" />
          {ended ? "The guest did not pay" : "Waiting for the guest to pay"}
        </span>
        <p className="text-sm text-muted">
          {ended
            ? (waiting.attempt?.failureReason ?? "The request ran out. Nothing was changed.")
            : `A MoMo request for ${formatRwf(waiting.differenceRwf)} went to ${waiting.attempt?.payerMasked ?? "the guest's phone"}. The booking changes as soon as they approve it.`}
        </p>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onPress={
              ended
                ? () => {
                    setWaiting(null);
                    token.current = "";
                  }
                : onBack
            }
          >
            {ended ? "Try again" : "Close"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="secondary" className="gap-3 p-3.5">
      <span className="font-semibold">Change the booking</span>
      {blocked ? (
        <p className="text-sm text-danger">{form.problems[0]}</p>
      ) : (
        <>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr))]">
            <TextField value={ask.checkIn} onChange={(v) => set({ checkIn: v })} className="flex flex-col gap-1">
              <Label>Arrival</Label>
              <Input type="date" className="tabular" />
            </TextField>
            <TextField value={ask.checkOut} onChange={(v) => set({ checkOut: v })} className="flex flex-col gap-1">
              <Label>Departure</Label>
              <Input type="date" className="tabular" />
            </TextField>
          </div>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr))]">
            {names.length > 1 ? (
              <ChoiceSelect
                label="Room type"
                options={names}
                value={room?.name ?? names[0] ?? ""}
                onChange={(name) => {
                  const next = form.roomTypes.find((r) => r.name === name);
                  if (next) set({ roomTypeId: next.id });
                }}
              />
            ) : (
              <div className="flex flex-col gap-1">
                <Label>Room type</Label>
                <span className="text-sm">{room?.name ?? "—"}</span>
              </div>
            )}
            <ChoiceSelect
              label="Adults"
              options={COUNTS(1, maxAdults)}
              value={String(Math.min(ask.adults, maxAdults))}
              onChange={(v) => set({ adults: Number(v) })}
            />
            <ChoiceSelect
              label="Children"
              options={COUNTS(0, maxChildren)}
              value={String(Math.min(ask.children, maxChildren))}
              onChange={(v) => set({ children: Number(v) })}
            />
          </div>

          {quote ? (
            <div className="flex flex-col gap-1.5 rounded-xl bg-surface p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted">Paid for the room</span>
                <span className="tabular">{formatRwf(quote.paidRoomRwf)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">
                  New total · {plural(quote.nights, "night")} × {formatRwf(quote.toNightlyRwf)}
                </span>
                <span className="tabular">{formatRwf(quote.newRoomRwf)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-separator pt-1.5 font-semibold">
                <span>{diff > 0 ? "The guest owes" : diff < 0 ? "Credit for the guest" : "Difference"}</span>
                <span className={`tabular ${diff > 0 ? "text-warning" : diff < 0 ? "text-success" : ""}`}>
                  {formatRwf(Math.abs(diff))}
                </span>
              </div>
            </div>
          ) : quoting ? (
            <p className="text-xs text-muted">Pricing the change…</p>
          ) : (
            <p className="text-xs text-muted">
              Pick new dates, another room type or a different party to see the new price.
            </p>
          )}

          {quote?.problems.length ? <p className="text-sm text-danger">{quote.problems[0]}</p> : null}

          {quote && diff > 0 && quote.problems.length === 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">How the guest pays the difference</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How the guest pays the difference">
                <Button
                  size="sm"
                  variant={settle === "bill" ? "primary" : "secondary"}
                  aria-pressed={settle === "bill"}
                  onPress={() => setSettle("bill")}
                >
                  Add it to the guest's bill
                </Button>
                {quote.settlements.includes("momo") ? (
                  <Button
                    size="sm"
                    variant={settle === "momo" ? "primary" : "secondary"}
                    aria-pressed={settle === "momo"}
                    onPress={() => setSettle("momo")}
                  >
                    Ask the guest to pay now by MoMo
                  </Button>
                ) : null}
              </div>
              {settle === "momo" ? (
                <TextField value={phone} onChange={setPhone} className="flex flex-col gap-1">
                  <Label>Guest's mobile money number</Label>
                  <Input inputMode="tel" placeholder="078 123 4567" className="tabular" />
                  <span className="text-xs text-muted">
                    {network
                      ? network === "mtn_momo"
                        ? "MTN MoMo"
                        : "Airtel Money"
                      : "MTN (078, 079) or Airtel (072, 073)"}{" "}
                    · the booking changes once they approve the request.
                  </span>
                </TextField>
              ) : (
                <p className="text-xs text-muted">
                  It is settled at the desk with the rest of the bill, at check in or check out.
                </p>
              )}
            </div>
          ) : null}

          {quote && diff < 0 && quote.problems.length === 0 ? (
            <p className="flex items-start gap-1.5 text-xs text-muted">
              <CircleInfo className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              {formatRwf(-diff)} stays on the guest's bill as credit for anything they add during the stay. What is left
              is refunded to them at check out.
            </p>
          ) : null}
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onPress={onBack}>
          Back
        </Button>
        {blocked ? null : (
          <Button size="sm" isDisabled={!canSave || (momo && !network)} onPress={save}>
            {busy ? "Saving…" : momo ? `Ask for ${formatRwf(diff)}` : "Save change"}
          </Button>
        )}
      </div>
    </Card>
  );
}

const emptyQuote: ReservationChangeQuote = {
  nights: 0,
  fromNightlyRwf: 0,
  toNightlyRwf: 0,
  paidRoomRwf: 0,
  newRoomRwf: 0,
  differenceRwf: 0,
  settlements: [],
  available: false,
  problems: [],
};
