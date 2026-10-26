"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  RefundPayeeRequest,
  type GuestRefund,
  type GuestRefundList,
  type GuestRefundStatus,
} from "@injishi/contracts";
import { Badge, Button, Input, Label, Skeleton } from "@injishi/web-ui";
import { formatPrice } from "@injishi/utils";

import { EmptyPanel } from "@/components/app/empty-panel";
import { Icon } from "@/components/app/icon";
import { fetchMyRefunds, supplyRefundPayee } from "@/data/refunds";
import { apiResultMessage, type ApiResult } from "@/lib/api";

/**
 * A guest's own refunds (073-gtbank-payments AC-12, AC-12a).
 *
 * Cancelling is immediate and the money follows: a refund is owed at once and
 * sent when the bank can pay it. This is where the guest watches it, in four
 * words, and the one place they can act on it: when their account holds no
 * verified identity, the bank needs their full name and ID before it pays, and
 * the form for that is here.
 *
 * Where the refund goes is never asked and never editable. It is the number
 * that paid, shown masked.
 */
export function RefundsScreen() {
  const [result, setResult] = useState<ApiResult<GuestRefundList> | null>(null);

  const load = useCallback(() => {
    setResult(null);
    let cancelled = false;
    void (async () => {
      const next = await fetchMyRefunds();
      if (!cancelled) setResult(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(load, [load]);

  if (result === null) {
    return (
      <div className="mx-auto flex w-full max-w-read flex-col gap-3 px-4 py-8">
        <span className="sr-only" role="status">
          Loading your refunds
        </span>
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-28 w-full rounded-card" />
      </div>
    );
  }

  if (result.status === "unauthenticated") {
    return (
      <EmptyPanel
        icon="lock"
        title="Sign in to see your refunds"
        action={{ label: "Sign in", href: "/sign-in?redirect=%2Faccount%2Frefunds" }}
      >
        A refund belongs to the person who paid, so it only ever opens for them.
      </EmptyPanel>
    );
  }

  if (result.status !== "ok") {
    return (
      <div className="mx-auto flex max-w-narrow animate-arrive flex-col items-center gap-3 px-4 py-16 text-center">
        <h2 className="font-display text-xl font-bold tracking-tight">We couldn&apos;t load your refunds</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {apiResultMessage(result)} Your refunds are safe — this is the list that didn&apos;t arrive.
        </p>
        <Button className="mt-2" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  if (result.data.refunds.length === 0) {
    return (
      <EmptyPanel icon="banknote" title="No refunds" action={{ label: "Your trips", href: "/trips" }}>
        When a cancelled booking is owed money back, it appears here until the
        bank has paid it.
      </EmptyPanel>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-read animate-arrive flex-col gap-3 px-4 py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight">Refunds</h1>
      <p className="text-sm text-muted-foreground">
        Every refund goes back to the mobile money number that paid.
      </p>
      <ul className="m-0 mt-2 flex list-none flex-col gap-3 p-0">
        {result.data.refunds.map((refund) => (
          <li key={refund.id}>
            <RefundCard
              refund={refund}
              canSupplyDetails={!result.data.hasVerifiedIdentity}
              onChanged={load}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUS: Record<GuestRefundStatus, { label: string; variant: "success" | "accent" | "warning" | "outline"; note: string }> = {
  processing: {
    label: "On its way",
    variant: "accent",
    note: "The refund is with the bank. Mobile money usually lands within minutes of being sent.",
  },
  needs_details: {
    label: "Needs your details",
    variant: "warning",
    note: "The bank needs the full name and ID of the person it pays before it can send this.",
  },
  delayed: {
    label: "Delayed",
    variant: "outline",
    note: "This did not go through on the first attempt. Nothing is lost, and our team is on it.",
  },
  paid: { label: "Paid", variant: "success", note: "The bank has paid this refund." },
};

function RefundCard({
  refund,
  canSupplyDetails,
  onChanged,
}: {
  refund: GuestRefund;
  canSupplyDetails: boolean;
  onChanged: () => void;
}) {
  const status = STATUS[refund.status];
  return (
    <article className="rounded-card border border-border bg-card p-inset">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="money font-display text-xl font-bold">{formatPrice(refund.amountRwf)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {refund.propertyName ??
              (refund.paidFor === "registration_fee"
                ? "Registration fee"
                : refund.paidFor === "order"
                  ? "An order"
                  : "A stay that was not booked")}
            {refund.bookingReference ? (
              <>
                {" · "}
                <Link href="/trips" className="money hover:underline">
                  {refund.bookingReference}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {/* Colour never carries this alone: the badge prints the word. */}
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{status.note}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Back to</dt>
          <dd className="money">{refund.paidTo}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Reference</dt>
          <dd className="money">{refund.reference}</dd>
        </div>
      </dl>
      {refund.status === "needs_details" && canSupplyDetails ? (
        <PayeeForm refundId={refund.id} onSaved={onChanged} />
      ) : null}
    </article>
  );
}

/**
 * The name and ID the bank asks for. The number is sent once and never shown
 * back, here or in any answer; a mistake is fixed by the bank refusing it and
 * the guest being asked again, never by reading it out.
 */
function PayeeForm({ refundId, onSaved }: { refundId: string; onSaved: () => void }) {
  const [idType, setIdType] = useState<"national_id" | "passport">("national_id");
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = RefundPayeeRequest.safeParse({ idType, fullName, idNumber });
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? "Check the details and try again.");
      return;
    }
    setProblem(null);
    setSaving(true);
    const result = await supplyRefundPayee(refundId, parsed.data);
    setSaving(false);
    if (result.status === "ok") {
      onSaved();
      return;
    }
    setProblem(apiResultMessage(result));
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3 border-t border-border pt-4" noValidate>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-sm font-semibold">Your ID</legend>
        <Button
          type="button"
          size="sm"
          variant={idType === "national_id" ? "default" : "outline"}
          aria-pressed={idType === "national_id"}
          onClick={() => setIdType("national_id")}
        >
          Rwandan National ID
        </Button>
        <Button
          type="button"
          size="sm"
          variant={idType === "passport" ? "default" : "outline"}
          aria-pressed={idType === "passport"}
          onClick={() => setIdType("passport")}
        >
          Passport
        </Button>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`name-${refundId}`}>Full name, as it is on your {idType === "passport" ? "passport" : "ID"}</Label>
        <Input
          id={`name-${refundId}`}
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`id-${refundId}`}>{idType === "passport" ? "Passport number" : "National ID number"}</Label>
        <Input
          id={`id-${refundId}`}
          inputMode={idType === "passport" ? "text" : "numeric"}
          autoComplete="off"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
        />
      </div>
      {problem ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <Icon name="triangle-alert" className="size-4 shrink-0" />
          {problem}
        </p>
      ) : null}
      <Button type="submit" pending={saving} className="self-start">
        {saving ? "Sending…" : "Send my refund"}
      </Button>
    </form>
  );
}
