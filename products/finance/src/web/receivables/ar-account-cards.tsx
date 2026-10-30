"use client";

import { Envelope, HandOk, Lock } from "@gravity-ui/icons";
import { Button, Card, Chip, Input, Label, TextField } from "@heroui/react";
import { ItemCard, ListView } from "@heroui-pro/react";
import { KeyValueList, toneColor } from "@injishi/ui";
import { useState } from "react";
import type { ArAccount, LogEntry } from "../../model/accounting.ts";
import type { Tone } from "../../model/shared.ts";
import { CardHeading, LogTimeline, Note, rwf } from "../accounting-parts.tsx";

export type DisputeState = "open" | "credit" | "reject";

/** Who / what an account is, and the contract versions its invoices were issued under. */
export function ArAccountCard({ account: a }: { account: ArAccount }) {
  return (
    <Card role="region" aria-labelledby="ac-h" className="gap-3 p-[18px]">
      <Card.Header>
        <CardHeading id="ac-h">{a.name}</CardHeading>
        <Card.Description className="tabular">
          {a.type} · {a.tin}
        </Card.Description>
      </Card.Header>
      <KeyValueList
        items={[
          { label: "Receivable owner", value: "Amahoro Hospitality Ltd" },
          { label: "Billing contact", value: a.contact },
          { label: "Booking rights", value: a.bookers },
          {
            label: "Balance",
            value: (
              <span className="tabular">
                {a.limit ? `${rwf(a.balance)} of ${rwf(a.limit)} limit` : a.noCreditLine?.balance}
              </span>
            ),
          },
        ]}
      />
      <span className="text-[13px] font-semibold">Contract terms</span>
      <div className="flex flex-col gap-2">
        {a.contract.map((c) => (
          <ItemCard key={c.version} variant="secondary">
            <ItemCard.Content>
              <ItemCard.Title>{c.version}</ItemCard.Title>
              <ItemCard.Description className="whitespace-normal">{c.terms}</ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
              <Chip size="sm" variant="soft" color={c.state === "Current" ? "accent" : "default"}>
                {c.state}
              </Chip>
            </ItemCard.Action>
          </ItemCard>
        ))}
      </div>
      <Note>{a.foot}</Note>
    </Card>
  );
}

/** Credit invoices issued at checkout; each points to its fiscal invoice. */
export function ArInvoicesCard({ account: a }: { account: ArAccount }) {
  return (
    <Card role="region" aria-labelledby="inv-h" className="gap-3 p-[18px]">
      <Card.Header>
        <CardHeading id="inv-h">Credit Invoices</CardHeading>
        <Card.Description>
          Issued at checkout through the city ledger. Each points to its fiscal invoice; none replaces it.
        </Card.Description>
      </Card.Header>
      <ListView key={a.id} aria-label={`Credit invoices of ${a.name}`} variant="secondary" items={a.invoices}>
        {(v) => (
          <ListView.Item id={v.id} textValue={v.id}>
            <ListView.ItemContent className="items-start">
              <div className="flex min-w-0 flex-col gap-0.5">
                <ListView.Title className="whitespace-normal tabular">
                  {v.id} · {rwf(v.amount)}
                </ListView.Title>
                <ListView.Description className="whitespace-normal">{v.source}</ListView.Description>
                <ListView.Description className="whitespace-normal tabular">
                  {v.fiscal} · {v.due}
                </ListView.Description>
              </div>
            </ListView.ItemContent>
            <ListView.ItemAction>
              <Chip size="sm" variant="soft" color={toneColor(v.tone)}>
                {v.state}
              </Chip>
            </ListView.ItemAction>
          </ListView.Item>
        )}
      </ListView>
    </Card>
  );
}

const DISPUTE: Record<DisputeState, { label: string; tone: Tone }> = {
  open: { label: "Under review", tone: "warning" },
  credit: { label: "Credit note drafted", tone: "default" },
  reject: { label: "Rejection sent", tone: "default" },
};

function PromiseForm({ onSave, onCancel }: { onSave: (amount: string, date: string) => void; onCancel: () => void }) {
  const [amount, setAmount] = useState("900,400");
  const [date, setDate] = useState("30 Oct 2026");
  return (
    <Card variant="secondary" className="gap-2.5 p-3.5">
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(140px,100%),1fr))]">
        <TextField value={amount} onChange={setAmount} fullWidth>
          <Label>Amount (RWF)</Label>
          <Input className="tabular" inputMode="numeric" />
        </TextField>
        <TextField value={date} onChange={setDate} fullWidth>
          <Label>Promised by</Label>
          <Input />
        </TextField>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onPress={() => onSave(amount.trim(), date.trim())}
          isDisabled={!amount.trim() || !date.trim()}
        >
          Save promise
        </Button>
        <Button size="sm" variant="ghost" onPress={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

/** Reminders, calls and promises, the credit-hold proposal and any open dispute. */
export function ArCollectionsCard({
  account: a,
  collections,
  isHeld,
  promiseOpen,
  dispute,
  onRemind,
  onTogglePromise,
  onSavePromise,
  onProposeHold,
  onDispute,
}: {
  account: ArAccount;
  collections: LogEntry[];
  isHeld: boolean;
  promiseOpen: boolean;
  dispute: DisputeState;
  onRemind: () => void;
  onTogglePromise: () => void;
  onSavePromise: (amount: string, date: string) => void;
  onProposeHold: () => void;
  onDispute: (state: DisputeState) => void;
}) {
  const d = a.dispute;
  const contact = a.contact.split(" · ")[0];
  const ds = DISPUTE[dispute];
  const disputeNote = d
    ? {
        open: `Resolving with a credit note drafts a refund receipt that credits ${d.fiscal}. The invoice itself is never edited.`,
        credit: `Refund receipt for ${rwf(d.amount)} drafted against ${d.fiscal} · Aline Uwase approves before Fiscal receipts issues it.`,
        reject: `Evidence pack sent to ${contact} 10:21 · the ${rwf(d.amount)} returns to collections if she accepts.`,
      }[dispute]
    : "";

  return (
    <Card role="region" aria-labelledby="col-h" className="gap-3 p-[18px]">
      <Card.Header>
        <CardHeading id="col-h">Collections</CardHeading>
        <Card.Description>{a.collectionsNote}</Card.Description>
      </Card.Header>
      {collections.length ? (
        <>
          <LogTimeline entries={collections} label="Collection history" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onPress={onRemind}>
              <Envelope className="size-4" aria-hidden="true" />
              Send reminder
            </Button>
            <Button size="sm" variant="secondary" onPress={onTogglePromise} aria-expanded={promiseOpen}>
              <HandOk className="size-4" aria-hidden="true" />
              Record promise to pay
            </Button>
            <Button size="sm" variant="danger-soft" onPress={onProposeHold} isDisabled={isHeld}>
              <Lock className="size-4" aria-hidden="true" />
              {isHeld ? "Credit hold proposed" : "Propose credit hold"}
            </Button>
          </div>
          {promiseOpen ? <PromiseForm onSave={onSavePromise} onCancel={onTogglePromise} /> : null}
          <Note>
            A credit hold stops new bookings on account. The owner decides; stays already booked are not affected.
          </Note>
        </>
      ) : (
        <p className="text-[13px] leading-5 text-muted">{a.quiet}</p>
      )}
      {d ? (
        <Card variant="secondary" className="gap-2 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Dispute · {d.invoice}</span>
            <Chip size="sm" variant="soft" color={toneColor(ds.tone)}>
              {ds.label}
            </Chip>
          </div>
          <span className="text-[13px] leading-5">
            {rwf(d.amount)} · {d.what}
          </span>
          <span className="text-xs leading-4 text-muted">
            {d.opened} · evidence: {d.evidence}. Excluded from reminders while open.
          </span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onPress={() => onDispute("credit")}>
              Resolve with credit note
            </Button>
            <Button size="sm" variant="ghost" onPress={() => onDispute("reject")}>
              Reject with evidence
            </Button>
          </div>
          <span className="text-xs leading-4 text-muted">{disputeNote}</span>
        </Card>
      ) : null}
    </Card>
  );
}
