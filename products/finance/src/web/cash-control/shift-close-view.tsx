"use client";

import { ArrowLeft, CircleCheck, EyeSlash, Moon, TriangleExclamation } from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Description,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  Separator,
  Table,
  TextArea,
  TextField,
} from "@heroui/react";
import { ListView, Segment, Stepper } from "@heroui-pro/react";
import { Icon, KeyValueList, LinkButton, PageContent, PageHeader, StatusDot } from "@injishi/ui";
import { type ReactNode, useState } from "react";
import type {
  CashDenomination,
  CashierShift,
  Check,
  ExcludedTender,
  FloatRow,
  ShiftTender,
  TillStatus,
} from "../../model/finance.ts";
import { useBoardHref, useFinanceShell } from "../mount.tsx";
import { CheckList, money, SubHeading, ToneChip } from "../parts.tsx";

interface ShiftCloseData {
  shift: CashierShift;
  denominations: CashDenomination[];
  floatRows: FloatRow[];
  tenders: ShiftTender[];
  excluded: ExcludedTender[];
  tills: TillStatus[];
}

const STEPS = [
  { label: "Opening float", sub: "What the till started with, counted and signed by both people." },
  {
    label: "Expected tenders",
    sub: "Totals come only from verified records. Anything the provider has not confirmed is listed apart and left out.",
  },
  { label: "Count cash", sub: "Count the drawer note by note. Totals update as you type." },
  { label: "Variance", sub: "Counted cash against float plus verified cash tenders." },
  { label: "Handover", sub: "What stays in the till, what goes to the safe and what the next cashier must know." },
  { label: "Approval", sub: "The cashier has signed. You approve as Finance; you are not the cashier." },
  { label: "Summary", sub: "Locked record of this close." },
];

const REASONS = ["Change given error", "Unrecorded payout", "Counting error", "Other"];

const NEXT_CASHIERS = [
  { id: "night", label: "Night desk · counts at sign-in" },
  { id: "morning", label: "Morning desk · Till 2 · counts at 06:00" },
];

function StatTile({
  label,
  value,
  foot,
  children,
}: {
  label: string;
  value: string;
  foot?: string;
  children?: ReactNode;
}) {
  return (
    <Card variant="secondary" className="gap-0.5 p-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-[17px] leading-6 font-semibold tabular">{value}</span>
      {foot ? <span className="text-[11px] text-muted">{foot}</span> : null}
      {children}
    </Card>
  );
}

export function ShiftCloseView({ data }: { data: ShiftCloseData }) {
  const screenHref = useBoardHref();
  const { TopbarStatus } = useFinanceShell();
  const { shift } = data;
  const [current, setCurrent] = useState(2);
  const [max, setMax] = useState(2);
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(data.denominations.map((d) => [d.id, d.count])),
  );
  const [saved, setSaved] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [ack, setAck] = useState(false);
  const [closed, setClosed] = useState(false);

  const counted = data.denominations.reduce((a, d) => a + d.value * (counts[d.id] ?? 0), 0);
  const variance = counted - shift.expectedCash;
  const needsRecount = Math.abs(variance) > shift.recountThreshold;
  const needsReason = variance !== 0 && !needsRecount;
  const step = closed ? 6 : current;
  const revealed = saved || step > 2;

  let nextOk = true;
  let nextLabel = "Continue";
  if (step === 2) nextLabel = "Save count";
  if (step === 3) {
    nextOk = !needsRecount;
    nextLabel = "Continue to handover";
  }
  if (step === 4) nextLabel = "Send for approval";
  if (step === 5) {
    nextOk = ack;
    nextLabel = "Approve and close shift";
  }

  const advance = () => {
    if (step === 3 && needsReason && !reason) {
      setTried(true);
      return;
    }
    if (step === 5) {
      setClosed(true);
      setCurrent(6);
      setMax(6);
      return;
    }
    const n = step + 1;
    setCurrent(n);
    setMax((m) => Math.max(m, n));
    if (step === 2) setSaved(true);
  };
  const recount = () => {
    setCurrent(2);
    setSaved(false);
    setAck(false);
  };

  const varLabel = variance === 0 ? "Balanced" : `${variance < 0 ? "Short" : "Over"} ${money(Math.abs(variance))}`;
  const varTone = variance === 0 ? "success" : needsRecount ? "danger" : "warning";
  const drop = Math.max(0, counted - shift.float);
  const excludedText = `${shift.excludedCount} · ${money(shift.excludedTotal)}`;

  const glance = [
    { label: "Opening float", value: money(shift.float) },
    { label: "Expected cash", value: revealed ? money(shift.expectedCash) : "Hidden until the count is saved" },
    { label: "Counted cash", value: revealed ? money(counted) : "Not saved yet" },
    { label: "Variance", value: revealed ? `${money(variance)}${reason ? ` · ${reason}` : ""}` : "—" },
    { label: "Verified non-cash", value: money(shift.verifiedNonCash) },
    { label: "Excluded, unverified", value: excludedText },
  ];

  const approvals: Check[] = [
    { tone: "success", label: "Cashier sign-off", detail: `${shift.cashier} · 22:09 · PIN` },
    { tone: "success", label: "Approver is not the cashier", detail: "Grace Uwera · Finance" },
    {
      tone: variance === 0 ? "success" : "warning",
      label: "Variance",
      detail: variance === 0 ? "Balanced" : `${money(variance)} · ${reason ?? "no reason recorded"}`,
    },
    {
      tone: "warning",
      label: "Excluded tenders",
      detail: `${excludedText} · stay in the Finance exception queue`,
    },
  ];

  const summaryRows = [
    { label: "Shift", value: `${shift.id} · ${shift.till} · ${shift.hours}` },
    { label: "Opening float", value: `${money(shift.float)} · stays in till` },
    { label: "Expected cash", value: money(shift.expectedCash) },
    { label: "Counted cash", value: money(counted) },
    { label: "Variance", value: variance === 0 ? "Balanced" : `${money(variance)} · ${reason ?? "—"}` },
    { label: "Safe drop", value: `${money(drop)} · bag SB-2210` },
    { label: "Verified non-cash", value: `${money(shift.verifiedNonCash)} · MoMo, Airtel, card` },
    {
      label: "Excluded",
      value: `${shift.excludedCount} unverified tenders · ${money(shift.excludedTotal)} → exceptions`,
    },
    { label: "Approved", value: "Grace Uwera · 22:14" },
  ];

  return (
    <PageContent className="text-sm">
      <TopbarStatus
        kind="chip"
        tone={closed ? "success" : "warning"}
        dot={closed ? "success" : "warning"}
        label={closed ? `${shift.till} closed 22:14` : `${shift.till} · closing`}
      />
      <PageHeader
        eyebrow="Cashiering · Isangano front desk · Monday 12 Oct · 22:06"
        title={`Close Shift · ${shift.till}`}
        description={`${shift.cashier}’s evening shift, ${shift.hours}. You witness the count and approve. This closes one till; the night audit rolls the business date separately.`}
        actions={
          <LinkButton href={screenHref("NightAudit")} variant="ghost">
            <Moon className="size-4" />
            Night audit
          </LinkButton>
        }
      />

      <Stepper
        size="sm"
        aria-label="Shift close steps"
        currentStep={step}
        onStepChange={(i) => {
          if (!closed && i <= max) setCurrent(i);
        }}
      >
        {STEPS.map((s) => (
          <Stepper.Step key={s.label}>
            <Stepper.Indicator />
            <Stepper.Content>
              <Stepper.Title>{s.label}</Stepper.Title>
            </Stepper.Content>
            <Stepper.Separator />
          </Stepper.Step>
        ))}
      </Stepper>

      <div className="flex flex-wrap items-start gap-4">
        <Card
          className="min-w-0 flex-[999_1_600px] gap-4 p-5"
          aria-labelledby="step-h"
          render={(p) => <section {...p} />}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted">Step {step + 1} of 7</span>
            <h2 id="step-h" className="text-[17px] leading-6 font-semibold">
              {STEPS[step].label}
            </h2>
            <p className="text-[13px] text-muted">{STEPS[step].sub}</p>
          </div>

          {step === 0 ? (
            <div className="flex flex-col gap-3">
              <KeyValueList
                items={[
                  { label: "Issued from safe", value: "Aline Uwase · 13:58" },
                  { label: "Counted and accepted", value: `${shift.cashier} · 14:02 · PIN signed` },
                  { label: "Float", value: <span className="tabular">{money(shift.float)}</span> },
                ]}
              />
              <Table variant="secondary">
                <Table.ScrollContainer>
                  <Table.Content aria-label="Opening float by denomination">
                    <Table.Header>
                      <Table.Column isRowHeader>Denomination</Table.Column>
                      <Table.Column className="text-right">Count</Table.Column>
                      <Table.Column className="text-right">Amount</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {data.floatRows.map((f) => (
                        <Table.Row key={f.id} id={f.id}>
                          <Table.Cell className="tabular">{f.label}</Table.Cell>
                          <Table.Cell className="text-right tabular">{f.count}</Table.Cell>
                          <Table.Cell className="text-right tabular">{money(f.amount)}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-[14px]">
              <Table variant="secondary">
                <Table.ScrollContainer>
                  <Table.Content aria-label="Verified tenders this shift">
                    <Table.Header>
                      <Table.Column isRowHeader>Tender</Table.Column>
                      <Table.Column className="text-right">Records</Table.Column>
                      <Table.Column className="text-right">Verified total</Table.Column>
                      <Table.Column>Evidence</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {data.tenders.map((t) => (
                        <Table.Row key={t.id} id={t.id}>
                          <Table.Cell>
                            <span className="flex items-center gap-2">
                              <Icon name={t.icon} className="size-4 shrink-0 text-muted" />
                              <span className="font-medium">{t.label}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell className="text-right tabular">{t.records}</Table.Cell>
                          <Table.Cell className="text-right font-semibold whitespace-nowrap tabular">
                            {money(t.amount)}
                          </Table.Cell>
                          <Table.Cell className="text-xs text-muted">{t.evidence}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
              <Card variant="secondary" className="gap-2 p-[14px]">
                <div className="flex items-center justify-between gap-2">
                  <SubHeading>Not verified · excluded from this close</SubHeading>
                  <ToneChip tone="warning" className="tabular">
                    {excludedText}
                  </ToneChip>
                </div>
                {data.excluded.map((e) => (
                  <div key={e.id} className="flex items-center gap-2.5 text-[13px] tabular">
                    <ToneChip tone={e.tone}>{e.state}</ToneChip>
                    <span className="flex-1">{e.text}</span>
                    <span className="font-medium">{money(e.amount)}</span>
                  </div>
                ))}
                <p className="text-xs leading-4 text-muted">
                  They stay with Finance as exceptions and count toward the shift in which the provider confirms them. A
                  guest’s SMS is not counted.
                </p>
              </Card>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-3">
              <Alert>
                <Alert.Indicator>
                  <EyeSlash />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Blind count</Alert.Title>
                  <Alert.Description>
                    The expected cash stays hidden until the count is saved, so the count is not anchored to it.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
              <div className="grid gap-x-5 gap-y-2 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
                {data.denominations.map((d) => (
                  <div key={d.id} className="flex items-center gap-2.5 py-1">
                    <NumberField
                      value={counts[d.id] ?? 0}
                      minValue={0}
                      onChange={(n) => {
                        setCounts((c) => ({ ...c, [d.id]: Number.isFinite(n) ? Math.max(0, Math.floor(n ?? 0)) : 0 }));
                        setSaved(false);
                      }}
                      className="flex flex-row items-center gap-2.5"
                    >
                      <Label className="w-24 tabular">{d.label}</Label>
                      <NumberField.Group className="w-[88px]">
                        <NumberField.Input className="text-right tabular" />
                      </NumberField.Group>
                    </NumberField>
                    <span className="flex-1 text-right text-[13px] text-muted tabular">
                      {money(d.value * (counts[d.id] ?? 0))}
                    </span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">Counted cash</span>
                <span className="text-xl leading-7 font-semibold tabular">{money(counted)}</span>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-[14px]">
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr))]">
                <StatTile label="Expected in drawer" value={money(shift.expectedCash)} foot="Float + verified cash" />
                <StatTile label="Counted" value={money(counted)} foot="Witnessed by you" />
                <StatTile label="Variance" value={money(variance)}>
                  <ToneChip tone={varTone} className="mt-1 self-start">
                    {varLabel}
                  </ToneChip>
                </StatTile>
              </div>
              {needsRecount ? (
                <Alert status="danger" role="alert">
                  <Alert.Indicator>
                    <TriangleExclamation />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Recount required</Alert.Title>
                    <Alert.Description>
                      Variances above RWF 5,000 need a second count before a reason can be recorded (configured cash
                      policy v1).
                    </Alert.Description>
                  </Alert.Content>
                  <Button size="sm" variant="secondary" className="self-start" onPress={recount}>
                    Recount
                  </Button>
                </Alert>
              ) : null}
              {needsReason ? (
                <div className="flex flex-col gap-1.5">
                  <span id="why-l" className="text-sm font-medium">
                    Reason for the variance
                  </span>
                  <Segment
                    aria-labelledby="why-l"
                    // No reason is chosen at first. Segment turns a null key into "uncontrolled", so pass the
                    // (possibly empty) selection straight to the underlying ToggleButtonGroup to stay controlled.
                    {...{ selectedKeys: reason ? [reason] : [] }}
                    onSelectionChange={(k) => {
                      setReason(String(k));
                      setTried(false);
                    }}
                    className="self-start"
                  >
                    {REASONS.map((r) => (
                      <Segment.Item key={r} id={r}>
                        {r}
                      </Segment.Item>
                    ))}
                  </Segment>
                  {tried && !reason ? (
                    <span role="alert" className="text-xs text-danger">
                      Choose a reason to continue.
                    </span>
                  ) : null}
                  <TextField
                    fullWidth
                    className="mt-1.5"
                    defaultValue="Gave RWF 2,000 too much change on a RWF 8,000 Lake Bar payment around 19:40. Guest not identifiable."
                  >
                    <Label>Note</Label>
                    <TextArea rows={2} />
                  </TextField>
                </div>
              ) : null}
              {variance === 0 ? (
                <Alert status="success">
                  <Alert.Indicator>
                    <CircleCheck />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Drawer balances</Alert.Title>
                    <Alert.Description>Counted cash equals float plus verified cash tenders.</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
                <Card variant="secondary" className="gap-1 p-[14px]">
                  <span className="text-xs text-muted">Float stays in {shift.till}</span>
                  <span className="text-[17px] leading-6 font-semibold tabular">{money(shift.float)}</span>
                  <span className="text-xs leading-4 text-muted">The night desk counts and accepts it at sign-in.</span>
                </Card>
                <Card variant="secondary" className="gap-1 p-[14px]">
                  <span className="text-xs text-muted">Safe drop</span>
                  <span className="text-[17px] leading-6 font-semibold tabular">{money(drop)}</span>
                  <span className="text-xs leading-4 text-muted">Counted cash minus float, sealed and witnessed.</span>
                </Card>
              </div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
                <TextField fullWidth defaultValue="SB-2210">
                  <Label>Sealed bag number</Label>
                  <Input className="tabular" />
                  <Description>Printed on the tamper-evident bag</Description>
                </TextField>
                <Select fullWidth defaultValue="night">
                  <Label>Next cashier</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {NEXT_CASHIERS.map((c) => (
                        <ListBox.Item key={c.id} id={c.id} textValue={c.label}>
                          {c.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <TextField
                fullWidth
                defaultValue="Room 112 Lake Bar tab still open: Airtel payment RWF 65,000 is Unknown. Do not take a second payment until Finance resolves it. Card for room 309 still waiting for 3-D Secure."
              >
                <Label>Handover notes</Label>
                <TextArea rows={3} />
              </TextField>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="flex flex-col gap-3">
              <CheckList items={approvals} />
              <Checkbox isSelected={ack} onChange={setAck} className="rounded-xl px-2 py-1.5">
                <Checkbox.Content className="flex items-center gap-2">
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  I witnessed the count, reviewed the variance reason and the excluded tenders
                </Checkbox.Content>
              </Checkbox>
            </div>
          ) : null}

          {step === 6 ? (
            <div className="flex flex-col gap-3">
              <Alert status="success" role="status">
                <Alert.Indicator>
                  <CircleCheck />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Shift {shift.id} closed at 22:14</Alert.Title>
                  <Alert.Description>
                    Approved by Grace Uwera. The count sheet, variance reason and bag number are locked in the audit
                    log.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
              <KeyValueList
                items={summaryRows.map((r) => ({ label: r.label, value: <span className="tabular">{r.value}</span> }))}
              />
              <p className="text-xs leading-4 text-muted">
                The business date does not change here. The night audit at 23:30 checks that every till is closed before
                it rolls to 13 Oct.
              </p>
            </div>
          ) : null}

          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {step > 0 && step < 6 ? (
              <Button variant="ghost" onPress={() => setCurrent(Math.max(0, step - 1))}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
            ) : null}
            <span className="flex-1" />
            {step === 5 ? (
              <Button variant="secondary" onPress={recount}>
                Send back for recount
              </Button>
            ) : null}
            {step < 6 ? (
              <Button isDisabled={!nextOk} onPress={advance}>
                {nextLabel}
              </Button>
            ) : (
              <LinkButton href={screenHref("NightAudit")}>Go to night audit</LinkButton>
            )}
          </div>
        </Card>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <Card className="gap-3 p-[18px]" aria-labelledby="sg-h" render={(p) => <section {...p} />}>
            <div className="flex items-center gap-2.5">
              <Avatar size="sm" variant="soft" color="accent">
                <Avatar.Fallback>{shift.initials}</Avatar.Fallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <h2 id="sg-h" className="text-sm leading-5 font-semibold">
                  {shift.cashier} · {shift.till}
                </h2>
                <span className="text-xs text-muted">Signed out 22:06 · {shift.hours}</span>
              </div>
            </div>
            <KeyValueList
              items={glance.map((g) => ({ label: g.label, value: <span className="tabular">{g.value}</span> }))}
            />
          </Card>
          <Card variant="secondary" className="gap-2.5 p-4" aria-labelledby="ot-h" render={(p) => <section {...p} />}>
            <h2 id="ot-h" className="text-sm leading-5 font-semibold">
              Other Tills Today
            </h2>
            <ListView aria-label="Other tills today" variant="secondary" items={data.tills}>
              {(t) => (
                <ListView.Item id={t.id} textValue={t.name}>
                  <ListView.ItemContent>
                    <StatusDot tone={t.tone} />
                    <div className="flex min-w-0 flex-col">
                      <ListView.Title>{t.name}</ListView.Title>
                      <ListView.Description>{t.meta}</ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction>
                    <ToneChip tone={t.tone}>{t.state}</ToneChip>
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
          </Card>
        </div>
      </div>
    </PageContent>
  );
}
