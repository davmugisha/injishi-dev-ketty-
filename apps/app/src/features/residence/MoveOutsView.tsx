"use client";

import {
  ArrowDownToLine,
  Calendar,
  Check,
  CircleCheck,
  CircleInfo,
  Clock,
  Paperclip,
  PaperPlane,
  Plus,
  ScalesUnbalanced,
  Vault,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Input,
  Label,
  Table,
  Tabs,
  TextArea,
  TextField,
  Toast,
  ToggleButton,
  toast,
} from "@heroui/react";
import { EmptyState, KPIGroup, ListView, Stepper, Timeline } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import type { Persona } from "@injishi/data";
import type {
  Deduction,
  DepositKpi,
  DisputeDecision,
  MoveOutCase,
  ResidenceUnit,
  Tone,
} from "@injishi/data/fixtures/residence";
import { stock } from "@injishi/data/media";
import { KeyValueList, PageContent, PageHeader, Photo } from "@injishi/ui";
import { type CSSProperties, Fragment, useState } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { downloadCsv, FormDialog, lineTab, money, SelectField, SubHeading, ToneChip } from "./shared";

export interface MoveOutsData {
  kpis: DepositKpi[];
  cases: MoveOutCase[];
  units: ResidenceUnit[];
}

type Tab = "insp" | "settle";
type Stage = "dispute" | "ready" | "approval";

const STEPS = ["Notice", "Inspection", "Deductions", "Resident response", "Approval", "Refund"];
const REASONS = [
  "Damage beyond fair wear, with evidence",
  "Unpaid rent or utilities",
  "Cleaning beyond the move-in condition",
  "Other, explained in the note",
];
const CHANNELS = ["Letter", "Resident app", "Email", "In person"];
/** Thumbnails of one area cycle the crop so several shots of the same stock photo read as different photos. */
const CROPS = ["object-center", "object-left", "object-right"];

/** Case card surface (artifact: button.card with aria-pressed; the selected case gets an accent ring). */
const caseVars = {
  "--toggle-button-bg": "var(--surface)",
  "--toggle-button-bg-hover": "color-mix(in oklab, var(--surface), var(--foreground) 4%)",
  "--toggle-button-bg-pressed": "color-mix(in oklab, var(--surface), var(--foreground) 6%)",
  "--toggle-button-bg-selected": "var(--surface)",
  "--toggle-button-bg-selected-hover": "color-mix(in oklab, var(--surface), var(--foreground) 4%)",
  "--toggle-button-bg-selected-pressed": "color-mix(in oklab, var(--surface), var(--foreground) 6%)",
  "--toggle-button-fg": "var(--foreground)",
  "--toggle-button-fg-selected": "var(--foreground)",
} as CSSProperties;

const firstName = (name: string) => name.split(" ")[0];

export function MoveOutsView({ persona, data }: { persona: Persona; data: MoveOutsData }) {
  const [added, setAdded] = useState<MoveOutCase[]>([]);
  const cases = [...data.cases, ...added];
  const [sel, setSel] = useState(data.cases[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("settle");
  const [stage, setStage] = useState<Stage>("dispute");
  const [decision, setDecision] = useState<DisputeDecision | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [approveNote, setApproveNote] = useState("Photos and move-in report attached. Resident accepted two items.");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const noticeUnits = data.units.filter((u) => u.lease && !cases.some((c) => c.id === u.id));
  const [notice, setNotice] = useState({
    unit: noticeUnits[0]?.id ?? "",
    received: "12 Oct 2026",
    movesOut: "11 Nov 2026",
    channel: CHANNELS[1],
  });

  const c = cases.find((x) => x.id === sel) ?? cases[0];
  if (!c) return null;

  // The disputed deduction follows the manager's decision; everything else is as recorded.
  const dispute = c.dispute;
  const disputedAmount = (d: Deduction) => {
    if (!dispute || d.id !== dispute.deduction || !decision) return d.amount;
    if (decision === "reduce") return dispute.reduceTo;
    if (decision === "drop") return 0;
    return d.amount;
  };
  const deductions = c.deductions.map((d) => {
    if (!dispute || d.id !== dispute.deduction || !decision) return d;
    return {
      ...d,
      amount: disputedAmount(d),
      response: decision === "drop" ? "Withdrawn" : "Decision recorded",
      tone: "default" as Tone,
      note: dispute.notes[decision],
    };
  });
  const dedTotal = deductions.reduce((t, d) => t + d.amount, 0);
  const refund = c.deposit - dedTotal;
  const disputed = c.deductions.find((d) => d.id === dispute?.deduction);

  const status = dispute
    ? stage === "dispute"
      ? { label: c.status, tone: c.statusTone }
      : { label: stage === "ready" ? "Ready for approval" : "Awaiting approval", tone: "info" as Tone }
    : { label: c.status, tone: c.statusTone };
  const step = dispute && stage === "approval" ? c.step + 1 : c.step;
  const summary = c.summary.map((m, i) => {
    if (!dispute) return m;
    if (i === 1)
      return {
        ...m,
        value: money(dedTotal),
        foot: decision ? "After your decision" : `${money(disputed?.amount ?? 0)} disputed`,
      };
    if (i === 2) return { ...m, value: money(refund) };
    return m;
  });
  const resolution = dispute && decision ? dispute.resolutions[decision] : "";
  const approver = c.approver;

  // Notices recorded on this screen join the running notices.
  const kpiValue = (k: DepositKpi) => (k.id === "notices" ? k.value + added.length : k.value);
  const kpiFoot = (k: DepositKpi) =>
    k.id === "notices" && added.length
      ? [k.foot, ...added.map((a) => `${a.id} ${a.when.charAt(0).toLowerCase()}${a.when.slice(1)}`)].join(" · ")
      : k.foot;

  const decide = (d: DisputeDecision) => {
    setDecision(d);
    setStage("ready");
  };
  const sendForApproval = () => {
    setApproveOpen(false);
    setStage("approval");
    toast.success(`Settlement sent to ${approver?.name ?? "the approver"} · ${c.lease}`, {
      indicator: <CircleCheck className="size-4" />,
    });
  };

  const deposits = [
    ...data.units
      .filter((u) => u.lease)
      .map((u) => {
        const leaving = u.status === "notice" || added.some((a) => a.id === u.id);
        return {
          id: u.id,
          who: u.resident,
          lease: u.lease,
          amount: u.rent * 2,
          state: leaving ? "Notice running" : "Held",
          tone: (leaving ? "accent" : "success") as Tone,
        };
      }),
    ...cases
      .filter((x) => x.step < STEPS.length && x.inspection.done)
      .map((x) => ({
        id: `${x.id}-prev`,
        who: `${x.name} (previous resident of ${x.id})`,
        lease: x.lease,
        amount: x.deposit,
        state: "In settlement",
        tone: "warning" as Tone,
      })),
  ];
  const depositTotal = deposits.reduce((t, d) => t + d.amount, 0);

  const recordNotice = () => {
    const u = data.units.find((x) => x.id === notice.unit);
    if (!u) return;
    const held = u.rent * 2;
    const next: MoveOutCase = {
      id: u.id,
      name: u.resident,
      lease: u.lease,
      when: `Moves out ${notice.movesOut.replace(/ \d{4}$/, "")}`,
      status: "Notice recorded",
      statusTone: "info",
      sub: `Notice received ${notice.received.replace(/ \d{4}$/, "")} by ${notice.channel.toLowerCase()} · deposit ${money(held)} held`,
      step: 1,
      deposit: held,
      inspection: {
        done: false,
        booked: false,
        title: "Inspection not booked yet",
        text: `Book a joint inspection with ${firstName(u.resident)} for ${notice.movesOut}. The checklist is prepared from the move-in report.`,
        hint: "Start becomes available on the move-out day.",
      },
      deductions: [],
      summary: [
        { label: "Caution held", value: money(held), foot: "Liability until settled" },
        { label: "Proposed deductions", value: "None yet", foot: "After inspection" },
        { label: "Final rent", value: "Scheduled", foot: "Charged up to the move-out day" },
        { label: "Remaining liability", value: money(held), foot: "Held in full" },
      ],
      heldNote: `Deductions can be proposed only after the inspection report is signed. The full ${money(held)} stays held until then.`,
    };
    setAdded((a) => [...a, next]);
    setSel(next.id);
    setTab("insp");
    setNoticeOpen(false);
    toast.success(`Notice recorded for ${u.id} · ${u.resident}`, { indicator: <CircleCheck className="size-4" /> });
  };

  return (
    <PageContent>
      {dispute && stage !== "dispute" ? (
        <TopbarStatus
          kind="chip"
          tone="default"
          dot={stage === "ready" ? "accent" : "warning"}
          label={stage === "ready" ? `${c.id} settlement ready for approval` : `${c.id} settlement awaiting approval`}
        />
      ) : null}
      <PageHeader
        eyebrow="Tenancy · Kacyiru Court Residences"
        title="Move-outs"
        description="From notice to inspection to caution settlement. A deposit stays a liability until its refund is verified."
        actions={
          <>
            <Button variant="secondary" onPress={() => setRegisterOpen(true)}>
              <Vault className="size-4" />
              Caution deposit register
            </Button>
            <Button
              onPress={() => {
                setNotice((n) => ({ ...n, unit: noticeUnits[0]?.id ?? "" }));
                setNoticeOpen(true);
              }}
              isDisabled={!noticeUnits.length}
            >
              <Plus className="size-4" />
              Record a notice
            </Button>
          </>
        }
      />

      <section aria-label="Caution deposits">
        <KPIGroup className="flex-wrap">
          {data.kpis.map((k, i) => (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="min-w-[min(200px,100%)] flex-[1_1_200px]">
                <KPI.Header>
                  <KPI.Title>{k.label}</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                  <KPI.Value
                    value={kpiValue(k)}
                    formatOptions={k.format === "currency" ? { style: "currency", currency: "RWF" } : undefined}
                    className="text-[22px] tabular"
                  />
                </KPI.Content>
                <KPI.Footer>
                  <p className="text-[12px] leading-4 text-muted">{kpiFoot(k)}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <div className="grid items-start gap-[16px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2.5">
          <h2 className="text-[15px] leading-[22px] font-semibold">Open and recent</h2>
          {cases.map((x) => {
            const isSel = x.id === c.id;
            const xStatus = x === c ? status : { label: x.status, tone: x.statusTone };
            return (
              <ToggleButton
                key={x.id}
                isSelected={isSel}
                onChange={() => {
                  setSel(x.id);
                  if (!x.inspection.done) setTab("insp");
                }}
                style={caseVars}
                aria-label={`${x.id}, ${x.name}, ${xStatus.label}`}
                className="h-auto w-full min-w-0 flex-col items-stretch justify-start gap-1 rounded-[20px] px-4 py-[14px] text-left font-normal whitespace-normal shadow-surface data-[selected=true]:shadow-[inset_0_0_0_2px_var(--accent)]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold tabular">{x.id}</span>
                  <ToneChip tone={xStatus.tone}>{xStatus.label}</ToneChip>
                </span>
                <span className="font-medium">{x.name}</span>
                <span className="text-[12px] text-muted tabular">
                  {x.lease} · {x.when}
                </span>
              </ToggleButton>
            );
          })}
        </div>

        <Card className="min-w-0 gap-4 p-5" aria-labelledby="mo-h" render={(p) => <section {...p} />}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[12px] text-muted tabular">
                {c.lease} · {c.id}
              </span>
              <h2 id="mo-h" className="text-[20px] leading-7 font-semibold">
                {c.name}
              </h2>
              <span className="text-[13px] text-muted tabular">{c.sub}</span>
            </div>
            <ToneChip tone={status.tone} size="md">
              {status.label}
            </ToneChip>
          </div>

          <Stepper size="sm" currentStep={step} aria-label="Move-out progress">
            {STEPS.map((label) => (
              <Stepper.Step key={label}>
                <Stepper.Indicator />
                <Stepper.Content>
                  <Stepper.Title>{label}</Stepper.Title>
                </Stepper.Content>
                <Stepper.Separator />
              </Stepper.Step>
            ))}
          </Stepper>

          <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as Tab)}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Move-out sections">
                <Tabs.Tab id="insp" className={lineTab}>
                  Inspection
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="settle" className={lineTab}>
                  Caution settlement
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel id="insp" className="pt-4">
              {c.inspection.done ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] text-muted">{c.inspection.meta}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        if (!c.inspection.done) return;
                        downloadCsv(`${c.lease}-move-out-inspection.csv`, [
                          ["Area", "At move-in", "At move-out", "Photos", "Finding"],
                          ...c.inspection.checklist.map((i) => [i.area, i.before, i.after, i.photos, i.finding]),
                        ]);
                      }}
                    >
                      <ArrowDownToLine className="size-4" />
                      Inspection report
                    </Button>
                  </div>
                  <Table>
                    <Table.ScrollContainer>
                      <Table.Content aria-label="Inspection checklist">
                        <Table.Header>
                          <Table.Column isRowHeader>Area</Table.Column>
                          <Table.Column>At move-in</Table.Column>
                          <Table.Column>At move-out</Table.Column>
                          <Table.Column>Photos</Table.Column>
                          <Table.Column>Finding</Table.Column>
                        </Table.Header>
                        <Table.Body>
                          {c.inspection.checklist.map((i) => (
                            <Table.Row key={i.area} id={i.area}>
                              <Table.Cell className="font-medium">{i.area}</Table.Cell>
                              <Table.Cell className="text-muted tabular">{i.before}</Table.Cell>
                              <Table.Cell className="tabular">{i.after}</Table.Cell>
                              <Table.Cell>
                                <span className="flex items-center gap-1">
                                  {i.photoKeys.length
                                    ? Array.from({ length: Math.min(i.photos, 3) }, (_, k) => {
                                        const key = i.photoKeys[k % i.photoKeys.length];
                                        const crop = i.photoKeys.length > 1 ? "object-center" : CROPS[k % CROPS.length];
                                        return (
                                          <Photo
                                            key={`${i.area}-photo-${k + 1}`}
                                            image={stock[key]}
                                            alt={`${i.area} photo ${k + 1}`}
                                            sizes="34px"
                                            className={`h-[26px] w-[34px] shrink-0 rounded-[6px] bg-surface-tertiary ${crop}`}
                                          />
                                        );
                                      })
                                    : null}
                                  {i.photos ? null : <span className="text-[12px] text-muted">None</span>}
                                </span>
                              </Table.Cell>
                              <Table.Cell>
                                <ToneChip tone={i.tone}>{i.finding}</ToneChip>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                </div>
              ) : (
                <EmptyState>
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <Calendar />
                    </EmptyState.Media>
                    <EmptyState.Title>{c.inspection.title}</EmptyState.Title>
                    <EmptyState.Description>{c.inspection.text}</EmptyState.Description>
                  </EmptyState.Header>
                  <EmptyState.Content className="flex flex-col items-center gap-2">
                    <span className="flex flex-wrap justify-center gap-2">
                      <Button size="sm" variant="secondary">
                        {c.inspection.booked ? "Reschedule" : "Book inspection"}
                      </Button>
                      <Button size="sm" isDisabled>
                        Start inspection
                      </Button>
                    </span>
                    <span className="text-[12px] text-muted">{c.inspection.hint}</span>
                  </EmptyState.Content>
                </EmptyState>
              )}
            </Tabs.Panel>

            <Tabs.Panel id="settle" className="pt-4">
              <div className="flex flex-col gap-[14px]">
                <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr))]">
                  {summary.map((m) => (
                    <Card key={m.label} variant="secondary" className="gap-0.5 px-[14px] py-3">
                      <span className="text-[12px] text-muted">{m.label}</span>
                      <span className="text-lg leading-6 font-semibold tabular">{m.value}</span>
                      <span className="text-[11px] text-muted tabular">{m.foot}</span>
                    </Card>
                  ))}
                </div>

                {deductions.length ? (
                  <Table>
                    <Table.ScrollContainer>
                      <Table.Content aria-label="Proposed deductions">
                        <Table.Header>
                          <Table.Column isRowHeader>Proposed deduction</Table.Column>
                          <Table.Column>Evidence</Table.Column>
                          <Table.Column className="text-right">Amount</Table.Column>
                          <Table.Column>Resident response</Table.Column>
                        </Table.Header>
                        <Table.Body>
                          {deductions.map((d) => (
                            <Table.Row key={d.id} id={d.id}>
                              <Table.Cell>
                                <span className="flex flex-col">
                                  <span className="font-medium">{d.item}</span>
                                  <span className="text-[12px] text-muted tabular">{d.reason}</span>
                                </span>
                              </Table.Cell>
                              <Table.Cell>
                                <span className="flex items-center gap-1.5 text-[13px]">
                                  <Paperclip className="size-4 shrink-0 text-muted" aria-hidden="true" />
                                  {d.evidence}
                                </span>
                              </Table.Cell>
                              <Table.Cell className="text-right font-medium whitespace-nowrap tabular">
                                {money(d.amount)}
                              </Table.Cell>
                              <Table.Cell>
                                <span className="flex flex-col items-start gap-1">
                                  <ToneChip tone={d.tone}>{d.response}</ToneChip>
                                  <span className="text-[12px] text-muted tabular">{d.note}</span>
                                </span>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                ) : null}

                {dispute && stage === "dispute" ? (
                  <>
                    <Alert status="warning">
                      <Alert.Indicator>
                        <ScalesUnbalanced />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>{dispute.title}</Alert.Title>
                        <Alert.Description>{dispute.text}</Alert.Description>
                      </Alert.Content>
                    </Alert>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onPress={() => decide("keep")}>
                        {dispute.options.keep}
                      </Button>
                      <Button size="sm" variant="secondary" onPress={() => decide("reduce")}>
                        {dispute.options.reduce}
                      </Button>
                      <Button size="sm" variant="ghost" onPress={() => decide("drop")}>
                        {dispute.options.drop}
                      </Button>
                    </div>
                  </>
                ) : null}

                {dispute && stage === "ready" ? (
                  <>
                    <Alert status="accent">
                      <Alert.Indicator>
                        <CircleInfo />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>{resolution}</Alert.Title>
                        <Alert.Description>
                          {firstName(c.name)} is notified of the decision. Deductions over RWF 50,000 need approval from
                          the owner before any refund starts.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="ghost"
                        onPress={() => {
                          setDecision(null);
                          setStage("dispute");
                        }}
                      >
                        Change decision
                      </Button>
                      <Button onPress={() => setApproveOpen(true)}>
                        <PaperPlane className="size-4" />
                        Send for approval
                      </Button>
                    </div>
                  </>
                ) : null}

                {dispute && stage === "approval" ? (
                  <Timeline size="sm" density="compact" aria-label="Settlement approval">
                    <Timeline.Item status="success">
                      <Timeline.Rail>
                        <Timeline.Marker>
                          <Check className="size-3" />
                        </Timeline.Marker>
                        <Timeline.Connector />
                      </Timeline.Rail>
                      <Timeline.Content className="flex flex-col pb-0.5">
                        <span className="text-[13px] leading-[18px] font-medium">
                          Settlement proposed by {persona.name}
                        </span>
                        <span className="text-[12px] leading-4 text-muted">Today 10:05 · {resolution}</span>
                      </Timeline.Content>
                    </Timeline.Item>
                    <Timeline.Item status="current">
                      <Timeline.Rail>
                        <Timeline.Marker>
                          <Clock className="size-3" />
                        </Timeline.Marker>
                        <Timeline.Connector />
                      </Timeline.Rail>
                      <Timeline.Content className="flex flex-col pb-0.5">
                        <span className="text-[13px] leading-[18px] font-medium">
                          Waiting for {approver?.name}, {approver?.role}
                        </span>
                        <span className="text-[12px] leading-4 text-muted">
                          Approver must be a different person from the proposer
                        </span>
                      </Timeline.Content>
                    </Timeline.Item>
                    <Timeline.Item>
                      <Timeline.Rail>
                        <Timeline.Marker>
                          <Vault className="size-3" />
                        </Timeline.Marker>
                        <Timeline.Connector />
                      </Timeline.Rail>
                      <Timeline.Content className="flex flex-col pb-0.5">
                        <span className="text-[13px] leading-[18px] font-medium">
                          Refund by Payments · {money(refund)}
                        </span>
                        <span className="text-[12px] leading-4 text-muted">
                          Not started. Paid to {firstName(c.name)}’s registered MTN MoMo number; stays Pending until the
                          provider confirms.
                        </span>
                      </Timeline.Content>
                    </Timeline.Item>
                  </Timeline>
                ) : null}

                {c.refund ? (
                  <Alert status="success">
                    <Alert.Indicator>
                      <CircleCheck />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>{c.refund.title}</Alert.Title>
                      <Alert.Description>{c.refund.text}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : null}
                {c.heldNote ? <p className="text-[13px] text-muted">{c.heldNote}</p> : null}
              </div>
            </Tabs.Panel>
          </Tabs>
        </Card>
      </div>

      {dispute ? (
        <FormDialog
          isOpen={approveOpen}
          onOpenChange={setApproveOpen}
          title="Send settlement for approval"
          description={`${c.lease} · ${c.id} · ${c.name}`}
          footer={
            <>
              <Button variant="secondary" onPress={() => setApproveOpen(false)}>
                Cancel
              </Button>
              <Button onPress={sendForApproval}>Send to {firstName(approver?.name ?? "approver")}</Button>
            </>
          }
        >
          <KeyValueList
            items={[
              { label: "Caution held", value: <span className="tabular">{money(c.deposit)}</span> },
              { label: "Deductions", value: <span className="tabular">{money(dedTotal)}</span> },
              { label: "Refund to resident", value: <span className="tabular">{money(refund)}</span> },
              { label: "Approver", value: `${approver?.name} · ${approver?.role}` },
            ]}
          />
          <SelectField label="Reason code" value={reason} options={REASONS} onChange={setReason} />
          <TextField fullWidth value={approveNote} onChange={setApproveNote} className="gap-1">
            <Label>Note for the approver</Label>
            <TextArea rows={2} />
          </TextField>
        </FormDialog>
      ) : null}

      <FormDialog
        isOpen={noticeOpen}
        onOpenChange={setNoticeOpen}
        title="Record a notice"
        description="Starts the move-out flow. The caution deposit stays held until its refund is verified."
        footer={
          <>
            <Button variant="secondary" onPress={() => setNoticeOpen(false)}>
              Cancel
            </Button>
            <Button onPress={recordNotice} isDisabled={!notice.unit || !notice.movesOut.trim()}>
              Record notice
            </Button>
          </>
        }
      >
        <SelectField
          label="Unit and resident"
          value={notice.unit}
          options={noticeUnits.map((u) => ({ id: u.id, label: `${u.id} · ${u.resident} · ${u.lease}` }))}
          onChange={(unit) => setNotice((n) => ({ ...n, unit }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            fullWidth
            value={notice.received}
            onChange={(v) => setNotice((n) => ({ ...n, received: v }))}
            className="gap-1"
          >
            <Label>Notice received</Label>
            <Input />
          </TextField>
          <TextField
            fullWidth
            value={notice.movesOut}
            onChange={(v) => setNotice((n) => ({ ...n, movesOut: v }))}
            className="gap-1"
          >
            <Label>Moves out</Label>
            <Input />
          </TextField>
        </div>
        <SelectField
          label="Received by"
          value={notice.channel}
          options={CHANNELS}
          onChange={(channel) => setNotice((n) => ({ ...n, channel }))}
        />
        <p className="text-[12px] leading-4 text-muted">The lease requires 30 days in writing, either party.</p>
      </FormDialog>

      <Drawer.Backdrop isOpen={registerOpen} onOpenChange={setRegisterOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="reg-h" className="w-[min(480px,100vw)]">
            <Drawer.CloseTrigger aria-label="Close" />
            <Drawer.Header className="flex flex-col gap-0.5">
              <Drawer.Heading id="reg-h" className="text-[17px] leading-6 font-semibold">
                Caution deposit register
              </Drawer.Heading>
              <p className="text-[13px] text-muted tabular">
                {deposits.length} deposits · {money(depositTotal)} held as a liability, not income
              </p>
            </Drawer.Header>
            <Drawer.Body>
              <ListView aria-label="Caution deposits held" variant="secondary" items={deposits}>
                {(d) => (
                  <ListView.Item id={d.id} textValue={`${d.id} ${d.who}`}>
                    <ListView.ItemContent>
                      <span className="min-w-10 text-[15px] font-semibold tabular">{d.id.replace("-prev", "")}</span>
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title className="whitespace-normal">{d.who}</ListView.Title>
                        <ListView.Description className="tabular">
                          {d.lease} · {money(d.amount)}
                        </ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      <ToneChip tone={d.tone} className="whitespace-nowrap">
                        {d.state}
                      </ToneChip>
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
            </Drawer.Body>
            <Drawer.Footer className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onPress={() =>
                  downloadCsv("kacyiru-court-caution-deposits.csv", [
                    ["Unit", "Held for", "Lease", "Amount (RWF)", "State"],
                    ...deposits.map((d) => [d.id.replace("-prev", ""), d.who, d.lease, d.amount, d.state]),
                  ])
                }
              >
                <ArrowDownToLine className="size-4" />
                Export
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
