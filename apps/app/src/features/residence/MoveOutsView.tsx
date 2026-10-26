"use client";

import { ArrowDownToLine, Calendar, CircleCheck, Paperclip, Plus, ScalesUnbalanced, Vault } from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Input,
  Label,
  Table,
  Tabs,
  TextField,
  Toast,
  ToggleButton,
  toast,
} from "@heroui/react";
import { EmptyState, KPIGroup, ListView, Stepper } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import type { Persona } from "@injishi/data";
import type { DepositKpi, MoveOutCase, ResidenceUnit, Tone } from "@injishi/data/fixtures/residence";
import { stock } from "@injishi/data/media";
import { PageContent, PageHeader, Photo } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { type CSSProperties, Fragment, useState } from "react";
import type { LiveLease } from "@/server/sources/residence";
import { recordNoticeAction } from "./actions";
import { downloadCsv, FormDialog, kigaliCalendar, lineTab, money, SelectField, ToneChip } from "./shared";

interface MoveOutsData {
  kpis: DepositKpi[];
  cases: MoveOutCase[];
  units: ResidenceUnit[];
  /** The live leases, for each unit's caution deposit (LeaseRecord); absent on fixtures. */
  leases?: LiveLease[];
}

type Tab = "insp" | "settle";

const STEPS = ["Notice", "Inspection", "Deductions", "Resident response", "Approval", "Refund"];
const CHANNELS = ["Letter", "Resident app", "Email", "In person"];
/**
 * What this screen cannot do yet. The cases below are the prototype's (data map residence.moveOuts is deferred): the
 * platform records a notice (`POST /ops/residence/notices`) but has no inspection, deduction, dispute or approval
 * record, so a decision or a booking here would be kept nowhere. Each says so and changes nothing.
 */
const DISPUTE_UNAVAILABLE =
  "Deciding a disputed deduction is not available yet. Nothing was recorded and the resident was not told.";
const INSPECTION_UNAVAILABLE = "Booking a move-out inspection is not available yet. Nothing was booked.";
const INSPECTION_REPORT_UNAVAILABLE = "An inspection report is not available yet: inspections are not recorded.";

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

/** "14 Nov 2026": a calendar day `days` after `iso`. */
const dayMonthYearOf = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export function MoveOutsView({
  data,
  building = "",
}: {
  persona: Persona;
  data: MoveOutsData;
  /** The building(s) the workspace covers, from the session. */
  building?: string;
}) {
  const cases = data.cases;
  const [sel, setSel] = useState(data.cases[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("settle");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  // A unit already under notice is not offered again (the API refuses a second notice on a lease).
  const noticeUnits = data.units.filter((u) => u.lease && u.status !== "notice");
  const [today] = useState(() => kigaliCalendar());
  const [notice, setNotice] = useState({
    unit: noticeUnits[0]?.id ?? "",
    received: `${today.short} ${today.year}`,
    movesOut: dayMonthYearOf(today.iso, 30),
    channel: CHANNELS[1],
  });
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const c = cases.find((x) => x.id === sel) ?? cases[0];
  if (!c) return null;

  const dispute = c.dispute;
  const deductions = c.deductions;
  const status = { label: c.status, tone: c.statusTone };
  const step = c.step;
  const summary = c.summary;

  // Each deposit is the caution its lease records (LeaseRecord), never two months' rent assumed; a lease with
  // none recorded says so and is left out of the total.
  const depositOf = (leaseId: string): number | null => {
    const l = data.leases?.find((x) => x.id === leaseId);
    return l?.record?.deposit ?? null;
  };
  const deposits = [
    ...data.units
      .filter((u) => u.lease)
      .map((u) => {
        const leaving = u.status === "notice";
        return {
          id: u.id,
          who: u.resident,
          lease: u.lease,
          amount: depositOf(u.lease),
          // The caution the lease agrees, not a payment the register has seen: "Agreed", never "Held".
          state: leaving ? "Notice running" : "Agreed",
          tone: (leaving ? "accent" : "success") as Tone,
        };
      }),
  ];
  const depositTotal = deposits.reduce((t, d) => t + (d.amount ?? 0), 0);
  // The notice period of the lease the notice is being recorded for, as the lease records it.
  const noticeLease = data.leases?.find((l) => l.id === data.units.find((u) => u.id === notice.unit)?.lease);
  const noticeDays = noticeLease?.record?.noticeDays ?? null;

  /**
   * Record a notice → `POST /ops/residence/notices`. The notice is the platform's record: after the refresh the unit
   * reads "notice" and Notices running counts it. No case is drawn for it here, because the cases on this screen are
   * sample data and the platform keeps no move-out case yet; the toast says so.
   */
  const recordNotice = async () => {
    const u = data.units.find((x) => x.id === notice.unit);
    if (!u || busy) return;
    setBusy(true);
    const result = await recordNoticeAction(notice);
    setBusy(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setNoticeOpen(false);
    router.refresh();
    toast.success(`Notice recorded for ${u.id} · ${u.resident}`, {
      description:
        "It shows on the unit and in Notices running. Move-out cases are not recorded on the platform yet, so none is added below.",
      indicator: <CircleCheck className="size-4" />,
    });
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow={building ? `Tenancy · ${building}` : "Tenancy"}
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
                    value={k.value}
                    formatOptions={k.format === "currency" ? { style: "currency", currency: "RWF" } : undefined}
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
                    <Button size="sm" variant="ghost" onPress={() => toast.warning(INSPECTION_REPORT_UNAVAILABLE)}>
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
                      <Button size="sm" variant="secondary" onPress={() => toast.warning(INSPECTION_UNAVAILABLE)}>
                        {c.inspection.booked ? "Reschedule" : "Book inspection"}
                      </Button>
                      <Button size="sm" isDisabled>
                        Start inspection
                      </Button>
                    </span>
                    <span className="text-[12px] text-muted">Inspections are not recorded on the platform yet.</span>
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

                {dispute ? (
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
                      <Button size="sm" variant="secondary" onPress={() => toast.warning(DISPUTE_UNAVAILABLE)}>
                        {dispute.options.keep}
                      </Button>
                      <Button size="sm" variant="secondary" onPress={() => toast.warning(DISPUTE_UNAVAILABLE)}>
                        {dispute.options.reduce}
                      </Button>
                      <Button size="sm" variant="ghost" onPress={() => toast.warning(DISPUTE_UNAVAILABLE)}>
                        {dispute.options.drop}
                      </Button>
                    </div>
                  </>
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
            <Button onPress={recordNotice} isDisabled={busy || !notice.unit || !notice.movesOut.trim()}>
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
        <p className="text-[12px] leading-4 text-muted">
          {noticeDays === null
            ? "This lease’s notice period is not on file."
            : `The lease requires ${noticeDays} days in writing, either party.`}
        </p>
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
                {deposits.length} deposits · {money(depositTotal)} agreed in leases, a liability, not income
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
                          {d.lease} · {d.amount === null ? "amount not on file" : money(d.amount)}
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
                  downloadCsv("caution-deposits.csv", [
                    ["Unit", "Held for", "Lease", "Amount (RWF)", "State"],
                    ...deposits.map((d) => [d.id.replace("-prev", ""), d.who, d.lease, d.amount ?? "", d.state]),
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
