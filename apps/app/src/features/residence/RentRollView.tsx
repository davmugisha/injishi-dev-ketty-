"use client";

import { ArrowDownToLine, Bell, CircleCheck, Lock, Plus } from "@gravity-ui/icons";
import {
  Button,
  Card,
  Description,
  FieldError,
  Input,
  Label,
  Table,
  Tabs,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { KPIGroup, ListView, Timeline } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { type Persona, screenHref } from "@injishi/data";
import type {
  LandlordPayout,
  LedgerEntry,
  RentKpi,
  RentLedger,
  RentMonth,
  RentRollRow,
  RentStatus,
  Tone,
} from "@injishi/data/fixtures/residence";
import { GateChip, Icon, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { Fragment, useState } from "react";
import { readFrancs } from "@/lib/francs";
import { recordPaymentAction, remindResidentsAction } from "./actions";
import {
  Dot,
  downloadCsv,
  FormDialog,
  firstKey,
  kigaliCalendar,
  Legend,
  lineTab,
  money,
  SelectField,
  SubHeading,
  selectableRow,
  TabCount,
  ToneChip,
} from "./shared";

export interface RentRollData {
  kpis: RentKpi[];
  rows: RentRollRow[];
  ledgers: RentLedger[];
  payouts: LandlordPayout[];
}

type Filter = "all" | "arrears" | "due" | "pending" | "paid" | "none";

const STATUS: Record<RentStatus, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "success" },
  arrears: { label: "In arrears", tone: "danger" },
  pending: { label: "Pending", tone: "info" },
  unknown: { label: "Unknown", tone: "warning" },
};
/**
 * A charge open and not yet overdue with no payment recorded against it: the roll calls it pending, but nothing
 * is in flight (this month reads "unpaid"), so it is due, not awaiting verification.
 */
const dueUnpaid = (r: RentRollRow) => r.status === "pending" && r.history[r.history.length - 1] === "unpaid";
const DUE: { label: string; tone: Tone } = { label: "Due · not paid", tone: "default" };
/**
 * No rent charge raised this month (this month reads "none"): the roll calls it paid, but nothing was charged or
 * paid. The API raises a lease's first charge only, so from the second month this is most leases not overdue.
 */
const noCharge = (r: RentRollRow) => r.status === "paid" && r.history[r.history.length - 1] === "none";
const NO_CHARGE: { label: string; tone: Tone } = { label: "No charge this month", tone: "default" };
const stateOf = (r: RentRollRow) => (dueUnpaid(r) ? DUE : noCharge(r) ? NO_CHARGE : STATUS[r.status]);
const MONTH_TONE: Record<RentMonth, Tone> = {
  paid: "success",
  late: "accent",
  unpaid: "danger",
  pending: "info",
  unknown: "warning",
  none: "default",
};
const MONTH_WORD: Record<RentMonth, string> = {
  paid: "paid",
  late: "paid late",
  unpaid: "unpaid or part-paid",
  pending: "pending verification",
  unknown: "result unknown",
  none: "no charge",
};
const LEGEND: { tone: Tone; label: string }[] = [
  { tone: "success", label: "Paid on time" },
  { tone: "accent", label: "Paid late" },
  { tone: "danger", label: "Unpaid or part-paid" },
  { tone: "info", label: "Pending verification" },
  { tone: "warning", label: "Result unknown" },
  { tone: "default", label: "No charge that month" },
];
const FILTERS: { id: Filter; label: string; test: (r: RentRollRow) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "arrears", label: "Arrears", test: (r) => r.status === "arrears" },
  { id: "due", label: "Due, not paid", test: dueUnpaid },
  {
    id: "pending",
    label: "Awaiting verification",
    test: (r) => (r.status === "pending" && !dueUnpaid(r)) || r.status === "unknown",
  },
  { id: "paid", label: "Paid", test: (r) => r.status === "paid" && !noCharge(r) },
  { id: "none", label: "No charge this month", test: noCharge },
];
const METHODS = ["Bank transfer", "MTN MoMo", "Airtel Money", "Cash at the office"];
/** The default reminder names the building the roll is for and no one in particular; the manager may edit it. */
const reminderText = (building: string) =>
  `Hello, your rent balance${building ? ` at ${building}` : ""} is overdue. Please pay by bank transfer or at the office, or contact management to agree a plan.`;

/**
 * The ledger of a lease with nothing outstanding (the API details only leases with an open charge). It states
 * only what the roll row holds: this month's charge closed by the verified payments counted against it, or no
 * charge open at all. It names no payment reference it was not given.
 */
function closedLedger(row: RentRollRow, month: string): LedgerEntry[] {
  if (row.verified <= 0) {
    return [
      {
        icon: "FileDollar",
        title: `${month} rent`,
        desc: "No unpaid charge on this lease",
        amount: 0,
        state: "Nothing open",
        tone: "default",
      },
    ];
  }
  return [
    {
      icon: "FileDollar",
      title: `${month} rent`,
      desc: `Due on the ${row.due} · closed by verified payments`,
      amount: row.verified,
      state: "Closed",
      tone: "success",
    },
    {
      icon: "Receipt",
      title: "Verified payments",
      desc: `Allocated to ${month} rent`,
      amount: row.verified,
      state: "Verified",
      tone: "success",
    },
  ];
}

export function RentRollView({
  persona,
  data,
  building = "",
}: {
  persona: Persona;
  data: RentRollData;
  /** The building(s) this roll covers, from the session's workspace. */
  building?: string;
}) {
  // The roll's month and its four-month history are this month's in Kigali, not the prototype's October.
  const cal = kigaliCalendar();
  const MONTHS = cal.lastFourMonths;
  const [filter, setFilter] = useState<Filter>("all");
  // Opens on the first lease in arrears, else the first row (the prototype opened on "A-03").
  const [sel, setSel] = useState(() => (data.rows.find((r) => r.status === "arrears") ?? data.rows[0])?.id ?? "");
  const [recordOpen, setRecordOpen] = useState(false);
  const [record, setRecord] = useState({ method: METHODS[0], amount: "", ref: "" });
  const [remindFor, setRemindFor] = useState<string[] | null>(null);
  const [message, setMessage] = useState(() => reminderText(building));
  const [busy, setBusy] = useState(false);

  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, data.rows.filter(f.test).length])) as Record<
    Filter,
    number
  >;
  const row = data.rows.find((r) => r.id === sel) ?? data.rows[0];
  const detail = data.ledgers.find((l) => l.id === row.id);
  // The ledger and the reminders are the API's: a saved payment or a sent reminder comes back with the page.
  const ledger = detail?.ledger ?? closedLedger(row, cal.month);
  const reminders = detail?.reminders ?? [];
  const status = stateOf(row);
  const balanceLabel =
    row.status === "arrears"
      ? "Overdue balance"
      : noCharge(row)
        ? "No charge raised this month"
        : row.status === "paid"
          ? "Balance"
          : dueUnpaid(row)
            ? "Balance due · no payment recorded"
            : "Balance · payment in flight";
  const balance = row.overdue
    ? money(row.overdue)
    : noCharge(row)
      ? "Nothing charged or paid"
      : row.status === "paid"
        ? "RWF 0"
        : `${money(row.rent)} open, not overdue`;

  const arrears = data.rows
    .filter((r) => r.status === "arrears")
    .map((r) => {
      const history = data.ledgers.find((l) => l.id === r.id)?.reminders ?? [];
      const latest = history[history.length - 1];
      const last = latest?.when.split(" · ")[0] ?? "never";
      return { ...r, last };
    });
  const recipients = arrears.filter((a) => remindFor?.includes(a.id));

  // Whole francs as typed: "20000.5" is refused, never read as 200,005 (lib/francs).
  const { amount, error: amountError } = readFrancs(record.amount);
  const canSave = amount > 0 && !amountError && record.ref.trim().length > 2;
  /**
   * Save as pending (`POST /ops/residence/rent-payments`). The Idempotency-Key is minted here, once per
   * press, so a request the network retries is still one payment.
   */
  const saveRecord = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    const result = await recordPaymentAction(
      { unit: row.id, amountRwf: amount, method: record.method, providerRef: record.ref.trim() },
      crypto.randomUUID(),
    );
    setBusy(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setRecord({ method: METHODS[0], amount: "", ref: "" });
    setRecordOpen(false);
    toast.success(`${money(amount)} saved as pending for ${row.id} · not counted until verified`, {
      indicator: <CircleCheck className="size-4" />,
    });
  };

  /** Send reminders (`POST /ops/residence/rent-reminders`); each lands in that lease's reminder history. */
  const sendReminders = async () => {
    const ids = recipients.map((r) => r.id);
    if (busy) return;
    setBusy(true);
    const result = await remindResidentsAction(ids, message);
    setBusy(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setRemindFor(null);
    toast.success(
      `${ids.length} ${ids.length === 1 ? "reminder" : "reminders"} recorded · residents who use the app see it there`,
      { indicator: <CircleCheck className="size-4" /> },
    );
  };

  const exportCsv = () =>
    downloadCsv(`rent-roll-${cal.iso.slice(0, 7)}.csv`, [
      ["Unit", "Resident", "Lease", "Due", ...MONTHS, `${cal.month} charge`, "Verified", "Overdue", "Status"],
      ...data.rows.map((r) => [
        r.id,
        r.name,
        r.lease,
        r.due,
        ...r.history.map((h) => MONTH_WORD[h]),
        r.rent,
        r.verified,
        r.overdue,
        stateOf(r).label,
      ]),
    ]);

  return (
    <PageContent>
      <PageHeader
        eyebrow={`Tenancy · ${cal.month} ${cal.year}${building ? ` · ${building}` : ""}`}
        title="Rent Roll"
        description={`Scheduled rent from ${data.rows.length} active leases. A charge closes only when verified payments cover it in full.`}
        actions={
          <>
            <Button variant="secondary" onPress={exportCsv}>
              <ArrowDownToLine className="size-4" />
              Export
            </Button>
            <Button onPress={() => setRemindFor(arrears.map((a) => a.id))}>
              <Bell className="size-4" />
              Remind residents in arrears
            </Button>
          </>
        }
      />

      <section aria-label={`${cal.month} rent figures`}>
        <KPIGroup className="flex-wrap">
          {data.kpis.map((k, i) => (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="min-w-[min(170px,100%)] flex-[1_1_170px]">
                <KPI.Header>
                  <KPI.Title>{k.label}</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                  <KPI.Value
                    value={k.value}
                    formatOptions={{ style: "currency", currency: "RWF" }}
                    className="text-[22px] tabular"
                  />
                </KPI.Content>
                <KPI.Footer>
                  <p className="text-[12px] leading-4 text-muted">{k.foot}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <div className="grid items-start gap-[16px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Tabs variant="secondary" selectedKey={filter} onSelectionChange={(k) => setFilter(String(k) as Filter)}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Filter rent roll">
                {FILTERS.map((f) => (
                  <Tabs.Tab key={f.id} id={f.id} className={lineTab}>
                    {f.label}
                    <TabCount>{counts[f.id]}</TabCount>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {FILTERS.map((f) => (
              <Tabs.Panel key={f.id} id={f.id} className="pt-3">
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content
                      aria-label="Rent roll"
                      selectionMode="single"
                      selectionBehavior="replace"
                      disallowEmptySelection
                      selectedKeys={new Set([row.id])}
                      onSelectionChange={(keys) => {
                        const k = firstKey(keys);
                        if (k) {
                          setSel(k);
                          setRecordOpen(false);
                        }
                      }}
                    >
                      <Table.Header>
                        <Table.Column isRowHeader>Unit</Table.Column>
                        <Table.Column>Resident</Table.Column>
                        <Table.Column>{`${MONTHS[0].slice(0, 3)}–${MONTHS[3].slice(0, 3)}`}</Table.Column>
                        <Table.Column className="text-right">{`${cal.month} charge`}</Table.Column>
                        <Table.Column className="text-right">Overdue</Table.Column>
                        <Table.Column>Status</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {data.rows.filter(f.test).map((r) => (
                          <Table.Row key={r.id} id={r.id} className={selectableRow}>
                            <Table.Cell>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="font-semibold tabular"
                                aria-label={`Open ${r.id} ledger`}
                                onPress={() => {
                                  setSel(r.id);
                                  setRecordOpen(false);
                                }}
                              >
                                {r.id}
                              </Button>
                            </Table.Cell>
                            <Table.Cell className="font-medium whitespace-nowrap">{r.name}</Table.Cell>
                            <Table.Cell>
                              <span
                                className="flex items-center gap-[5px]"
                                role="img"
                                aria-label={r.history.map((h, i) => `${MONTHS[i]} ${MONTH_WORD[h]}`).join(", ")}
                              >
                                {r.history.map((h, i) => (
                                  <Dot key={MONTHS[i]} tone={MONTH_TONE[h]} />
                                ))}
                              </span>
                            </Table.Cell>
                            <Table.Cell className="text-right whitespace-nowrap tabular">{money(r.rent)}</Table.Cell>
                            <Table.Cell className="text-right font-medium whitespace-nowrap tabular">
                              {r.overdue ? money(r.overdue) : "—"}
                            </Table.Cell>
                            <Table.Cell>
                              <ToneChip tone={stateOf(r).tone} className="whitespace-nowrap">
                                {stateOf(r).label}
                              </ToneChip>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </Tabs.Panel>
            ))}
          </Tabs>
          <Legend items={LEGEND} className="gap-x-[14px]" />
        </div>

        <div className="flex min-w-0 flex-col gap-[16px]">
          <Card className="gap-[14px] p-[18px]" aria-labelledby="led-h" render={(p) => <aside {...p} />}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[12px] text-muted tabular">
                  {row.id} · {row.lease}
                </span>
                <h2 id="led-h" className="text-[17px] leading-6 font-semibold">
                  {row.name}
                </h2>
                <span className="text-[12px] text-muted tabular">
                  {money(row.rent)} a month · due on the {row.due}
                </span>
              </div>
              <ToneChip tone={status.tone} size="md" className="shrink-0">
                {status.label}
              </ToneChip>
            </div>
            <Card variant="secondary" className="gap-0.5 px-[14px] py-3">
              <span className="text-[12px] text-muted">{balanceLabel}</span>
              <span className="text-[22px] leading-7 font-semibold tabular">{balance}</span>
            </Card>

            <div className="flex flex-col gap-2">
              <SubHeading className="text-sm leading-5">Charges and payment allocation</SubHeading>
              <ListView
                aria-label="Charges and payment allocation"
                variant="secondary"
                items={ledger.map((l, i) => ({ ...l, id: `${l.title}-${i}` }))}
              >
                {(l) => (
                  <ListView.Item id={l.id} textValue={l.title} className="items-start">
                    <ListView.ItemContent className="items-start">
                      <Icon name={l.icon} className="mt-0.5 size-4 shrink-0 text-muted" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>{l.title}</ListView.Title>
                        <ListView.Description className="whitespace-normal tabular">{l.desc}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction className="flex flex-col items-end gap-1">
                      <span className="font-medium whitespace-nowrap tabular">{money(l.amount)}</span>
                      <ToneChip tone={l.tone}>{l.state}</ToneChip>
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
              <p className="text-[12px] leading-4 text-muted">
                Payments go to the oldest open charge first. A partial payment reduces the balance but never closes the
                charge.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <SubHeading className="text-sm leading-5">Reminder history</SubHeading>
              {reminders.length ? (
                <Timeline size="sm" density="compact" aria-label={`Reminders to ${row.name}`}>
                  {reminders.map((m) => (
                    <Timeline.Item key={`${m.title}-${m.when}`} status={m.status}>
                      <Timeline.Rail>
                        <Timeline.Marker />
                        <Timeline.Connector />
                      </Timeline.Rail>
                      <Timeline.Content className="flex flex-col pb-0.5">
                        <span className="text-[13px] leading-[18px] font-medium">{m.title}</span>
                        <span className="text-[12px] leading-4 text-muted tabular">{m.when}</span>
                      </Timeline.Content>
                    </Timeline.Item>
                  ))}
                </Timeline>
              ) : (
                <p className="text-[13px] text-muted">No reminders sent for this lease yet.</p>
              )}
            </div>

            {recordOpen ? (
              <Card variant="secondary" className="gap-2.5 p-[14px]">
                <SubHeading className="text-sm leading-5">Record a payment received outside the app</SubHeading>
                <div className="grid grid-cols-2 gap-2.5">
                  <SelectField
                    label="Method"
                    value={record.method}
                    options={METHODS}
                    onChange={(method) => setRecord((s) => ({ ...s, method }))}
                  />
                  <TextField
                    fullWidth
                    value={record.amount}
                    onChange={(v) => setRecord((s) => ({ ...s, amount: v }))}
                    isInvalid={!!amountError}
                    className="gap-1"
                  >
                    <Label>Amount (RWF)</Label>
                    <Input inputMode="numeric" placeholder="0" className="tabular" />
                    <FieldError>{amountError}</FieldError>
                  </TextField>
                </div>
                <TextField
                  fullWidth
                  value={record.ref}
                  onChange={(v) => setRecord((s) => ({ ...s, ref: v }))}
                  className="gap-1"
                >
                  <Label>Bank or provider reference</Label>
                  <Input placeholder="From the bank slip or SMS" />
                  <Description>
                    Saved as Pending. Matching it to a bank statement or provider report is not available yet.
                  </Description>
                </TextField>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onPress={() => setRecordOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" isDisabled={!canSave || busy} onPress={saveRecord}>
                    Save as pending
                  </Button>
                </div>
              </Card>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onPress={() => setRecordOpen(true)} isDisabled={recordOpen}>
                <Plus className="size-4" />
                Record payment
              </Button>
              <Button
                size="sm"
                variant="ghost"
                isDisabled={row.status !== "arrears"}
                onPress={() => setRemindFor([row.id])}
              >
                <Bell className="size-4" />
                Send reminder
              </Button>
              <LinkButton href={screenHref("Leases")} size="sm" variant="ghost">
                Lease
              </LinkButton>
            </div>
          </Card>

          <Card className="gap-3 p-[18px]" aria-labelledby="pay-h" render={(p) => <section {...p} />}>
            <div className="flex flex-col gap-1.5">
              <h2 id="pay-h" className="text-[15px] leading-[22px] font-semibold">
                Landlord Settlement
              </h2>
              <span className="text-[12px] leading-4 text-muted">
                Executed by Payments. Residence sees the status but cannot start or change a payout.
              </span>
              <GateChip icon={<Lock className="size-3" />} className="self-start">
                Payouts and escrow · GT Bank capability not confirmed
              </GateChip>
            </div>
            {data.payouts.map((p) => (
              <Card key={p.id} variant="secondary" className="gap-1 px-[14px] py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">{p.title}</span>
                  <ToneChip tone={p.tone}>{p.state}</ToneChip>
                </div>
                <span className="text-base font-semibold tabular">{money(p.amount)}</span>
                <span className="text-[12px] leading-4 text-muted tabular">{p.desc}</span>
              </Card>
            ))}
          </Card>
        </div>
      </div>

      <FormDialog
        isOpen={remindFor !== null}
        onOpenChange={(open) => (open ? null : setRemindFor(null))}
        title="Send rent reminders"
        description="Shown in the resident app to residents who use it · email and SMS are not available yet"
        footer={
          <>
            <Button variant="secondary" onPress={() => setRemindFor(null)}>
              Cancel
            </Button>
            <Button onPress={sendReminders} isDisabled={!recipients.length || !message.trim() || busy}>
              Send {recipients.length} {recipients.length === 1 ? "reminder" : "reminders"}
            </Button>
          </>
        }
      >
        <ListView aria-label="Residents to remind" variant="secondary" items={recipients}>
          {(a) => (
            <ListView.Item id={a.id} textValue={a.name}>
              <ListView.ItemContent>
                <span className="min-w-10 text-[15px] font-semibold tabular">{a.id}</span>
                <div className="flex min-w-0 flex-col">
                  <ListView.Title>{a.name}</ListView.Title>
                  <ListView.Description className="tabular">Last reminder {a.last}</ListView.Description>
                </div>
              </ListView.ItemContent>
              <ListView.ItemAction className="font-medium whitespace-nowrap tabular">
                {money(a.overdue)}
              </ListView.ItemAction>
            </ListView.Item>
          )}
        </ListView>
        <TextField fullWidth value={message} onChange={setMessage} className="gap-1">
          <Label>Message</Label>
          <TextArea rows={3} />
          <Description>No late fee is added. Late fees are not configured for this property.</Description>
        </TextField>
      </FormDialog>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
