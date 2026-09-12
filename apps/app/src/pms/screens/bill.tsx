"use client";

/**
 * The one Bill (folio) — a signature surface (F-P03, blueprint §7).
 *
 * **On real data** (ADR-035, D-f wave 2). Reads `GET /api/v1/ops/folios/:id` and
 * commands `POST :id/charges` (`folio.charge`), `POST :id/payments`
 * (`folio.payment`) and `POST :id/charges/:chargeId/void` (`folio.charge`). Both
 * money commands carry an `Idempotency-Key` (D-h). The demo store is gone from
 * this screen (D-i).
 *
 * **IT IS ADDRESSED BY THE FOLIO NOW, NOT BY THE RESERVATION.** The demo kept
 * one row for a booking, a stay and its bill, so `/finance/bills/<id>` took a
 * reservation id. A folio is its own row with its own id, and it has to be:
 * a walk-in has a bill before it has anything else, and a stay can outlive the
 * booking that started it.
 *
 * **THREE THINGS THE LEDGER DOES THAT A FIXTURE CANNOT**, and this screen now
 * shows all three rather than smoothing them away:
 *
 * - **A charge is posted TAX EXCLUSIVE** and the server adds the tax as its own
 *   line, at the rate effective when it posted (ADR-016, D-n). So the amount
 *   typed here is what the guest is charged before VAT, and the total below is
 *   arithmetic the server did. A screen that sent a tax inclusive figure would
 *   silently overcharge by the VAT rate.
 * - **A void is a REVERSING LINE, not a deletion.** The original stays, greyed,
 *   with its reversal beneath it. A bill that hid the mistake would be a bill
 *   nobody could audit, and `voidedByChargeId` names the pair so the
 *   relationship is a fact about two rows rather than a flag somebody flipped.
 * - **A payment posts no revenue.** The charge already did that at post time.
 *   Building it the other way round would double count every shilling.
 *
 * Departments come from the same `/ops/departments` rows the nav derives its
 * sections from, filtered to revenue centres: a charge naming a cost centre is
 * refused with 422, so the picker greys the wrong ones out rather than letting
 * the desk find out on submit.
 */

import { Button, Input } from "@injishi/ui";
import type { FolioType, OperatorFolioCharge, PaymentMethod } from "@injishi/contracts";
import { useState } from "react";

import { Icon } from "../components/icon";
import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  SelectField,
  Skeleton,
  fieldStyle,
} from "../components/ui";
import { humanError } from "../data/api";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useDepartments, useFolio, usePostCharge, useTakePayment, useVoidCharge } from "../data/ops";
import { dshortIso, fmt, parseAmount } from "../lib/format";
import { usePms } from "../store";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "mobile_money", label: "Mobile money" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
];

/** What a line is, said plainly. The enum is the server's vocabulary. */
const CHARGE_LABEL: Record<string, string> = {
  room: "Room",
  service_order: "Service order",
  pos: "Point of sale",
  service_charge: "Service charge",
  adjustment: "Adjustment",
  discount: "Discount",
  deposit: "Deposit",
  refund: "Refund",
  payment: "Payment",
  tax: "Tax",
  void: "Reversal",
};

/** What kind of bill it is, said plainly. Only a guest's bill names a person. */
export const FOLIO_KIND: Record<FolioType, string> = {
  guest: "Guest bill",
  master: "Master bill",
  group: "Group bill",
  house: "House account",
};

export function Bill({ id }: { id: string }) {
  /*
   * MONEY THAT LANDS SAYS SO OUT LOUD.
   *
   * Posting a charge, taking a payment and reversing a line each cleared their
   * field and left the screen otherwise still: the new row is somewhere in a
   * statement that may already be twenty lines long, and on a bill being
   * settled at the desk with a guest waiting nobody scans for it. So each one
   * names the amount, and the failures stay in the panel where the form is.
   */
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useFolio(workspaceId, id);
  const departments = useDepartments(workspaceId);
  const postCharge = usePostCharge(workspaceId, id);
  const takePayment = useTakePayment(workspaceId, id);
  const voidCharge = useVoidCharge(workspaceId, id);

  const [charge, setCharge] = useState({ departmentId: "", description: "", amount: "" });
  const [pay, setPay] = useState<{ method: PaymentMethod; amount: string }>({
    method: "mobile_money",
    amount: "",
  });
  /** The line being voided, and the reason typed for it. */
  const [voiding, setVoiding] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mayCharge = can("folio.charge");
  const mayPay = can("folio.payment");
  const chargeDenied = mayCharge ? undefined : reasonFor("folio.charge");
  const payDenied = mayPay ? undefined : reasonFor("folio.payment");

  if (!mayCharge) {
    return (
      <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("folio.charge")}</EmptyState>
    );
  }

  if (query.isPending) {
    return (
      <div className="pms-enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Skeleton height={64} />
        <Skeleton height={300} delay={60} />
      </div>
    );
  }

  if (query.isError) {
    /* A failed read is not a settled bill. Told that, a desk would let a guest
       walk out on a balance. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load this bill. Every charge on it is still there — this is on
        our side, not an empty statement.
      </LoadFailed>
    );
  }

  const folio = query.data;
  if (!folio) {
    return (
      <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
        That bill is not on this property.
      </EmptyState>
    );
  }

  // Only a revenue centre may take a charge; the server refuses the rest with
  // 422, so they are not offered rather than offered and rejected.
  const revenueDepts = (departments.data?.departments ?? []).filter(
    (d) => d.isRevenueCenter && d.status === "active",
  );

  const closed = folio.status !== "open";
  const busy = postCharge.isPending || takePayment.isPending || voidCharge.isPending;

  function submitCharge() {
    // A second Enter while the first is in flight is a second charge, with its
    // own idempotency key. The button refuses a second press; the keyboard has
    // to be refused here.
    if (busy) return;
    setError(null);
    const amountRwf = parseAmount(charge.amount);
    if (!charge.description.trim() || !Number.isFinite(amountRwf) || amountRwf === 0) {
      setError("A charge needs a description and an amount.");
      return;
    }
    const what = charge.description.trim();
    postCharge.mutate(
      {
        chargeType: "pos",
        description: what,
        quantity: 1,
        amountRwf,
        ...(charge.departmentId ? { departmentId: charge.departmentId } : {}),
      },
      {
        onSuccess: () => {
          setCharge({ departmentId: charge.departmentId, description: "", amount: "" });
          // The tax is the server's line, so the toast names what was ENTERED
          // and points at the statement rather than quoting a total it did not
          // work out.
          toast(`${what} — ${fmt(amountRwf)} is on the bill, before tax.`, "ok");
        },
        onError: (e) => setError(humanError(e)),
      },
    );
  }

  function submitPayment() {
    if (busy) return;
    setError(null);
    const amountRwf = parseAmount(pay.amount);
    if (!Number.isFinite(amountRwf) || amountRwf <= 0) {
      setError("Enter what was actually paid.");
      return;
    }
    const how = METHODS.find((m) => m.value === pay.method)?.label ?? "";
    takePayment.mutate(
      { amountRwf, method: pay.method },
      {
        onSuccess: (updated) => {
          setPay({ ...pay, amount: "" });
          toast(
            `${fmt(amountRwf)} recorded by ${how.toLowerCase()}. ${
              updated.balanceRwf > 0 ? `${fmt(updated.balanceRwf)} still to settle.` : "The bill is settled."
            }`,
            "ok",
          );
        },
        onError: (e) => setError(humanError(e)),
      },
    );
  }

  function submitVoid(line: OperatorFolioCharge) {
    if (busy) return;
    setError(null);
    const text = reason.trim();
    if (!text) return;
    voidCharge.mutate(
      { chargeId: line.id, reason: text },
      {
        onSuccess: () => {
          setVoiding(null);
          setReason("");
          toast(
            `${fmt(Math.abs(line.amountRwf))} reversed. Both lines stay on the bill, with your reason.`,
            "ok",
          );
        },
        onError: (e) => setError(humanError(e)),
      },
    );
  }

  return (
    <div className="pms-enter" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          background: "var(--card)",
          border: "1px solid var(--card-bd)",
          borderRadius: "var(--radius-surface)",
        }}
      >
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>
            {folio.guestName ??
              (folio.folioType === "guest" ? "Unnamed guest" : FOLIO_KIND[folio.folioType])}
          </span>
          <span className="pms-num" style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
            {[folio.folioNumber, folio.roomLabel ? `Room ${folio.roomLabel}` : null, `opened ${dshortIso(folio.openedAt)}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <Badge intent={closed ? "neutral" : "info"}>{closed ? "Closed" : "Open"}</Badge>
        <span className="pms-num" style={{ fontSize: 20, fontWeight: 700 }}>
          {fmt(folio.balanceRwf)}
        </span>
      </div>

      <section>
        <SectionHeading n={folio.charges.length}>Statement</SectionHeading>
        {folio.charges.length === 0 ? (
          <EmptyState className="mt-2.5 p-6">
            Nothing on this bill yet. Charges land here the moment they happen.
          </EmptyState>
        ) : (
          <div
            className="pms-tablescroll"
            style={{
              marginTop: 10,
              background: "var(--card)",
              border: "1px solid var(--card-bd)",
              borderRadius: "var(--radius-surface)",
              overflow: "hidden",
            }}
          >
            {folio.charges.map((line, i) => {
              const reversed = line.voidedByChargeId !== null;
              const isVoid = line.sourceRefType === "void";
              return (
                <div
                  key={line.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.6fr 1fr auto auto",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 18px",
                    borderTop: i === 0 ? "1px solid transparent" : "1px solid var(--line)",
                    // A reversed line stays visible and struck, so the bill
                    // shows the mistake AND the correction.
                    opacity: reversed ? 0.5 : 1,
                    textDecoration: reversed ? "line-through" : "none",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, color: "var(--foreground)" }}>
                      {line.description ?? CHARGE_LABEL[line.chargeType] ?? line.chargeType}
                    </span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--faint)" }}>
                      {[
                        CHARGE_LABEL[line.chargeType] ?? line.chargeType,
                        line.departmentName,
                        line.businessDate ?? dshortIso(line.postedAt),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>

                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {line.taxAmountRwf ? `incl. tax ${fmt(line.taxAmountRwf)}` : ""}
                  </span>

                  <span
                    className="pms-num"
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      textAlign: "right",
                      color: line.amountRwf < 0 ? "var(--ok)" : "var(--foreground)",
                    }}
                  >
                    {fmt(line.amountRwf)}
                  </span>

                  <span style={{ display: "flex", justifyContent: "flex-end", minWidth: 64 }}>
                    {/* A void can never itself be voided, and a line already
                        reversed cannot be reversed twice. */}
                    {!closed && !reversed && !isVoid && voiding !== line.id && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setVoiding(line.id);
                          setReason("");
                        }}
                        aria-label={`Void ${line.description ?? "this line"}`}
                        title={chargeDenied ?? "Void this line"}
                        disabled={Boolean(chargeDenied) || busy}
                        style={{
                          border: "none",
                          background: "none",
                          color: "var(--muted)",
                          padding: 4,
                          cursor: chargeDenied ? "not-allowed" : "pointer",
                        }}
                      >
                        <Icon name="x" size={15} />
                      </Button>
                    )}
                  </span>

                  {voiding === line.id && (
                    <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, paddingTop: 8 }}>
                      <Input
                        autoFocus
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitVoid(line);
                          if (e.key === "Escape") setVoiding(null);
                        }}
                        placeholder="Why is this being reversed? The guest sees it."
                        aria-label="Reason for the reversal"
                        maxLength={500}
                        style={fieldStyle}
                      />
                      <ActionButton onClick={() => setVoiding(null)}>Cancel</ActionButton>
                      <ActionButton
                        variant="primary"
                        disabled={!reason.trim()}
                        pending={voidCharge.isPending}
                        onClick={() => submitVoid(line)}
                      >
                        {voidCharge.isPending ? "Reversing" : "Reverse"}
                      </ActionButton>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {error && (
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--bad)" }}>{error}</div>
      )}

      {!closed && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <section
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-bd)",
              borderRadius: "var(--radius-surface)",
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted2)" }}>
              Add a charge
            </div>
            <p style={{ marginTop: 4, fontSize: 11.5, color: "var(--muted)" }}>
              Enter the amount BEFORE tax. The tax posts as its own line at the rate in
              force today.
            </p>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <SelectField
                value={charge.departmentId}
                onChange={(departmentId) => setCharge({ ...charge, departmentId })}
                label="Department this charge belongs to"
                options={[
                  { value: "", label: "No department" },
                  ...revenueDepts.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
              <Input
                value={charge.description}
                onChange={(e) => setCharge({ ...charge, description: e.target.value })}
                placeholder="What for — e.g. Two beers, minibar"
                aria-label="What the charge is for"
                maxLength={500}
                style={fieldStyle}
              />
              <Input
                value={charge.amount}
                onChange={(e) => setCharge({ ...charge, amount: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && submitCharge()}
                inputMode="numeric"
                placeholder="RWF, before tax"
                aria-label="Amount before tax"
                style={fieldStyle}
              />
              <ActionButton
                variant="primary"
                disabled={Boolean(chargeDenied)}
                pending={postCharge.isPending}
                title={chargeDenied}
                onClick={submitCharge}
              >
                {postCharge.isPending ? "Posting the charge" : "Post the charge"}
              </ActionButton>
            </div>
          </section>

          <section
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-bd)",
              borderRadius: "var(--radius-surface)",
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted2)" }}>
              Take a payment
            </div>
            <p style={{ marginTop: 4, fontSize: 11.5, color: "var(--muted)" }}>
              A payment settles the balance. It posts no revenue — the charges already
              did.
            </p>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <SelectField
                value={pay.method}
                onChange={(method) => setPay({ ...pay, method: method as PaymentMethod })}
                label="How the money arrived"
                options={METHODS.map((m) => ({ value: m.value, label: m.label }))}
              />
              <Input
                value={pay.amount}
                onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && submitPayment()}
                inputMode="numeric"
                placeholder="RWF"
                aria-label="Amount paid"
                style={fieldStyle}
              />
              <ActionButton
                variant="primary"
                disabled={Boolean(payDenied)}
                pending={takePayment.isPending}
                title={payDenied}
                onClick={submitPayment}
              >
                {takePayment.isPending
                  ? `Recording ${fmt(parseAmount(pay.amount) || 0)}`
                  : `Record ${fmt(parseAmount(pay.amount) || 0)}`}
              </ActionButton>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
