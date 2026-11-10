"use client";

import {
  ArrowRight,
  Calculator,
  Calendar,
  Check,
  CircleCheck,
  CircleDollar,
  Ellipsis,
  Eye,
  FileDollar,
  Hourglass,
  Lock,
  PaperPlane,
  Person as PersonIcon,
  Persons,
  PersonsLock,
  ScalesBalanced,
  ShieldCheck,
  ShieldExclamation,
  Wallet,
  Wrench,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  AvatarGroup,
  Button,
  Chip,
  Drawer,
  Dropdown,
  Label,
  Modal,
  Tabs,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { ItemCard, ItemCardGroup, KPIGroup, Stepper } from "@heroui-pro/react";
import { DataGrid, type DataGridColumn } from "@heroui-pro/react/data-grid";
import { KPI } from "@heroui-pro/react/kpi";
import { GateChip, Icon, KeyValueList, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, type ReactNode, useMemo, useState, useTransition } from "react";
import type { Done } from "../../model/commands.ts";
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
  PayRunState,
  PayRunStep,
  PayRunTotal,
} from "../../model/payroll.ts";
import { useBoardHref, useHrActions, useHrFeature } from "../mount.tsx";
import { avatarColor, firstName, initials, Person, TAB_CLASS } from "../people/parts";
import { BlockerFixDrawer } from "./blocker-fix-drawer";
import { ClaimsPanel } from "./claims-panel";
import { FinalSettlements } from "./final-settlements";
import { FixPay } from "./fix-pay";
import { LoansPanel } from "./loans-panel";
import { AmountList, type AmountRow, LineDonut, openPendingTab } from "./parts";
import { PastRunDrawer } from "./past-run-drawer";
import { type PayLineFigures, payLineFigures, pct, rwf, signedRwf } from "./pay-calc";
import { PayLinesGrid } from "./pay-lines-grid";
import { Change, PaymentRails, PayRunCharts } from "./pay-run-charts";

export interface PayRunData {
  /** Where the run stands and what the person may do; `live: false` on the sample board. */
  state: PayRunState;
  rates: PayRates;
  lines: PayLine[];
  steps: PayRunStep[];
  exceptions: PayRunException[];
  rules: PayRunRule[];
  totals: PayRunTotal[];
  /** Everyone leaving this month. */
  settlements: FinalSettlement[];
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

/** Each total's icon, and the field of an earlier month it is compared with. */
const TOTAL_LOOK: Record<string, { icon: ReactNode; was?: "staff" | "gross" | "paye" | "rssb" | "net" }> = {
  staff: { icon: <Persons />, was: "staff" },
  gross: { icon: <CircleDollar />, was: "gross" },
  paye: { icon: <FileDollar />, was: "paye" },
  rssb: { icon: <ShieldCheck />, was: "rssb" },
  loans: { icon: <Calculator /> },
  net: { icon: <Wallet />, was: "net" },
};

/** A blocker's cause, said of several people at once: "8 still clocked in". */
const BLOCKER_LABEL: Record<string, string> = {
  open_attendance: "still clocked in",
  unvalidated_attendance: "clock records to check",
  overtime_day_unknown: "overtime days to set",
  missing_rssb_number: "without an RSSB number",
  missing_id: "without an ID document",
};

/** Previous runs: each month against the one before it, newest first. */
type HistoryRow = PayRunHistory & { before: PayRunHistory | null };
const historyColumns: DataGridColumn<HistoryRow>[] = [
  {
    id: "period",
    header: "Period",
    isRowHeader: true,
    minWidth: 150,
    cell: (h) => <span className="font-semibold">{h.period}</span>,
  },
  {
    id: "staff",
    header: "Staff",
    align: "end",
    cell: (h) => (
      <span className="inline-flex items-center gap-2 tabular">
        {h.staff}
        <Change now={h.staff} before={h.before?.staff} unit="count" />
      </span>
    ),
  },
  {
    id: "net",
    header: "Net pay",
    align: "end",
    minWidth: 190,
    cell: (h) => (
      <span className="inline-flex items-center gap-2 tabular">
        <span className="font-semibold">{rwf(h.net)}</span>
        <Change now={h.net} before={h.before?.net} />
      </span>
    ),
  },
  {
    id: "prepared",
    header: "Prepared",
    cell: (h) =>
      h.preparedBy === "—" ? <span className="text-muted">—</span> : <Person name={h.preparedBy} sub={h.preparedAt} />,
  },
  {
    id: "confirmed",
    header: "Confirmed",
    cell: (h) =>
      h.confirmedBy === "—" ? (
        <span className="text-muted">—</span>
      ) : (
        <Person name={h.confirmedBy} sub={h.confirmedAt} />
      ),
  },
  {
    id: "outcome",
    header: "Outcome",
    cell: (h) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <Chip size="sm" variant="soft" color="success">
          <CircleCheck className="size-3" aria-hidden="true" />
          <Chip.Label>{h.outcome}</Chip.Label>
        </Chip>
        {h.combinedPermission ? (
          <Chip size="sm" variant="soft" color="warning">
            One person
          </Chip>
        ) : null}
      </span>
    ),
  },
  {
    id: "open",
    header: <span className="sr-only">Open</span>,
    width: 48,
    align: "end",
    cell: () => <ArrowRight className="size-4 text-muted" aria-hidden="true" />,
  },
];

/** A live line's figures are the API's; the sample board works them out from the rule snapshot. */
function figuresOf(line: PayLine, rates: PayRates): PayLineFigures {
  const f = line.figures;
  if (!f) return payLineFigures(line, rates);
  return {
    gross: f.gross,
    paye: f.paye,
    pension: 0,
    maternity: 0,
    rssb: f.rssb,
    otherDeductions: f.otherDeductions,
    onTop: f.nonIncome,
    net: f.net,
    employer: f.employer,
  };
}

/** Which dialog is open: handing the month over, sending it back, or freezing it. */
type Dialog = null | "submit" | "sendBack" | "confirm";

/** The parts of the board below the totals. */
type BoardTab = "lines" | "exceptions" | "documents" | "claims" | "loans" | "history";

/** What can be done about one exception, in a menu so the rows stay quiet. */
function ExceptionMenu({
  x,
  canHold,
  isDisabled,
  onFix,
  onOpenFile,
  onHold,
  onLook,
}: {
  x: PayRunException;
  canHold: boolean;
  isDisabled: boolean;
  onFix: () => void;
  onOpenFile: () => void;
  onHold: () => void;
  onLook: () => void;
}) {
  const items: { id: string; label: string; icon: ReactNode; run: () => void }[] = [
    ...(x.blocker ? [{ id: "fix", label: "Fix", icon: <Wrench className="size-4 text-muted" />, run: onFix }] : []),
    ...(x.blocker && x.employeeId
      ? [{ id: "file", label: "Open file", icon: <PersonIcon className="size-4 text-muted" />, run: onOpenFile }]
      : []),
    ...(canHold
      ? [{ id: "hold", label: "Pay next month", icon: <Calendar className="size-4 text-muted" />, run: onHold }]
      : []),
    ...(!x.blocker && x.lineId
      ? [{ id: "look", label: "See the pay line", icon: <Eye className="size-4 text-muted" />, run: onLook }]
      : []),
  ];
  if (items.length === 0) return null;
  const name = `Act on ${x.who || x.title}`;
  return (
    <Dropdown>
      <Button isIconOnly size="sm" variant="ghost" aria-label={name} isDisabled={isDisabled}>
        <Ellipsis className="size-4" aria-hidden="true" />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-[180px]">
        <Dropdown.Menu aria-label={name} onAction={(k) => items.find((i) => i.id === k)?.run()}>
          {items.map((i) => (
            <Dropdown.Item key={i.id} id={i.id} textValue={i.label}>
              {i.icon}
              <Label>{i.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/**
 * Where a live run stands and the buttons that move it. HR prepares and submits (`payroll.draft`);
 * whoever confirms (`payroll.run`, the owner) confirms or sends it back. An owner who prepares the
 * month alone confirms it without submitting.
 */
function LiveStatus({
  state,
  headcount,
  blockers,
  pending,
  onPrepare,
  onRecompute,
  onSubmit,
  onWithdraw,
  onSendBack,
  onConfirm,
  onFix,
}: {
  state: PayRunState;
  headcount: number;
  blockers: number;
  pending: boolean;
  onPrepare: (period: string) => void;
  onRecompute: () => void;
  onSubmit: () => void;
  onWithdraw: () => void;
  onSendBack: () => void;
  onConfirm: () => void;
  /** Opens the list of what stops the month, to put each right. */
  onFix: () => void;
}) {
  const prepareNext =
    state.nextPeriod && state.canPrepare ? (
      <Button isPending={pending} onPress={() => onPrepare(state.nextPeriod as string)}>
        <PaperPlane className="size-4" aria-hidden="true" />
        Prepare {state.nextPeriodLabel}
      </Button>
    ) : null;

  if (!state.runId) {
    return (
      <Alert status="accent" role="status" className="flex-wrap items-center">
        <Alert.Indicator>
          <Hourglass aria-hidden="true" />
        </Alert.Indicator>
        <Alert.Content className="min-w-0 flex-[1_1_260px]">
          <Alert.Title>No pay run for {state.nextPeriodLabel ?? "this month"} yet</Alert.Title>
          <Alert.Description>
            {state.canPrepare ? "Nothing is paid until it is confirmed." : "HR prepares it first."}
          </Alert.Description>
        </Alert.Content>
        <div className="ms-auto shrink-0">{prepareNext}</div>
      </Alert>
    );
  }

  if (state.stage === "review") {
    return (
      <Alert status={blockers > 0 ? "warning" : "accent"} role="status" className="flex-wrap items-center">
        <Alert.Indicator>
          <PersonsLock aria-hidden="true" />
        </Alert.Indicator>
        <Alert.Content className="min-w-0 flex-[1_1_260px]">
          <Alert.Title>
            {blockers > 0
              ? `${blockers} thing${blockers === 1 ? "" : "s"} stop${blockers === 1 ? "s" : ""} this month`
              : state.canConfirm
                ? "Ready to confirm"
                : `Ready to submit to ${state.confirmerName}`}
          </Alert.Title>
          <Alert.Description>
            {state.canConfirm
              ? "Confirming freezes the month."
              : `${state.confirmerName} confirms and releases the files.`}
          </Alert.Description>
        </Alert.Content>
        <div className="ms-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" isPending={pending} onPress={onRecompute}>
            Compute again
          </Button>
          {blockers > 0 ? (
            <Button onPress={onFix}>
              <Wrench className="size-4" aria-hidden="true" />
              Fix {blockers}
            </Button>
          ) : null}
          {state.canConfirm ? (
            <Button isDisabled={blockers > 0} isPending={pending} onPress={onConfirm}>
              <CircleCheck className="size-4" aria-hidden="true" />
              Confirm pay for {headcount}
            </Button>
          ) : (
            <Button isDisabled={blockers > 0} isPending={pending} onPress={onSubmit}>
              <PaperPlane className="size-4" aria-hidden="true" />
              Submit for confirmation
            </Button>
          )}
        </div>
      </Alert>
    );
  }

  if (state.stage === "submitted") {
    return (
      <Alert status="default" role="status" className="flex-wrap items-center">
        <Alert.Indicator>
          <Hourglass aria-hidden="true" />
        </Alert.Indicator>
        <Alert.Content className="min-w-0 flex-[1_1_260px]">
          <Alert.Title>
            {state.canConfirm
              ? `Submitted by ${state.preparerName} · ${state.submittedLabel}`
              : `Submitted to ${state.confirmerName} · awaiting confirmation`}
          </Alert.Title>
          <Alert.Description>
            {state.submitNote
              ? `“${state.submitNote}”`
              : state.canConfirm
                ? "Check the lines, then confirm."
                : "Locked while it waits."}
          </Alert.Description>
        </Alert.Content>
        <div className="ms-auto flex shrink-0 flex-wrap items-center gap-2">
          {state.canConfirm ? (
            <>
              <Button variant="secondary" isPending={pending} onPress={onSendBack}>
                Send back
              </Button>
              <Button isPending={pending} onPress={onConfirm}>
                <CircleCheck className="size-4" aria-hidden="true" />
                Confirm pay for {headcount}
              </Button>
            </>
          ) : (
            <Button variant="secondary" isPending={pending} onPress={onWithdraw}>
              Withdraw to edit
            </Button>
          )}
        </div>
      </Alert>
    );
  }

  return (
    <Alert status="success" role="status" className="flex-wrap items-center">
      <Alert.Indicator>
        <CircleCheck aria-hidden="true" />
      </Alert.Indicator>
      <Alert.Content className="min-w-0 flex-[1_1_260px]">
        <Alert.Title>Confirmed by {state.confirmedLabel}</Alert.Title>
      </Alert.Content>
      <div className="ms-auto shrink-0">{prepareNext}</div>
    </Alert>
  );
}

export function PayRunView({ data, initialStage }: { data: PayRunData; initialStage: PayRunStage }) {
  const { buildPayFile, confirmPayRun, holdPayslip, preparePayRun, recomputePayRun, submitPayRun, withdrawPayRun } =
    useHrActions();
  const screenHref = useBoardHref();
  // Claims and loans are features Injishi may switch off: their tabs go, the deductions already made stay.
  const claimsOn = useHrFeature("claims");
  const loansOn = useHrFeature("loans");
  const router = useRouter();
  const { rates, lines, exceptions, state } = data;
  const live = state.live;
  const [stage, setStage] = useState<PayRunStage>(initialStage);
  const [dialog, setDialog] = useState<Dialog>(null);
  const dialogOpen = dialog === "submit";
  const setDialogOpen = (open: boolean) => setDialog(open ? "submit" : null);
  const [words, setWords] = useState("");
  const [pending, startTransition] = useTransition();
  /** Run one of the board's actions; a refusal is shown in the API's words. */
  const act = (run: () => Promise<Done>, done?: string) =>
    startTransition(async () => {
      const result = await run();
      if (!result.ok) toast.danger(result.error);
      else if (done) toast.success(done);
    });
  const runId = state.runId;
  const [lineOpen, setLineOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [tab, setTab] = useState<BoardTab>("lines");
  // The earlier month whose run is open in a drawer.
  const [pastRun, setPastRun] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(exceptions.map((x) => [x.id, x.reviewed])),
  );
  const [selectedId, setSelectedId] = useState<string>(
    () => exceptions.find((x) => !x.reviewed && x.lineId)?.lineId ?? lines[0]?.id ?? "",
  );

  const figures = useMemo(() => new Map(lines.map((l) => [l.id, figuresOf(l, rates)])), [lines, rates]);
  const locked = stage !== "review";
  const confirmed = stage === "confirmed";
  const reviewedCount = exceptions.filter((x) => reviewed[x.id]).length;
  // A live month waits on its blockers, not on a reviewer's ticks.
  const blockers = exceptions.filter((x) => x.blocker);
  const unreviewed = live ? blockers.length : exceptions.length - reviewedCount;
  const staffTotal = data.totals.find((t) => t.id === "staff")?.value ?? lines.length;
  const netTotal = data.totals.find((t) => t.id === "net");
  // The month before, for the change on each total.
  const prev = data.history[0] ?? null;
  // Blockers with one cause fold into one row ("8 still clocked in"), fixed together in the drawer.
  const exRows: ({ kind: "one"; x: PayRunException } | { kind: "group"; code: string; items: PayRunException[] })[] =
    [];
  if (live) {
    const byCode = new Map<string, PayRunException[]>();
    for (const x of blockers) byCode.set(x.code ?? x.id, [...(byCode.get(x.code ?? x.id) ?? []), x]);
    for (const [code, items] of byCode)
      exRows.push(items.length > 1 ? { kind: "group", code, items } : { kind: "one", x: items[0] });
    for (const x of exceptions) if (!x.blocker) exRows.push({ kind: "one", x });
  } else for (const x of exceptions) exRows.push({ kind: "one", x });
  // Recording a loan is `payroll.run`'s (`POST /ops/loans`), so only they are offered it.
  const canLend = live && state.canConfirm;
  const hasExceptionsTab = exceptions.length > 0 || data.settlements.length > 0;
  const tabs: { id: BoardTab; label: string; count?: number }[] = [
    { id: "lines", label: "Pay lines" },
    ...(hasExceptionsTab ? [{ id: "exceptions" as const, label: "Exceptions", count: exceptions.length }] : []),
    { id: "documents", label: "Payslips and returns" },
    ...(claimsOn ? [{ id: "claims" as const, label: "Claims" }] : []),
    ...(canLend && loansOn ? [{ id: "loans" as const, label: "Loans and advances" }] : []),
    ...(data.history.length ? [{ id: "history" as const, label: "Previous runs", count: data.history.length }] : []),
  ];
  // The tab open can go away, when the last exception of the month is fixed.
  const shownTab = tabs.some((t) => t.id === tab) ? tab : "lines";
  /** A line's breakdown opens in the drawer beside the list. */
  const openLine = (id: string) => {
    setSelectedId(id);
    setLineOpen(true);
  };

  const selected = lines.find((l) => l.id === selectedId) ?? lines[0];
  const sel = selected ? figures.get(selected.id) : undefined;
  const breakdown: AmountRow[] =
    selected && sel && selected.figures
      ? [
          { label: "Base", value: rwf(selected.base) },
          { label: "Allowances", value: rwf(selected.allowances) },
          ...(selected.other
            ? [{ label: selected.otherLabel ?? "Other pay", value: signedRwf(selected.other, "+") }]
            : []),
          { label: "Gross pay", value: rwf(sel.gross), total: true },
          { label: `PAYE · bands ${rates.id}`, value: signedRwf(sel.paye, "−") },
          { label: "RSSB, employee share", value: signedRwf(sel.rssb, "−") },
          ...(selected.figures.otherDeductions
            ? [
                {
                  label: selected.loanLabel ?? "Loans and deductions",
                  value: signedRwf(selected.figures.otherDeductions, "−"),
                },
              ]
            : []),
          ...(selected.figures.nonIncome
            ? [
                {
                  label: selected.figures.nonIncomeLabel ?? "Paid on top",
                  value: signedRwf(selected.figures.nonIncome, "+"),
                },
              ]
            : []),
          { label: `Net pay · ${selected.payBy}`, value: rwf(sel.net), total: true },
          { label: "Employer RSSB contributions", value: rwf(sel.employer) },
        ]
      : selected && sel
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

  /** Build a payment file or a declaration and open it; whoever was left out is named. */
  const buildFile = (id: string, kind: "bank" | "momo" | "paye" | "rssb") => {
    const pendingTab = openPendingTab();
    startTransition(async () => {
      const result = await buildPayFile(id, kind).catch(() => null);
      if (!result?.ok) {
        pendingTab.close();
        toast.danger(result?.error ?? "The file could not be built. Try again.");
        return;
      }
      pendingTab.go(result.url);
      if (result.leftOut.length > 0) toast.warning(`Left out: ${result.leftOut.join("; ")}`);
      else toast.success(pendingTab.opened ? "Built and opened in a new tab." : "Built. The download is starting.");
    });
  };

  const markReviewed = (x: PayRunException) => {
    setReviewed((r) => ({ ...r, [x.id]: true }));
    if (x.lineId) openLine(x.lineId);
  };

  const stepDesc = (s: PayRunStep) => {
    if (live) return confirmed && s.confirmedDesc ? s.confirmedDesc : s.desc;
    if (s.id === "review" && stage === "review")
      return `Checks passed · ${reviewedCount} of ${exceptions.length} exceptions`;
    if (confirmed && s.confirmedDesc) return s.confirmedDesc;
    return s.desc;
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow={state.eyebrow}
        title={state.title}
        description={state.description}
        actions={
          <LinkButton href={screenHref("PayrollRules")} variant="secondary">
            <ScalesBalanced className="size-4" aria-hidden="true" />
            Payroll rules
          </LinkButton>
        }
      />

      <div className="overflow-x-auto">
        <Stepper
          aria-label="Pay run steps"
          currentStep={live && !runId ? 0 : STAGE_STEP[stage]}
          size="md"
          className="min-w-[640px]"
        >
          {data.steps.map((s, i) => (
            <Stepper.Step key={s.id}>
              <StepIndicator locked={i === RELEASE_STEP} />
              <Stepper.Content>
                <Stepper.Title className="text-[14px] leading-5">{s.title}</Stepper.Title>
                <Stepper.Description className="text-xs leading-4">{stepDesc(s)}</Stepper.Description>
              </Stepper.Content>
              <Stepper.Separator />
            </Stepper.Step>
          ))}
        </Stepper>
      </div>

      {live ? (
        <LiveStatus
          state={state}
          headcount={staffTotal}
          blockers={blockers.length}
          pending={pending}
          onPrepare={(period) => act(() => preparePayRun(period), "Month computed. Check the lines.")}
          onRecompute={() => runId && act(() => recomputePayRun(runId), "Computed again.")}
          onSubmit={() => {
            setWords("");
            setDialog("submit");
          }}
          onWithdraw={() => runId && act(() => withdrawPayRun(runId, null), "Withdrawn for editing.")}
          onSendBack={() => {
            setWords("");
            setDialog("sendBack");
          }}
          onConfirm={() => setDialog("confirm")}
          onFix={() => setFixOpen(true)}
        />
      ) : stage === "review" ? (
        <Alert status="accent" role="status" className="flex-wrap items-center">
          <Alert.Indicator>
            <PersonsLock aria-hidden="true" />
          </Alert.Indicator>
          <Alert.Content className="min-w-0 flex-[1_1_260px]">
            <Alert.Title>You prepared this run. {state.confirmerName} must confirm it.</Alert.Title>
            <Alert.Description>You submit; they confirm and release the files.</Alert.Description>
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
            <Alert.Title>Submitted to {state.confirmerName} · awaiting confirmation</Alert.Title>
            <Alert.Description>Locked while it waits.</Alert.Description>
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
            <Alert.Title>Confirmed by {state.confirmerName} · today 11:20</Alert.Title>
            <Alert.Description>With a documented exception · files await release</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted">Rules</span>
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
          {data.totals.map((t, i) => {
            const look = TOTAL_LOOK[t.id];
            const was = look?.was && prev ? prev[look.was] : undefined;
            const up = was ? t.value > was : false;
            const trend =
              was && was !== t.value ? (
                <KPI.Trend trend={up ? "up" : "down"}>
                  {t.format === "count"
                    ? `${up ? "+" : "−"}${Math.abs(t.value - was)}`
                    : `${up ? "+" : "−"}${Math.abs(((t.value - was) / was) * 100).toFixed(1)}%`}
                </KPI.Trend>
              ) : null;
            const foot = totalFoot(t) || (trend && prev ? `on ${prev.period.split(" ")[0]}` : "");
            return (
              <Fragment key={t.id}>
                {i > 0 ? <KPIGroup.Separator /> : null}
                <KPI className="min-w-[170px] flex-[1_1_170px] gap-1.5">
                  <KPI.Header>
                    {look ? <KPI.Icon>{look.icon}</KPI.Icon> : null}
                    <KPI.Title>{t.label}</KPI.Title>
                  </KPI.Header>
                  <KPI.Content className="flex flex-none flex-wrap items-center gap-x-2 gap-y-1">
                    <KPI.Value
                      value={t.value}
                      formatOptions={t.format === "rwf" ? { style: "currency", currency: "RWF" } : undefined}
                      className="text-[20px] leading-7 font-bold tabular"
                    />
                    {trend}
                  </KPI.Content>
                  {foot ? (
                    <KPI.Footer>
                      <p className="text-xs leading-4 text-muted">{foot}</p>
                    </KPI.Footer>
                  ) : null}
                </KPI>
              </Fragment>
            );
          })}
        </KPIGroup>
      </section>

      <PayRunCharts
        totals={data.totals}
        history={data.history}
        period={data.state.period}
        nets={lines.filter((l) => !l.confidential).map((l) => figures.get(l.id)?.net ?? 0)}
        rails={
          <PaymentRails
            files={data.files}
            unpaid={lines
              .filter((l) => l.payBy === "No pay account" && !l.confidential)
              .map((l) => ({ id: l.employeeId, name: l.name }))}
            confirmed={confirmed}
            lockLabel={
              !confirmed
                ? "Locked until confirmation"
                : live && state.canConfirm
                  ? "You release"
                  : `Release: ${state.confirmerName}`
            }
            note={
              live
                ? confirmed
                  ? state.canConfirm
                    ? "Build each file, then upload it to the bank or MoMo portal."
                    : `Waiting for ${state.confirmerName} to release.`
                  : "Built once the owner confirms."
                : confirmed
                  ? `Waiting for ${state.confirmerName} to release.`
                  : "Locked until the owner confirms."
            }
            canBuild={live && confirmed && state.canConfirm && !!runId}
            building={pending}
            onBuild={(kind) => runId && buildFile(runId, kind)}
          />
        }
      />

      <Tabs variant="secondary" selectedKey={shownTab} onSelectionChange={(k) => setTab(String(k) as BoardTab)}>
        <Tabs.ListContainer className="overflow-x-auto">
          <Tabs.List aria-label="Pay run part" className="justify-start gap-1">
            {tabs.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className={TAB_CLASS}>
                {t.label}
                {t.count ? (
                  <Chip
                    size="sm"
                    variant="soft"
                    color={t.id === "exceptions" && blockers.length ? "danger" : "default"}
                  >
                    {t.count}
                  </Chip>
                ) : null}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="lines" className="flex flex-col gap-4 pt-3">
          <PayLinesGrid
            lines={lines}
            figures={figures}
            staffTotal={staffTotal}
            exceptionCount={exceptions.length}
            onOpen={openLine}
          />
        </Tabs.Panel>

        {hasExceptionsTab ? (
          <Tabs.Panel id="exceptions" className="flex flex-col gap-4 pt-3">
            <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
              {exceptions.length ? (
                <ItemCardGroup layout="list" variant="default" aria-labelledby="ex-h">
                  <ItemCardGroup.Header className="flex items-center gap-2">
                    <ItemCardGroup.Title id="ex-h" aria-level={2} className="flex-1">
                      Exceptions
                    </ItemCardGroup.Title>
                    {live ? (
                      <>
                        {blockers.length ? (
                          <Chip size="sm" variant="soft" color="danger">
                            {blockers.length} to fix
                          </Chip>
                        ) : null}
                        {exceptions.length - blockers.length ? (
                          <Chip size="sm" variant="soft" color="warning">
                            {exceptions.length - blockers.length} worth a look
                          </Chip>
                        ) : null}
                      </>
                    ) : (
                      <Chip
                        size="sm"
                        variant="soft"
                        color={reviewedCount === exceptions.length ? "success" : "warning"}
                      >
                        {reviewedCount} of {exceptions.length} reviewed
                      </Chip>
                    )}
                  </ItemCardGroup.Header>
                  {exRows.map((row) => {
                    if (row.kind === "group") {
                      const names = row.items.map((x) => x.who ?? x.title.split(" · ")[0]);
                      return (
                        <ItemCard key={row.code} className="items-start">
                          <ItemCard.Icon className="size-9 rounded-xl bg-danger-soft text-danger-soft-foreground [&>svg]:size-[18px]">
                            <Icon name={row.items[0].icon} />
                          </ItemCard.Icon>
                          <ItemCard.Content className="min-w-0 flex-1 gap-1.5">
                            <ItemCard.Title className="whitespace-normal">
                              {row.items.length} {BLOCKER_LABEL[row.code] ?? "to fix"}
                            </ItemCard.Title>
                            <span className="flex flex-wrap items-center gap-2">
                              <AvatarGroup size="sm" variant="soft" overlap="ring" max={6} aria-hidden="true">
                                {names.map((n) => (
                                  <Avatar key={n} color={avatarColor(n)}>
                                    <Avatar.Fallback>{initials(n)}</Avatar.Fallback>
                                  </Avatar>
                                ))}
                              </AvatarGroup>
                              <ItemCard.Description className="min-w-0 flex-1 truncate">
                                {names.map(firstName).join(", ")}
                              </ItemCard.Description>
                            </span>
                          </ItemCard.Content>
                          <ItemCard.Action className="shrink-0 self-center">
                            <Button size="sm" onPress={() => setFixOpen(true)}>
                              <Wrench className="size-4" aria-hidden="true" />
                              Fix {row.items.length}
                            </Button>
                          </ItemCard.Action>
                        </ItemCard>
                      );
                    }
                    const x = row.x;
                    const done = !!reviewed[x.id];
                    const tone = x.blocker ? "danger" : live || !done ? "warning" : "success";
                    return (
                      <ItemCard key={x.id} className="items-start">
                        <ItemCard.Icon
                          className={`size-9 rounded-xl [&>svg]:size-[18px] ${
                            tone === "danger"
                              ? "bg-danger-soft text-danger-soft-foreground"
                              : tone === "warning"
                                ? "bg-warning-soft text-warning-soft-foreground"
                                : "bg-success-soft text-success-soft-foreground"
                          }`}
                        >
                          <Icon name={x.icon} />
                        </ItemCard.Icon>
                        <ItemCard.Content className="min-w-0 flex-1">
                          <ItemCard.Title className="whitespace-normal">{x.title}</ItemCard.Title>
                          <ItemCard.Description className="whitespace-normal">{x.detail}</ItemCard.Description>
                        </ItemCard.Content>
                        <ItemCard.Action className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 self-center">
                          {live ? (
                            <ExceptionMenu
                              x={x}
                              canHold={!!(x.canHold && runId && x.employeeId)}
                              isDisabled={pending}
                              onFix={() => setFixOpen(true)}
                              onOpenFile={() =>
                                router.push(
                                  `${screenHref("Employees")}?employee=${encodeURIComponent(x.employeeId ?? "")}`,
                                )
                              }
                              onHold={() => {
                                const who = x.employeeId;
                                if (!runId || !who) return;
                                act(
                                  () => holdPayslip(runId, who, `Paid next month: ${x.detail}`.slice(0, 500)),
                                  "Paid next month. The draft is computed again without them.",
                                );
                              }}
                              onLook={() => (x.lineId ? openLine(x.lineId) : undefined)}
                            />
                          ) : !done && !locked ? (
                            <Button size="sm" variant="secondary" onPress={() => markReviewed(x)}>
                              Mark reviewed
                            </Button>
                          ) : (
                            <Chip size="sm" variant="soft" color={done ? "success" : "warning"}>
                              {done ? "Reviewed" : "Not reviewed"}
                            </Chip>
                          )}
                        </ItemCard.Action>
                      </ItemCard>
                    );
                  })}
                </ItemCardGroup>
              ) : null}

              <FinalSettlements settlements={data.settlements} lines={lines} figures={figures} />
            </div>
          </Tabs.Panel>
        ) : null}

        <Tabs.Panel id="documents" className="flex flex-col gap-4 pt-3">
          <ItemCardGroup
            layout="grid"
            aria-labelledby="ps-h"
            className="[grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]"
          >
            <ItemCardGroup.Header>
              <ItemCardGroup.Title id="ps-h" aria-level={2}>
                Payslips and declarations
              </ItemCardGroup.Title>
            </ItemCardGroup.Header>
            {data.outputs.map((o) => {
              const ready = o.readyAfter === "confirmation" && confirmed;
              return (
                <ItemCard key={o.id}>
                  <ItemCard.Icon
                    className={`size-10 rounded-xl [&>svg]:size-5 ${ready ? "bg-success-soft text-success-soft-foreground" : "bg-default text-muted"}`}
                  >
                    <Icon name={o.icon} />
                  </ItemCard.Icon>
                  <ItemCard.Content className="min-w-0 flex-1">
                    <ItemCard.Title>{o.title}</ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">{o.meta}</ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    {live && ready && state.canConfirm && runId && o.kind ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        isPending={pending}
                        onPress={() => buildFile(runId, o.kind as "paye" | "rssb")}
                      >
                        Build
                      </Button>
                    ) : (
                      <Chip size="sm" variant="soft" color={ready ? "success" : "default"}>
                        {!ready ? <Lock className="size-3" aria-hidden="true" /> : null}
                        <Chip.Label>
                          {o.readyAfter === "release" ? "After release" : ready ? "Ready" : "After confirmation"}
                        </Chip.Label>
                      </Chip>
                    )}
                  </ItemCard.Action>
                </ItemCard>
              );
            })}
          </ItemCardGroup>
        </Tabs.Panel>

        {claimsOn ? (
          <Tabs.Panel id="claims" className="flex flex-col gap-4 pt-3">
            <ClaimsPanel canDecide={state.canConfirm} />
          </Tabs.Panel>
        ) : null}

        {canLend && loansOn ? (
          <Tabs.Panel id="loans" className="flex flex-col gap-4 pt-3">
            <LoansPanel period={state.period} isConfirmed={confirmed} />
          </Tabs.Panel>
        ) : null}

        {data.history.length ? (
          <Tabs.Panel id="history" className="flex flex-col gap-4 pt-3">
            <DataGrid
              aria-label="Previous runs"
              data={data.history.map((h, i) => ({ ...h, before: data.history[i + 1] ?? null }))}
              columns={historyColumns}
              getRowId={(h) => h.id}
              onRowAction={(key) => setPastRun(String(key))}
              contentClassName="min-w-[820px] [&_tbody_tr]:cursor-pointer"
              renderEmptyState={() => <span className="text-xs text-muted">No confirmed month before this one.</span>}
            />
          </Tabs.Panel>
        ) : null}
      </Tabs>

      {live ? (
        <Modal.Backdrop isOpen={dialog !== null} onOpenChange={(open) => (open ? undefined : setDialog(null))}>
          <Modal.Container size="md">
            <Modal.Dialog aria-labelledby="live-d-h">
              <Modal.Header>
                <Modal.Heading id="live-d-h" className="text-[18px] leading-6 font-semibold">
                  {dialog === "confirm"
                    ? `Confirm ${state.title.replace(" pay run", "")} pay for ${staffTotal}?`
                    : dialog === "submit"
                      ? `Submit ${state.title.replace(" pay run", "")} to ${state.confirmerName}?`
                      : `Send ${state.title.replace(" pay run", "")} back to ${state.preparerName}?`}
                </Modal.Heading>
                <p className="mt-1.5 text-sm leading-5 text-muted">
                  {dialog === "confirm"
                    ? "This freezes the month. It cannot be undone."
                    : dialog === "submit"
                      ? "Locked while it waits. You can withdraw it until confirmed."
                      : "It goes back with your reason. Nothing is paid."}
                </p>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-[16px]">
                {dialog === "submit" || dialog === "confirm" ? (
                  <KeyValueList
                    items={[
                      { label: "Staff", value: String(staffTotal) },
                      { label: "Net pay", value: netTotal ? rwf(netTotal.value) : "—" },
                      { label: "Employer cost", value: netTotal?.footAmount ? rwf(netTotal.footAmount) : "—" },
                      { label: "Rules", value: data.rules.map((r) => r.label.split(" · ")[0]).join(", ") || "—" },
                    ]}
                  />
                ) : null}
                {dialog === "confirm" ? null : (
                  <TextField fullWidth value={words} onChange={setWords}>
                    <Label>
                      {dialog === "submit" ? `Note to ${state.confirmerName} (optional)` : "Why (optional)"}
                    </Label>
                    <TextArea
                      variant="secondary"
                      rows={2}
                      placeholder={
                        dialog === "submit"
                          ? "Two people paid next month while their files are fixed"
                          : "Overtime not approved yet"
                      }
                    />
                  </TextField>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button
                  isPending={pending}
                  onPress={() => {
                    const said = words.trim() || null;
                    const which = dialog;
                    setDialog(null);
                    if (!runId) return;
                    if (which === "confirm")
                      act(() => confirmPayRun(runId), "Confirmed. Payslips and files are ready.");
                    else if (which === "submit")
                      act(() => submitPayRun(runId, said), `Submitted to ${state.confirmerName}.`);
                    else act(() => withdrawPayRun(runId, said), `Sent back to ${state.preparerName}.`);
                  }}
                >
                  {dialog === "confirm"
                    ? `Confirm pay for ${staffTotal}`
                    : dialog === "submit"
                      ? "Submit for confirmation"
                      : "Send back"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      ) : null}

      <Modal.Backdrop isOpen={!live && dialogOpen && stage === "review"} onOpenChange={setDialogOpen}>
        <Modal.Container size="md">
          <Modal.Dialog aria-labelledby="sd-h">
            <Modal.Header>
              <Modal.Heading id="sd-h" className="text-[18px] leading-6 font-semibold">
                Submit October run to {state.confirmerName}?
              </Modal.Heading>
              <p className="mt-1.5 text-sm leading-5 text-muted">Locked while it is reviewed.</p>
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
                </Alert.Content>
              </Alert>
              <TextField fullWidth>
                <Label>Note to {state.confirmerName} (optional)</Label>
                <TextArea variant="secondary" rows={2} placeholder="Retroactive line follows your 30 Sep approval" />
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
      <PastRunDrawer
        summary={data.history.find((h) => h.id === pastRun) ?? null}
        previous={data.history[data.history.findIndex((h) => h.id === pastRun) + 1] ?? null}
        canFiles={state.canConfirm}
        building={pending}
        onBuild={(kind) => pastRun && buildFile(pastRun, kind)}
        onOpenChange={(open) => {
          if (!open) setPastRun(null);
        }}
      />
      <BlockerFixDrawer
        isOpen={fixOpen}
        onOpenChange={setFixOpen}
        blockers={exceptions.filter((x) => x.blocker)}
        runId={runId}
        holding={pending}
        canSetEmployerNumber={state.canConfirm}
        onHold={(x) =>
          runId && x.employeeId
            ? act(
                () => holdPayslip(runId, x.employeeId as string, `Paid next month: ${x.detail}`.slice(0, 500)),
                "Paid next month. The draft is computed again without them.",
              )
            : undefined
        }
      />
      <Drawer.Backdrop isOpen={lineOpen && !!selected} onOpenChange={setLineOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="pl-h" className="w-full max-w-[460px]">
            <Drawer.CloseTrigger aria-label="Close" />
            {selected ? (
              <>
                <Drawer.Header className="flex flex-col gap-2">
                  <Drawer.Heading id="pl-h" className="sr-only">
                    Pay line · {selected.name}
                  </Drawer.Heading>
                  {selected.confidential ? (
                    <span className="flex items-center gap-2 text-[17px] font-semibold">
                      <Lock className="size-4 text-muted" aria-hidden="true" />
                      Owner
                    </span>
                  ) : (
                    <Person name={selected.name} sub={`${selected.role} · ${selected.payBy}`} size="md" />
                  )}
                  {selected.flag !== "Regular" ? (
                    <Chip size="sm" variant="soft" color={toneColor(selected.flagTone)} className="self-start">
                      {selected.flag}
                    </Chip>
                  ) : null}
                </Drawer.Header>
                <Drawer.Body className="flex flex-col gap-4">
                  {selected.confidential ? (
                    <p className="text-sm text-muted">Only the owner sees these figures.</p>
                  ) : sel ? (
                    <>
                      <LineDonut
                        gross={sel.gross}
                        net={sel.net}
                        paye={sel.paye}
                        rssb={sel.rssb}
                        other={sel.otherDeductions}
                      />
                      <AmountList rows={breakdown} />
                      <p className="text-xs leading-4 text-muted">{selected.note ?? "Regular line."}</p>
                    </>
                  ) : null}
                  {!selected.confidential && selected.employeeId && live ? (
                    <FixPay
                      key={selected.id}
                      employeeId={selected.employeeId}
                      name={selected.name}
                      period={state.period}
                      runId={runId}
                      canAddAmounts={state.canConfirm}
                      editable={stage === "review"}
                      fileHref={`${screenHref("Employees")}?employee=${encodeURIComponent(selected.employeeId)}`}
                    />
                  ) : null}
                </Drawer.Body>
              </>
            ) : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
