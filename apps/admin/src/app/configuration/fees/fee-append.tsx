"use client";

import { Button, Input, Textarea } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { useStaffPermissions } from "@/components/shell/staff-access-provider";
import { appendRegistrationFee } from "@/lib/actions/configuration";
import { useAdminUi } from "@/lib/store";

/**
 * Append a registration fee (ADR-053, AC-R9, C11).
 *
 * The route existed and was proven; this screen had no control for it, so a
 * price change still needed a developer (I12). Shown only to a staffer whose
 * permissions from the server include `admin.fee.edit` (finance, super admin).
 * Everyone else reads the schedule below and is offered nothing to press, which
 * is the same answer the API would give them.
 *
 * APPEND, never edit, and the form says so: a registration already created keeps
 * the amount on its invoice. A date in the past is refused by the platform, and
 * its sentence is shown here, beside the date that caused it.
 *
 * THE BUTTON WAITS FOR HYDRATION. The form is server rendered, so a press that
 * lands before React attaches `onSubmit` runs the browser's own submit: a GET
 * that writes nothing and puts the amount and the audit reason into the address
 * bar and the server's request log. Seen on 2026-09-13. A disabled default
 * button also stops Enter in a field from submitting, so nothing reaches the
 * browser's submit until the handler that prevents it is there.
 */

const subscribeNothing = () => () => {};

const TYPES = [
  { key: "hospitality", label: "Hospitality — a hotel, guest house or other stay" },
  { key: "residence", label: "Residence — a landlord's building" },
  { key: "broker", label: "Broker" },
] as const;

export function FeeAppend() {
  const mayAppend = useStaffPermissions().includes("admin.fee.edit");
  const toast = useAdminUi((s) => s.toast);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  // False in the server render and until hydration, true from then on.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);

  if (!mayAppend) return null;

  return (
    <section
      data-section="fee-append"
      aria-label="Append a registration fee"
      className="rounded-card border border-border bg-field p-6"
    >
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Append a registration fee
      </h2>
      <p className="mt-1 max-w-read text-sm text-muted-foreground">
        A new amount takes effect from the moment you choose and never changes an invoice
        already issued. Leave the date empty to start now.
      </p>
      <form
        className="mt-4 grid gap-3 md:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          const amount = Number(String(data.get("amountRwf") ?? "").replace(/[,\s]/g, ""));
          const when = String(data.get("effectiveFrom") ?? "");
          if (!Number.isInteger(amount) || amount < 0) {
            setRefusal("Write the fee in whole Rwandan francs.");
            return;
          }
          setRefusal(null);
          setPending(true);
          try {
            const out = await appendRegistrationFee({
              businessType: String(data.get("businessType") ?? ""),
              amountRwf: amount,
              // The staffer's wall time, as the moment it names in their timezone.
              effectiveFrom: when ? new Date(when).toISOString() : null,
              reason: String(data.get("reason") ?? ""),
            });
            if (out.ok) {
              toast(out.message, out.tone);
              form.reset();
              router.refresh();
            } else {
              setRefusal(out.message);
            }
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="block text-sm font-semibold">
          Business type
          <select
            name="businessType"
            aria-label="Business type"
            defaultValue="hospitality"
            className="mt-1 h-10 w-full rounded border border-border bg-field px-2 text-sm text-foreground"
          >
            {TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Amount (RWF)
          <Input name="amountRwf" aria-label="Amount in RWF" inputMode="numeric" required readOnly={pending} className="mt-1 w-full" />
        </label>
        <label className="block text-sm font-semibold">
          Effective from
          <Input name="effectiveFrom" aria-label="Effective from" type="datetime-local" readOnly={pending} className="mt-1 w-full" />
        </label>
        <label className="block md:col-span-3">
          <span className="text-sm font-semibold">Reason — recorded on the audit trail with your name</span>
          <Textarea name="reason" required minLength={4} maxLength={500} rows={2} className="mt-1" readOnly={pending} />
        </label>
        {refusal && (
          <p role="alert" className="rounded-card border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground md:col-span-3">
            {refusal}
          </p>
        )}
        <div className="md:col-span-3">
          <Button type="submit" variant="primary" pending={pending} disabled={!hydrated}>
            {pending ? "Appending…" : "Append fee"}
          </Button>
        </div>
      </form>
    </section>
  );
}
