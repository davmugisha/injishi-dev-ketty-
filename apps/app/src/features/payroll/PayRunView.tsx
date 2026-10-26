"use client";

import {
  Check,
  CircleCheck,
  Hourglass,
  Lock,
  PaperPlane,
  PersonsLock,
  ScalesBalanced,
  ShieldExclamation,
} from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Label, Modal, Table, TextArea, TextField } from "@heroui/react";
import { KPIGroup, ListView, Segment, Stepper } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { screenHref } from "@injishi/data";
import type {
  FinalSettlement,
  PayLine,
  PaymentFile,
  PayRates,
  PayRunException,
  PayRunHistory,
  PayRunOutput,
  PayRunRule,
  PayRunStage,
  PayRunStep,
  PayRunTotal,
} from "@injishi/data/fixtures/payroll";
import { GateChip, Icon, KeyValueList, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment, useMemo, useState } from "react";
import { AmountList, type AmountRow } from "./parts";
import { amount, payLineFigures, pct, rwf, signedRwf } from "./payCalc";

interface PayRunData {
  rates: PayRates;
  lines: PayLine[];
  steps: PayRunStep[];
  exceptions: PayRunException[];
  rules: PayRunRule[];
  totals: PayRunTotal[];
  settlement: FinalSettlement | null;
  files: PaymentFile[];
  outputs: PayRunOutput[];
  history: PayRunHistory[];
}

const STAGE_STEP: Record<PayRunStage, number> = { review: 1, submitted: 2, confirmed: 3 };
/** The payment file release step shows a lock until the owner has confirmed. */
const RELEASE_STEP = 3;

function StepIndicator({ locked }: { locked: boolean }) {
  const { status, index } = Stepper.useStep();
  if (status === "inactive" && locked) {
    return (
      <Stepper.Indicator>
        <Stepper.Icon>
          <Lock aria-hidden="true" />
        </Stepper.Icon>
      </Stepper.Indicator>
    );
  }
  if (status === "complete") return <Stepper.Indicator />;
  return <Stepper.Indicator>{index + 1}</Stepper.Indicator>;
}

function totalFoot(t: PayRunTotal) {
  return t.footAmount === null ? t.foot : `${t.foot} ${rwf(t.footAmount)}`;
}

export function PayRunView({ data, initialStage }: { data: PayRunData; initialStage: PayRunStage }) {
  const { rates, lines, exceptions } = data;
  const [stage, setStage] = useState<PayRunStage>(initialStage);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [onlyExceptions, setOnlyExceptions] = useState(false);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(exceptions.map((x) => [x.id, x.reviewed])),
  );
  const [selectedId, setSelectedId] = useState<string>(
    () => exceptions.find((x) => !x.reviewed && x.lineId)?.lineId ?? lines[0]?.id ?? "",
  );

  const figures = useMemo(() => new Map(lines.map((l) => [l.id, payLineFigures(l, rates)])), [lines, rates]);
  const locked = stage !== "review";
  const confirmed = stage === "confirmed";
  const reviewedCount = exceptions.filter((x) => reviewed[x.id]).length;
  const unreviewed = exceptions.length - reviewedCount;
  const staffTotal = data.totals.find((t) => t.id === "staff")?.value ?? lines.length;
  const netTotal = data.totals.find((t) => t.id === "net");
  const shownLines = onlyExceptions ? lines.filter((l) => l.isException) : lines;

  const selected = lines.find((l) => l.id === selectedId) ?? lines[0];
  const sel = selected ? figures.get(selected.id) : undefined;
  const breakdown: AmountRow[] =
    selected && sel
      ? [
          { label: "Base", value: rwf(selected.base) },
          { label: "Allowances (taxable)", value: rwf(selected.allowances) },
          ...(selected.other
            ? [{ label: selected.otherLabel ?? "Other pay", value: signedRwf(selected.other, "+") }]
            : []),
          { label: "Gross pay", value: rwf(sel.gross), total: true },
          { label: `PAYE · ${rates.id} bands`, value: signedRwf(sel.paye, "−") },
          { label: `RSSB pension ${pct(rates.pension)} · ${rates.id}`, value: signedRwf(sel.pension, "−") },
          {
            label: `RSSB maternity ${pct(rates.maternity)} · ${rates.id}`,
            value: signedRwf(sel.maternity, "−"),
          },
          ...(selected.loan
            ? [{ label: selected.loanLabel ?? "Loan repayment", value: signedRwf(selected.loan, "−") }]
            : []),
          { label: `Net pay · ${selected.payBy}`, value: rwf(sel.net), total: true },
          { label: "Employer pension, maternity, occupational hazards", value: rwf(sel.employer) },
        ]
      : [];

  const leaver = data.settlement ? lines.find((l) => l.id === data.settlement?.lineId) : undefined;
  const leaverFig = leaver ? figures.get(leaver.id) : undefined;
  const settlementRows: AmountRow[] =
    data.settlement && leaver && leaverFig
      ? [
          { label: data.settlement.payLabel, value: rwf(leaver.base) },
          { label: "Allowance, pro-rata", value: rwf(leaver.allowances) },
          { label: data.settlement.leaveLabel, value: rwf(leaver.other) },
          { label: "Gross", value: rwf(leaverFig.gross), total: true },
          { label: "PAYE and RSSB", value: signedRwf(leaverFig.paye + leaverFig.rssb, "−") },
          { label: data.settlement.advanceLabel, value: signedRwf(leaver.loan, "−") },
          { label: `Net final pay · ${leaver.payBy}`, value: rwf(leaverFig.net), total: true },
        ]
      : [];

  const markReviewed = (x: PayRunException) => {
    setReviewed((r) => ({ ...r, [x.id]: true }));
    if (x.lineId) setSelectedId(x.lineId);
  };

  const stepDesc = (s: PayRunStep) => {
    if (s.id === "review" && stage === "review")
      return `Checks passed · ${reviewedCount} of ${exceptions.length} exceptions`;
    if (confirmed && s.confirmedDesc) return s.confirmedDesc;
    return s.desc;
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow="People › Pay run · period 1–31 October 2026 · pay date Friday 23 October"
        title="October 2026 Pay Run"
        description="Amahoro Hospitality Ltd (44 staff) and Amahoro Residences Ltd (4 staff). Each employer files its own declarations."
        actions={
          <LinkButton href={screenHref("PayrollRules")} variant="secondary">
            <ScalesBalanced className="size-4" aria-hidden="true" />
            Payroll rules
          </LinkButton>
        }
      />

      <div className="overflow-x-auto">
        <Stepper aria-label="Pay run steps" currentStep={STAGE_STEP[stage]} size="md" className="min-w-[640px]">
          {data.steps.map((s, i) => (
            <Stepper.Step key={s.id}>
              <StepIndicator locked={i === RELEASE_STEP} />
              <Stepper.Content>
                <Stepper.Title className="text-[14px] leading-5">{s.title}</Stepper.Title>
                <Stepper.Description className="text-[10px] leading-[14px]">{stepDesc(s)}</Stepper.Description>
              </Stepper.Content>
              <Stepper.Separator />
            </Stepper.Step>
          ))}
        </Stepper>
      </div>

      {stage === "review" ? (
        <Alert status="accent" role="status" className="flex-wrap items-center">
          <Alert.Indicator>
            <PersonsLock aria-hidden="true" />
          </Alert.Indicator>
          <Alert.Content className="min-w-0 flex-[1_1_260px]">
            <Alert.Title>You prepared this run. Didier Mugenzi must confirm it.</Alert.Title>
            <Alert.Description>
              Preparing and confirming are separate permissions. You can submit, withdraw and correct the draft; you
              cannot confirm it or release payment files.
            </Alert.Description>
          </Alert.Content>
          <div className="ms-auto flex shrink-0 flex-col items-end gap-1">
            {unreviewed === 0 ? (
              <Button onPress={() => setDialogOpen(true)}>
                <PaperPlane className="size-4" aria-hidden="true" />
                Submit for confirmation
              </Button>
            ) : (
              <>
                <Button isDisabled aria-describedby="sub-why">
                  <PaperPlane className="size-4" aria-hidden="true" />
                  Submit for confirmation
                </Button>
                <span id="sub-why" className="text-xs text-muted">
                  Review {unreviewed} more exception first
                </span>
              </>
            )}
          </div>
        </Alert>
      ) : stage === "submitted" ? (
        <Alert status="default" role="status" className="flex-wrap items-center">
          <Alert.Indicator>
            <Hourglass aria-hidden="true" />
          </Alert.Indicator>
          <Alert.Content className="min-w-0 flex-[1_1_260px]">
            <Alert.Title>Submitted to Didier Mugenzi · awaiting confirmation</Alert.Title>
            <Alert.Description>
              You prepared this run, so only he can confirm it. The snapshot is locked; withdraw it if something needs
              to change.
            </Alert.Description>
          </Alert.Content>
          <Button variant="secondary" className="ms-auto shrink-0" onPress={() => setStage("review")}>
            Withdraw to edit
          </Button>
        </Alert>
      ) : (
        <Alert status="success" role="status" className="flex-wrap items-center">
          <Alert.Indicator>
            <CircleCheck aria-hidden="true" />
          </Alert.Indicator>
          <Alert.Content className="min-w-0 flex-[1_1_260px]">
            <Alert.Title>Confirmed by Didier Mugenzi · today 11:20</Alert.Title>
            <Alert.Description>
              He recorded a documented exception because the rule versions are still awaiting sign-off. Payment files
              now wait for release by someone with that permission.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted">Rule versions in this snapshot</span>
        {data.rules.map((r) => (
          <NextLink key={r.id} href={screenHref("PayrollRules")} className="text-inherit no-underline">
            <GateChip
              icon={
                r.status === "approved" ? (
                  <Check className="size-3" aria-hidden="true" />
                ) : (
                  <ShieldExclamation className="size-3" aria-hidden="true" />
                )
              }
            >
              {r.label}
            </GateChip>
          </NextLink>
        ))}
      </div>

      <section aria-label="Run totals">
        <KPIGroup className="flex-wrap">
          {data.totals.map((t, i) => (
            <Fragment key={t.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="min-w-[160px] flex-[1_1_160px] gap-1">
                <KPI.Header>
                  <KPI.Title>{t.label}</KPI.Title>
                </KPI.Header>
                <KPI.Content className="flex-none">
                  <KPI.Value
                    value={t.value}
                    formatOptions={t.format === "rwf" ? { style: "currency", currency: "RWF" } : undefined}
                    className="text-[20px] leading-7 tabular"
                  />
                </KPI.Content>
                <KPI.Footer>
                  <p className="text-xs leading-4 text-muted">{totalFoot(t)}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <section className="flex flex-col gap-[10px]" aria-labelledby="lines-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="lines-h" className="text-[15px] leading-[22px] font-semibold">
            Pay Lines
          </h2>
          <Segment
            aria-label="Show lines"
            selectedKey={onlyExceptions ? "exceptions" : "all"}
            onSelectionChange={(k) => setOnlyExceptions(k === "exceptions")}
          >
            <Segment.Item id="all">All lines</Segment.Item>
            <Segment.Item id="exceptions">Exceptions only</Segment.Item>
          </Segment>
        </div>
        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Pay lines"
              className="min-w-[1040px]"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set([selectedId])}
              onSelectionChange={(keys) => {
                if (keys !== "all") {
                  const [first] = keys;
                  if (first !== undefined) setSelectedId(String(first));
                }
              }}
            >
              <Table.Header>
                <Table.Column isRowHeader>Employee</Table.Column>
                <Table.Column className="text-right">Base</Table.Column>
                <Table.Column className="text-right">Allowances</Table.Column>
                <Table.Column className="text-right">Overtime and other</Table.Column>
                <Table.Column className="text-right">Gross</Table.Column>
                <Table.Column className="text-right">PAYE</Table.Column>
                <Table.Column className="text-right">RSSB</Table.Column>
                <Table.Column className="text-right">Loans</Table.Column>
                <Table.Column className="text-right">Net</Table.Column>
                <Table.Column>Flag</Table.Column>
              </Table.Header>
              <Table.Body>
                {shownLines.map((l) => {
                  const f = figures.get(l.id);
                  if (!f) return null;
                  return (
                    <Table.Row key={l.id} id={l.id} className="cursor-pointer">
                      <Table.Cell>
                        <span className="flex flex-col">
                          <span className="font-medium">{l.name}</span>
                          <span className="text-xs text-muted">
                            {l.role} · {l.payBy}
                          </span>
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-right tabular">{amount(l.base)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{amount(l.allowances)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{amount(l.other, true)}</Table.Cell>
                      <Table.Cell className="text-right font-medium tabular">{amount(f.gross)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{amount(f.paye)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{amount(f.rssb)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{amount(l.loan, true)}</Table.Cell>
                      <Table.Cell className="text-right font-semibold tabular">{amount(f.net)}</Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={toneColor(l.flagTone)}>
                          {l.flag}
                        </Chip>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        <p className="text-xs text-muted">
          {onlyExceptions
            ? `Showing ${shownLines.length} exception lines of ${staffTotal}`
            : `Showing ${shownLines.length} of ${staffTotal} lines · exceptions and a sample of regular lines`}{" "}
          · amounts in RWF · RSSB column is the employee share (pension and maternity); employer shares are in the
          totals.
        </p>
      </section>

      <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
        <Card aria-labelledby="ex-h" className="gap-[10px] p-[16px]">
          <Card.Header>
            <Card.Title id="ex-h" className="text-[15px] font-semibold">
              Exceptions · {reviewedCount} of {exceptions.length} reviewed
            </Card.Title>
            <Card.Description>Each one carries its reason and who approved it</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-[10px]">
            {exceptions.map((x) => {
              const done = !!reviewed[x.id];
              return (
                <div key={x.id} className="flex items-start gap-[10px] border-t border-separator pt-2">
                  <Icon name={x.icon} className="mt-0.5 size-4 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-medium">{x.title}</span>
                    <span className="text-xs leading-4 text-muted">{x.detail}</span>
                  </div>
                  {!done && !locked ? (
                    <Button size="sm" variant="secondary" className="shrink-0" onPress={() => markReviewed(x)}>
                      Mark reviewed
                    </Button>
                  ) : (
                    <Chip size="sm" variant="soft" color={done ? "success" : "warning"} className="shrink-0">
                      {done ? "Reviewed" : "Not reviewed"}
                    </Chip>
                  )}
                </div>
              );
            })}
          </Card.Content>
        </Card>

        {selected ? (
          <Card aria-labelledby="pl-h" className="gap-[10px] p-[16px]">
            <Card.Header>
              <Card.Title id="pl-h" className="text-[15px] font-semibold">
                Pay Line · {selected.name}
              </Card.Title>
              <Card.Description>How each figure was calculated, with the rule version used</Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-[10px]">
              <AmountList rows={breakdown} />
              <p className="text-xs leading-4 text-muted">
                {selected.note ??
                  "Regular line. Rates come from the configured rule versions above, which are awaiting payroll expert sign-off."}
              </p>
            </Card.Content>
          </Card>
        ) : null}

        {data.settlement ? (
          <Card aria-labelledby="fs-h" className="gap-[10px] p-[16px]">
            <Card.Header>
              <Card.Title id="fs-h" className="text-[15px] font-semibold">
                Final Settlement · {data.settlement.name}
              </Card.Title>
              <Card.Description>{data.settlement.desc}</Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-[10px]">
              <AmountList rows={settlementRows} />
            </Card.Content>
            <Card.Footer>
              <LinkButton href={screenHref(data.settlement.board)} size="sm" variant="ghost">
                Offboarding checklist
              </LinkButton>
            </Card.Footer>
          </Card>
        ) : null}
      </div>

      <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
        <Card aria-labelledby="pf-h" className="gap-[12px] p-[16px]">
          <Card.Header className="flex flex-row items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Card.Title id="pf-h" className="text-[15px] font-semibold">
                Payment Files
              </Card.Title>
              <Card.Description>
                Released separately, by someone with the Release payment files permission
              </Card.Description>
            </div>
            <Chip size="sm" variant="soft" color={confirmed ? "warning" : "default"} className="shrink-0">
              <Lock className="size-3" aria-hidden="true" />
              <Chip.Label>{confirmed ? "Release: Didier Mugenzi" : "Locked until confirmation"}</Chip.Label>
            </Chip>
          </Card.Header>
          <Card.Content className="flex flex-col gap-[12px]">
            <Table variant="secondary" className={confirmed ? undefined : "opacity-60"}>
              <Table.ScrollContainer>
                <Table.Content aria-label="Payment files">
                  <Table.Header>
                    <Table.Column isRowHeader>Rail</Table.Column>
                    <Table.Column className="text-right">Staff</Table.Column>
                    <Table.Column className="text-right">Amount</Table.Column>
                    <Table.Column>File</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {data.files.map((f) => (
                      <Table.Row key={f.id} id={f.id}>
                        <Table.Cell>
                          <span className="flex flex-col">
                            <span className="font-medium">{f.rail}</span>
                            <span className="text-xs text-muted">{f.how}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-right tabular">{f.staff}</Table.Cell>
                        <Table.Cell className="text-right tabular">{rwf(f.amount)}</Table.Cell>
                        <Table.Cell>
                          <GateChip
                            icon={
                              confirmed ? (
                                <Icon name={f.confirmedIcon} className="size-3" />
                              ) : (
                                <Lock className="size-3" aria-hidden="true" />
                              )
                            }
                          >
                            {confirmed ? f.confirmedGate : "After confirmation"}
                          </GateChip>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            <p className="text-xs leading-4 text-muted">
              {confirmed
                ? "Waiting for Didier Mugenzi to release. GT Bank production access is not verified, so the bank file is downloaded and uploaded in the bank’s portal by the releaser."
                : "Previews stay locked until the owner confirms the run."}{" "}
              Injishi never pays on confirmation alone, and a payment counts as paid only when the bank or MoMo provider
              confirms it.
            </p>
          </Card.Content>
        </Card>

        <Card aria-labelledby="ps-h" className="gap-[12px] p-[16px]">
          <Card.Header>
            <Card.Title id="ps-h" className="text-[15px] font-semibold">
              Payslips and Declarations
            </Card.Title>
            <Card.Description>Prepared from the confirmed snapshot only</Card.Description>
          </Card.Header>
          <Card.Content>
            <ListView
              aria-label="Payslips and declarations"
              variant="secondary"
              items={data.outputs.map((o) => ({ ...o, ready: o.readyAfter === "confirmation" && confirmed }))}
            >
              {(o) => {
                const { ready } = o;
                return (
                  <ListView.Item id={o.id} textValue={o.title}>
                    <ListView.ItemContent>
                      <Icon name={o.icon} className="size-4 shrink-0 text-muted" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>{o.title}</ListView.Title>
                        <ListView.Description>{o.meta}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      <Chip size="sm" variant="soft" color={ready ? "success" : "default"}>
                        {o.readyAfter === "release" ? "After release" : ready ? "Ready" : "After confirmation"}
                      </Chip>
                    </ListView.ItemAction>
                  </ListView.Item>
                );
              }}
            </ListView>
          </Card.Content>
        </Card>
      </div>

      <section className="flex flex-col gap-[10px]" aria-labelledby="hist-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="hist-h" className="text-[15px] leading-[22px] font-semibold">
            Previous Runs
          </h2>
          <span className="text-xs text-muted">
            Confirmed runs are never edited. Corrections become adjustment lines in a later run.
          </span>
        </div>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Previous runs">
              <Table.Header>
                <Table.Column isRowHeader>Period</Table.Column>
                <Table.Column className="text-right">Staff</Table.Column>
                <Table.Column className="text-right">Net</Table.Column>
                <Table.Column>Prepared</Table.Column>
                <Table.Column>Confirmed</Table.Column>
                <Table.Column>Released</Table.Column>
                <Table.Column>Outcome</Table.Column>
              </Table.Header>
              <Table.Body>
                {data.history.map((h) => (
                  <Table.Row key={h.id} id={h.id}>
                    <Table.Cell className="font-medium">{h.period}</Table.Cell>
                    <Table.Cell className="text-right tabular">{h.staff}</Table.Cell>
                    <Table.Cell className="text-right tabular">{rwf(h.net)}</Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col">
                        <span>{h.preparedBy}</span>
                        <span className="text-xs text-muted tabular">{h.preparedAt}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col">
                        <span>{h.confirmedBy}</span>
                        <span className="text-xs text-muted tabular">{h.confirmedAt}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col">
                        <span>{h.releasedBy}</span>
                        <span className="text-xs text-muted tabular">{h.releasedAt}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Chip size="sm" variant="soft" color="success">
                          {h.outcome}
                        </Chip>
                        {h.combinedPermission ? (
                          <Chip size="sm" variant="soft" color="warning">
                            One person, combined permission
                          </Chip>
                        ) : null}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </section>

      <Modal.Backdrop isOpen={dialogOpen && stage === "review"} onOpenChange={setDialogOpen}>
        <Modal.Container size="md">
          <Modal.Dialog aria-labelledby="sd-h">
            <Modal.Header>
              <Modal.Heading id="sd-h" className="text-[18px] leading-6 font-semibold">
                Submit October run to Didier Mugenzi?
              </Modal.Heading>
              <p className="mt-1.5 text-sm leading-5 text-muted">
                The snapshot is locked while he reviews it. You can withdraw it until he confirms.
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-[16px]">
              <KeyValueList
                items={[
                  { label: "Staff", value: `${staffTotal} · ${reviewedCount} exceptions reviewed` },
                  { label: "Net pay", value: netTotal ? rwf(netTotal.value) : "—" },
                  { label: "Employer cost", value: netTotal?.footAmount ? rwf(netTotal.footAmount) : "—" },
                  { label: "Rules", value: "PAYE v2026-01, RSSB v2026-01, allowances v2026-01" },
                ]}
              />
              <Alert status="warning">
                <Alert.Indicator>
                  <ShieldExclamation aria-hidden="true" />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Rules are awaiting payroll expert sign-off</Alert.Title>
                  <Alert.Description>
                    Didier must either wait for sign-off or record a documented exception when he confirms.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
              <TextField fullWidth>
                <Label>Note to Didier (optional)</Label>
                <TextArea
                  variant="secondary"
                  rows={2}
                  placeholder="For example: Joseph’s retroactive line follows your 30 Sep approval"
                />
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onPress={() => {
                  setDialogOpen(false);
                  setStage("submitted");
                }}
              >
                Submit for confirmation
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </PageContent>
  );
}
