"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  Briefcase,
  Calendar,
  Camera,
  CircleCheck,
  CircleQuestion,
  Clock,
  FileText,
  House,
  Key,
  Person,
  Plus,
  Receipt,
  Suitcase,
  Wallet,
  Xmark,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  Input,
  Label,
  Modal,
  ProgressBar,
  Table,
  Tabs,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { EmptyState, KPIGroup, NativeSelect } from "@heroui-pro/react";
import { AreaChart } from "@heroui-pro/react/area-chart";
import { KPI } from "@heroui-pro/react/kpi";
import type {
  MyHr,
  MyHrDocument,
  MyHrRecord,
  MyHrReview,
  MyHrShift,
  MyHrTicket,
  MyHrTone,
} from "@injishi/data/fixtures/shared";
import type { HrFeatureId, ShiftChoices, SwapAsk, SwapColleague } from "@injishi/product-hr";
import { formatRwf, KeyValueList, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { Fragment, type ReactNode, useRef, useState, useTransition } from "react";
import {
  askClaim,
  askExtraDays,
  askFix,
  askHelp,
  askLeave,
  cancelClaim,
  cancelMine,
  changePin,
  handInDocument,
  type MeResult,
  replyHelp,
  sendReview,
  tickTask,
} from "./actions";
import { ClockCard } from "./clock-card";
import { ShiftAsks } from "./shift-asks";
import { ME_TABS, type MeTab } from "./tabs";

const TAB_LABEL: Record<MeTab, string> = {
  overview: "Overview",
  pay: "Payslips",
  leave: "Leave",
  time: "Attendance",
  file: "Profile",
};

const TAB_ICON: Record<MeTab, ReactNode> = {
  overview: <House className="size-4" aria-hidden="true" />,
  pay: <FileText className="size-4" aria-hidden="true" />,
  leave: <Suitcase className="size-4" aria-hidden="true" />,
  time: <Clock className="size-4" aria-hidden="true" />,
  file: <Person className="size-4" aria-hidden="true" />,
};

/**
 * One tab of Me. Unselected tabs are muted and only darken on hover; the selected one is the
 * accent colour, bold, over the accent line. Keyboard focus is a ring, never a filled block, so
 * a focused tab can never be mistaken for the selected one.
 */
const TAB_CLASS = [
  "w-auto flex-none gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium text-muted",
  "hover:opacity-100 data-[hovered=true]:opacity-100 hover:text-foreground data-[hovered=true]:text-foreground",
  "data-[selected=true]:font-semibold data-[selected=true]:text-accent",
  "data-[focus-visible=true]:bg-transparent data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-offset-[-2px] data-[focus-visible=true]:outline-focus",
].join(" ");

const FIGURE_ICON: Record<string, ReactNode> = {
  leave: <Suitcase />,
  shift: <Calendar />,
  month: <Clock />,
  pay: <Wallet />,
};

/** The document types a new hire most often provides; "Other" takes a title of one's own. */
const DOCUMENT_TYPES = ["ID copy", "Certificate", "Driving licence", "Other"];

/** What a question to HR or IT is about. */
const HELP_TOPICS = [
  { id: "pay", label: "Pay" },
  { id: "leave", label: "Leave" },
  { id: "documents", label: "Documents" },
  { id: "uniform", label: "Uniform" },
  { id: "it", label: "Phone or app" },
  { id: "other", label: "Other" },
] as const;

type Dialog =
  | { kind: "help" }
  | { kind: "reply"; ticket: MyHrTicket }
  | { kind: "review"; review: MyHrReview }
  | { kind: "leave" }
  | { kind: "extra" }
  | { kind: "claim" }
  | { kind: "doc"; doc: MyHrDocument | null }
  | { kind: "fix"; record: MyHrRecord | null }
  | { kind: "pin" };

const DIALOG: Record<Dialog["kind"], { title: string; lead: string; submit: string }> = {
  help: {
    title: "Ask HR or IT",
    lead: "HR answers here, usually within a day.",
    submit: "Send",
  },
  reply: {
    title: "Reply to HR",
    lead: "HR sees it in the same conversation.",
    submit: "Send",
  },
  review: {
    title: "Your review",
    lead: "HR and your manager read this.",
    submit: "Send my review",
  },
  leave: {
    title: "Request leave",
    lead: "Goes to your line manager, then HR.",
    submit: "Submit request",
  },
  extra: {
    title: "Request additional leave days",
    lead: "For days beyond your entitlement.",
    submit: "Submit request",
  },
  claim: {
    title: "New expense claim",
    lead: "Paid back with your next salary.",
    submit: "Submit claim",
  },
  doc: {
    title: "Upload document",
    lead: "PDF or image, up to 10 MB.",
    submit: "Upload",
  },
  fix: {
    title: "Request attendance correction",
    lead: "Your supervisor reviews it.",
    submit: "Submit request",
  },
  pin: {
    title: "Change kiosk PIN",
    lead: "4 to 6 digits.",
    submit: "Save PIN",
  },
};

function StatusChip({ tone, children }: { tone: MyHrTone; children: ReactNode }) {
  return (
    <Chip size="sm" variant="soft" color={toneColor(tone)}>
      {children}
    </Chip>
  );
}

function Section({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card aria-labelledby={id} className={`min-w-0 gap-3 p-[18px] ${className ?? ""}`}>
      <Card.Header className="flex flex-row flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Card.Title id={id} className="text-[15px] font-semibold">
            {title}
          </Card.Title>
          {description ? <Card.Description>{description}</Card.Description> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">{children}</Card.Content>
    </Card>
  );
}

/** An empty section: an icon, a title and one line saying what will appear here. */
function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <EmptyState size="sm" className="py-4">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">{icon}</EmptyState.Media>
        <EmptyState.Title>{title}</EmptyState.Title>
        {children ? <EmptyState.Description>{children}</EmptyState.Description> : null}
      </EmptyState.Header>
    </EmptyState>
  );
}

/** One labelled field of the employee summary. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate text-sm font-medium">{children}</dd>
    </div>
  );
}

/**
 * Me: a signed-in person's own HR (ADR-058, 058-self-service). Their payslips, leave,
 * attendance and employment record, and the requests they can make, read from their own staff
 * file only. Every request goes to the API as the person, which answers for their file alone.
 */
export function MeView({
  data,
  initialTab,
  shiftAsks = null,
  off,
}: {
  data: MyHr;
  initialTab: MeTab;
  /** Asking for a swap, a different shift or a rotation; null for someone with no file of their own. */
  shiftAsks?: { asks: SwapAsk[]; colleagues: SwapColleague[]; choices: ShiftChoices } | null;
  /** The HR features Injishi switched off for the business: their sections and forms are hidden. */
  off: readonly HrFeatureId[];
}) {
  const claimsOn = !off.includes("claims");
  const loansOn = !off.includes("loans");
  const deskOn = !off.includes("helpDesk");
  const newsOn = !off.includes("announcements");
  const reviewsOn = !off.includes("reviews");
  const assetsOn = !off.includes("assets");
  const [tab, setTab] = useState<MeTab>(initialTab);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [pending, startTransition] = useTransition();
  const p = data.person;
  const employeeId = p.employeeId ?? "";
  const canAsk = data.hasFile && !data.readOnly;

  // The forms' fields, cleared each time a form opens.
  const [leaveType, setLeaveType] = useState(data.leaveTypes[0]?.id ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [days, setDays] = useState("1");
  const [amount, setAmount] = useState("");
  const [words, setWords] = useState("");
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0] as string);
  const [otherTitle, setOtherTitle] = useState("");
  const [picked, setPicked] = useState<File | null>(null);
  const [fixDay, setFixDay] = useState("");
  const [inAt, setInAt] = useState("");
  const [outAt, setOutAt] = useState("");
  const [pinNow, setPinNow] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [topic, setTopic] = useState<(typeof HELP_TOPICS)[number]["id"]>("pay");
  const [allNews, setAllNews] = useState(false);
  const filePick = useRef<HTMLInputElement>(null);

  const open = (d: Dialog) => {
    setWords("");
    setPicked(null);
    setAmount("");
    setDays("1");
    setFrom("");
    setTo("");
    setDocType(DOCUMENT_TYPES[0] as string);
    setOtherTitle("");
    setPinNow("");
    setPinNew("");
    if (d.kind === "fix") {
      setFixDay(d.record?.workDate ?? "");
      setInAt(d.record?.inAt ?? "");
      setOutAt(d.record?.outAt ?? "");
    }
    if (d.kind === "review") setWords(d.review.note ?? "");
    setDialog(d);
  };

  /** Run a request; a refusal is shown in the API's words. */
  const run = (task: () => Promise<MeResult>, done: string, close = true) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      if (close) setDialog(null);
      toast.success(done);
    });

  const submit = (d: Dialog) => {
    if (d.kind === "reply") {
      run(() => replyHelp(employeeId, d.ticket.id, words), "Sent to HR.");
    } else if (d.kind === "review") {
      run(() => sendReview(employeeId, d.review.id, words), "Your review is sent.");
    } else if (d.kind === "help") {
      run(() => askHelp({ topic, body: words }), "Sent to HR. Their answer shows under Help desk.");
    } else if (d.kind === "leave") {
      run(
        () => askLeave(employeeId, { leaveTypeId: leaveType, startsOn: from, endsOn: to || from, reason: words }),
        "Leave request submitted.",
      );
    } else if (d.kind === "extra") {
      run(
        () => askExtraDays(employeeId, { leaveTypeId: leaveType, days: Number(days.replace(",", ".")), reason: words }),
        "Request for additional days submitted.",
      );
    } else if (d.kind === "claim") {
      const form = new FormData();
      form.append("amount", amount);
      form.append("reason", words);
      form.append("key", crypto.randomUUID());
      if (picked) form.append("receipt", picked);
      run(() => askClaim(employeeId, form), "Expense claim submitted.");
    } else if (d.kind === "doc") {
      const form = new FormData();
      if (picked) form.append("file", picked);
      if (d.doc) form.append("documentId", d.doc.id);
      else form.append("title", docType === "Other" ? otherTitle : docType);
      run(() => handInDocument(employeeId, form), "Document uploaded for HR review.");
    } else if (d.kind === "fix") {
      run(
        () => askFix(employeeId, { recordId: d.record?.id ?? null, workDate: fixDay, inAt, outAt, reason: words }),
        "Correction request submitted.",
      );
    } else {
      run(() => changePin(employeeId, { currentPin: pinNow, pin: pinNew }), "Kiosk PIN changed.");
    }
  };

  if (!data.hasFile) {
    return (
      <PageContent>
        <PageHeader eyebrow="Me" title={p.name} />
        <Card className="p-[18px]">
          <Empty icon={<Briefcase />} title="No employee record at this business" />
        </Card>
      </PageContent>
    );
  }

  const announcements = newsOn ? (data.announcements ?? []) : [];
  const pendingRequests = data.requests.filter((r) => r.chip === "Pending");
  const openTasks = data.tasks.filter((t) => !t.done);
  const latest = data.payslips[0] ?? null;
  // The year to date: the payslips of the latest payslip's year.
  const payYear = latest?.period.slice(0, 4) ?? "";
  const yearSlips = data.payslips.filter((s) => s.period.startsWith(payYear));
  const yearGross = yearSlips.reduce((t, s) => t + s.gross, 0);
  const yearNet = yearSlips.reduce((t, s) => t + s.net, 0);
  const yearDeducted = Math.max(0, yearGross - yearNet);
  // What reached the person of what they earned, for the latest payslip's bar.
  const takeHome = latest && latest.gross > 0 ? Math.round((latest.net / latest.gross) * 100) : 0;
  const scheduledHours = Math.round(data.shifts.reduce((t, s) => t + shiftMinutes(s.time), 0) / 60);
  const downloadPayslip = (id: string) =>
    window.open(`/me/payslip/${id}?file=${encodeURIComponent(employeeId)}`, "_blank");

  return (
    <PageContent>
      <PageHeader
        eyebrow={p.business}
        title="Me"
        actions={
          canAsk ? (
            <>
              {deskOn ? (
                <Button variant="ghost" onPress={() => open({ kind: "help" })}>
                  <CircleQuestion className="size-4" aria-hidden="true" />
                  Ask HR
                </Button>
              ) : null}
              {claimsOn ? (
                <Button variant="secondary" onPress={() => open({ kind: "claim" })}>
                  <Receipt className="size-4" aria-hidden="true" />
                  New expense claim
                </Button>
              ) : null}
              <Button onPress={() => open({ kind: "leave" })}>
                <Suitcase className="size-4" aria-hidden="true" />
                Request leave
              </Button>
            </>
          ) : null
        }
      />

      {data.readOnly ? (
        <Alert status="default">
          <Alert.Content>
            <Alert.Title>Your employment has ended</Alert.Title>
            <Alert.Description>You can still read your record.</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {/* ── The employee summary ─────────────────────────────────────────────────── */}
      <Card aria-label="Employee summary" className="p-[18px]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-10">
          <div className="flex min-w-0 items-center gap-3.5 lg:w-[260px] lg:shrink-0">
            <Avatar size="lg" variant="soft" color="accent">
              <Avatar.Fallback>{p.initials}</Avatar.Fallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-lg leading-6 font-semibold">{p.name}</span>
              <span className="truncate text-sm text-muted">{p.job}</span>
            </div>
          </div>
          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-3 border-t border-separator pt-4 sm:grid-cols-4 lg:border-t-0 lg:pt-0">
            <Field label="Employee ID">
              <span className="tabular">{p.staffNo}</span>
            </Field>
            <Field label="Branch">{p.branch}</Field>
            <Field label="Line manager">{p.manager ?? "Not assigned"}</Field>
            <Field label="Status">
              <StatusChip tone={p.status === "active" ? "success" : "default"}>
                {p.status === "active" ? "Active" : "Former employee"}
              </StatusChip>
            </Field>
          </dl>
        </div>
      </Card>

      {data.clock && !data.readOnly ? <ClockCard employeeId={employeeId} clock={data.clock} /> : null}

      <section aria-label="Key figures">
        <KPIGroup className="flex-wrap">
          {data.figures.map((f, i) => (
            <Fragment key={f.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="min-w-[min(200px,100%)] flex-[1_1_200px] gap-1">
                <KPI.Header>
                  {FIGURE_ICON[f.id] ? <KPI.Icon>{FIGURE_ICON[f.id]}</KPI.Icon> : null}
                  <KPI.Title>{f.label}</KPI.Title>
                </KPI.Header>
                <KPI.Content className="flex-none">
                  <span className="text-[20px] leading-7 font-semibold tabular">{f.value}</span>
                </KPI.Content>
                <KPI.Footer>
                  <p className="text-xs leading-4 text-muted">{f.foot}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as MeTab)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Me" className="justify-start gap-1">
            {ME_TABS.map((t) => (
              <Tabs.Tab key={t} id={t} className={TAB_CLASS}>
                {TAB_ICON[t]}
                {TAB_LABEL[t]}
                {t === "leave" && pendingRequests.length > 0 ? (
                  <Chip
                    size="sm"
                    variant="soft"
                    color="warning"
                    className="tabular"
                    aria-label={`${pendingRequests.length} pending`}
                  >
                    {pendingRequests.length}
                  </Chip>
                ) : null}
                <Tabs.Indicator className="h-[3px] rounded-t-full" />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        {/* ── Overview ─────────────────────────────────────────────────────────────── */}
        <Tabs.Panel id="overview" className="grid items-start gap-4 pt-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Section
            id="me-shifts"
            title="Your schedule"
            description={
              data.shifts.length === 0
                ? "The next two weeks"
                : `${data.shifts.length} ${data.shifts.length === 1 ? "shift" : "shifts"}${
                    scheduledHours > 0 ? ` · ${scheduledHours} h` : ""
                  } in the next two weeks`
            }
          >
            {data.shifts.length === 0 ? (
              <Empty icon={<Calendar />} title="No shifts scheduled" />
            ) : (
              <ShiftWeeks today={data.today} shifts={data.shifts} />
            )}
            {shiftAsks ? <ShiftAsks employeeId={employeeId} today={data.today} {...shiftAsks} /> : null}
          </Section>

          <div className="flex min-w-0 flex-col gap-4">
            {announcements.length > 0 ? (
              <Section id="me-news" title="From HR">
                <ul className="flex flex-col divide-y divide-separator">
                  {(allNews ? announcements : announcements.slice(0, 3)).map((a) => (
                    <li key={a.id} className="flex flex-col gap-1 py-3 text-sm first:pt-1 last:pb-1">
                      <span className="font-medium">{a.title}</span>
                      <span className="text-[13px] leading-[18px] whitespace-pre-line">{a.body}</span>
                      <span className="text-xs leading-[18px] text-muted">{a.meta}</span>
                    </li>
                  ))}
                </ul>
                {announcements.length > 3 ? (
                  <Button size="sm" variant="ghost" className="-ms-2 self-start" onPress={() => setAllNews((v) => !v)}>
                    {allNews ? "Show fewer" : `All ${announcements.length}`}
                  </Button>
                ) : null}
              </Section>
            ) : null}

            <Section
              id="me-latest"
              title="Latest payslip"
              description={latest ? latest.month : undefined}
              action={
                latest ? (
                  <Button size="sm" variant="secondary" onPress={() => downloadPayslip(latest.id)}>
                    <ArrowDownToLine className="size-4" aria-hidden="true" />
                    PDF
                  </Button>
                ) : null
              }
            >
              {latest ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted">Net pay</span>
                      <span className="text-[26px] leading-8 font-semibold tabular">{formatRwf(latest.net)}</span>
                    </div>
                    <StatusChip tone={latest.tone}>{latest.paid}</StatusChip>
                  </div>
                  <ProgressBar aria-label="Take-home share of gross pay" value={takeHome} size="sm" color="success">
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                  <dl className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Gross pay", value: formatRwf(latest.gross) },
                      { label: "Deductions", value: `−${formatRwf(Math.max(0, latest.gross - latest.net))}` },
                      { label: "Take-home", value: `${takeHome}%` },
                    ].map((x) => (
                      <div key={x.label} className="flex min-w-0 flex-col">
                        <dt className="text-xs text-muted">{x.label}</dt>
                        <dd className="truncate text-sm font-medium tabular">{x.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <Button size="sm" variant="ghost" className="-ms-2 self-start" onPress={() => setTab("pay")}>
                    All payslips
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <Empty icon={<FileText />} title="No payslip issued yet" />
              )}
            </Section>

            <Section
              id="me-pending"
              title="Pending requests"
              description={
                pendingRequests.length === 0
                  ? "Nothing is waiting for a decision"
                  : `${pendingRequests.length} waiting for a decision`
              }
              action={
                data.requests.length > 0 ? (
                  <Button size="sm" variant="ghost" onPress={() => setTab("leave")}>
                    View all
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                ) : null
              }
            >
              {pendingRequests.length === 0 ? (
                <Empty icon={<CircleCheck />} title="You are all caught up" />
              ) : (
                <ul className="flex flex-col divide-y divide-separator">
                  {pendingRequests.slice(0, 4).map((r) => (
                    <li key={r.id} className="flex flex-col gap-0.5 py-3 text-sm first:pt-1 last:pb-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{r.kind}</span>
                        <StatusChip tone={r.tone}>{r.chip}</StatusChip>
                      </span>
                      <span className="tabular">{r.title}</span>
                      <span className="text-xs leading-[18px] text-muted">{r.meta}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {deskOn ? (
              <Section
                id="me-help"
                title="Help desk"
                description={
                  (data.tickets ?? []).length ? "Your questions to HR or IT" : "Ask HR or IT anything about your work"
                }
                action={
                  canAsk ? (
                    <Button size="sm" variant="secondary" onPress={() => open({ kind: "help" })}>
                      <Plus className="size-4" aria-hidden="true" />
                      Ask
                    </Button>
                  ) : null
                }
              >
                {(data.tickets ?? []).length === 0 ? (
                  <Empty icon={<CircleQuestion />} title="No questions yet" />
                ) : (
                  <ul className="flex flex-col divide-y divide-separator">
                    {(data.tickets ?? []).slice(0, 4).map((t) => (
                      <li key={t.id} className="flex flex-col gap-1 py-3 text-sm first:pt-1 last:pb-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-medium">{t.title}</span>
                          <StatusChip tone={t.tone}>{t.chip}</StatusChip>
                        </span>
                        {t.answer ? (
                          <span className="rounded-lg bg-surface-secondary px-2.5 py-1.5 text-[13px] leading-[18px]">
                            {t.answer}
                          </span>
                        ) : null}
                        <span className="text-xs leading-[18px] text-muted">{t.meta}</span>
                        {canAsk ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="-ms-2 self-start"
                            onPress={() => open({ kind: "reply", ticket: t })}
                          >
                            Reply
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            ) : null}

            {reviewsOn && (data.reviews ?? []).length > 0 ? (
              <Section id="me-review" title="Your review">
                <ul className="flex flex-col divide-y divide-separator">
                  {(data.reviews ?? []).slice(0, 3).map((r) => (
                    <li key={r.id} className="flex flex-col gap-1 py-3 text-sm first:pt-1 last:pb-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium">{r.title}</span>
                        <StatusChip tone={r.tone}>{r.chip}</StatusChip>
                      </span>
                      {r.note ? (
                        <span className="rounded-lg bg-surface-secondary px-2.5 py-1.5 text-[13px] leading-[18px]">
                          {r.note}
                        </span>
                      ) : null}
                      <span className="text-xs leading-[18px] text-muted">{r.meta}</span>
                      {r.canWrite && canAsk ? (
                        <Button
                          size="sm"
                          variant={r.note ? "ghost" : "secondary"}
                          className={r.note ? "-ms-2 self-start" : "self-start"}
                          onPress={() => open({ kind: "review", review: r })}
                        >
                          {r.note ? "Change my review" : "Write my review"}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {assetsOn && (data.assets ?? []).length > 0 ? (
              <Section id="me-assets" title="On loan to you" description="Bring each back to HR when asked">
                <ul className="flex flex-col divide-y divide-separator">
                  {(data.assets ?? []).map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 py-2.5 text-sm first:pt-1 last:pb-1"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{a.name}</span>
                        <span className="text-xs text-muted">{a.meta}</span>
                      </span>
                      <StatusChip tone={a.tone}>{a.chip}</StatusChip>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {openTasks.length > 0 ? (
              <Section id="me-open-tasks" title="Checklist" description={`${openTasks.length} open tasks`}>
                <TaskList
                  data={data}
                  pending={pending}
                  onlyOpen
                  onTick={(id, done) =>
                    run(() => tickTask(employeeId, id, done), done ? "Task completed." : "Task reopened.", false)
                  }
                />
              </Section>
            ) : null}
          </div>
        </Tabs.Panel>

        {/* ── Payslips ─────────────────────────────────────────────────────────────── */}
        <Tabs.Panel id="pay" className="flex flex-col gap-4 pt-4">
          {data.payslips.length > 0 ? (
            <Section
              id="me-ytd"
              title={`${payYear} so far`}
              description={`${yearSlips.length} ${yearSlips.length === 1 ? "payslip" : "payslips"}`}
            >
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
                {[
                  { label: "Net pay", value: formatRwf(yearNet), foot: "" },
                  { label: "Gross pay", value: formatRwf(yearGross), foot: "" },
                  {
                    label: "Tax and deductions",
                    value: formatRwf(yearDeducted),
                    foot: "",
                  },
                  {
                    label: "Average net a month",
                    value: formatRwf(Math.round(yearNet / Math.max(1, yearSlips.length))),
                    foot: `Over ${yearSlips.length} ${yearSlips.length === 1 ? "month" : "months"}`,
                  },
                ].map((m) => (
                  <Card key={m.label} variant="secondary" className="gap-0.5 p-[14px]">
                    <span className="text-xs text-muted">{m.label}</span>
                    <span className="text-[20px] leading-7 font-semibold tabular">{m.value}</span>
                    {m.foot ? <span className="text-xs text-muted">{m.foot}</span> : null}
                  </Card>
                ))}
              </div>
              <PayTrend payslips={data.payslips} />
            </Section>
          ) : null}

          <Section id="me-payslips" title="Payslips">
            {data.payslips.length === 0 ? (
              <Empty icon={<FileText />} title="No payslips yet" />
            ) : (
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[680px] border-separate border-spacing-0 text-sm">
                  <caption className="sr-only">Your payslips, newest first</caption>
                  <thead>
                    <tr className="text-xs text-muted">
                      <th scope="col" className="border-b border-separator px-3 pb-2.5 text-left font-medium">
                        Period
                      </th>
                      <th scope="col" className="border-b border-separator px-3 pb-2.5 text-right font-medium">
                        Gross pay
                      </th>
                      <th scope="col" className="border-b border-separator px-3 pb-2.5 text-right font-medium">
                        Deductions
                      </th>
                      <th scope="col" className="border-b border-separator px-3 pb-2.5 text-right font-medium">
                        Net pay
                      </th>
                      <th scope="col" className="border-b border-separator px-3 pb-2.5 text-left font-medium">
                        Status
                      </th>
                      <th scope="col" className="border-b border-separator px-3 pb-2.5">
                        <span className="sr-only">Download</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payslips.map((s, i) => (
                      <tr key={s.id} className="transition-colors hover:bg-default/50 [&:last-child>*]:border-b-0">
                        <th scope="row" className="border-b border-separator px-3 py-3 text-left font-medium">
                          <span className="flex items-center gap-2">
                            <FileText className="size-4 shrink-0 text-muted" aria-hidden="true" />
                            {s.month}
                            {i === 0 ? (
                              <Chip size="sm" variant="soft" color="accent">
                                Latest
                              </Chip>
                            ) : null}
                          </span>
                        </th>
                        <td className="border-b border-separator px-3 py-3 text-right text-muted tabular">
                          {formatRwf(s.gross)}
                        </td>
                        <td className="border-b border-separator px-3 py-3 text-right text-muted tabular">
                          −{formatRwf(Math.max(0, s.gross - s.net))}
                        </td>
                        <td className="border-b border-separator px-3 py-3 text-right font-semibold tabular">
                          {formatRwf(s.net)}
                        </td>
                        <td className="border-b border-separator px-3 py-3">
                          <StatusChip tone={s.tone}>{s.paid}</StatusChip>
                        </td>
                        <td className="border-b border-separator px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-label={`Download the ${s.month} payslip as a PDF`}
                            onPress={() => downloadPayslip(s.id)}
                          >
                            <ArrowDownToLine className="size-4" aria-hidden="true" />
                            PDF
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Claims and loans side by side; with one switched off, the other takes the full width. */}
          {claimsOn || loansOn ? (
            <div className={`grid items-start gap-4 ${claimsOn && loansOn ? "xl:grid-cols-2" : ""}`}>
              {claimsOn ? (
                <Section
                  id="me-claims"
                  title="Expense claims"
                  action={
                    canAsk ? (
                      <Button size="sm" variant="secondary" onPress={() => open({ kind: "claim" })}>
                        <Plus className="size-4" aria-hidden="true" />
                        New claim
                      </Button>
                    ) : null
                  }
                >
                  {data.claims.length === 0 ? (
                    <Empty icon={<Receipt />} title="No expense claims" />
                  ) : (
                    <ul className="flex flex-col divide-y divide-separator">
                      {data.claims.map((c) => (
                        <li key={c.id} className="flex items-start gap-3 py-3 text-sm first:pt-1 last:pb-1">
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-default text-muted">
                            <Receipt className="size-4" aria-hidden="true" />
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="font-medium">{c.title}</span>
                            <span className="text-xs text-muted">{c.meta}</span>
                            {c.canCancel && canAsk ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="-ms-2 mt-1 self-start text-danger"
                                isDisabled={pending}
                                onPress={() => run(() => cancelClaim(employeeId, c.id), "Claim withdrawn.", false)}
                              >
                                <Xmark className="size-4" aria-hidden="true" />
                                Withdraw claim
                              </Button>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className="font-semibold tabular">
                              {c.amount !== null ? formatRwf(c.amount) : "—"}
                            </span>
                            <StatusChip tone={c.tone}>{c.chip}</StatusChip>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              ) : null}

              {loansOn ? (
                <Section id="me-loans" title="Loans and advances">
                  {data.loans.length === 0 ? (
                    <Empty icon={<Wallet />} title="No loans or advances" />
                  ) : (
                    <ul className="flex flex-col divide-y divide-separator">
                      {data.loans.map((l) => (
                        <li key={l.id} className="flex flex-col gap-2.5 py-3 text-sm first:pt-1 last:pb-1">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-default text-muted">
                              <Wallet className="size-4" aria-hidden="true" />
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="font-medium">{l.title}</span>
                              <span className="text-xs text-muted">{l.meta}</span>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              <span className="font-semibold tabular">
                                {l.amount !== null ? formatRwf(l.amount) : "—"}
                              </span>
                              <StatusChip tone={l.tone}>{l.chip}</StatusChip>
                            </div>
                          </div>
                          {l.repaid !== null && l.repaid < 1 ? (
                            <div className="flex items-center gap-3 ps-11">
                              <ProgressBar
                                aria-label={`${l.title} repaid`}
                                value={Math.round(l.repaid * 100)}
                                size="sm"
                                className="flex-1"
                              >
                                <ProgressBar.Track>
                                  <ProgressBar.Fill />
                                </ProgressBar.Track>
                              </ProgressBar>
                              <span className="shrink-0 text-xs text-muted tabular">
                                {Math.round(l.repaid * 100)}% repaid
                              </span>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              ) : null}
            </div>
          ) : null}
        </Tabs.Panel>

        {/* ── Leave ───────────────────────────────────────────────────────────────── */}
        <Tabs.Panel id="leave" className="flex flex-col gap-4 pt-4">
          <Section
            id="me-balances"
            title="Leave balances"
            action={
              canAsk ? (
                <>
                  <Button size="sm" variant="secondary" onPress={() => open({ kind: "extra" })}>
                    <Plus className="size-4" aria-hidden="true" />
                    Request additional days
                  </Button>
                  <Button size="sm" onPress={() => open({ kind: "leave" })}>
                    <Suitcase className="size-4" aria-hidden="true" />
                    Request leave
                  </Button>
                </>
              ) : null
            }
          >
            {data.balances.length === 0 ? (
              <Empty icon={<Suitcase />} title="No leave entitlement on record" />
            ) : (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
                {data.balances.map((b) => (
                  <Card key={b.id} variant="secondary" className="gap-0.5 p-[14px]">
                    <span className="truncate text-xs text-muted">{b.name}</span>
                    <span className="text-[20px] leading-7 font-semibold tabular">
                      {b.days === null ? "—" : `${b.days} ${b.days === 1 ? "day" : "days"}`}
                    </span>
                    <span className="text-xs text-muted">{b.foot}</span>
                  </Card>
                ))}
              </div>
            )}
          </Section>

          <Section id="me-requests" title="Requests">
            {data.requests.length === 0 ? (
              <Empty icon={<FileText />} title="No requests yet" />
            ) : (
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Requests" className="min-w-[680px]">
                    <Table.Header>
                      <Table.Column isRowHeader>Type</Table.Column>
                      <Table.Column>Dates</Table.Column>
                      <Table.Column>Details</Table.Column>
                      <Table.Column>Status</Table.Column>
                      <Table.Column className="text-right">Action</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {data.requests.map((r) => (
                        <Table.Row key={r.id} id={r.id}>
                          <Table.Cell className="font-medium">{r.kind}</Table.Cell>
                          <Table.Cell className="tabular">{r.title}</Table.Cell>
                          <Table.Cell className="max-w-[320px] whitespace-normal text-muted">{r.meta}</Table.Cell>
                          <Table.Cell>
                            <StatusChip tone={r.tone}>{r.chip}</StatusChip>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            {r.canCancel && canAsk ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                isDisabled={pending}
                                onPress={() => run(() => cancelMine(employeeId, r.id), "Request withdrawn.", false)}
                              >
                                Withdraw
                              </Button>
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            )}
          </Section>
        </Tabs.Panel>

        {/* ── Attendance ──────────────────────────────────────────────────────────── */}
        <Tabs.Panel id="time" className="flex flex-col gap-4 pt-4">
          {data.month ? (
            <Section id="me-month" title="Monthly summary" description={data.month.label}>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
                {[
                  { label: "Days worked", value: String(data.month.daysWorked) },
                  { label: "Hours worked", value: data.month.worked, foot: `of ${data.month.expected} scheduled` },
                  { label: "Late arrivals", value: String(data.month.late) },
                  { label: "Approved overtime", value: data.month.overtime },
                ].map((m) => (
                  <Card key={m.label} variant="secondary" className="gap-0.5 p-[14px]">
                    <span className="text-xs text-muted">{m.label}</span>
                    <span className="text-[20px] leading-7 font-semibold tabular">{m.value}</span>
                    {m.foot ? <span className="text-xs text-muted">{m.foot}</span> : null}
                  </Card>
                ))}
              </div>
            </Section>
          ) : null}

          <Section
            id="me-records"
            title="Attendance records"
            action={
              canAsk ? (
                <Button size="sm" variant="secondary" onPress={() => open({ kind: "fix", record: null })}>
                  <Plus className="size-4" aria-hidden="true" />
                  Ask about a missing day
                </Button>
              ) : null
            }
          >
            {data.records.length === 0 ? (
              <Empty icon={<Clock />} title="No attendance recorded this month" />
            ) : (
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Attendance records" className="min-w-[700px]">
                    <Table.Header>
                      <Table.Column isRowHeader>Date</Table.Column>
                      <Table.Column>Clock in – out</Table.Column>
                      <Table.Column className="text-right">Hours</Table.Column>
                      <Table.Column>Notes</Table.Column>
                      <Table.Column>Status</Table.Column>
                      <Table.Column className="text-right">Action</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {data.records.map((r) => (
                        <Table.Row key={r.id} id={r.id}>
                          <Table.Cell className="font-medium tabular">{r.day}</Table.Cell>
                          <Table.Cell className="tabular">{r.times}</Table.Cell>
                          <Table.Cell className="text-right tabular">{r.worked}</Table.Cell>
                          <Table.Cell className="text-muted">{r.note || "—"}</Table.Cell>
                          <Table.Cell>
                            <StatusChip tone={r.tone}>{r.chip}</StatusChip>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            {r.canAsk && canAsk ? (
                              <Button size="sm" variant="ghost" onPress={() => open({ kind: "fix", record: r })}>
                                Request correction
                              </Button>
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            )}
          </Section>

          {data.kioskPin ? (
            <Section
              id="me-pin"
              title="Kiosk PIN"
              description={data.kioskPin.hasPin ? `Changed ${data.kioskPin.setOn ?? "earlier"}` : "Not set yet"}
              action={
                data.kioskPin.hasPin && canAsk ? (
                  <Button size="sm" variant="secondary" onPress={() => open({ kind: "pin" })}>
                    <Key className="size-4" aria-hidden="true" />
                    Change PIN
                  </Button>
                ) : null
              }
            >
              <div>
                <StatusChip tone={data.kioskPin.hasPin ? "success" : "warning"}>
                  {data.kioskPin.hasPin ? "Active" : "Not set"}
                </StatusChip>
              </div>
            </Section>
          ) : null}
        </Tabs.Panel>

        {/* ── Profile ─────────────────────────────────────────────────────────────── */}
        <Tabs.Panel id="file" className="grid items-start gap-4 pt-4 xl:grid-cols-2">
          <Section id="me-details" title="Employment details">
            <KeyValueList
              items={[
                { label: "Full name", value: p.name },
                { label: "Job title", value: p.job },
                { label: "Employer", value: p.business },
                { label: "Branch", value: p.branch },
                { label: "Employee ID", value: p.staffNo },
                { label: "Line manager", value: p.manager ?? "Not assigned" },
                { label: "Status", value: p.status === "active" ? "Active" : "Former employee" },
              ]}
            />
          </Section>

          <div className="flex min-w-0 flex-col gap-4">
            <Section
              id="me-docs"
              title="Documents"
              action={
                canAsk ? (
                  <Button size="sm" variant="secondary" onPress={() => open({ kind: "doc", doc: null })}>
                    <Camera className="size-4" aria-hidden="true" />
                    Upload document
                  </Button>
                ) : null
              }
            >
              {data.documents.length === 0 ? (
                <Empty icon={<FileText />} title="No documents on file" />
              ) : (
                <ul className="flex flex-col divide-y divide-separator">
                  {data.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <FileText className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">{d.title}</span>
                        <span className="text-xs text-muted">{d.meta}</span>
                      </span>
                      {d.canSend && canAsk ? (
                        <Button size="sm" variant="secondary" onPress={() => open({ kind: "doc", doc: d })}>
                          Upload
                        </Button>
                      ) : null}
                      <StatusChip tone={d.tone}>{d.chip}</StatusChip>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {data.tasks.length > 0 ? (
              <Section id="me-checklist" title="Checklist">
                <TaskList
                  data={data}
                  pending={pending}
                  onTick={(id, done) =>
                    run(() => tickTask(employeeId, id, done), done ? "Task completed." : "Task reopened.", false)
                  }
                />
              </Section>
            ) : null}
          </div>
        </Tabs.Panel>
      </Tabs>

      {/* ── The forms ─────────────────────────────────────────────────────────────── */}
      <Modal.Backdrop isOpen={dialog !== null} onOpenChange={(o) => (o ? undefined : setDialog(null))}>
        <Modal.Container size="md">
          <Modal.Dialog aria-labelledby="me-d-h">
            {dialog ? (
              <>
                <Modal.Header>
                  <Modal.Heading id="me-d-h" className="text-[18px] leading-6 font-semibold">
                    {dialog.kind === "doc" && dialog.doc
                      ? `Upload ${dialog.doc.title}`
                      : dialog.kind === "fix"
                        ? dialog.record
                          ? `${DIALOG.fix.title} · ${dialog.record.day}`
                          : DIALOG.fix.title
                        : dialog.kind === "review"
                          ? `${DIALOG.review.title} · ${dialog.review.title}`
                          : DIALOG[dialog.kind].title}
                  </Modal.Heading>
                  <p className="mt-1.5 text-sm leading-5 text-muted">{DIALOG[dialog.kind].lead}</p>
                </Modal.Header>
                <Modal.Body className="flex flex-col gap-3">
                  <DialogFields
                    dialog={dialog}
                    data={data}
                    leaveType={leaveType}
                    setLeaveType={setLeaveType}
                    from={from}
                    setFrom={setFrom}
                    to={to}
                    setTo={setTo}
                    days={days}
                    setDays={setDays}
                    amount={amount}
                    setAmount={setAmount}
                    words={words}
                    setWords={setWords}
                    docType={docType}
                    setDocType={setDocType}
                    otherTitle={otherTitle}
                    setOtherTitle={setOtherTitle}
                    picked={picked}
                    setPicked={setPicked}
                    filePick={filePick}
                    fixDay={fixDay}
                    setFixDay={setFixDay}
                    inAt={inAt}
                    setInAt={setInAt}
                    outAt={outAt}
                    setOutAt={setOutAt}
                    pinNow={pinNow}
                    setPinNow={setPinNow}
                    pinNew={pinNew}
                    setPinNew={setPinNew}
                    topic={topic}
                    setTopic={(v) => setTopic(v as (typeof HELP_TOPICS)[number]["id"])}
                  />
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" onPress={() => setDialog(null)}>
                    Cancel
                  </Button>
                  <Button isPending={pending} onPress={() => submit(dialog)}>
                    {DIALOG[dialog.kind].submit}
                  </Button>
                </Modal.Footer>
              </>
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-19" plus n days, as a date at noon UTC so no time zone moves the day. */
function plusDays(iso: string, n: number): Date {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** Minutes between "07:00" and "15:00" in "07:00 – 15:00"; a night shift ends the next day. */
function shiftMinutes(time: string): number {
  const m = time.match(/(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  return end > start ? end - start : end + 1440 - start;
}

/**
 * The next fourteen days as two rows of seven: each day shows its shift and hours, or "Day off".
 * Today is outlined in the accent so the person finds themselves at once.
 */
function ShiftWeeks({ today, shifts }: { today: string; shifts: MyHrShift[] }) {
  const byDate = new Map<string, MyHrShift[]>();
  for (const s of shifts) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const weeks = [0, 7].map((start) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = plusDays(today, start + i);
      const iso = d.toISOString().slice(0, 10);
      return { iso, d, shifts: byDate.get(iso) ?? [] };
    }),
  );
  const span = (days: { d: Date }[]) => {
    const a = days[0].d;
    const b = days[days.length - 1].d;
    return `${a.getUTCDate()} ${MONTH[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTH[b.getUTCMonth()]}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {weeks.map((week, w) => (
        <div key={week[0].iso} className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted">
            {w === 0 ? "This week" : "Next week"} · {span(week)}
          </span>
          <ol className="grid grid-cols-7 gap-1.5">
            {week.map(({ iso, d, shifts: day }) => {
              const isToday = iso === today;
              const first = day[0];
              return (
                <li
                  key={iso}
                  aria-label={`${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}: ${
                    first ? `${first.name}, ${first.time}` : "day off"
                  }`}
                  className={`flex min-h-[96px] min-w-0 flex-col gap-1 rounded-xl border p-2 ${
                    isToday
                      ? "border-accent bg-accent-soft"
                      : first
                        ? "border-separator bg-surface"
                        : "border-dashed border-separator"
                  }`}
                >
                  <span className={`text-xs font-medium ${isToday ? "text-accent" : "text-muted"}`}>
                    {isToday ? "Today" : WEEKDAY[d.getUTCDay()]}
                  </span>
                  <span className="text-lg leading-6 font-semibold tabular">{d.getUTCDate()}</span>
                  {first ? (
                    <span className="mt-auto flex min-w-0 flex-col">
                      <span className="size-2 rounded-full bg-accent sm:hidden" aria-hidden="true" />
                      <span className="hidden truncate text-xs font-medium sm:block">
                        {first.name}
                        {day.length > 1 ? ` +${day.length - 1}` : ""}
                      </span>
                      <span className="hidden truncate text-xs text-muted tabular sm:block">
                        {first.time.slice(0, 5)} · {Math.round(shiftMinutes(first.time) / 6) / 10} h
                      </span>
                    </span>
                  ) : (
                    <span className="mt-auto text-xs text-muted">Off</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

/**
 * Net pay month by month, the last twelve payslips: one series in the brand colour, shown once
 * there are two months to compare. Every value is also in the payslip table below it.
 */
function PayTrend({ payslips }: { payslips: MyHr["payslips"] }) {
  const points = [...payslips]
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-12)
    .map((s) => ({ month: `${s.month.slice(0, 3)} ${s.period.slice(2, 4)}`, net: s.net, gross: s.gross }));
  if (points.length < 2) return null;
  return (
    <div className="flex flex-col gap-1.5 pt-2">
      <span className="text-xs font-medium text-muted">Net pay by month</span>
      <div
        role="img"
        aria-label={`Net pay by month: ${points.map((p) => `${p.month} ${formatRwf(p.net)}`).join(", ")}`}
      >
        <AreaChart data={points} height={160} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <AreaChart.Grid vertical={false} />
          <AreaChart.XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <AreaChart.YAxis hide domain={[0, "dataMax"]} />
          <AreaChart.Tooltip content={<AreaChart.TooltipContent valueFormatter={(v) => formatRwf(Number(v))} />} />
          <AreaChart.Area
            type="monotone"
            dataKey="net"
            name="Net pay"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="var(--chart-1)"
            fillOpacity={0.12}
            dot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-1)" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </div>
    </div>
  );
}

/** The fields of each form. */
function DialogFields(props: {
  dialog: Dialog;
  data: MyHr;
  leaveType: string;
  setLeaveType: (v: string) => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  days: string;
  setDays: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  words: string;
  setWords: (v: string) => void;
  docType: string;
  setDocType: (v: string) => void;
  otherTitle: string;
  setOtherTitle: (v: string) => void;
  picked: File | null;
  setPicked: (f: File | null) => void;
  filePick: React.RefObject<HTMLInputElement | null>;
  fixDay: string;
  setFixDay: (v: string) => void;
  inAt: string;
  setInAt: (v: string) => void;
  outAt: string;
  setOutAt: (v: string) => void;
  pinNow: string;
  setPinNow: (v: string) => void;
  pinNew: string;
  setPinNew: (v: string) => void;
  topic: string;
  setTopic: (v: string) => void;
}) {
  const { dialog, data } = props;
  const leaveTypeSelect = (id: string) => (
    <NativeSelect fullWidth className="flex flex-col gap-1">
      <Label htmlFor={id}>Leave type</Label>
      <NativeSelect.Trigger id={id} value={props.leaveType} onChange={(e) => props.setLeaveType(e.target.value)}>
        {data.leaveTypes.map((t) => (
          <NativeSelect.Option key={t.id} value={t.id}>
            {t.name}
          </NativeSelect.Option>
        ))}
        <NativeSelect.Indicator />
      </NativeSelect.Trigger>
    </NativeSelect>
  );

  if (dialog.kind === "reply" || dialog.kind === "review") {
    return (
      <>
        {dialog.kind === "reply" && dialog.ticket.answer ? (
          <p className="rounded-lg bg-surface-secondary px-2.5 py-1.5 text-[13px] leading-[18px]">
            {dialog.ticket.answer}
          </p>
        ) : null}
        <TextField value={props.words} onChange={props.setWords} className="flex flex-col gap-1">
          <Label>{dialog.kind === "reply" ? "Your reply" : "What went well, and what you would change"}</Label>
          <TextArea rows={4} />
        </TextField>
      </>
    );
  }
  if (dialog.kind === "help") {
    return (
      <>
        <NativeSelect fullWidth className="flex flex-col gap-1">
          <Label htmlFor="me-help-topic">About</Label>
          <NativeSelect.Trigger id="me-help-topic" value={props.topic} onChange={(e) => props.setTopic(e.target.value)}>
            {HELP_TOPICS.map((t) => (
              <NativeSelect.Option key={t.id} value={t.id}>
                {t.label}
              </NativeSelect.Option>
            ))}
            <NativeSelect.Indicator />
          </NativeSelect.Trigger>
        </NativeSelect>
        <TextField value={props.words} onChange={props.setWords} className="flex flex-col gap-1">
          <Label>Your question</Label>
          <TextArea rows={4} placeholder="My September payslip shows less transport than usual. Why?" />
        </TextField>
      </>
    );
  }
  if (dialog.kind === "leave") {
    return (
      <>
        {leaveTypeSelect("me-leave-type")}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField value={props.from} onChange={props.setFrom} className="flex flex-col gap-1">
            <Label>Start date</Label>
            <Input type="date" />
          </TextField>
          <TextField value={props.to} onChange={props.setTo} className="flex flex-col gap-1">
            <Label>End date</Label>
            <Input type="date" />
          </TextField>
        </div>
        <TextField value={props.words} onChange={props.setWords} className="flex flex-col gap-1">
          <Label>Comment (optional)</Label>
          <TextArea rows={2} placeholder="Family event" />
        </TextField>
      </>
    );
  }
  if (dialog.kind === "extra") {
    return (
      <>
        {leaveTypeSelect("me-extra-type")}
        <TextField value={props.days} onChange={props.setDays} className="flex flex-col gap-1">
          <Label>Number of days</Label>
          <Input inputMode="decimal" className="tabular" />
        </TextField>
        <TextField value={props.words} onChange={props.setWords} className="flex flex-col gap-1">
          <Label>Reason</Label>
          <TextArea rows={2} placeholder="Worked on the public holiday of 4 July" />
        </TextField>
      </>
    );
  }
  if (dialog.kind === "claim") {
    return (
      <>
        <TextField value={props.amount} onChange={props.setAmount} className="flex flex-col gap-1">
          <Label>Amount (RWF)</Label>
          <Input inputMode="numeric" className="tabular" placeholder="12,000" />
        </TextField>
        <TextField value={props.words} onChange={props.setWords} className="flex flex-col gap-1">
          <Label>Description</Label>
          <TextArea rows={2} placeholder="Transport to the supplier for the laundry order" />
        </TextField>
        <FilePick
          file={props.picked}
          pickRef={props.filePick}
          onPick={props.setPicked}
          label="Attach receipt (optional)"
        />
      </>
    );
  }
  if (dialog.kind === "doc") {
    return (
      <>
        {dialog.doc ? null : (
          <NativeSelect fullWidth className="flex flex-col gap-1">
            <Label htmlFor="me-doc-type">Document type</Label>
            <NativeSelect.Trigger
              id="me-doc-type"
              value={props.docType}
              onChange={(e) => props.setDocType(e.target.value)}
            >
              {DOCUMENT_TYPES.map((name) => (
                <NativeSelect.Option key={name} value={name}>
                  {name}
                </NativeSelect.Option>
              ))}
              <NativeSelect.Indicator />
            </NativeSelect.Trigger>
          </NativeSelect>
        )}
        {!dialog.doc && props.docType === "Other" ? (
          <TextField value={props.otherTitle} onChange={props.setOtherTitle} className="flex flex-col gap-1">
            <Label>Document title</Label>
            <Input placeholder="Food handler's certificate" />
          </TextField>
        ) : null}
        <FilePick file={props.picked} pickRef={props.filePick} onPick={props.setPicked} label="Choose file" />
      </>
    );
  }
  if (dialog.kind === "fix") {
    return (
      <>
        {dialog.record ? null : (
          <TextField value={props.fixDay} onChange={props.setFixDay} className="flex flex-col gap-1">
            <Label>Day</Label>
            <Input type="date" max={props.data.today} />
          </TextField>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField value={props.inAt} onChange={props.setInAt} className="flex flex-col gap-1">
            <Label>Clock in</Label>
            <Input type="time" />
          </TextField>
          <TextField value={props.outAt} onChange={props.setOutAt} className="flex flex-col gap-1">
            <Label>Clock out</Label>
            <Input type="time" />
          </TextField>
        </div>
        <TextField value={props.words} onChange={props.setWords} className="flex flex-col gap-1">
          <Label>Reason</Label>
          <TextArea rows={2} placeholder="Forgot to clock out after the evening shift" />
        </TextField>
      </>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        value={props.pinNow}
        onChange={(v) => props.setPinNow(v.replace(/\D/g, "").slice(0, 6))}
        className="flex flex-col gap-1"
      >
        <Label>Current PIN</Label>
        <Input type="password" inputMode="numeric" autoComplete="off" />
      </TextField>
      <TextField
        value={props.pinNew}
        onChange={(v) => props.setPinNew(v.replace(/\D/g, "").slice(0, 6))}
        className="flex flex-col gap-1"
      >
        <Label>New PIN (4–6 digits)</Label>
        <Input type="password" inputMode="numeric" autoComplete="off" />
      </TextField>
    </div>
  );
}

/** The checklist's tasks: the person completes their own; HR's read as HR's. */
function TaskList({
  data,
  pending,
  onTick,
  onlyOpen = false,
}: {
  data: MyHr;
  pending: boolean;
  onTick: (taskId: string, done: boolean) => void;
  onlyOpen?: boolean;
}) {
  const tasks = onlyOpen ? data.tasks.filter((t) => !t.done) : data.tasks;
  return (
    <ul className="flex flex-col divide-y divide-separator">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
          {t.mine && !data.readOnly ? (
            <Checkbox
              aria-label={t.label}
              isSelected={t.done}
              isDisabled={pending}
              onChange={(on) => onTick(t.id, on)}
              variant="secondary"
            >
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
              </Checkbox.Content>
            </Checkbox>
          ) : (
            <span className="flex size-4 shrink-0 items-center justify-center">
              {t.done ? <CircleCheck className="size-4 text-success" aria-hidden="true" /> : null}
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={t.done ? "text-muted line-through" : "font-medium"}>{t.label}</span>
            <span className="text-xs text-muted">
              {t.checklist} · {t.meta}
            </span>
          </span>
          {!t.mine && !t.done ? (
            <Chip size="sm" variant="soft">
              HR
            </Chip>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** A file chosen from the computer or the phone: a PDF or an image. */
function FilePick({
  file,
  pickRef,
  onPick,
  label,
}: {
  file: File | null;
  pickRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file: File | null) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <input
        ref={pickRef}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <Button variant="secondary" onPress={() => pickRef.current?.click()} className="self-start">
        <Camera className="size-4" aria-hidden="true" />
        {file ? "Replace file" : label}
      </Button>
      {file ? <span className="text-xs text-muted">{file.name}</span> : null}
    </div>
  );
}
