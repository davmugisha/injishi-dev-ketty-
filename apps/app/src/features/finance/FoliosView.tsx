"use client";

import {
  ArrowRightArrowLeft,
  Briefcase,
  CircleCheck,
  CircleInfo,
  House,
  LayoutColumns,
  Lock,
  LockOpen,
  Person,
  Persons,
  PersonsLock,
  ShieldExclamation,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Label,
  ListBox,
  Modal,
  SearchField,
  Select,
  Separator,
  Table,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { ListView } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { Check, FinanceEvent, Folio, FolioKind, FolioLine, Tone } from "@injishi/data/fixtures/finance";
import { GateChip, Icon, KeyValueList, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { type Key, type ReactNode, useState } from "react";
import { CheckList, EventTimeline, groupCell, lineTab, money, selectableRow, TabCount, ToneChip } from "./shared";

const KINDS: { id: FolioKind; label: string; icon: ReactNode }[] = [
  { id: "guest", label: "Guest", icon: <Person className="size-4" /> },
  { id: "house", label: "House", icon: <House className="size-4" /> },
  { id: "master", label: "Master bills", icon: <Persons className="size-4" /> },
  { id: "city", label: "City ledger", icon: <Briefcase className="size-4" /> },
];

const KIND_LABEL: Record<FolioKind, string> = {
  guest: "Guest folio",
  house: "House folio",
  master: "Master bill",
  city: "City-ledger account",
};

const REOPEN_REASONS = [
  { id: "GUEST-DISPUTE", label: "GUEST-DISPUTE · Guest disputes a posted charge" },
  { id: "WRONG-ROOM", label: "WRONG-ROOM · Charge posted to the wrong room" },
  { id: "RATE-ERROR", label: "RATE-ERROR · Rate differs from the confirmation" },
];

const PAYERS = [
  { id: "guest", label: "Guest · personal payment at checkout" },
  { id: "company", label: "Company · direct bill to the city ledger" },
];

const sumLines = (lines: FolioLine[]) => lines.reduce((a, l) => a + l.amount, 0);
const chargesOf = (x: Folio) => x.groups.filter((g) => !g.moved).reduce((s, g) => s + sumLines(g.lines), 0);
const balanceOf = (x: Folio) => {
  const ch = chargesOf(x);
  return x.kind === "city" ? ch : ch - x.paid - (x.billed ?? 0);
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k === undefined ? null : String(k);
}

function Stat({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <Card variant="secondary" className="gap-0.5 px-3 py-2.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-base leading-6 font-semibold tabular">{value}</span>
      <span className="text-[11px] leading-[14px] text-muted">{foot}</span>
    </Card>
  );
}

export function FoliosView({ folios }: { folios: Folio[] }) {
  const [tab, setTab] = useState<FolioKind>("master");
  const [sel, setSel] = useState("F-5540");
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [reopen, setReopen] = useState<Record<string, boolean>>({});
  const [split, setSplit] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<"reopen" | "split" | null>(null);
  const [picks, setPicks] = useState<Record<string, string[]>>({});

  const statusOf = (x: Folio): [string, Tone] => {
    if (reopen[x.id]) return ["Reopen requested", "warning"];
    if (closed[x.id]) return ["Closed · receipt pending", "warning"];
    return [x.status, x.statusTone];
  };

  const q = query.trim().toLowerCase();
  const matches = (x: Folio) => !q || `${x.id} ${x.name} ${x.link}`.toLowerCase().includes(q);
  const tabs = KINDS.map((k) => ({ ...k, count: folios.filter((x) => x.kind === k.id && matches(x)).length }));
  const list = folios.filter((x) => x.kind === tab && matches(x));

  const x = folios.find((y) => y.id === sel) ?? folios[0];
  const [stLabel, stTone] = statusOf(x);
  const ch = chargesOf(x);
  const bal = balanceOf(x);
  const moved = x.groups.filter((g) => g.moved).reduce((s, g) => s + sumLines(g.lines), 0);
  const stats =
    x.kind === "city"
      ? [
          { k: "Open invoices", v: money(ch), foot: `${x.groups[0].lines.length} invoices` },
          { k: "Unallocated credit", v: money(x.pending), foot: "From bank statement" },
          { k: "Oldest", v: x.groups[0].lines[0].src, foot: "Since invoice date" },
        ]
      : x.kind === "house"
        ? [
            { k: "Charges posted", v: money(ch), foot: "Cost, not revenue" },
            { k: "Payments", v: "None expected", foot: "House account" },
            { k: "Posts to ledger", v: "31 Oct", foot: "Month-end close" },
          ]
        : [
            {
              k: "Charges posted",
              v: money(ch),
              foot: moved ? `${money(moved)} moved to F-5540` : "Net of reversals",
            },
            { k: "Verified payments", v: money(x.paid), foot: "Provider or bank confirmed" },
            x.billed
              ? { k: "On city ledger", v: money(x.billed), foot: "Authorised receivable, not cash" }
              : { k: "Not yet verified", v: money(x.pending), foot: "Excluded from balance" },
            {
              k: bal < 0 ? "Credit balance" : "Balance due",
              v: money(Math.abs(bal)),
              foot: bal < 0 ? "Unapplied deposit · a liability" : "Charges minus verified",
            },
          ];

  const isClosed = !!x.closed || !!closed[x.id];
  const open = !isClosed && x.kind !== "city";
  const allOk = x.checks.every((c) => c.tone === "success");
  const blockers = x.checks.filter((c) => c.tone !== "success").length;
  const checks: Check[] = closed[x.id]
    ? [
        ...x.checks,
        {
          tone: "warning",
          label: "Sale receipt submitted",
          detail: "Pending at VSDC · VSDC-REQ-1012-0447 · not Issued yet",
        },
      ]
    : x.checks;
  const trail: FinanceEvent[] = [...x.trail];
  if (closed[x.id])
    trail.push({
      title: "Closed by Grace Uwera",
      meta: "12 Oct 10:12 · sale receipt submitted · Pending",
      status: "current",
    });
  if (split[x.id])
    trail.push({ title: "Split into F-5541", meta: "12 Oct 10:10 · Grace Uwera · source IDs kept", status: "success" });
  if (reopen[x.id])
    trail.push({
      title: "Reopen requested · GUEST-DISPUTE",
      meta: "12 Oct 10:11 · Grace Uwera · waiting for Aline Uwase",
      status: "current",
    });

  const splitLines = x.groups
    .filter((g) => !g.moved)
    .flatMap((g) => g.lines)
    .filter((l) => l.amount > 0 && l.fiscal !== "Reversed");
  const picked = picks[x.id] ?? (splitLines.length ? [String(splitLines.length - 1)] : []);
  const pickedAmt = picked.reduce((a, i) => a + (splitLines[Number(i)]?.amount ?? 0), 0);
  const splitSummary = `${plural(picked.length, "charge")} · ${money(pickedAmt)} to F-5541`;

  const canClose = open && allOk && !closed[x.id];
  const canReopen = isClosed && !reopen[x.id] && x.kind !== "city";
  const lockWhy =
    x.kind === "city"
      ? "City-ledger accounts are settled by invoice payments, not closed like folios."
      : isClosed
        ? reopen[x.id]
          ? "Reopen is waiting for a second approver."
          : "This folio is closed. Corrections go through a reopen request and a credit note."
        : `${blockers} prerequisite${blockers === 1 ? " is" : "s are"} not met. Closing would hide an unpaid or unverified balance.`;
  const checkTitle = x.kind === "city" ? "Account Health" : isClosed ? "Close Record" : "Close Prerequisites";
  const checkSub =
    x.kind === "city"
      ? "Receivable checks for this debtor"
      : isClosed
        ? "What was true when this folio closed"
        : "All must pass before the folio can close";
  const reopenNote =
    x.reopenNote ??
    "The sale receipt is still Pending. Once issued it is never edited; corrections are made with a credit note.";

  return (
    <PageContent className="text-sm">
      <PageHeader
        eyebrow="Cashiering · Amahoro Hospitality Ltd · TIN 102 345 678"
        title="Folios"
        description="Guest, house, master and city-ledger folios. Balances come from posted charges and verified payments only."
        actions={
          <>
            <SearchField aria-label="Search folios" value={query} onChange={setQuery} className="w-[260px] max-w-full">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Folio, guest, booking, room" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <LinkButton href={screenHref("AccountsReceivable")} variant="secondary">
              <Briefcase className="size-4" />
              Invoices and aging
            </LinkButton>
          </>
        }
      />

      <Tabs
        variant="secondary"
        selectedKey={tab}
        onSelectionChange={(k) => {
          const kind = String(k) as FolioKind;
          setTab(kind);
          const first = folios.find((f) => f.kind === kind && matches(f)) ?? folios.find((f) => f.kind === kind);
          if (first) setSel(first.id);
        }}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Folio type">
            {tabs.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className={`${lineTab} gap-1.5`}>
                {t.icon}
                {t.label}
                <TabCount count={t.count} />
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {KINDS.map((k) => (
          <Tabs.Panel key={k.id} id={k.id} className="pt-3">
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Folios"
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
                    <Table.Column isRowHeader>Folio</Table.Column>
                    <Table.Column>Linked records</Table.Column>
                    <Table.Column>Property</Table.Column>
                    <Table.Column>Status</Table.Column>
                    <Table.Column className="text-right">Charges</Table.Column>
                    <Table.Column className="text-right">Verified paid</Table.Column>
                    <Table.Column className="text-right">Balance</Table.Column>
                  </Table.Header>
                  <Table.Body
                    renderEmptyState={() => (
                      <p className="px-4 py-6 text-center text-[13px] text-muted">No folio matches “{query}”.</p>
                    )}
                  >
                    {list.map((r) => {
                      const [label, tone] = statusOf(r);
                      const b = balanceOf(r);
                      return (
                        <Table.Row key={r.id} id={r.id} className={selectableRow}>
                          <Table.Cell>
                            <span className="flex flex-col">
                              <span className="font-semibold tabular">{r.id}</span>
                              <span className="text-xs text-muted">{r.name}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell className="text-[13px] text-muted tabular">{r.link}</Table.Cell>
                          <Table.Cell className="text-[13px]">{r.property}</Table.Cell>
                          <Table.Cell>
                            <ToneChip tone={tone}>{label}</ToneChip>
                          </Table.Cell>
                          <Table.Cell className="text-right tabular">{money(chargesOf(r))}</Table.Cell>
                          <Table.Cell className="text-right tabular">
                            {r.kind === "city" || r.kind === "house" ? "—" : money(r.paid)}
                          </Table.Cell>
                          <Table.Cell className="text-right font-semibold tabular">
                            {r.kind === "house" ? "Cost centre" : b < 0 ? `${money(-b)} credit` : money(b)}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Tabs.Panel>
        ))}
      </Tabs>

      <div className="flex flex-wrap items-start gap-4">
        <Card
          className="min-w-0 flex-[999_1_600px] gap-4 p-[18px]"
          aria-labelledby="f-h"
          render={(p) => <section {...p} />}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-muted">
                {KIND_LABEL[x.kind]} · {x.property}
              </span>
              <h2 id="f-h" className="text-xl leading-7 font-semibold tracking-[-0.01em]">
                {x.id} · {x.name}
              </h2>
              <span className="text-[13px] text-muted tabular">{x.link}</span>
            </div>
            <ToneChip tone={stTone} size="md">
              {stLabel}
            </ToneChip>
          </div>

          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr))]">
            {stats.map((s) => (
              <Stat key={s.k} label={s.k} value={s.v} foot={s.foot} />
            ))}
          </div>

          {x.alert ? (
            <Alert status={x.alert.tone} role="status">
              <Alert.Indicator>
                <CircleInfo />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>{x.alert.title}</Alert.Title>
                <Alert.Description>{x.alert.text}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          {split[x.id] ? (
            <Alert status="success" role="status">
              <Alert.Indicator>
                <CircleCheck />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Split into F-5541</Alert.Title>
                <Alert.Description>{split[x.id]}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          <span id="charges-cap" className="sr-only">
            Charges and adjustments on {x.id}
          </span>
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-labelledby="charges-cap">
                <Table.Header>
                  <Table.Column isRowHeader>Date</Table.Column>
                  <Table.Column>Charge and source</Table.Column>
                  <Table.Column>Department</Table.Column>
                  <Table.Column>Fiscal</Table.Column>
                  <Table.Column className="text-right">Amount</Table.Column>
                </Table.Header>
                <Table.Body>
                  {x.groups.flatMap((g) => [
                    <Table.Row key={`g-${g.label}`} id={`g-${g.label}`}>
                      <Table.Cell colSpan={5} className={`${groupCell} py-[7px]`}>
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-[13px] font-semibold">{g.label}</span>
                          <span className="text-xs text-muted tabular">{money(sumLines(g.lines))}</span>
                        </span>
                      </Table.Cell>
                    </Table.Row>,
                    ...g.lines.map((l) => (
                      <Table.Row key={`${g.label}|${l.src}|${l.desc}`} id={`${g.label}|${l.src}|${l.desc}`}>
                        <Table.Cell className="text-[13px] whitespace-nowrap text-muted tabular">{l.date}</Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col gap-0.5">
                            <span className="text-[13px] font-medium">{l.desc}</span>
                            <span className="text-xs text-muted tabular">{l.src}</span>
                            {l.transfer ? (
                              <span className="flex items-center gap-1.5 text-xs text-accent-soft-foreground">
                                <ArrowRightArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
                                {l.transfer}
                              </span>
                            ) : null}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-[13px]">
                          <span className="flex flex-col">
                            <span>{l.dept}</span>
                            <span className="text-[11px] text-muted">
                              {l.fiscal === "Not a sale"
                                ? "Out of scope · comp"
                                : x.kind === "city"
                                  ? "Per fiscal receipt"
                                  : "Tax class B"}
                            </span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <ToneChip tone={l.fiscalTone} className="whitespace-nowrap">
                            {l.fiscal}
                          </ToneChip>
                        </Table.Cell>
                        <Table.Cell className="text-right font-medium whitespace-nowrap tabular">
                          {money(l.amount)}
                        </Table.Cell>
                      </Table.Row>
                    )),
                  ])}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>

          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
            Amounts in RWF, tax-inclusive. Tax classes follow rule set v3, effective 1 Jul 2026{" "}
            <GateChip icon={<ShieldExclamation className="size-3" />}>Awaiting sign-off</GateChip>
          </p>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm leading-5 font-semibold">
              {x.kind === "city" ? "Received and Allocations" : "Payments and Allocations"}
            </h3>
            {x.payments.length === 0 ? (
              <p className="text-[13px] text-muted">{x.noPaymentsText}</p>
            ) : (
              <ListView
                aria-label={x.kind === "city" ? "Received and allocations" : "Payments and allocations"}
                variant="secondary"
                items={x.payments.map((p, i) => ({ ...p, id: `${x.id}-p${i}` }))}
              >
                {(p) => (
                  <ListView.Item id={p.id} textValue={`${p.method} · ${money(p.amount)}`}>
                    <ListView.ItemContent>
                      <Icon name={p.icon} className="size-4 shrink-0 text-muted" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>
                          {p.method} · <span className="tabular">{money(p.amount)}</span>
                        </ListView.Title>
                        <ListView.Description className="tabular">{p.evidence}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      <ToneChip tone={p.tone} size="md">
                        {p.state}
                      </ToneChip>
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
            )}
          </div>
        </Card>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <Card className="gap-3 p-[18px]" aria-labelledby="close-h" render={(p) => <section {...p} />}>
            <Card.Header>
              <Card.Title id="close-h" className="text-[15px] font-semibold">
                {checkTitle}
              </Card.Title>
              <Card.Description>{checkSub}</Card.Description>
            </Card.Header>
            <CheckList items={checks} />
            <Separator />
            {canClose ? (
              <Button className="self-start" onPress={() => setClosed((m) => ({ ...m, [x.id]: true }))}>
                <Lock className="size-4" />
                Close folio and send sale receipt
              </Button>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Button isDisabled aria-describedby="lock-why" className="self-start">
                  <Lock className="size-4" />
                  Close folio
                </Button>
                <span id="lock-why" className="text-xs leading-4 text-muted">
                  {lockWhy}
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {open ? (
                <Button size="sm" variant="secondary" onPress={() => setDialog("split")}>
                  <LayoutColumns className="size-4" />
                  Split folio
                </Button>
              ) : null}
              {canReopen ? (
                <Button size="sm" variant="secondary" onPress={() => setDialog("reopen")}>
                  <LockOpen className="size-4" />
                  Request reopen
                </Button>
              ) : null}
              {x.kind === "city" ? (
                <LinkButton href={screenHref("AccountsReceivable")} size="sm" variant="secondary">
                  Open in accounts receivable
                </LinkButton>
              ) : null}
              <LinkButton href={screenHref("Payments")} size="sm" variant="ghost">
                Payments
              </LinkButton>
            </div>
            <p className="text-xs leading-4 text-muted">
              Voids, corrections and write-offs need a reason code and leave a reversal line. Nothing is deleted.
            </p>
          </Card>

          {x.routing ? (
            <Card
              variant="secondary"
              className="gap-2.5 p-4"
              aria-labelledby="route-h"
              render={(p) => <section {...p} />}
            >
              <Card.Header>
                <Card.Title id="route-h" className="text-sm font-semibold">
                  Routing for 23–26 Oct Block
                </Card.Title>
                <Card.Description>25 rooms · approved by Aline Uwase · 4 Oct</Card.Description>
              </Card.Header>
              <KeyValueList items={x.routing.map((r) => ({ label: r.k, value: r.v }))} />
              <p className="text-xs leading-4 text-muted">
                A routed charge posts once to its target folio and keeps its original sale ID, so it is never sold or
                fiscalised twice.
              </p>
            </Card>
          ) : null}

          <Card
            variant="secondary"
            className="gap-2.5 p-4"
            aria-labelledby="trail-h"
            render={(p) => <section {...p} />}
          >
            <h2 id="trail-h" className="text-sm leading-5 font-semibold">
              Audit Trail
            </h2>
            <EventTimeline events={trail} />
          </Card>
        </div>
      </div>

      <Modal.Backdrop isOpen={dialog === "reopen"} onOpenChange={(o) => setDialog(o ? "reopen" : null)}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[520px]">
            <Modal.Header className="flex-col items-start gap-1">
              <Modal.Heading>Request to Reopen {x.id}</Modal.Heading>
              <p className="text-[13px] leading-[18px] text-muted">{reopenNote}</p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <Select fullWidth defaultValue="GUEST-DISPUTE">
                <Label>Reason code</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {REOPEN_REASONS.map((r) => (
                      <ListBox.Item key={r.id} id={r.id} textValue={r.label}>
                        {r.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <TextField fullWidth defaultValue={x.reopenDraft ?? ""}>
                <Label>What needs to change</Label>
                <TextArea rows={3} placeholder="Describe the correction and link the guest’s message" />
              </TextField>
              <Alert>
                <Alert.Indicator>
                  <PersonsLock />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Second approver required</Alert.Title>
                  <Alert.Description>
                    Aline Uwase or Didier Mugenzi approves the reopen. You cannot approve your own request.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" slot="close">
                Cancel
              </Button>
              <Button
                onPress={() => {
                  setReopen((m) => ({ ...m, [x.id]: true }));
                  setDialog(null);
                }}
              >
                Send for approval
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={dialog === "split"} onOpenChange={(o) => setDialog(o ? "split" : null)}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[720px]">
            <Modal.Header className="flex-col items-start gap-1">
              <Modal.Heading>Split {x.id} into a New Window</Modal.Heading>
              <p className="text-[13px] leading-[18px] text-muted">
                Choose the charges that move to F-5541. They keep their original sale and source IDs; no new sale or
                fiscal posting is created.
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <CheckboxGroup
                aria-label="Charges to move"
                value={picked}
                onChange={(v) => setPicks((m) => ({ ...m, [x.id]: v }))}
                className="flex flex-col gap-1"
              >
                {splitLines.map((l, i) => (
                  <Checkbox key={`${l.desc}-${l.date}`} value={String(i)} className="rounded-xl px-2 py-1.5">
                    <Checkbox.Content className="flex w-full items-center gap-2">
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <span className="flex-1">{l.desc}</span>
                      <span className="font-medium tabular">{money(l.amount)}</span>
                    </Checkbox.Content>
                  </Checkbox>
                ))}
              </CheckboxGroup>
              <Select fullWidth defaultValue="guest">
                <Label>New window pays by</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {PAYERS.map((p) => (
                      <ListBox.Item key={p.id} id={p.id} textValue={p.label}>
                        {p.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </Modal.Body>
            <Modal.Footer className="flex flex-wrap items-center gap-2">
              <span className="mr-auto text-[13px] text-muted tabular">{splitSummary}</span>
              <span className="ml-auto flex gap-2">
                <Button variant="ghost" slot="close">
                  Cancel
                </Button>
                <Button
                  isDisabled={picked.length === 0}
                  onPress={() => {
                    setSplit((m) => ({
                      ...m,
                      [x.id]: `${plural(picked.length, "charge")} (${money(pickedAmt)}) moved and kept the original sale IDs. Payments stay on ${x.id}; no new sale or fiscal posting was created.`,
                    }));
                    setDialog(null);
                  }}
                >
                  Split folio
                </Button>
              </span>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </PageContent>
  );
}
