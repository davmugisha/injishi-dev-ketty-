"use client";

import {
  ArrowDownToLine,
  ArrowUpRightFromSquare,
  CircleCheck,
  CircleInfo,
  Envelope,
  Lock,
  Tray,
} from "@gravity-ui/icons";
import { Alert, Button, Card, Checkbox, Chip, Modal, Table } from "@heroui/react";
import { EmptyState, ListView, Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { CommissionLine, LogEntry, Payout, Tone } from "@injishi/data/fixtures/accounting";
import { KeyValueList, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { useState } from "react";
import { firstKey, type KpiItem, KpiStrip, LogTimeline, Note, rwf, Stack } from "./shared";

type Stage = "await" | "hold" | "approved" | "second";

const STAGE: Record<Stage, { label: string; tone: Tone }> = {
  await: { label: "Awaiting approval", tone: "warning" },
  hold: { label: "On hold", tone: "default" },
  approved: { label: "Approved payable", tone: "accent" },
  second: { label: "Awaiting second approver", tone: "warning" },
};

const PAYOUT_STATE: Record<Payout["status"], { label: string; tone: Tone; filter: string }> = {
  scheduled: { label: "Scheduled", tone: "default", filter: "Scheduled" },
  sent: { label: "Sent · awaiting bank", tone: "warning", filter: "Sent" },
  confirmed: { label: "Confirmed by bank", tone: "success", filter: "Confirmed" },
  failed: { label: "Failed", tone: "danger", filter: "Failed" },
};

const PAYEE_FILTERS = [
  { id: "all", label: "All" },
  { id: "agent", label: "Travel agents" },
  { id: "broker", label: "Residence brokers" },
] as const;

/** Commissions above this need a second approver. */
const SECOND_APPROVAL_OVER = 150000;

interface Row extends CommissionLine {
  amount: number;
  stage: Stage;
  settle: string;
  history: LogEntry[];
  eligible: boolean;
  hint: string;
}

export function CommissionsView({ lines, payouts }: { lines: CommissionLine[]; payouts: Payout[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [sel, setSel] = useState(lines[0]?.id ?? "");
  // Lines that can be approved now (tax document on file) start selected, as on the board.
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(lines.filter((c) => c.status === "await" && c.hasTaxDocument).map((c) => [c.id, true])),
  );
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pay, setPay] = useState<string>("all");

  const all: Row[] = lines.map((c) => {
    const amount = Math.round((c.basis * c.rate) / 100);
    const big = amount > SECOND_APPROVAL_OVER;
    let stage: Stage = c.status;
    let settle = c.settlement;
    const history = [...c.log];
    if (approved[c.id]) {
      stage = big ? "second" : "approved";
      settle = big ? "Waiting for Didier Mugenzi as second approver" : "Handed to Payments · not yet scheduled";
      history.push({
        status: "current",
        title: "12 Oct 10:22 · Approved by you",
        detail: big ? "Second approver needed above RWF 150,000" : "Payable created in the ledger",
      });
    }
    if (requested[c.id])
      history.push({
        status: "current",
        title: "12 Oct 10:21 · Invoice requested again",
        detail: `Email to ${c.invoiceContact ?? "the payee"}`,
      });
    const hint =
      stage === "await"
        ? c.hasTaxDocument
          ? "Tax document on file"
          : "Tax document missing"
        : stage === "hold"
          ? (c.holdHint ?? "")
          : settle.split(" · ")[0];
    return { ...c, amount, stage, settle, history, eligible: stage === "await" && c.hasTaxDocument, hint };
  });
  const shown = all.filter((c) => filter === "all" || c.kind === filter);
  const cur = shown.find((c) => c.id === sel) ?? shown[0];
  const chosen = all.filter((c) => c.eligible && checked[c.id]);
  const sum = (rows: Row[]) => rows.reduce((t, c) => t + c.amount, 0);

  const kpis: KpiItem[] = [
    {
      id: "open",
      label: "Open commissions",
      value: sum(all),
      format: "rwf",
      foot: `${all.length} lines · agents and brokers`,
      icon: "Sack",
      status: "default",
    },
    {
      id: "awaiting",
      label: "Awaiting approval",
      value: sum(all.filter((c) => c.stage === "await" || c.stage === "second")),
      format: "rwf",
      foot: `${all.filter((c) => c.stage === "await" && !c.hasTaxDocument).length} blocked by a missing tax document`,
      icon: "Clock",
      status: "warning",
    },
    {
      id: "approved",
      label: "Approved, not yet paid",
      value: sum(all.filter((c) => c.stage === "approved")),
      format: "rwf",
      foot: "Scheduled or sent by Payments",
      icon: "CircleCheck",
      status: "default",
    },
    {
      id: "hold",
      label: "On hold",
      value: sum(all.filter((c) => c.stage === "hold")),
      format: "rwf",
      foot: "A refund decision and a broker dispute",
      icon: "CirclePause",
      status: "default",
    },
  ];

  const payRows = payouts.filter((p) => pay === "all" || p.status === pay);
  const payFilters = [
    { id: "all", label: `All ${payouts.length}` },
    ...(["scheduled", "sent", "confirmed", "failed"] as const).map((s) => ({
      id: s,
      label: `${PAYOUT_STATE[s].filter} ${payouts.filter((p) => p.status === s).length}`,
    })),
  ];

  const openDialog = () => {
    if (!chosen.length) return;
    setConfirm(false);
    setDialog(true);
  };

  let note = "";
  if (cur) {
    if (cur.stage === "await" && !cur.hasTaxDocument)
      note = "Approval unlocks when the agent’s commission invoice is on file.";
    else if (cur.stage === "await") note = `Approving records a payable owed by ${cur.payer}. It cannot release money.`;
    else if (cur.stage === "hold") note = cur.holdReason ?? "";
    else if (cur.stage === "approved")
      note = "Payments executes the transfer. This shows Paid only when the bank or provider confirms.";
    else note = "Your approval is recorded. A second approver is required above RWF 150,000.";
  }
  const curStage = cur ? STAGE[cur.stage] : null;

  return (
    <PageContent>
      <PageHeader
        eyebrow="October 2026 · Receivables & ledger"
        title="Commissions & Payouts"
        actions={
          <>
            <Button variant="secondary">
              <ArrowDownToLine className="size-4" aria-hidden="true" />
              Export statements
            </Button>
            <Button isDisabled={!chosen.length} onPress={openDialog}>
              <CircleCheck className="size-4" aria-hidden="true" />
              Approve selected ({chosen.length})
            </Button>
          </>
        }
      />

      <Alert>
        <Alert.Indicator>
          <CircleInfo />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Approval creates a payable. It never sends money.</Alert.Title>
          <Alert.Description>
            A payments approver schedules each transfer in Payments. Until GT Bank production access is verified,
            transfers are made in the bank portal and recorded here only with statement evidence.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <KpiStrip items={kpis} label="Commission summary" minWidth="200px" />

      <div className="flex flex-wrap items-start gap-4">
        <section aria-labelledby="cm-h" className="flex min-w-0 flex-[999_1_640px] flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="cm-h" className="text-[15px] leading-[22px] font-semibold">
              Commissions Payable
            </h2>
            <Segment aria-label="Payee type" selectedKey={filter} onSelectionChange={(k) => setFilter(String(k))}>
              {PAYEE_FILTERS.map((f) => (
                <Segment.Item key={f.id} id={f.id}>
                  {f.label}
                </Segment.Item>
              ))}
            </Segment>
          </div>
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                className="min-w-[720px]"
                aria-label="Commissions payable"
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={cur ? new Set([cur.id]) : new Set()}
                onSelectionChange={(keys) => {
                  const id = firstKey(keys);
                  if (id) setSel(id);
                }}
              >
                <Table.Header>
                  <Table.Column className="w-9 pe-0">
                    <span className="sr-only">Select</span>
                  </Table.Column>
                  <Table.Column isRowHeader>Payee</Table.Column>
                  <Table.Column>Source</Table.Column>
                  <Table.Column className="text-right">Basis × rate</Table.Column>
                  <Table.Column className="text-right">Commission</Table.Column>
                  <Table.Column>Status</Table.Column>
                </Table.Header>
                <Table.Body>
                  {shown.map((c) => {
                    const st = STAGE[c.stage];
                    return (
                      <Table.Row key={c.id} id={c.id} className="cursor-pointer">
                        <Table.Cell className="pe-0">
                          <Checkbox
                            aria-label={`Select ${c.payee}, ${c.source}`}
                            isSelected={c.eligible && Boolean(checked[c.id])}
                            isDisabled={!c.eligible}
                            onChange={(on) => setChecked((o) => ({ ...o, [c.id]: on }))}
                            variant="secondary"
                          >
                            <Checkbox.Content>
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox.Content>
                          </Checkbox>
                        </Table.Cell>
                        <Table.Cell>
                          <Stack
                            primary={c.payee}
                            primaryClassName="font-medium"
                            secondary={`${c.role} · paid by ${c.payer.replace(/^Amahoro /, "")}`}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Stack primary={`${c.source} · ${c.guest}`} primaryClassName="tabular" secondary={c.stay} />
                        </Table.Cell>
                        <Table.Cell className="text-right text-xs text-muted tabular">
                          {rwf(c.basis)} × {c.rate}%
                        </Table.Cell>
                        <Table.Cell className="text-right font-medium tabular">{rwf(c.amount)}</Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col gap-0.5">
                            <Chip size="sm" variant="soft" color={toneColor(st.tone)} className="self-start">
                              {st.label}
                            </Chip>
                            <span className="text-xs text-muted">{c.hint}</span>
                          </span>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <Note>
            Accrued at checkout or on the first verified rent, from the contracted rate in force on the stay or lease
            date. Commissions over RWF 150,000 need a second approver.
          </Note>
        </section>

        {cur && curStage ? (
          <Card role="region" aria-labelledby="sel-h" className="min-w-0 flex-[1_1_340px] gap-3 p-[18px]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <h2 id="sel-h" className="text-[15px] leading-[22px] font-semibold">
                  {cur.payee}
                </h2>
                <span className="text-xs text-muted tabular">
                  {cur.role} · {cur.source}
                </span>
              </div>
              <Chip size="sm" variant="soft" color={toneColor(curStage.tone)} className="shrink-0">
                {curStage.label}
              </Chip>
            </div>
            <Card variant="secondary" className="gap-0.5 px-3.5 py-3 tabular">
              <span className="text-xs text-muted">{cur.contract}</span>
              <span className="text-lg leading-[26px] font-semibold">
                {rwf(cur.basis)} × {cur.rate}% = {rwf(cur.amount)}
              </span>
            </Card>
            <KeyValueList
              items={[
                { label: "Payer entity", value: cur.payer },
                { label: "Source record", value: cur.sourceRecord },
                { label: "Tax document", value: cur.taxDocument },
                { label: "Settlement", value: cur.settle },
                { label: "Executes in", value: "Payments only" },
              ]}
            />
            <LogTimeline entries={cur.history} label="Commission history" />
            {cur.eligible || cur.stage === "approved" || (cur.stage === "await" && !cur.hasTaxDocument) ? (
              <div className="flex flex-wrap items-center gap-2">
                {cur.eligible ? (
                  <Button
                    size="sm"
                    onPress={() => {
                      setChecked({ [cur.id]: true });
                      setConfirm(false);
                      setDialog(true);
                    }}
                  >
                    <CircleCheck className="size-4" aria-hidden="true" />
                    Approve payable
                  </Button>
                ) : null}
                {cur.stage === "await" && !cur.hasTaxDocument ? (
                  <>
                    <Button size="sm" isDisabled>
                      <Lock className="size-4" aria-hidden="true" />
                      Approve payable
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => setRequested((o) => ({ ...o, [cur.id]: true }))}
                    >
                      <Envelope className="size-4" aria-hidden="true" />
                      Request invoice again
                    </Button>
                  </>
                ) : null}
                {cur.stage === "approved" ? (
                  <LinkButton href={screenHref("Payments")} size="sm" variant="secondary">
                    <ArrowUpRightFromSquare className="size-4" aria-hidden="true" />
                    View in Payments
                  </LinkButton>
                ) : null}
              </div>
            ) : null}
            <Note>{note}</Note>
          </Card>
        ) : null}
      </div>

      <section aria-labelledby="po-h" className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <h2 id="po-h" className="text-[15px] leading-[22px] font-semibold">
              Payouts
            </h2>
            <span className="text-xs text-muted">
              Host, landlord, broker and agent transfers as executed by Payments. Read only here.
            </span>
          </div>
          <Segment aria-label="Execution state" selectedKey={pay} onSelectionChange={(k) => setPay(String(k))}>
            {payFilters.map((f) => (
              <Segment.Item key={f.id} id={f.id}>
                {f.label}
              </Segment.Item>
            ))}
          </Segment>
        </div>
        {payRows.length ? (
          <Table>
            <Table.ScrollContainer>
              <Table.Content className="min-w-[900px]" aria-label="Payouts executed by Payments">
                <Table.Header>
                  <Table.Column isRowHeader>Payout</Table.Column>
                  <Table.Column>Payee and account</Table.Column>
                  <Table.Column>Paid by</Table.Column>
                  <Table.Column className="text-right">Amount</Table.Column>
                  <Table.Column>Execution</Table.Column>
                  <Table.Column>Evidence and detail</Table.Column>
                </Table.Header>
                <Table.Body>
                  {payRows.map((p) => {
                    const st = PAYOUT_STATE[p.status];
                    return (
                      <Table.Row key={p.id} id={p.id}>
                        <Table.Cell>
                          <Stack primary={p.id} primaryClassName="font-medium tabular" secondary={p.type} />
                        </Table.Cell>
                        <Table.Cell>
                          <Stack primary={p.payee} secondary={p.account} secondaryClassName="tabular" />
                        </Table.Cell>
                        <Table.Cell className="text-[13px]">{p.payer}</Table.Cell>
                        <Table.Cell className="text-right font-medium tabular">{rwf(p.amount)}</Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col gap-0.5">
                            <Chip size="sm" variant="soft" color={toneColor(st.tone)} className="self-start">
                              {st.label}
                            </Chip>
                            <span className="text-xs text-muted tabular">{p.when}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="max-w-[340px] text-xs whitespace-normal text-muted">{p.note}</Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        ) : (
          <EmptyState size="sm">
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <Tray />
              </EmptyState.Media>
              <EmptyState.Title>No payouts in this state</EmptyState.Title>
              <EmptyState.Description>Choose another state to see transfers.</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        )}
      </section>

      <Modal.Backdrop isOpen={dialog} onOpenChange={setDialog}>
        <Modal.Container>
          <Modal.Dialog aria-labelledby="ap-h" className="sm:max-w-[520px]">
            <Modal.Header className="flex-col items-start gap-1">
              <Modal.Heading id="ap-h" className="text-lg leading-[26px] font-semibold">
                Approve {chosen.length} Payables · {rwf(sum(chosen))}
              </Modal.Heading>
              <p className="text-[13px] text-muted">
                Each becomes a payable in the ledger. Payments schedules and executes the transfers separately.
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <ListView aria-label="Payables to approve" variant="secondary" items={chosen}>
                {(c) => (
                  <ListView.Item id={c.id} textValue={`${c.payee} ${c.source}`}>
                    <ListView.ItemContent>
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title className="whitespace-normal">
                          {c.payee} · {c.source}
                        </ListView.Title>
                        <ListView.Description className="whitespace-normal">
                          {c.contract} · {c.taxDocument}
                        </ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      <span className="flex flex-col items-end">
                        <span className="font-medium tabular">{rwf(c.amount)}</span>
                        {c.amount > SECOND_APPROVAL_OVER ? (
                          <span className="text-xs text-muted">Needs second approver</span>
                        ) : null}
                      </span>
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
              <Checkbox isSelected={confirm} onChange={setConfirm}>
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <span className="text-[13px]">
                    I checked the contracted rate, the basis and the tax document for each line
                  </span>
                </Checkbox.Content>
              </Checkbox>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={() => setDialog(false)}>
                Cancel
              </Button>
              <Button
                isDisabled={!confirm || !chosen.length}
                onPress={() => {
                  setApproved((o) => ({ ...o, ...Object.fromEntries(chosen.map((c) => [c.id, true])) }));
                  setChecked({});
                  setDialog(false);
                  setConfirm(false);
                }}
              >
                Approve payables
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </PageContent>
  );
}
