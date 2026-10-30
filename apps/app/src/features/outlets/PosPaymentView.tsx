"use client";

import { ChevronLeft, FileCheck, Key, Printer, ShieldExclamation, SquareCheck, Wallet } from "@gravity-ui/icons";
import { Alert, Button, Checkbox, Chip, Description, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { EmptyState, ItemCard, RadioButtonGroup, Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  Bill,
  BillLine,
  BillPayment,
  BillSeat,
  FiscalState,
  FiscalStateId,
  KeyFact,
  MomoOutcome,
  OutletTone,
  Tender,
} from "@injishi/data/fixtures/outlets";
import { GateChip, Icon, KeyValueList, LinkButton, SectionHeader, toneColor } from "@injishi/ui";
import { useMemo, useState } from "react";
import { money } from "./shared";

export type MomoId = MomoOutcome["id"];
type SplitMode = "whole" | "seat" | "item";
type AlertStatus = "default" | "accent" | "success" | "warning" | "danger";

interface PosPaymentData {
  bill: Bill;
  seats: BillSeat[];
  payments: BillPayment[];
  outcomes: MomoOutcome[];
  lines: BillLine[];
  tenders: Tender[];
  fiscalStates: FiscalState[];
}

/** A payment on the bill, including ones taken during this visit to the screen. */
interface PayRec {
  id: string;
  seats: string[];
  lines: string[];
  who: string;
  amount: number;
  label: string;
  tone: OutletTone;
  alert: AlertStatus;
  icon: string;
  title: string;
  text: string;
  facts: KeyFact[];
  fiscal: FiscalStateId;
  settled: boolean;
  canCheck: boolean;
  noCancel: boolean;
  retry: boolean;
  receipt?: { number: string; line: string };
}

interface PayDraft {
  seats: string[];
  lines: string[];
  who: string;
}

const MODES: { id: SplitMode; label: string }[] = [
  { id: "whole", label: "Whole bill" },
  { id: "seat", label: "By seat" },
  { id: "item", label: "By item" },
];

/** Time stamped on a payment taken from this screen. */
const NOW = "19:53";

const alertOf = (tone: OutletTone): AlertStatus => {
  if (tone === "info" || tone === "accent") return "accent";
  if (tone === "success" || tone === "warning" || tone === "danger") return tone;
  return "default";
};

function toRec(p: BillPayment, momo: MomoOutcome | null): PayRec {
  if (p.momo && momo) {
    return {
      id: p.id,
      seats: p.seats,
      lines: [],
      who: p.who,
      amount: p.amount,
      label: momo.label,
      tone: momo.tone,
      alert: alertOf(momo.tone),
      icon: momo.icon,
      title: momo.title,
      text: momo.text,
      facts: [...p.facts, { label: "Provider reference", value: momo.reference }],
      fiscal: momo.fiscal,
      settled: momo.settled,
      canCheck: momo.canCheck,
      noCancel: momo.noCancel,
      retry: momo.retry,
    };
  }
  return {
    id: p.id,
    seats: p.seats,
    lines: [],
    who: p.who,
    amount: p.amount,
    label: p.label,
    tone: p.tone,
    alert: alertOf(p.alertTone),
    icon: p.icon,
    title: p.title,
    text: p.text,
    facts: p.facts,
    fiscal: p.fiscal,
    settled: p.settled,
    canCheck: false,
    noCancel: true,
    retry: false,
    receipt: p.receipt,
  };
}

/** What the action button does for the tender in front of the waiter. */
function actionFor(
  tender: Tender["id"],
  signed: boolean,
  short: boolean,
): { label: string; icon: string; hint: string; disabled: boolean } {
  if (tender === "cash") {
    return {
      label: "Record cash",
      icon: "Wallet",
      hint: short ? "" : "Opens the drawer and records the payment",
      disabled: short,
    };
  }
  if (tender === "mtn" || tender === "airtel") {
    return {
      label: "Send payment prompt",
      icon: "PaperPlane",
      hint: tender === "airtel" ? "Shows Pending until Airtel confirms" : "Shows Pending until MTN confirms",
      disabled: false,
    };
  }
  if (tender === "card") {
    return {
      label: "Send to terminal",
      icon: "CreditCard",
      hint: "Paid only after GT Bank authorises",
      disabled: false,
    };
  }
  return {
    label: "Post to folio",
    icon: "Key",
    hint: signed ? "Posts once, even if the tablet retries" : "Needs the guest signature first",
    disabled: !signed,
  };
}

/**
 * Split a table bill and take the next tender (artifact: POSPayment). Mobile-money state follows `?momo=`.
 * Seat 4 is the open seat; Seats 1 to 3 already have a payment.
 */
export function PosPaymentView({ momo, data }: { momo: MomoId; data: PosPaymentData }) {
  const outcome = data.outcomes.find((o) => o.id === momo) ?? data.outcomes.find((o) => o.id === "pending");
  const base = useMemo(
    () => data.payments.map((p) => toRec(p, p.momo ? (outcome ?? null) : null)),
    [data.payments, outcome],
  );
  const fiscalById = useMemo(() => new Map(data.fiscalStates.map((f) => [f.id, f])), [data.fiscalStates]);
  const payById = useMemo(() => new Map(base.map((p) => [p.id, p])), [base]);

  const [mode, setMode] = useState<SplitMode>("seat");
  const [seat, setSeat] = useState("s4");
  const [tender, setTender] = useState<Tender["id"]>("cash");
  const [cash, setCash] = useState(20000);
  const [signed, setSigned] = useState(false);
  const [picks, setPicks] = useState<Record<string, boolean>>({ tilapia: true, salad4: true });
  const [extra, setExtra] = useState<PayRec[]>([]);
  const [checked, setChecked] = useState(false);

  const all = [...base, ...extra];
  const live = all.filter((r) => !r.retry);
  const bySeat = new Map<string, PayRec>();
  for (const r of all) for (const k of r.seats) bySeat.set(k, r);
  const lineRec = (id: string) => [...live].reverse().find((r) => r.seats.includes("s4") || r.lines.includes(id));
  const unpaid = data.lines.filter((l) => !l.payment);
  const s4left = unpaid.filter((l) => !lineRec(l.id)).reduce((a, l) => a + l.amount, 0);
  const lastS4 = [...live].reverse().find((r) => r.seats.includes("s4") || r.lines.length > 0);
  const s2 = bySeat.get("s2");
  const s2open = Boolean(s2?.retry);
  const fullS4 = data.seats.find((s) => s.id === "s4")?.amount ?? s4left;
  const leftAll = s4left + (s2open ? (s2?.amount ?? 0) : 0);
  const settled = live.filter((r) => r.settled).reduce((a, r) => a + r.amount, 0);
  const pendingAmt = live.filter((r) => !r.settled).reduce((a, r) => a + r.amount, 0);

  const picked = unpaid.filter((l) => picks[l.id] && !lineRec(l.id));
  const pickedAmt = picked.reduce((a, l) => a + l.amount, 0);
  const openItems = unpaid.filter((l) => !lineRec(l.id));

  let rec: PayRec | undefined;
  let due = 0;
  let draft: PayDraft | null = null;
  let eyebrow = "";
  let title = "";
  let shown = 0;
  if (mode === "seat") {
    const x = data.seats.find((s) => s.id === seat) ?? data.seats[0];
    if (x?.id === "s4") {
      rec = s4left === 0 ? lastS4 : undefined;
      due = s4left;
      draft = { seats: ["s4"], lines: [], who: "Seat 4" };
    } else if (x) {
      rec = bySeat.get(x.id);
      due = rec && !rec.retry ? 0 : x.amount;
      draft = { seats: [x.id], lines: [], who: x.label };
    }
    eyebrow = "Paying by seat";
    title = x?.label ?? "";
    shown = rec && !rec.retry ? rec.amount : due || (x?.amount ?? 0);
  } else if (mode === "item") {
    rec = s4left === 0 ? lastS4 : undefined;
    due = rec ? 0 : pickedAmt;
    draft = {
      seats: [],
      lines: picked.map((l) => l.id),
      who: `Items · ${picked.map((l) => l.name.split(" · ")[0]).join(", ")}`,
    };
    eyebrow = "Paying by item";
    title = rec ? "All items paid or pending" : `${picked.length} of ${openItems.length} open items selected`;
    shown = due;
  } else {
    due = leftAll;
    rec = leftAll === 0 ? live[live.length - 1] : undefined;
    draft = {
      seats: s2open ? ["s2"] : [],
      lines: unpaid.filter((l) => !lineRec(l.id)).map((l) => l.id),
      who: "Rest of bill",
    };
    eyebrow = "Paying the rest of the bill";
    title = "Left to collect";
    shown = leftAll;
  }
  const hasRec = Boolean(rec);
  const canPay = due > 0 && (!rec || rec.retry);
  const nothing = !rec && due === 0;
  const change = cash - due;
  const short = change < 0;
  const act = actionFor(tender, signed, short);
  if (short && tender === "cash") act.hint = `Short by ${money(-change)}`;

  const quick = [due, Math.ceil(due / 5000) * 5000, Math.ceil(due / 10000) * 10000 + 10000].filter(
    (v, i, a) => v > 0 && a.indexOf(v) === i,
  );
  const chosen = data.tenders.find((t) => t.id === tender);
  const open = live.filter((r) => !r.settled).length + (s4left > 0 ? 1 : 0) + (s2open ? 1 : 0);
  const waiting = fiscalById.get("waiting");

  const seatCards = data.seats.map((x) => {
    let r = bySeat.get(x.id);
    if (x.id === "s4") r = s4left === 0 ? lastS4 : undefined;
    const part = x.id === "s4" && s4left > 0 && s4left < fullS4;
    const label = r ? r.label : part ? "Part paid" : "Not paid";
    const tone: OutletTone = r ? r.tone : "default";
    return { ...x, status: label, tone, current: seat === x.id };
  });

  const itemRows = data.lines.map((l) => {
    const source = l.payment ? data.payments.find((p) => p.id === l.payment) : undefined;
    const cover = source ? undefined : lineRec(l.id);
    const locked = Boolean(source || cover);
    const meta = source
      ? source.momo
        ? `${l.meta} · MoMo ${(payById.get(source.id)?.label ?? source.label).toLowerCase()}`
        : `${l.meta} · ${source.short}`
      : cover
        ? `${cover.label} · ${l.meta}`
        : l.meta;
    return { ...l, meta, locked, selected: !locked && Boolean(picks[l.id]) };
  });

  const fiscalRows = [
    ...all.map((r) => {
      const fs = fiscalById.get(r.fiscal);
      return {
        id: r.id,
        who: r.who,
        amount: r.amount,
        label: fs?.label ?? "Draft",
        tone: fs?.tone ?? "default",
        detail: fs?.detail ?? "",
        issued: r.fiscal === "issued",
        receipt: r.receipt,
      };
    }),
    ...(s4left > 0
      ? [
          {
            id: "s4-left",
            who: "Seat 4",
            amount: s4left,
            label: waiting?.label ?? "Draft",
            tone: waiting?.tone ?? "default",
            detail: waiting?.detail ?? "Waiting for payment.",
            issued: false,
            receipt: undefined,
          },
        ]
      : []),
  ];

  const take = () => {
    if (!canPay || act.disabled || !draft) return;
    const n = extra.length + 4;
    const id = `P${n}`;
    const intent = `PI-7715${n}`;
    const common = { id, seats: draft.seats, lines: draft.lines, who: draft.who, amount: due };
    let next: PayRec;
    if (tender === "cash") {
      next = {
        ...common,
        label: "Paid · cash",
        tone: "success",
        alert: "success",
        icon: "CircleCheck",
        title: "Cash received at Till 2",
        text: `${money(cash)} received · ${money(change)} change due to the guest.`,
        facts: [
          { label: "Payment", value: `${intent} · cash · ${NOW}` },
          { label: "Taken by", value: "Claudine Mukamana · Till 2" },
        ],
        fiscal: "vsdc",
        settled: true,
        canCheck: false,
        noCancel: true,
        retry: false,
      };
    } else if (tender === "room") {
      next = {
        ...common,
        label: "On room 204",
        tone: "info",
        alert: "accent",
        icon: "Key",
        title: "Posted to folio F-5521",
        text: "The fiscal receipt follows at folio close. A retry cannot post this twice.",
        facts: [
          { label: "Folio posting", value: `FP-3087${n} · ${NOW}` },
          { label: "Stay", value: "ST-8812" },
        ],
        fiscal: "folio",
        settled: true,
        canCheck: false,
        noCancel: true,
        retry: false,
      };
    } else {
      const rail = chosen?.rail ?? "";
      next = {
        ...common,
        label: "Pending",
        tone: "warning",
        alert: "warning",
        icon: "Hourglass",
        title:
          tender === "card"
            ? "Pending · waiting for the card on the terminal"
            : "Pending · waiting for the guest to approve",
        text: "The bill stays open until the provider confirms. Do not hand over a receipt yet.",
        facts: [
          { label: "Payment intent", value: `${intent} · attempt 1 · ${NOW}` },
          { label: "Rail", value: rail },
          { label: "Provider reference", value: "Not yet" },
        ],
        fiscal: "draft",
        settled: false,
        canCheck: true,
        noCancel: false,
        retry: false,
      };
    }
    setExtra((rs) => [...rs, next]);
    setChecked(false);
    setSigned(false);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-background text-[14px] text-foreground">
      <header className="flex flex-none items-center gap-3 bg-surface px-4 py-2.5 shadow-[0_1px_0_var(--separator)]">
        <LinkButton href={screenHref("POS")} variant="ghost" size="sm">
          <ChevronLeft className="size-4" />
          Ticket
        </LinkButton>
        <div className="flex min-w-0 flex-col">
          <span className="text-[15px] leading-5 font-semibold">
            {data.bill.table} · bill {data.bill.id}
          </span>
          <span className="truncate text-[12px] leading-4 text-muted">
            Isangano Terrace · merchant Amahoro Hospitality Ltd · TIN 102 345 678
          </span>
        </div>
        <span className="flex-1" />
        <Chip variant="soft" color={open ? "warning" : "success"}>
          <Chip.Label>{open ? `Bill open · ${open} to settle` : "Ready to close"}</Chip.Label>
        </Chip>
        <Chip size="sm" variant="soft">
          <Wallet className="size-3" />
          <Chip.Label>Till 2 · Claudine Mukamana</Chip.Label>
        </Chip>
      </header>

      <div className="flex min-h-0 flex-1">
        <section aria-labelledby="split-h" className="flex w-[340px] flex-none flex-col gap-3 overflow-y-auto p-3.5">
          <SectionHeader
            id="split-h"
            title="Split the bill"
            action={<span className="text-[13px] text-muted tabular">Total {money(data.bill.total)}</span>}
          />
          <Segment
            aria-label="Split mode"
            selectedKey={mode}
            onSelectionChange={(k) => {
              const next = String(k);
              if (next === "whole" || next === "seat" || next === "item") {
                setMode(next);
                setChecked(false);
              }
            }}
            className="w-full"
          >
            {MODES.map((m) => (
              <Segment.Item key={m.id} id={m.id} className="flex-1">
                {m.label}
              </Segment.Item>
            ))}
          </Segment>

          {mode === "seat" ? (
            <div className="flex flex-col gap-2">
              {seatCards.map((sc) => (
                <Button
                  key={sc.id}
                  variant="tertiary"
                  aria-current={sc.current ? "true" : undefined}
                  onPress={() => {
                    setSeat(sc.id);
                    setChecked(false);
                  }}
                  className={`h-auto min-h-16 w-full items-start justify-between gap-2 rounded-[14px] px-3 py-2.5 text-left whitespace-normal shadow-[var(--surface-shadow)] [--button-bg-hover:var(--surface-hover)] [--button-bg:var(--surface)] [--button-fg:var(--foreground)] ${sc.current ? "ring-2 ring-accent" : ""}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">{sc.label}</span>
                    <span className="text-[12px] leading-4 font-normal text-muted">{sc.items}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="font-semibold tabular">{money(sc.amount)}</span>
                    <Chip size="sm" variant="soft" color={toneColor(sc.tone)}>
                      <Chip.Label>{sc.status}</Chip.Label>
                    </Chip>
                  </span>
                </Button>
              ))}
              <p className="text-[12px] leading-4 text-muted">
                Shared avocado salad (RWF 5,500) is split equally across the four seats.
              </p>
            </div>
          ) : null}

          {mode === "item" ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] text-muted">
                Tick what this guest pays for. Paid and pending items are locked.
              </span>
              {itemRows.map((it) => (
                <Checkbox
                  key={it.id}
                  isSelected={it.selected}
                  isDisabled={it.locked}
                  onChange={() => setPicks((p) => ({ ...p, [it.id]: !p[it.id] }))}
                  aria-label={it.name}
                  className={`w-full rounded-[14px] bg-surface px-3 py-2.5 shadow-[var(--surface-shadow)] ${it.locked ? "opacity-60" : ""}`}
                >
                  <Checkbox.Content className="w-full items-center gap-2.5">
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="leading-[18px] font-medium">{it.name}</span>
                      <span className="text-[12px] text-muted">{it.meta}</span>
                    </span>
                    <span className="font-medium tabular">{money(it.amount)}</span>
                  </Checkbox.Content>
                </Checkbox>
              ))}
            </div>
          ) : null}

          {mode === "whole" ? (
            <section className="flex flex-col gap-2 rounded-[14px] bg-surface p-4 shadow-[var(--surface-shadow)]">
              <KeyValueList
                className="grid-cols-[1fr_auto]"
                items={[
                  { label: "Bill total", value: <span className="tabular">{money(data.bill.total)}</span> },
                  { label: "Settled", value: <span className="tabular">{money(settled)}</span> },
                  {
                    label: "Pending, not counted as paid",
                    value: <span className="tabular">{money(pendingAmt)}</span>,
                  },
                  {
                    label: "Left to collect",
                    value: (
                      <span className="text-[15px] tabular">
                        {money(Math.max(0, data.bill.total - settled - pendingAmt))}
                      </span>
                    ),
                  },
                ]}
              />
              <p className="text-[12px] leading-4 text-muted">
                Mobile money stays pending until the provider confirms it.
              </p>
            </section>
          ) : null}
        </section>

        <section
          aria-labelledby="tender-h"
          className="flex min-w-0 flex-1 flex-col gap-3.5 overflow-y-auto bg-surface px-[18px] py-3.5 shadow-[-1px_0_0_var(--separator),1px_0_0_var(--separator)]"
        >
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[12px] text-muted">{eyebrow}</span>
              <h2 id="tender-h" className="text-[18px] leading-6 font-semibold">
                {title}
              </h2>
            </div>
            <span className="text-[28px] leading-[34px] font-semibold tabular">{money(shown)}</span>
          </div>

          {hasRec && rec ? (
            <>
              <Alert status={rec.alert} role="status">
                <Alert.Indicator>
                  <Icon name={rec.icon} />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>{rec.title}</Alert.Title>
                  {rec.text ? <Alert.Description>{rec.text}</Alert.Description> : null}
                </Alert.Content>
              </Alert>
              <KeyValueList
                items={rec.facts.map((f) => ({ label: f.label, value: <span className="tabular">{f.value}</span> }))}
              />
              {rec.canCheck ? (
                <div className="flex gap-2">
                  <Button variant="secondary" onPress={() => setChecked(true)}>
                    <Icon name="ArrowsRotateRight" className="size-4" />
                    Check status
                  </Button>
                  <Button variant="ghost" isDisabled={rec.noCancel}>
                    Cancel attempt
                  </Button>
                </div>
              ) : null}
              {checked && rec.canCheck ? (
                <p className="text-[12px] text-muted">
                  Checked with the provider at 19:54 · not confirmed yet. We keep checking automatically.
                </p>
              ) : null}
            </>
          ) : null}

          {canPay && chosen ? (
            <>
              <RadioButtonGroup
                aria-label="Tender"
                layout="grid"
                value={tender}
                onChange={(v) => {
                  if (v === "cash" || v === "mtn" || v === "airtel" || v === "card" || v === "room") {
                    setTender(v);
                    setChecked(false);
                  }
                }}
                className="grid-cols-5 gap-2"
              >
                {data.tenders.map((t) => (
                  <RadioButtonGroup.Item
                    key={t.id}
                    value={t.id}
                    className="min-h-[84px] items-start gap-1.5 px-2.5 py-3 text-left"
                  >
                    <Icon name={t.icon} className="size-5" />
                    <RadioButtonGroup.ItemContent className="flex flex-col">
                      <span className="text-[13px] leading-[18px] font-semibold">{t.label}</span>
                      <span className="text-[11px] leading-[14px] text-muted">{t.sub}</span>
                    </RadioButtonGroup.ItemContent>
                  </RadioButtonGroup.Item>
                ))}
              </RadioButtonGroup>

              {tender === "cash" ? (
                <>
                  <div className="grid grid-cols-2 items-end gap-3.5">
                    <TextField
                      fullWidth
                      value={String(cash)}
                      onChange={(v) => setCash(Number.parseInt(v.replace(/[^0-9]/g, ""), 10) || 0)}
                      isInvalid={short}
                      className="gap-1"
                    >
                      <Label>Cash received (RWF)</Label>
                      <Input className="h-12 text-[20px] tabular" inputMode="numeric" />
                    </TextField>
                    <div className="flex flex-col gap-0.5 pb-1">
                      <span className="text-[12px] text-muted">{short ? "Still to pay" : "Change due"}</span>
                      <span className="text-[22px] leading-7 font-semibold tabular">{money(Math.abs(change))}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quick.map((v) => (
                      <Button key={v} variant="secondary" size="sm" onPress={() => setCash(v)}>
                        {money(v)}
                      </Button>
                    ))}
                  </div>
                </>
              ) : null}

              {tender === "mtn" || tender === "airtel" ? (
                <div className="grid grid-cols-2 gap-3.5">
                  <TextField fullWidth defaultValue={chosen.phone} className="gap-1" key={tender}>
                    <Label htmlFor="phone">Guest phone number</Label>
                    <Input id="phone" className="tabular" inputMode="tel" />
                    <Description>The guest approves on their phone with their PIN</Description>
                  </TextField>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Network</span>
                    <Chip variant="soft" className="self-start">
                      <Chip.Label>{chosen.network}</Chip.Label>
                    </Chip>
                    <Description>The provider reference is recorded when the provider confirms</Description>
                  </div>
                </div>
              ) : null}

              {tender === "card" ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Terminal</span>
                    <Select aria-label="Terminal" defaultValue={chosen.terminal} className="min-w-[220px]">
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id={chosen.terminal} textValue={chosen.terminal ?? "Terminal"}>
                            {chosen.terminal}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <GateChip icon={<ShieldExclamation className="size-3" />}>GT Bank production not verified</GateChip>
                  </div>
                  <p className="text-[13px] text-muted">
                    The amount goes to the terminal. The bill counts as paid only when GT Bank confirms the
                    authorisation.
                  </p>
                </div>
              ) : null}

              {tender === "room" ? (
                <>
                  <ItemCard variant="secondary">
                    <ItemCard.Icon>
                      <Key />
                    </ItemCard.Icon>
                    <ItemCard.Content>
                      <ItemCard.Title>{chosen.guest}</ItemCard.Title>
                      <ItemCard.Description className="whitespace-normal">{chosen.stay}</ItemCard.Description>
                    </ItemCard.Content>
                  </ItemCard>
                  <Alert status="accent">
                    <Alert.Indicator>
                      <FileCheck />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>No fiscal receipt now</Alert.Title>
                      <Alert.Description>
                        The fiscal receipt is issued once, at folio close, under Amahoro Hospitality Ltd. Fiscalising
                        here too would invoice this sale twice.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                  <Checkbox isSelected={signed} onChange={setSigned}>
                    <Checkbox.Content className="items-center gap-2">
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      Guest signed and showed the room key
                    </Checkbox.Content>
                  </Checkbox>
                </>
              ) : null}

              <div className="mt-auto flex items-center gap-2 pt-2">
                <span className="flex-1 text-[12px] text-muted">{act.hint}</span>
                <Button size="lg" isDisabled={act.disabled} onPress={take}>
                  <Icon name={act.icon} className="size-4" />
                  {act.label} · {money(due)}
                </Button>
              </div>
            </>
          ) : null}

          {nothing ? (
            <EmptyState size="sm">
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <SquareCheck />
                </EmptyState.Media>
                <EmptyState.Title>Nothing selected</EmptyState.Title>
                <EmptyState.Description>Tick the items this guest is paying for.</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          ) : null}
        </section>

        <aside aria-labelledby="fiscal-h" className="flex w-[330px] flex-none flex-col gap-2.5 overflow-y-auto p-3.5">
          <div className="flex flex-col gap-0.5">
            <h2 id="fiscal-h" className="text-[15px] leading-[22px] font-semibold">
              Fiscal receipts
            </h2>
            <span className="text-[12px] leading-4 text-muted">
              Isangano Terrace · Amahoro Hospitality Ltd · TIN 102 345 678 · device SDC-ISG-02
            </span>
          </div>
          {fiscalRows.map((fr) => (
            <article
              key={fr.id}
              className="flex flex-col gap-1.5 rounded-[14px] bg-surface p-3 px-3.5 shadow-[var(--surface-shadow)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {fr.who} · <span className="tabular">{money(fr.amount)}</span>
                </span>
                <Chip size="sm" variant="soft" color={toneColor(fr.tone)}>
                  <Chip.Label>{fr.label}</Chip.Label>
                </Chip>
              </div>
              <span className="text-[12px] leading-4 text-muted">{fr.detail}</span>
              {fr.issued && fr.receipt ? (
                <>
                  <div className="flex items-center gap-2.5 rounded-xl bg-surface-secondary p-2">
                    <Icon name="QrCode" className="size-8" />
                    <span className="flex flex-col text-[12px] leading-4 tabular">
                      <span className="font-semibold">{fr.receipt.number}</span>
                      <span className="text-muted">{fr.receipt.line}</span>
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="secondary" size="sm">
                      <Printer className="size-3.5" />
                      Print
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Icon name="PaperPlane" className="size-3.5" />
                      Send by SMS
                    </Button>
                  </div>
                </>
              ) : null}
            </article>
          ))}
          <p className="text-[12px] leading-4 text-muted">
            A payment receipt shows money received. The fiscal receipt is the tax document; only an issued one carries
            an EBM number.
          </p>
          <div className="mt-auto flex flex-col gap-1.5">
            <Button variant="secondary" size="lg" isDisabled={open > 0}>
              <Icon name="CircleCheck" className="size-4" />
              Close bill
            </Button>
            <span className="text-[12px] leading-4 text-muted">
              {open > 0
                ? "Closes when every split is paid and verified, or posted to a folio."
                : "Every split is settled. Closing archives the bill."}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
