"use client";

import { Alert, Button, Card, Table, TextArea, TextField, Label } from "@heroui/react";
import { SectionHeader } from "@injishi/ui";
import type { MoneyDesk as MoneyDeskDoc, MoneyDeskRow } from "@/server/sources/admin";
import { useState, useTransition } from "react";
import {
  decideOverrideAction,
  pullPaymentAction,
  requestOverrideAction,
  resolvePaymentAction,
  type ActionResult,
} from "./money-actions";
import { money, ToneChip } from "./shared";

/**
 * The money queue and the account's balance, the first lens of Platform Money (073-gtbank-payments AC-19).
 *
 * Everything a person can do here is one of three kinds, and the screen keeps them apart: ASK the bank
 * about a payment (pull), CLOSE what moves no money (resolve, with a note), or REQUEST a two person act
 * (send again, confirm received, cancel what a reversal paid for, write off), which a different super admin
 * then approves or rejects in the list below. Nothing here can move money on one person's say.
 */

const BUCKETS: { id: MoneyDeskRow["bucket"]; label: string; note: string }[] = [
  { id: "reversals", label: "Reversals", note: "The bank took a payment back. Double refunds first." },
  { id: "parked", label: "Parked", note: "A machine cannot learn the outcome." },
  { id: "owed", label: "Owed", note: "A refund failed and is still owed." },
  { id: "short", label: "Short", note: "Waiting for the account to cover it." },
  { id: "over_limit", label: "Over the limit", note: "Above the disbursement limit." },
  { id: "waiting_on_payer", label: "Waiting on the payer", note: "The payer has not given their name and ID yet." },
];

const ACTION_LABEL: Record<string, string> = {
  resend_disbursement: "Send again",
  confirm_received: "Confirm received",
  cancel_service: "Cancel what it paid for",
  write_off: "Write off",
  treasury_adjustment: "Treasury adjustment",
};

/** Which two person acts a row in this bucket may ask for (AC-21). */
function actionsFor(row: MoneyDeskRow): string[] {
  if (row.bucket === "owed") return ["resend_disbursement", "write_off"];
  if (row.bucket === "parked" && row.direction === "collection" && row.status === "unknown") return ["confirm_received"];
  if (row.bucket === "reversals" && row.direction === "collection") return ["cancel_service"];
  return [];
}

export function MoneyDesk({ desk }: { desk: MoneyDeskDoc }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [open, setOpen] = useState<{ rowId: string; kind: string } | null>(null);
  const [note, setNote] = useState("");

  if (desk.access === "none") {
    return (
      <Alert status="default" role="status">
        <Alert.Content>
          <Alert.Title>The money queue is for finance staff</Alert.Title>
          <Alert.Description>
            Your staff role cannot read payments that need a person. Finance staff and super admins work it.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  function act(run: () => Promise<ActionResult>, done: string) {
    start(async () => {
      const result = await run();
      setMessage(result.ok ? { tone: "success", text: done } : { tone: "danger", text: result.error });
      if (result.ok) {
        setOpen(null);
        setNote("");
      }
    });
  }

  const total = Object.values(desk.counts).reduce((a, b) => a + b, 0);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="desk-h">
      <SectionHeader
        id="desk-h"
        title="Payments that need a person"
        description={`${desk.provider} · ${desk.mode}. Pull and resolve never move money; moving it takes a second super admin.`}
      />

      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]">
        <Fact label="Available to send" value={money(desk.available)} />
        <Fact label="Out at the bank" value={money(desk.inFlight)} />
        <Fact label="Queued" value={money(desk.queued)} />
        <Fact label="Parked" value={String(desk.parked)} />
        <Fact label="Last reconciliation" value={desk.lastRun ?? "Never run"} />
      </div>

      {message ? (
        <Alert status={message.tone} role="status">
          <Alert.Content>
            <Alert.Description>{message.text}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {total === 0 ? (
        <p className="text-sm text-muted">Nothing needs a person right now.</p>
      ) : (
        BUCKETS.filter((b) => desk.counts[b.id] > 0).map((b) => (
          <Card key={b.id} className="gap-2 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-semibold">
                {b.label} · {desk.counts[b.id]}
              </h3>
              <span className="text-xs text-muted">{b.note}</span>
            </div>
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label={b.label}>
                  <Table.Header>
                    <Table.Column isRowHeader>Reference</Table.Column>
                    <Table.Column>Payment</Table.Column>
                    <Table.Column>Wallet</Table.Column>
                    <Table.Column className="text-right">Amount</Table.Column>
                    <Table.Column>Why</Table.Column>
                    <Table.Column>Waited</Table.Column>
                    <Table.Column>Do</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {desk.rows
                      .filter((r) => r.bucket === b.id)
                      .map((r) => (
                        <Table.Row key={r.id} id={r.id}>
                          <Table.Cell className="whitespace-nowrap">
                            <span className="flex flex-col">
                              <span className="text-[13px] font-medium tabular">{r.reference}</span>
                              <span className="text-xs text-muted tabular">{r.providerReference ?? "no bank reference"}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="flex flex-col">
                              <span>{r.operation.replaceAll("_", " ")}</span>
                              <span className="text-xs text-muted">
                                {r.status}
                                {r.bookingReference ? ` · ${r.bookingReference}` : ""}
                              </span>
                            </span>
                          </Table.Cell>
                          <Table.Cell className="tabular">{r.party ?? "—"}</Table.Cell>
                          <Table.Cell className="text-right whitespace-nowrap tabular">{money(r.amount)}</Table.Cell>
                          <Table.Cell className="text-xs text-muted">{r.reason ?? "—"}</Table.Cell>
                          <Table.Cell className="text-xs tabular">{r.age}</Table.Cell>
                          <Table.Cell>
                            <div className="flex flex-wrap gap-1.5">
                              <Button
                                size="sm"
                                variant="secondary"
                                isDisabled={pending}
                                onPress={() => act(() => pullPaymentAction(r.id), `Asked the bank about ${r.reference}.`)}
                              >
                                Pull
                              </Button>
                              {r.pendingOverride ? (
                                <ToneChip tone="warning">{ACTION_LABEL[r.pendingOverride.action] ?? r.pendingOverride.action} waiting</ToneChip>
                              ) : null}
                              {desk.canRequest && !r.pendingOverride
                                ? [
                                    ...(r.status === "unknown" ? ["resolve_failed"] : []),
                                    ...(r.bucket === "reversals" ? ["resolve_stands"] : []),
                                    ...actionsFor(r),
                                  ].map((kind) => (
                                    <Button
                                      key={kind}
                                      size="sm"
                                      variant="tertiary"
                                      isDisabled={pending}
                                      onPress={() => setOpen({ rowId: r.id, kind })}
                                    >
                                      {kind === "resolve_failed"
                                        ? "Resolve as failed"
                                        : kind === "resolve_stands"
                                          ? "Let it stand"
                                          : ACTION_LABEL[kind]}
                                    </Button>
                                  ))
                                : null}
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            {open && desk.rows.some((r) => r.id === open.rowId && r.bucket === b.id) ? (
              <form
                className="flex flex-col gap-2 border-t border-separator pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const { rowId, kind } = open;
                  if (kind === "resolve_failed" || kind === "resolve_stands") {
                    act(
                      () => resolvePaymentAction(rowId, kind === "resolve_failed" ? "failed" : "stands", note),
                      "Resolved, with your note on the record.",
                    );
                  } else {
                    act(
                      () => requestOverrideAction(rowId, kind as Parameters<typeof requestOverrideAction>[1], note),
                      "Requested. A different super admin must approve it.",
                    );
                  }
                }}
              >
                <TextField value={note} onChange={setNote} isRequired>
                  <Label>{open.kind.startsWith("resolve") ? "What you checked, and why" : "Why this needs a second person"}</Label>
                  <TextArea rows={2} />
                </TextField>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" isDisabled={pending}>
                    {open.kind.startsWith("resolve") ? "Resolve" : "Request"}
                  </Button>
                  <Button size="sm" variant="tertiary" onPress={() => setOpen(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}
          </Card>
        ))
      )}

      {desk.overrides.length > 0 ? (
        <Card className="gap-2 p-4" aria-labelledby="ov-h" render={(p) => <section {...p} />}>
          <h3 id="ov-h" className="text-[15px] font-semibold">
            Waiting for a second signature · {desk.overrides.length}
          </h3>
          {desk.overrides.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-separator pt-2">
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">
                  {ACTION_LABEL[o.action] ?? o.action}
                  {o.subjectReference ? ` · ${o.subjectReference}` : ""}
                  {o.amount != null ? ` · ${money(o.amount)}` : ""}
                </span>
                <span className="text-xs text-muted">
                  {o.initiatedBy}: “{o.reason}”
                </span>
              </span>
              {o.canDecide ? (
                <span className="flex gap-1.5">
                  <Button
                    size="sm"
                    isDisabled={pending}
                    onPress={() => act(() => decideOverrideAction(o.id, "approve"), "Approved and applied.")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    isDisabled={pending}
                    onPress={() => act(() => decideOverrideAction(o.id, "reject"), "Rejected.")}
                  >
                    Reject
                  </Button>
                </span>
              ) : (
                <span className="text-xs text-muted">Needs a different super admin</span>
              )}
            </div>
          ))}
        </Card>
      ) : null}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-1 px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-lg leading-6 font-semibold tabular">{value}</span>
    </Card>
  );
}
