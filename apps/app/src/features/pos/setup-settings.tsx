"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import type { PaymentMethod, PosOutlet } from "@/server/pos";
import { updateSettingsAction } from "./actions";
import { METHOD_NAME, Panel } from "./back-office";
import { previewReceiptOf, ReceiptPaper } from "./ebm-receipt";
import { businessDayText, clock, DAY_START_CHOICES, isDirty, tinValid } from "./setup-logic";
import { usePosAction } from "./shared";

export const selectClass =
  "h-10 w-full rounded-lg border border-separator bg-field px-3 text-[14px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent";

const METHODS: PaymentMethod[] = [
  "cash",
  "mtn_momo",
  "airtel_money",
  "card",
  "bank_transfer",
  "voucher",
  "customer_credit",
];

/** Tells the screen whether this form has changes not saved yet (for the leave-this-step warning). */
type OnDirty = (dirty: boolean) => void;

/** Shows the save bar's state: what is unsaved, or that everything is saved. */
function SaveBar({
  dirty,
  valid,
  pending,
  onSave,
  onReset,
  label,
}: {
  dirty: boolean;
  valid: boolean;
  pending: boolean;
  onSave: () => void;
  onReset: () => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-separator pt-3">
      <span data-ui="save-state" className={`mr-auto text-[12px] ${dirty ? "text-warning" : "text-muted"}`}>
        {dirty ? "Unsaved changes" : "All changes saved"}
      </span>
      {dirty ? (
        <Button variant="ghost" isDisabled={pending} onPress={onReset}>
          Undo changes
        </Button>
      ) : null}
      <Button variant="primary" isDisabled={!dirty || !valid || pending} onPress={onSave}>
        {label}
      </Button>
    </div>
  );
}

/** The venue's TIN, phone and address (on every receipt) and when its business day starts. */
export function VenueDetailsStep({ outlet, onDirty }: { outlet: PosOutlet; onDirty: OnDirty }) {
  const s = outlet.settings;
  const saved = useMemo(
    () => ({
      venueTin: s.venueTin ?? "",
      venuePhone: s.venuePhone ?? "",
      venueAddress: s.venueAddress ?? "",
      businessDayStartMinutes: s.businessDayStartMinutes ?? 0,
    }),
    [s.venueTin, s.venuePhone, s.venueAddress, s.businessDayStartMinutes],
  );
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  const { run, pending } = usePosAction();
  const dirty = isDirty(saved, draft);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const tinOk = tinValid(draft.venueTin);
  const valid = tinOk && draft.venuePhone.trim().length <= 30 && draft.venueAddress.trim().length <= 200;
  // A start the API accepts but the list does not offer (set elsewhere) still shows as itself.
  const choices = DAY_START_CHOICES.includes(draft.businessDayStartMinutes)
    ? DAY_START_CHOICES
    : [...DAY_START_CHOICES, draft.businessDayStartMinutes].sort((a, b) => a - b);
  const preview = previewReceiptOf(outlet, {
    venueTin: tinOk ? draft.venueTin : "",
    venuePhone: draft.venuePhone,
    venueAddress: draft.venueAddress,
    receiptHeader: s.receiptHeader,
    receiptFooter: s.receiptFooter,
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel title="Venue details" note="Printed at the top of every receipt this outlet gives, under its name.">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              value={draft.venueTin}
              onChange={(v) => setDraft({ ...draft, venueTin: v.replace(/\D/g, "").slice(0, 9) })}
              isInvalid={!tinOk}
              fullWidth
            >
              <Label>TIN (Tax Identification Number)</Label>
              <Input inputMode="numeric" placeholder="9 digits, such as 102345678" className="tabular" />
              {!tinOk ? <p className="text-[12px] text-danger">A TIN is 9 digits.</p> : null}
            </TextField>
            <TextField value={draft.venuePhone} onChange={(v) => setDraft({ ...draft, venuePhone: v })} fullWidth>
              <Label>Phone</Label>
              <Input inputMode="tel" placeholder="+250 788 000 000" maxLength={30} />
            </TextField>
            <TextField
              value={draft.venueAddress}
              onChange={(v) => setDraft({ ...draft, venueAddress: v })}
              fullWidth
              className="md:col-span-2"
            >
              <Label>Address</Label>
              <Input placeholder="KN 5 Rd, Kimihurura, Kigali" maxLength={200} />
            </TextField>
          </div>
        </Panel>
        <Panel
          title="Business day"
          note="When a day starts on the dashboard and in the reports. A bar that closes after midnight starts its day later, so the night's sales stay together."
        >
          <label className="flex max-w-sm flex-col gap-1 text-[13px] font-medium">
            The business day starts at
            <select
              data-ui="business-day-start"
              className={selectClass}
              value={draft.businessDayStartMinutes}
              onChange={(e) => setDraft({ ...draft, businessDayStartMinutes: Number(e.target.value) })}
            >
              {choices.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "00:00 (midnight, calendar day)" : clock(m)}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[13px] text-muted">
            {businessDayText(draft.businessDayStartMinutes)}.
            {draft.businessDayStartMinutes
              ? ` A sale at ${clock(Math.max(0, draft.businessDayStartMinutes - 60))} counts in the day before. Receipt and order numbers keep their calendar date.`
              : " Receipt and order numbers use the same date."}
          </p>
          <SaveBar
            dirty={dirty}
            valid={valid}
            pending={pending}
            label="Save venue details"
            onReset={() => setDraft(saved)}
            onSave={() =>
              run(
                () =>
                  updateSettingsAction(outlet.id, {
                    venueTin: draft.venueTin.trim(),
                    venuePhone: draft.venuePhone.trim(),
                    venueAddress: draft.venueAddress.trim(),
                    businessDayStartMinutes: draft.businessDayStartMinutes,
                  }),
                "Venue details saved.",
              )
            }
          />
        </Panel>
      </div>
      <ReceiptPreview r={preview} note="Example lines. Updates as you type; nothing is saved until you press Save." />
    </div>
  );
}

function ReceiptPreview({ r, note }: { r: ReturnType<typeof previewReceiptOf>; note: string }) {
  return (
    <section aria-label="Receipt preview" className="flex min-w-0 flex-col gap-2">
      <p className="text-[13px] font-medium">Receipt preview</p>
      <div className="rounded-2xl bg-[var(--pos-band)] p-4" data-ui="receipt-preview">
        <ReceiptPaper r={r} />
      </div>
      <p className="text-[12px] text-muted">{note}</p>
    </section>
  );
}

/** Tax mode, receipt text (with a live preview), the payment methods offered and the cashier's discount limit. */
export function ReceiptsStep({ outlet, onDirty }: { outlet: PosOutlet; onDirty: OnDirty }) {
  const s = outlet.settings;
  const saved = useMemo(
    () => ({
      taxMode: s.taxMode,
      receiptHeader: s.receiptHeader,
      receiptFooter: s.receiptFooter,
      limit: String(s.discountLimitBps / 100),
      methods: s.enabledMethods,
    }),
    [s.taxMode, s.receiptHeader, s.receiptFooter, s.discountLimitBps, s.enabledMethods],
  );
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  const { run, pending } = usePosAction();
  const dirty = isDirty(saved, draft);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const pct = Number(draft.limit);
  const valid = draft.methods.length > 0 && draft.limit.trim() !== "" && Number.isFinite(pct) && pct >= 0 && pct <= 100;
  const toggle = (m: PaymentMethod) =>
    setDraft((d) => ({ ...d, methods: d.methods.includes(m) ? d.methods.filter((x) => x !== m) : [...d.methods, m] }));
  const preview = previewReceiptOf(outlet, {
    venueTin: s.venueTin ?? "",
    venuePhone: s.venuePhone ?? "",
    venueAddress: s.venueAddress ?? "",
    receiptHeader: draft.receiptHeader,
    receiptFooter: draft.receiptFooter,
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel title="Receipts and payments" note="Applies to this outlet. Money is always in Rwandan francs (RWF).">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Prices on the menu
            <select
              className={selectClass}
              value={draft.taxMode}
              onChange={(e) => setDraft({ ...draft, taxMode: e.target.value as typeof draft.taxMode })}
            >
              <option value="exclusive">Tax is added on top of these prices</option>
              <option value="inclusive">These prices already include tax</option>
            </select>
            <span className="text-[12px] font-normal text-muted">
              {draft.taxMode === "inclusive"
                ? "A 1,180 RWF menu price is what the guest pays; the receipt shows the 180 RWF VAT inside it."
                : "A 1,000 RWF menu price becomes 1,180 RWF on the bill with 18% VAT added."}{" "}
              Open bills keep the mode they were opened with.
            </span>
          </label>
          <TextField
            value={draft.limit}
            onChange={(v) => setDraft({ ...draft, limit: v.replace(/[^\d.]/g, "") })}
            isInvalid={!valid && draft.methods.length > 0}
            fullWidth
          >
            <Label>Largest discount a cashier gives alone (%)</Label>
            <Input inputMode="decimal" className="tabular" />
            <p className="text-[12px] text-muted">A larger discount needs a manager's approval. 0 to 100.</p>
          </TextField>
          <TextField value={draft.receiptHeader} onChange={(v) => setDraft({ ...draft, receiptHeader: v })} fullWidth>
            <Label>Receipt header</Label>
            <Input placeholder="Welcome to Mama Rosa" maxLength={200} />
          </TextField>
          <TextField value={draft.receiptFooter} onChange={(v) => setDraft({ ...draft, receiptFooter: v })} fullWidth>
            <Label>Receipt footer</Label>
            <Input placeholder="Thank you, come again" maxLength={200} />
          </TextField>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[13px] font-medium">Payment methods offered</legend>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => {
              const on = draft.methods.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(m)}
                  className={`min-h-9 rounded-full border px-3 text-[13px] font-medium ${
                    on
                      ? "border-accent bg-accent-soft text-accent-soft-foreground"
                      : "border-separator text-muted hover:bg-default"
                  }`}
                >
                  {METHOD_NAME[m]}
                </button>
              );
            })}
          </div>
          <p className={`text-[12px] ${draft.methods.length ? "text-muted" : "text-danger"}`}>
            {draft.methods.length
              ? "Mobile money and card payments are simulated until a payment provider is connected."
              : "Offer at least one payment method."}
          </p>
        </fieldset>
        <SaveBar
          dirty={dirty}
          valid={valid}
          pending={pending}
          label="Save settings"
          onReset={() => setDraft(saved)}
          onSave={() =>
            run(
              () =>
                updateSettingsAction(outlet.id, {
                  taxMode: draft.taxMode,
                  receiptHeader: draft.receiptHeader.trim(),
                  receiptFooter: draft.receiptFooter.trim(),
                  discountLimitBps: Math.round(pct * 100),
                  enabledMethods: draft.methods,
                }),
              "Receipt and payment settings saved.",
            )
          }
        />
      </Panel>
      <ReceiptPreview
        r={preview}
        note="Example lines. The TIN, phone and address come from Venue details; the header and footer update as you type."
      />
    </div>
  );
}
