"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowRightArrowLeft,
  ArrowRightToSquare,
  ArrowsRotateRight,
  ArrowUturnCcwLeft,
  CircleCheck,
  CircleQuestion,
  Comment,
  CopyCheck,
  Envelope,
  Lock,
  ShieldExclamation,
} from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Spinner, Table, Toast, toast } from "@heroui/react";
import { ChatMessage, ItemCard, Timeline } from "@heroui-pro/react";
import {
  formatRwf,
  GateChip,
  Icon,
  KeyValueList,
  LinkButton,
  PageContent,
  PageHeader,
  toneColor,
  toneStatus,
} from "@injishi/ui";
import NextLink from "next/link";
import { useState } from "react";
import type {
  CancellationTier,
  HistoryEvent,
  LinkedRecord,
  PaymentOutcome,
  ReservationRecord,
} from "../../model/frontdesk.ts";
import { useBoardHref } from "../mount.tsx";
import { PolicyTiers, plural } from "./shared.tsx";

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-[15px] leading-[22px] font-semibold">
      {children}
    </h2>
  );
}

function LinkedCard({ lk }: { lk: LinkedRecord & { state: string; note: string } }) {
  const screenHref = useBoardHref();
  const card = (
    <ItemCard className="h-full flex-col items-start gap-2.5 px-3.5 py-3">
      <ItemCard.Icon>
        <Icon name={lk.icon} />
      </ItemCard.Icon>
      <ItemCard.Content>
        <ItemCard.Description>{lk.kind}</ItemCard.Description>
        <ItemCard.Title className="tabular">{lk.recordId}</ItemCard.Title>
        <Chip size="sm" variant="soft" color={toneColor(lk.tone)} className="mt-1 self-start">
          {lk.state}
        </Chip>
        <ItemCard.Description className="mt-1 whitespace-normal">{lk.note}</ItemCard.Description>
      </ItemCard.Content>
    </ItemCard>
  );
  // This record is the prototype's sample; its stay has no live record, so it is not linked to a stay page.
  return lk.board && lk.board !== "StayFolio" ? (
    <NextLink
      href={screenHref(lk.board)}
      aria-label={`${lk.kind} ${lk.recordId}, ${lk.state}`}
      className="block rounded-[inherit] text-inherit no-underline"
    >
      {card}
    </NextLink>
  ) : (
    card
  );
}

export function ReservationDetailView({
  record,
  tiers,
  payment,
}: {
  record: ReservationRecord;
  tiers: CancellationTier[];
  payment: PaymentOutcome;
}) {
  const screenHref = useBoardHref();
  const [pay] = useState<PaymentOutcome>(payment);
  /** Nothing on this sample record reaches a provider or a mailbox: say so, and change nothing. */
  const unavailable = (what: string) => toast.warning(`${what} is not available yet. Nothing was changed.`);
  const P = record.outcomes[pay];
  const d = record.deposit;

  const linked = record.linked.map((l) => ({
    ...l,
    state: l.followsPayment === "state" ? P.label : l.state,
    tone: l.followsPayment === "state" ? P.tone : l.tone,
    note: l.followsPayment === "note" ? P.folio : l.note,
  }));
  const history: HistoryEvent[] = record.history.map((h) =>
    h.status === "payment" ? { ...h, status: P.status, icon: P.icon, detail: `${h.detail} · ${P.history}` } : h,
  );
  const totals = record.nights.reduce((t, n) => ({ rate: t.rate + n.rate, vat: t.vat + n.vat }), { rate: 0, vat: 0 });

  return (
    <PageContent className="gap-4 text-[14px] leading-5">
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={
          <>
            <NextLink href={screenHref("Reservations")} className="text-inherit no-underline hover:underline">
              Reservations
            </NextLink>
            <span aria-hidden="true">›</span>
            <span className="tabular">{record.id}</span>
            {/* The full record (parties, saved terms, payment history) is the prototype's sample: say so. */}
            <span aria-hidden="true">·</span>
            <span>sample record</span>
          </>
        }
        title={record.guest}
        description={record.summary}
        actions={
          <>
            <LinkButton href={screenHref("Messages")} variant="ghost">
              <Comment className="size-4" />
              Message
            </LinkButton>
            <LinkButton href={screenHref("RoomRack")} variant="secondary">
              <ArrowRightArrowLeft className="size-4" />
              Room rack
            </LinkButton>
            <LinkButton href={`${screenHref("CheckIn")}?booking=${encodeURIComponent(record.id)}`}>
              <ArrowRightToSquare className="size-4" />
              Check in
            </LinkButton>
          </>
        }
      />

      <section
        aria-label="Linked records"
        className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr))]"
      >
        {linked.map((lk) => (
          <LinkedCard key={lk.id} lk={lk} />
        ))}
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_620px] flex-col gap-4">
          <Card className="gap-3 p-[18px]" aria-labelledby="pt-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionHeading id="pt-h">Parties</SectionHeading>
              <span className="text-xs text-muted">{record.partiesNote}</span>
            </div>
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
              {record.parties.map((p) => (
                <Card key={p.id} variant="secondary" className="gap-1.5 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Chip size="sm" variant="soft" color={toneColor(p.tone)}>
                      {p.role}
                    </Chip>
                    <Icon name={p.icon} className="size-4 text-muted" aria-hidden="true" />
                  </div>
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-xs leading-4 text-muted">{p.desc}</span>
                  {p.flag ? (
                    <Chip size="sm" variant="soft" color="warning" className="self-start">
                      {p.flag}
                    </Chip>
                  ) : null}
                </Card>
              ))}
            </div>
          </Card>

          <Card className="gap-3 p-[18px]" aria-labelledby="rl-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <SectionHeading id="rl-h">Rate Lines</SectionHeading>
                <span className="text-xs text-muted">{record.rateNote}</span>
              </div>
              <GateChip icon={<Lock className="size-3" />}>Rates are managed by your general manager</GateChip>
            </div>
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Nightly rates">
                  <Table.Header>
                    <Table.Column isRowHeader>Night</Table.Column>
                    <Table.Column>Room</Table.Column>
                    <Table.Column>Rate plan</Table.Column>
                    <Table.Column className="text-right">Rate</Table.Column>
                    <Table.Column className="text-right">VAT 18%</Table.Column>
                    <Table.Column className="text-right">Total</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {[
                      ...record.nights.map((n) => (
                        <Table.Row key={n.id} id={n.id}>
                          <Table.Cell className="tabular">{n.night}</Table.Cell>
                          <Table.Cell>
                            <span className="flex items-center gap-1.5">
                              <span className="font-medium tabular">{n.room}</span>
                              {n.note ? <span className="text-xs text-muted">{n.note}</span> : null}
                            </span>
                          </Table.Cell>
                          <Table.Cell>{record.ratePlan}</Table.Cell>
                          <Table.Cell className="text-right tabular">{formatRwf(n.rate)}</Table.Cell>
                          <Table.Cell className="text-right tabular">{formatRwf(n.vat)}</Table.Cell>
                          <Table.Cell className="text-right tabular">{formatRwf(n.rate + n.vat)}</Table.Cell>
                        </Table.Row>
                      )),
                      <Table.Row key="total" id="total" className="font-semibold">
                        <Table.Cell>{plural(record.nights.length, "night")}</Table.Cell>
                        <Table.Cell>{null}</Table.Cell>
                        <Table.Cell>{null}</Table.Cell>
                        <Table.Cell className="text-right tabular">{formatRwf(totals.rate)}</Table.Cell>
                        <Table.Cell className="text-right tabular">{formatRwf(totals.vat)}</Table.Cell>
                        <Table.Cell className="text-right tabular">{formatRwf(totals.rate + totals.vat)}</Table.Cell>
                      </Table.Row>,
                    ]}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted">{record.taxNote}</span>
              <GateChip icon={<ShieldExclamation className="size-3" />}>Configured · awaiting sign-off</GateChip>
              <span className="text-muted">{record.levyNote}</span>
            </div>
          </Card>

          <Card className="gap-3 p-[18px]" aria-labelledby="ts-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-muted" aria-hidden="true" />
                <SectionHeading id="ts-h">Terms Snapshot</SectionHeading>
              </div>
              <Chip size="sm" variant="soft">
                {record.termsId} · read-only
              </Chip>
            </div>
            <p className="text-[13px] text-muted">{record.termsNote}</p>
            <KeyValueList
              className="grid-cols-[minmax(140px,max-content)_minmax(0,1fr)]"
              items={record.terms.map((t) => ({ label: t.label, value: t.value }))}
            />
          </Card>

          <Card className="gap-3 p-[18px]" aria-labelledby="ms-h">
            <div className="flex items-center justify-between gap-2">
              <SectionHeading id="ms-h">Messages</SectionHeading>
              <LinkButton href={screenHref("Messages")} size="sm" variant="ghost">
                Open conversation
                <ArrowRight className="size-4" />
              </LinkButton>
            </div>
            <div className="flex flex-col gap-3" role="log" aria-label={`Messages with ${record.firstName}`}>
              {record.messages.map((m) =>
                m.from === "guest" ? (
                  <ChatMessage.Assistant key={m.id} className="p-0">
                    <ChatMessage.Avatar show fallback={m.initials} alt={record.guest} />
                    <ChatMessage.Body className="gap-1">
                      <ChatMessage.Bubble className="text-[13px] leading-5">
                        <ChatMessage.Content>{m.text}</ChatMessage.Content>
                      </ChatMessage.Bubble>
                      <span className="text-[11px] text-muted">{m.meta}</span>
                    </ChatMessage.Body>
                  </ChatMessage.Assistant>
                ) : (
                  <ChatMessage.User key={m.id} className="flex-col items-end gap-1">
                    <ChatMessage.Bubble className="max-w-[85%] bg-accent-soft text-[13px] leading-5">
                      <ChatMessage.Content>{m.text}</ChatMessage.Content>
                    </ChatMessage.Bubble>
                    <span className="text-[11px] text-muted">{m.meta}</span>
                  </ChatMessage.User>
                ),
              )}
            </div>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4" aria-label="Payment, policy and documents">
          <Card className="gap-3 p-[18px]" aria-labelledby="pi-h">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <SectionHeading id="pi-h">Deposit</SectionHeading>
                <span className="text-xs text-muted tabular">Payment intent {d.intent}</span>
              </div>
              <Chip size="sm" variant="soft" color={toneColor(P.tone)}>
                {P.label}
              </Chip>
            </div>
            <div className="flex flex-col">
              <span className="text-[22px] leading-7 font-semibold tabular">{formatRwf(d.amount)}</span>
              <span className="text-xs text-muted">{d.basis}</span>
            </div>
            <Timeline size="sm" density="compact">
              {record.attempts.map((a) => {
                const result = a.result ?? { label: P.label, tone: P.tone, detail: P.time };
                return (
                  <Timeline.Item key={a.id} status={a.result ? toneStatus(a.result.tone) : P.status}>
                    <Timeline.Rail>
                      <Timeline.Marker>
                        <Icon name={a.result ? "Xmark" : P.icon} className="size-3" />
                      </Timeline.Marker>
                      <Timeline.Connector />
                    </Timeline.Rail>
                    <Timeline.Content className="flex flex-col gap-0.5 pb-2 text-sm">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold">{a.title}</span>
                        <Chip size="sm" variant="soft" color={toneColor(result.tone)}>
                          {result.label}
                        </Chip>
                      </span>
                      <span className="text-xs text-muted tabular">
                        {a.phone} · ref {a.ref}
                      </span>
                      <span className="text-xs text-muted tabular">{result.detail}</span>
                      <span className="text-[11px] text-muted tabular">Key {a.key}</span>
                    </Timeline.Content>
                  </Timeline.Item>
                );
              })}
            </Timeline>
            {pay === "pending" ? (
              <Alert status="default" role="status">
                <Alert.Indicator>
                  <Spinner size="sm" aria-label="Waiting" />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Pending · waiting for MTN to confirm</Alert.Title>
                  <Alert.Description>
                    {record.firstName} approves on their phone. Last checked {d.lastChecked}. Not paid until MTN
                    confirms.
                  </Alert.Description>
                  <div className="mt-2">
                    <Button size="sm" variant="secondary" onPress={() => unavailable("Checking a payment with MTN")}>
                      <ArrowsRotateRight className="size-4" />
                      Check status
                    </Button>
                  </div>
                </Alert.Content>
              </Alert>
            ) : null}
            {pay === "verified" ? (
              <Alert status="success" role="status">
                <Alert.Indicator>
                  <CircleCheck />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Verified by {d.provider}</Alert.Title>
                  <Alert.Description className="tabular">
                    {formatRwf(d.amount)} · ref {d.providerRef} · confirmed {d.confirmedAt} · allocated to folio{" "}
                    {d.folioId} as a deposit.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            {pay === "unknown" ? (
              <Alert status="warning" role="status">
                <Alert.Indicator>
                  <CircleQuestion />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Unknown · checking with MTN</Alert.Title>
                  <Alert.Description>
                    The request timed out at {d.timedOutAt} without an answer. Don't ask {record.firstName} to pay again
                    until MTN replies; Payments keeps checking.
                  </Alert.Description>
                  <div className="mt-2">
                    <Button size="sm" variant="secondary" onPress={() => unavailable("Checking a payment with MTN")}>
                      <ArrowsRotateRight className="size-4" />
                      Check again
                    </Button>
                  </div>
                </Alert.Content>
              </Alert>
            ) : null}
            <ul className="flex flex-col gap-1.5 text-xs leading-4 text-muted">
              <li className="flex items-start gap-2">
                <CopyCheck className="mt-px size-3.5 flex-none" aria-hidden="true" />
                <span>Each attempt has its own key, so a repeated MTN callback posts once.</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowUturnCcwLeft className="mt-px size-3.5 flex-none" aria-hidden="true" />
                <span>
                  If this attempt fails, the booking stays confirmed and the deposit is collected at check-in. If money
                  is taken but posting fails, Payments completes or reverses it; {record.firstName} is never charged
                  twice.
                </span>
              </li>
            </ul>
          </Card>

          <Card className="gap-2.5 p-[18px]" aria-labelledby="cp-h">
            <div className="flex items-center justify-between gap-2">
              <SectionHeading id="cp-h">Cancellation Policy</SectionHeading>
              <Chip size="sm" variant="soft">
                {record.policyId}
              </Chip>
            </div>
            <PolicyTiers tiers={tiers} current={record.tierToday} label={`Cancellation tiers of ${record.policyId}`} />
            <p className="text-xs text-muted">
              {pay === "verified" ? record.cancelNote.verified : record.cancelNote.unpaid}
            </p>
          </Card>

          <Card className="gap-2.5 p-[18px]" aria-labelledby="pf-h">
            <div className="flex items-center justify-between gap-2">
              <SectionHeading id="pf-h">Proforma Invoice</SectionHeading>
              <Chip size="sm" variant="soft" color="accent">
                Proforma · not fiscal
              </Chip>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex flex-col">
                <span className="font-semibold tabular">{record.proforma.id}</span>
                <span className="text-xs text-muted">{record.proforma.sent}</span>
              </span>
              <span className="font-semibold whitespace-nowrap tabular">{formatRwf(record.proforma.total)}</span>
            </div>
            <p className="text-xs text-muted">
              A quote for the stay. Not a tax invoice and not a receipt. The EBM fiscal receipt is issued when folio{" "}
              {d.folioId} is settled.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onPress={() => window.print()}>
                <ArrowDownToLine className="size-4" />
                Download
              </Button>
              <Button size="sm" variant="ghost" onPress={() => unavailable("Emailing the proforma")}>
                <Envelope className="size-4" />
                Email again
              </Button>
            </div>
          </Card>

          <Card className="gap-3 p-[18px]" aria-labelledby="hi-h">
            <SectionHeading id="hi-h">Change History</SectionHeading>
            <Timeline size="sm" density="compact">
              {history.map((h) => (
                <Timeline.Item key={h.id} status={h.status === "payment" ? "default" : h.status}>
                  <Timeline.Rail>
                    <Timeline.Marker>
                      <Icon name={h.icon} className="size-3" />
                    </Timeline.Marker>
                    <Timeline.Connector />
                  </Timeline.Rail>
                  <Timeline.Content className="flex flex-col pb-0.5">
                    <span className="text-[13px] font-medium">{h.title}</span>
                    <span className="text-xs leading-4 text-muted">{h.detail}</span>
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </aside>
      </div>
    </PageContent>
  );
}
