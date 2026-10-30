"use client";

import {
  ArrowUturnCcwLeft,
  CircleCheck,
  CircleInfo,
  CircleXmark,
  Lock,
  Plus,
  ScalesBalanced,
  TriangleExclamation,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Table,
  Tabs,
  TextField,
} from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { DeskMethod, PaymentIntent, PaymentState, RefundRequest, Tone } from "@injishi/data/fixtures/finance";
import { GateChip, Icon, KeyValueList, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { type Key, useState } from "react";
import { CheckIcon, EventTimeline, lineTab, money, SubHeading, selectableRow, TabCount, ToneChip } from "./pay-parts";

interface PaymentsData {
  payments: PaymentIntent[];
  refunds: RefundRequest[];
  deskMethods: DeskMethod[];
}

const STATE: Record<PaymentState, { tone: Tone; group: "open" | "ok" | "back" }> = {
  Initiated: { tone: "default", group: "open" },
  Pending: { tone: "warning", group: "open" },
  Unknown: { tone: "warning", group: "open" },
  Verified: { tone: "success", group: "ok" },
  Failed: { tone: "danger", group: "open" },
  Disputed: { tone: "danger", group: "open" },
  Reversed: { tone: "default", group: "back" },
  Refunded: { tone: "info", group: "back" },
  Recorded: { tone: "default", group: "open" },
};

const TABS: { id: string; label: string; test: (x: PaymentIntent) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "open", label: "Needs attention", test: (x) => STATE[x.state].group === "open" },
  { id: "ok", label: "Verified", test: (x) => x.state === "Verified" },
  { id: "back", label: "Reversed and refunded", test: (x) => STATE[x.state].group === "back" },
];

const NOTE_ICON = {
  success: CircleCheck,
  warning: TriangleExclamation,
  danger: CircleXmark,
  default: CircleInfo,
} as const;

const DESK_FOLIOS = [
  { id: "F-5529", label: "F-5529 · Jean Bosco Nkurunziza · Room 306 · balance RWF 26,000" },
  { id: "F-5531", label: "F-5531 · Daniel Okafor · Room 305 · balance RWF 120,000" },
  { id: "F-5525", label: "F-5525 · Yuki Tanaka · Room 112 · balance RWF 65,000" },
];

function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k === undefined ? null : String(k);
}

const attemptsOf = (x: PaymentIntent) => x.events.filter((e) => e.title.startsWith("Attempt")).length || 1;

/** Intents created before today and already closed, so not listed here (168 in total with the 12 shown). */
const OLDER_CLOSED_INTENTS = 156;

export function PaymentsView({ data }: { data: PaymentsData }) {
  const [tab, setTab] = useState("all");
  const [sel, setSel] = useState("PI-77126");
  const [dialog, setDialog] = useState<"exec" | "desk" | null>(null);
  const [refundTarget, setRefundTarget] = useState<string | null>(null);
  const [executed, setExecuted] = useState<Record<string, boolean>>({});
  const [method, setMethod] = useState<DeskMethod["id"]>("mtn");
  const [deskVals, setDeskVals] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<PaymentIntent | null>(null);

  const intents = added ? [added, ...data.payments] : data.payments;
  const tabs = TABS.map((t) => ({ ...t, count: intents.filter(t.test).length }));
  const rows = intents.filter((TABS.find((t) => t.id === tab) ?? TABS[0]).test);

  const x = intents.find((y) => y.id === sel) ?? intents[0];
  const NoteIcon = NOTE_ICON[x.note.tone];
  const target = data.refunds.find((f) => f.id === refundTarget) ?? data.refunds[0];
  const dm = data.deskMethods.find((m) => m.id === method) ?? data.deskMethods[0];
  const deskValue = deskVals[dm.id] ?? dm.fieldValue;

  const submitDesk = () => {
    setAdded({
      id: "PI-77144",
      time: "12 Oct 10:15",
      payer: "Jean Bosco Nkurunziza",
      record: "F-5529 · Room 306 · desk payment",
      method: dm.method,
      account: dm.account,
      icon: dm.icon,
      amount: 26000,
      state: dm.state,
      providerRef: "Not yet",
      events: [{ title: "Recorded at the desk by Grace Uwera", meta: "10:15 · key pi_77144:att_1", status: "current" }],
      evidence: [
        { tone: "idle", k: "Provider confirmation", v: "Not received yet" },
        { tone: "idle", k: "Ledger", v: "Nothing posted until verified" },
      ],
      note: { tone: "default", title: dm.outcomeTitle, text: dm.outcomeText },
    });
    setTab("all");
    setSel("PI-77144");
    setDialog(null);
  };

  return (
    <PageContent className="text-sm">
      <PageHeader
        eyebrow="Cashiering · GT Bank adapter · MTN MoMo, Airtel Money, card, bank transfer"
        title="Payments"
        description="Every payment intent with its provider attempts. Only a payment confirmed by the provider counts as Verified."
        actions={
          <>
            <LinkButton href={screenHref("Reconciliation")} variant="secondary">
              <ScalesBalanced className="size-4" />
              Reconciliation
            </LinkButton>
            <Button onPress={() => setDialog("desk")}>
              <Plus className="size-4" />
              Record desk payment
            </Button>
          </>
        }
      />

      <div className="relative">
        <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Filter by state">
              {tabs.map((t) => (
                <Tabs.Tab key={t.id} id={t.id} className={lineTab}>
                  {t.label}
                  <TabCount count={t.count} />
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {TABS.map((t) => (
            <Tabs.Panel key={t.id} id={t.id} className="pt-3">
              <Table>
                <Table.ScrollContainer>
                  <Table.Content
                    aria-label="Payment intents"
                    selectionMode="single"
                    selectionBehavior="replace"
                    disallowEmptySelection
                    selectedKeys={new Set([sel])}
                    onSelectionChange={(keys) => {
                      const id = firstKey(keys as "all" | Set<Key>);
                      if (id) setSel(id);
                    }}
                  >
                    <Table.Header>
                      <Table.Column isRowHeader>Intent</Table.Column>
                      <Table.Column>Payer and record</Table.Column>
                      <Table.Column>Method</Table.Column>
                      <Table.Column className="text-right">Amount</Table.Column>
                      <Table.Column>State</Table.Column>
                      <Table.Column className="text-right">Attempts</Table.Column>
                      <Table.Column>Provider reference</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {rows.map((r) => (
                        <Table.Row key={r.id} id={r.id} className={selectableRow}>
                          <Table.Cell>
                            <span className="flex flex-col">
                              <span className="font-semibold tabular">{r.id}</span>
                              <span className="text-xs text-muted tabular">{r.time}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="flex flex-col">
                              <span className="font-medium">{r.payer}</span>
                              <span className="text-xs text-muted tabular">{r.record}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="flex items-center gap-2">
                              <Icon name={r.icon} className="size-4 shrink-0 text-muted" />
                              <span className="flex flex-col">
                                <span className="text-[13px] font-medium">{r.method}</span>
                                <span className="text-xs text-muted tabular">{r.account}</span>
                              </span>
                            </span>
                          </Table.Cell>
                          <Table.Cell className="text-right font-medium whitespace-nowrap tabular">
                            {money(r.amount)}
                          </Table.Cell>
                          <Table.Cell>
                            <ToneChip tone={STATE[r.state].tone} className="whitespace-nowrap">
                              {r.state === "Unknown" ? "Unknown — checking" : r.state}
                            </ToneChip>
                          </Table.Cell>
                          <Table.Cell className="text-right tabular">{attemptsOf(r)}</Table.Cell>
                          <Table.Cell className="text-xs text-muted tabular">{r.providerRef}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </Tabs.Panel>
          ))}
        </Tabs>
        <span className="mt-2 block text-xs text-muted md:absolute md:top-2 md:right-0 md:mt-0">
          Today and everything still open · {intents.length} of {OLDER_CLOSED_INTENTS + intents.length} intents
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <Card
          className="min-w-0 flex-[1_1_520px] gap-[14px] p-[18px]"
          aria-labelledby="pi-h"
          render={(p) => <section {...p} />}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-muted tabular">
                {x.method} · {x.account}
              </span>
              <h2 id="pi-h" className="text-[15px] leading-[22px] font-semibold">
                {x.id} · {x.payer}
              </h2>
              <span className="text-[13px] text-muted tabular">{x.record} · merchant Amahoro Hospitality Ltd</span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-xl leading-7 font-semibold tabular">{money(x.amount)}</span>
              <ToneChip tone={STATE[x.state].tone} size="md">
                {x.state === "Unknown" ? "Unknown — checking with provider" : x.state}
              </ToneChip>
            </div>
          </div>
          <Alert status={x.note.tone} role="status">
            <Alert.Indicator>
              <NoteIcon />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>{x.note.title}</Alert.Title>
              <Alert.Description>{x.note.text}</Alert.Description>
            </Alert.Content>
          </Alert>
          <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
            <div className="flex flex-col gap-2">
              <SubHeading>Attempts and Events</SubHeading>
              <EventTimeline events={x.events} />
            </div>
            <div className="flex flex-col gap-2">
              <SubHeading>Provider Evidence</SubHeading>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {x.evidence.map((v) => (
                  <li key={`${v.k}-${v.v}`} className="flex items-start gap-2">
                    <CheckIcon tone={v.tone} />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-xs text-muted">{v.k}</span>
                      <span className="text-[13px] font-medium tabular">{v.v}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {x.board ? (
            <div className="flex gap-2">
              <LinkButton href={screenHref(x.board)} size="sm" variant="secondary">
                {x.cta}
              </LinkButton>
            </div>
          ) : null}
        </Card>

        <Card
          className="min-w-0 flex-[1_1_420px] gap-3 p-[18px]"
          aria-labelledby="rf-h"
          render={(p) => <section {...p} />}
        >
          <Card.Header>
            <Card.Title id="rf-h" className="text-[15px] font-semibold">
              Refunds to Execute
            </Card.Title>
            <Card.Description>
              Reservation policy and approvers decide. Finance executes through the provider and never approves its own
              request.
            </Card.Description>
          </Card.Header>
          {data.refunds.map((f) => {
            const done = !!executed[f.id];
            const canExec = !!f.executable && !done;
            const status = done ? "Pending at provider" : f.executable ? "Approved · ready" : (f.status ?? "");
            const tone: Tone = done ? "warning" : f.executable ? "accent" : (f.statusTone ?? "default");
            const why = done
              ? "Executed by you 10:14 · GT Bank GTB-RF-26101241 · shows Refunded only after the provider confirms."
              : f.why;
            return (
              <Card key={f.id} variant="secondary" className="gap-2 p-[14px]" render={(p) => <article {...p} />}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold tabular">
                      {f.id} · {f.ref}
                    </span>
                    <span className="text-xs text-muted tabular">
                      {money(f.amount)} · {f.kind} · {f.rail}
                    </span>
                  </div>
                  <ToneChip tone={tone} size="md" className="shrink-0">
                    {status}
                  </ToneChip>
                </div>
                <span className="text-xs leading-4">{f.policy}</span>
                <span className="text-xs leading-4 text-muted">
                  Requested by {f.requestedBy} · approved by {f.approvedBy}
                </span>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {f.checks.map((c) => (
                    <li key={c.text} className="flex items-center gap-2 text-xs">
                      <CheckIcon tone={c.tone} className="size-4 shrink-0" />
                      {c.text}
                    </li>
                  ))}
                </ul>
                {f.gate ? (
                  <GateChip icon={<Lock className="size-3" />} className="self-start">
                    Partial card refund · external gate
                  </GateChip>
                ) : null}
                {canExec ? (
                  <Button
                    size="sm"
                    className="self-start"
                    onPress={() => {
                      setRefundTarget(f.id);
                      setDialog("exec");
                    }}
                  >
                    <ArrowUturnCcwLeft className="size-4" />
                    Execute refund
                  </Button>
                ) : null}
                {why ? <span className="text-xs leading-4 text-muted tabular">{why}</span> : null}
              </Card>
            );
          })}
        </Card>
      </div>

      <Modal.Backdrop isOpen={dialog === "exec"} onOpenChange={(o) => setDialog(o ? "exec" : null)}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[520px]">
            <Modal.Header className="flex-col items-start gap-1">
              <Modal.Heading>Execute {target.id}</Modal.Heading>
              <p className="text-[13px] leading-[18px] text-muted">
                {money(target.amount)} back to {target.rail}. The refund shows Pending until GT Bank confirms it; a
                refund receipt (credit note) goes to the VSDC after that.
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <KeyValueList
                items={[
                  { label: "Decision", value: target.policy },
                  { label: "Requested by", value: target.requestedBy },
                  { label: "Approved by", value: target.approvedBy },
                  { label: "Executed by", value: "Grace Uwera" },
                ]}
              />
              <TextField fullWidth defaultValue="482 913">
                <Label>Authenticator code</Label>
                <Input inputMode="numeric" autoComplete="one-time-code" placeholder="6 digits" className="tabular" />
                <Description>Step-up check for money leaving the business</Description>
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" slot="close">
                Cancel
              </Button>
              <Button
                onPress={() => {
                  setExecuted((m) => ({ ...m, [target.id]: true }));
                  setDialog(null);
                }}
              >
                Execute through GT Bank
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={dialog === "desk"} onOpenChange={(o) => setDialog(o ? "desk" : null)}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[720px]">
            <Modal.Header className="flex-col items-start gap-1">
              <Modal.Heading>Record Desk Payment</Modal.Heading>
              <p className="text-[13px] leading-[18px] text-muted">
                Saved as a payment intent. The folio balance changes only when the payment is verified.
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <Select fullWidth defaultValue="F-5529">
                <Label>Folio</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {DESK_FOLIOS.map((f) => (
                      <ListBox.Item key={f.id} id={f.id} textValue={f.label}>
                        {f.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Method</span>
                <Segment
                  aria-label="Payment method"
                  selectedKey={method}
                  onSelectionChange={(k) => setMethod(String(k) as DeskMethod["id"])}
                  className="self-start"
                >
                  {data.deskMethods.map((m) => (
                    <Segment.Item key={m.id} id={m.id}>
                      {m.label}
                    </Segment.Item>
                  ))}
                </Segment>
              </div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
                <TextField fullWidth value={deskValue} onChange={(v) => setDeskVals((m) => ({ ...m, [dm.id]: v }))}>
                  <Label>{dm.fieldLabel}</Label>
                  <Input className="tabular" />
                  <Description>{dm.fieldHelp}</Description>
                </TextField>
                <TextField fullWidth defaultValue="26,000">
                  <Label>Amount (RWF)</Label>
                  <Input inputMode="numeric" className="tabular" />
                  <Description>Up to the open balance</Description>
                </TextField>
              </div>
              <Alert>
                <Alert.Indicator>
                  <CircleInfo />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>{dm.outcomeTitle}</Alert.Title>
                  <Alert.Description>{dm.outcomeText}</Alert.Description>
                </Alert.Content>
              </Alert>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" slot="close">
                Cancel
              </Button>
              <Button onPress={submitDesk}>{dm.cta}</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </PageContent>
  );
}
