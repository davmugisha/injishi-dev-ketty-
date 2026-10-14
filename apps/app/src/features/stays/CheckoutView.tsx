"use client";

import {
  ArrowRightFromSquare,
  ArrowsRotateRight,
  Briefcase,
  BroomMotion,
  Check,
  CircleCheck,
  CircleQuestion,
  Comments,
  FileExclamation,
  Key,
  Lock,
  PaperPlane,
  Receipt,
} from "@gravity-ui/icons";
import { Alert, Button, Card, Checkbox, Input, Label, Separator, Switch, Table, TextField } from "@heroui/react";
import { Segment, Stepper, Timeline } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  CheckoutCase,
  CheckoutKey,
  CheckoutLedgerLine,
  FiscalReceiptDraft,
  MomoEvent,
  Tone,
} from "@injishi/data/fixtures/stays";
import { Icon, KeyValueList, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import NextLink from "next/link";
import { useState } from "react";
import { FiscalQr } from "./FiscalQr";
import { CardHeading, InfoRow, Note, rwf, StatTile, ToneChip } from "./parts";

export type ReceiptOutcome = "pending" | "issued" | "unknown";
export type MomoState = "idle" | "pending" | "unknown" | "verified";

export interface CheckoutData {
  checkout: CheckoutCase;
  ledger: CheckoutLedgerLine[];
  momoTrail: MomoEvent[];
  receipts: FiscalReceiptDraft[];
  keys: CheckoutKey[];
}

type StepStatus = "complete" | "active" | "inactive";

const MOMO_CHIP: Record<MomoState, { label: string; tone: Tone }> = {
  idle: { label: "RWF 39,000 open", tone: "warning" },
  pending: { label: "Pending", tone: "warning" },
  unknown: { label: "Unknown — checking", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
};
const LANGS = ["EN", "RW", "FR"] as const;

interface ReceiptView {
  receipt: FiscalReceiptDraft;
  sub: string;
  chip: string;
  tone: Tone;
  ebm: string | null;
  canRecheck: boolean;
  lines: string[];
}

export function CheckoutView({
  data,
  receipt: outcome,
  initialMomo,
}: {
  persona: Persona;
  data: CheckoutData;
  receipt: ReceiptOutcome;
  initialMomo: MomoState;
}) {
  const c = data.checkout;
  const [momo, setMomo] = useState<MomoState>(initialMomo);
  const [keys, setKeys] = useState<"idle" | "requested">("idle");
  const [card, setCard] = useState(false);
  const [survey, setSurvey] = useState(true);
  const [lang, setLang] = useState<(typeof LANGS)[number]>("EN");
  const [tin, setTin] = useState(true);
  const [done, setDone] = useState(false);
  const [checks, setChecks] = useState(0);
  const [refreshed, setRefreshed] = useState(false);

  const guestPaid = momo === "verified";
  const ledger = data.ledger.filter((l) => !l.afterGuestPaid || guestPaid);
  const windows = [
    {
      label: "Balance due now",
      amount: rwf(guestPaid ? 0 : c.guestShare),
      note: guestPaid ? `Folio ${c.folioId} can close` : "Guest share, waiting for MTN",
    },
    { label: "Company share", amount: rwf(c.companyShare), note: "On the city ledger, invoiced" },
    { label: "Not counted", amount: rwf(c.unmatched), note: "Unmatched transfer, with Finance" },
  ];

  const event = (id: MomoEvent["id"]) => data.momoTrail.find((e) => e.id === id);
  const trail: (MomoEvent & { status: "default" | "current" | "warning" | "success" })[] = [];
  const push = (id: MomoEvent["id"], status: "default" | "current" | "warning" | "success") => {
    const e = event(id);
    if (e) trail.push({ ...e, status });
  };
  if (momo !== "idle") push("initiated", "default");
  if (momo !== "idle") push("pending", momo === "pending" ? "current" : "default");
  if (momo === "unknown" || momo === "verified") push("unknown", momo === "unknown" ? "warning" : "default");
  if (momo === "verified") push("verified", "success");

  const receiptView = (r: FiscalReceiptDraft): ReceiptView => {
    const settled = r.payer === "company" || guestPaid;
    const amount = rwf(r.amount);
    const sub = `${r.payer === "company" && !tin && r.buyerWithoutTin ? r.buyerWithoutTin : r.buyer} · ${amount} incl. VAT`;
    const base = { receipt: r, sub, ebm: null, canRecheck: false };
    if (!settled)
      return {
        ...base,
        chip: "Waiting for settlement",
        tone: "default",
        lines: ["Not sent to the VSDC yet. It is requested once this share is fully paid."],
      };
    if (outcome === "issued")
      return {
        ...base,
        chip: "Issued",
        tone: "success",
        ebm: `EBM-26-${r.number}`,
        lines: [
          `Fiscal receipt EBM-26-${r.number} · normal sale · ${amount}`,
          `SDC ID SDC010012345 · receipt ${r.number}/10489 · signed ${r.requestedAt}`,
          "Emailed to the guest with the QR code",
        ],
      };
    if (outcome === "unknown")
      return {
        ...base,
        chip: "Unknown — Finance follows up",
        tone: "warning",
        lines: [
          `Request FR-${r.number} sent ${r.requestedAt} · the VSDC did not answer`,
          "Do not reissue: a second request could create a duplicate fiscal sale. Finance checks the VSDC journal.",
        ],
      };
    return {
      ...base,
      chip: "Pending at VSDC",
      tone: "warning",
      canRecheck: true,
      lines: [
        `Request FR-${r.number} sent ${r.requestedAt} · retry ${1 + checks} of 5 uses the same request ID, so no duplicate is possible`,
        checks ? `Checked 10:5${7 + Math.min(checks, 2)} · still pending` : "No EBM number until the VSDC signs it",
      ],
    };
  };
  const receipts = data.receipts.map(receiptView);

  const revoked = keys === "requested";
  const keyRows = data.keys.map((k) => ({
    ...k,
    detail: revoked ? (card && k.returnedDetail ? k.returnedDetail : k.revokedDetail) : k.detail,
    state: revoked ? k.revokedState : k.state,
    tone: revoked ? k.revokedTone : ("default" as Tone),
  }));

  const settled = guestPaid;
  const outcomeWord = outcome === "issued" ? "issued" : outcome === "unknown" ? "unknown" : "pending";
  const steps: { label: string; hint: string; status: StepStatus }[] = [
    { label: "Balance", hint: "Verified 10:48", status: "complete" },
    { label: "Settle", hint: settled ? "Fully covered" : "Guest share open", status: settled ? "complete" : "active" },
    {
      label: "Receipts",
      hint: `${settled ? "All" : "Company"} ${outcomeWord}`,
      status: settled && outcome === "issued" ? "complete" : "active",
    },
    { label: "Keys", hint: revoked ? "Requested" : "Not yet", status: revoked ? "complete" : "inactive" },
    { label: "Depart", hint: done ? "10:58" : "Not yet", status: done ? "complete" : "inactive" },
  ];
  const firstOpen = Math.max(
    0,
    steps.findIndex((s) => s.status !== "complete"),
  );

  const blockers: string[] = [];
  if (!settled)
    blockers.push(
      momo === "unknown"
        ? "The MTN payment is Unknown, so the folio stays open."
        : `The guest share of ${rwf(c.guestShare)} is not verified yet.`,
    );
  if (!revoked) blockers.push("Revoke the keys first.");
  const follows = settled && outcome !== "issued";
  const doneText = `Stay ${c.stayId} checked out · booking ${c.bookingId} completed · folio ${c.folioId} closed with ${rwf(
    c.companyShare,
  )} on the Umurage Consulting ledger · room ${c.room} set to Dirty and ${c.housekeeper} notified${
    survey ? ` · survey emailed in ${lang}` : ""
  }.`;

  return (
    <PageContent>
      <PageHeader
        eyebrow={
          <>
            <NextLink href={screenHref("FrontDeskToday")} className="text-inherit no-underline hover:underline">
              Front desk
            </NextLink>
            <span aria-hidden="true">›</span>
            <span>Departures</span>
            <span aria-hidden="true">›</span>
            <span>Room {c.room}</span>
          </>
        }
        title={`Check Out ${c.guest} · Room ${c.room}`}
        description={`Stay ${c.stayId} · Folio ${c.folioId} · due out ${c.dueOut}. Nothing is marked paid until the provider confirms it.`}
        actions={
          <>
            <LinkButton href={screenHref("StayFolio")} variant="secondary">
              <Receipt className="size-4" />
              Open stay and folio
            </LinkButton>
            <LinkButton href={screenHref("Messages")} variant="ghost">
              <Comments className="size-4" />
              Message guest
            </LinkButton>
            {done ? (
              <LinkButton href={screenHref("FrontDeskToday")}>Back to departures</LinkButton>
            ) : (
              <Button isDisabled={blockers.length > 0} onPress={() => setDone(true)}>
                <ArrowRightFromSquare className="size-4" />
                {follows ? "Check out · receipt to follow" : "Complete checkout"}
              </Button>
            )}
          </>
        }
      />

      <Stepper size="sm" aria-label="Checkout progress" currentStep={firstOpen}>
        {steps.map((s, i) => (
          <Stepper.Step key={s.label} data-status={s.status}>
            <Stepper.Indicator data-status={s.status}>
              {s.status === "complete" ? <Check className="size-3" aria-hidden="true" /> : i + 1}
            </Stepper.Indicator>
            <Stepper.Content>
              <Stepper.Title>{s.label}</Stepper.Title>
              <Stepper.Description className="text-[12px] leading-4 text-muted">{s.hint}</Stepper.Description>
            </Stepper.Content>
            <Stepper.Separator progress={s.status === "complete" ? 1 : 0} />
          </Stepper.Step>
        ))}
      </Stepper>

      {blockers.length ? (
        <Note icon="Lock" iconClassName="text-danger" lead="Not ready to check out." role="status">
          {blockers.join(" ")}
        </Note>
      ) : null}
      {follows && !done ? (
        <Alert status="default">
          <Alert.Indicator>
            <FileExclamation />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>
              {outcome === "unknown"
                ? "Receipt outcome unknown — documented exception"
                : "Receipt still pending — documented exception"}
            </Alert.Title>
            <Alert.Description>
              {outcome === "unknown"
                ? "You can complete checkout. Do not reissue. Finance follows up with the VSDC and emails the receipt once it is confirmed."
                : "You can complete checkout. The receipt is emailed to the guest and the company once the VSDC signs it."}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {done ? (
        <Alert status="success" role="status">
          <Alert.Indicator>
            <CircleCheck />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>{c.guest} checked out at 10:58</Alert.Title>
            <Alert.Description>{doneText}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-4">
          <Card aria-labelledby="b-h" className="gap-3 p-[18px]">
            <CardHeading
              id="b-h"
              title="1 · Verify the Balance"
              sub={`Posted charges against provider-confirmed payments only · checked ${refreshed ? "10:54" : "10:48"}`}
              action={
                <Button size="sm" variant="secondary" onPress={() => setRefreshed(true)}>
                  <ArrowsRotateRight className="size-4" />
                  Refresh payments
                </Button>
              }
            />
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Balance evidence">
                  <Table.Header>
                    <Table.Column isRowHeader>Item</Table.Column>
                    <Table.Column>Evidence</Table.Column>
                    <Table.Column>State</Table.Column>
                    <Table.Column className="text-right">Amount</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {ledger.map((l) => (
                      <Table.Row key={l.id} id={l.id}>
                        <Table.Cell className="font-medium">{l.item}</Table.Cell>
                        <Table.Cell className="text-[12px] leading-4 text-muted tabular">{l.evidence}</Table.Cell>
                        <Table.Cell>
                          <ToneChip tone={l.tone} className="h-auto max-w-[200px] py-0.5 whitespace-normal">
                            {l.state}
                          </ToneChip>
                        </Table.Cell>
                        <Table.Cell className="text-right whitespace-nowrap tabular">
                          {l.amount === null ? "Not counted" : rwf(l.amount)}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))]">
              {windows.map((w) => (
                <StatTile key={w.label}>
                  <span className="text-[12px] text-muted">{w.label}</span>
                  <span className="text-[18px] leading-6 font-semibold tabular">{w.amount}</span>
                  <span className="text-[12px] leading-4 text-muted">{w.note}</span>
                </StatTile>
              ))}
            </div>
          </Card>

          <Card aria-labelledby="s-h" className="gap-3.5 p-[18px]">
            <CardHeading
              id="s-h"
              title="2 · Settle What Is Left"
              sub="The booking routes room nights and meals to the company. Bar and laundry are the guest’s."
            />

            <Card variant="secondary" className="gap-2.5 px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="text-[14px] font-semibold">Company share · {c.company}</span>
                  <span className="text-[12px] text-muted tabular">
                    {c.companyTin} · city ledger {c.cityLedger}
                  </span>
                </div>
                <ToneChip tone="accent">Documented exception · moved to company ledger</ToneChip>
              </div>
              <KeyValueList items={c.transfer.map((t) => ({ label: t.label, value: t.value }))} />
              <Note icon="TriangleExclamation" size="xs" lead="Umurage Consulting has invoices 62 days past due.">
                Finance has been told. The unmatched {rwf(c.unmatched)} transfer is applied to this invoice once Finance
                confirms it.
              </Note>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" isDisabled>
                  <Lock className="size-4" />
                  Reverse move
                </Button>
                <span className="text-[12px] text-muted">Only Finance can reverse a ledger transfer.</span>
              </div>
            </Card>

            <Card variant="secondary" className="gap-2.5 px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="text-[14px] font-semibold">Guest share · {c.guest}</span>
                  <span className="text-[12px] text-muted">{c.guestShareDetail}</span>
                </div>
                <ToneChip tone={MOMO_CHIP[momo].tone}>{MOMO_CHIP[momo].label}</ToneChip>
              </div>
              {momo === "idle" ? (
                <>
                  <div className="flex flex-wrap items-end gap-3">
                    <TextField defaultValue={c.momoPhone} className="flex-[1_1_200px]">
                      <Label>MTN MoMo number</Label>
                      <Input variant="secondary" className="tabular" />
                    </TextField>
                    <div className="flex flex-[0_1_160px] flex-col gap-1">
                      <span className="text-sm font-medium">Amount</span>
                      <span className="flex h-9 items-center font-semibold tabular">{rwf(c.guestShare)}</span>
                    </div>
                    <Button onPress={() => setMomo("pending")}>
                      <PaperPlane className="size-4" />
                      Send MoMo request
                    </Button>
                  </div>
                  <p className="text-[12px] text-muted">
                    The earlier Airtel Money request expired without charging the guest, so a new request is safe.
                  </p>
                </>
              ) : null}
              {trail.length ? (
                <Timeline size="sm" density="compact" aria-label="MTN MoMo request">
                  {trail.map((t) => (
                    <Timeline.Item key={t.id} status={t.status}>
                      <Timeline.Rail>
                        <Timeline.Marker>
                          <Icon name={t.icon} className="size-3" />
                        </Timeline.Marker>
                        <Timeline.Connector />
                      </Timeline.Rail>
                      <Timeline.Content className="flex flex-col pb-0.5 text-sm">
                        <span className="font-medium">{t.title}</span>
                        <span className="text-[12px] leading-4 text-muted tabular">{t.detail}</span>
                      </Timeline.Content>
                    </Timeline.Item>
                  ))}
                </Timeline>
              ) : null}
              {momo === "unknown" ? (
                <Alert status="warning" role="status">
                  <Alert.Indicator>
                    <CircleQuestion />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Unknown — checking with MTN</Alert.Title>
                    <Alert.Description>
                      MTN did not answer in time. The guest may or may not have approved. The folio stays open and is
                      not marked paid. Do not send a second request or take cash for this amount until MTN answers.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
              {momo === "pending" || momo === "unknown" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => setMomo(momo === "pending" ? "unknown" : "verified")}
                  >
                    <ArrowsRotateRight className="size-4" />
                    Check status with MTN
                  </Button>
                  <Button size="sm" variant="ghost" isDisabled>
                    Take cash instead
                  </Button>
                  <span className="text-[12px] text-muted">
                    Cash opens once MTN gives a final answer, so the guest is never charged twice.
                  </span>
                </div>
              ) : null}
            </Card>
          </Card>
        </div>

        <div className="flex min-w-0 max-w-[470px] flex-[1_1_380px] flex-col gap-4">
          <Card aria-labelledby="f-h" className="gap-3 p-[18px]">
            <CardHeading
              id="f-h"
              title="3 · Fiscal Receipts and Invoice"
              sub="Each settled share gets one fiscal receipt from the VSDC under Amahoro Hospitality Ltd, TIN 102 345 678"
            />
            {receipts.map((r) => (
              <Card key={r.receipt.id} variant="secondary" className="gap-2.5 px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[14px] font-semibold">{r.receipt.title}</span>
                    <span className="text-[12px] text-muted tabular">{r.sub}</span>
                  </div>
                  <ToneChip tone={r.tone}>{r.chip}</ToneChip>
                </div>
                <div className="flex items-start gap-3.5">
                  {r.ebm ? <FiscalQr code={r.ebm} /> : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {r.lines.map((x) => (
                      <span key={x} className="text-[13px] leading-[18px] tabular">
                        {x}
                      </span>
                    ))}
                    {r.canRecheck ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="self-start"
                        onPress={() => setChecks(checks + 1)}
                      >
                        <ArrowsRotateRight className="size-4" />
                        Check VSDC status
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
            <div className="flex items-start gap-2.5 pt-0.5">
              <Briefcase className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[14px] font-medium">
                  Commercial invoice {c.invoice.number} · {c.company}
                </span>
                <span className="text-[12px] leading-4 text-muted tabular">
                  {c.companyTin} · {rwf(c.companyShare)} · due {c.invoice.due} · on the city ledger. A commercial
                  invoice is a request to pay, not a fiscal receipt.
                </span>
              </div>
              <ToneChip tone="default">Commercial invoice</ToneChip>
            </div>
            <Switch isSelected={tin} onChange={setTin}>
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Print the company TIN on the company fiscal receipt
              </Switch.Content>
            </Switch>
          </Card>

          <Card aria-labelledby="k-h" className="gap-3 p-[18px]">
            <CardHeading
              id="k-h"
              title="4 · Keys and Departure"
              sub="Revocation is requested from the lock provider and shown as it answers"
            />
            {keyRows.map((k) => (
              <InfoRow
                key={k.id}
                icon={k.icon}
                title={k.title}
                detail={k.detail}
                trailing={<ToneChip tone={k.tone}>{k.state}</ToneChip>}
              />
            ))}
            <Checkbox isSelected={card} onChange={setCard}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                Key card #2 handed back at the desk
              </Checkbox.Content>
            </Checkbox>
            {revoked ? null : (
              <Button variant="secondary" className="self-start" onPress={() => setKeys("requested")}>
                <Key className="size-4" />
                Revoke keys for {c.room}
              </Button>
            )}
            <Separator />
            <Switch isSelected={survey} onChange={setSurvey}>
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Send departure survey by email
              </Switch.Content>
            </Switch>
            {survey ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] text-muted">Language</span>
                <Segment
                  aria-label="Survey language"
                  selectedKey={lang}
                  onSelectionChange={(k) => setLang(String(k) as (typeof LANGS)[number])}
                >
                  {LANGS.map((l) => (
                    <Segment.Item key={l} id={l}>
                      {l}
                    </Segment.Item>
                  ))}
                </Segment>
              </div>
            ) : null}
            <p className="text-[12px] leading-4 text-muted">
              Service message under the stay. Thomas opted out of marketing on 7 Oct, so no offers are attached.
            </p>
            <p className="flex items-center gap-2 text-[13px]">
              <BroomMotion className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>
                Room {c.room} goes to Dirty on checkout. No arrival in {c.room} today.
              </span>
            </p>
          </Card>
        </div>
      </div>
    </PageContent>
  );
}
