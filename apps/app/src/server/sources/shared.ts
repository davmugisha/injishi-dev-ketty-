/**
 * Live sources for the shared area: API responses presented as the shared fixture document types.
 *
 * Me (`shared.myHr`): a signed-in person's own HR, read from their own staff file at this business
 * through `/me/work` (ADR-058, 058-self-service). The routes answer for the caller's own file only
 * (any other id is 404), so nothing here can show anybody else's pay or leave. A read the file has
 * nothing for answers empty rather than failing the page.
 */
import type {
  MyHr,
  MyHrDocument,
  MyHrItem,
  MyHrRecord,
  MyHrRequest,
  MyHrTask,
  MyHrTone,
} from "@injishi/data/fixtures/shared";
import { ApiError } from "../api";
import {
  type ApiLoan as ApiAssetLoan,
  type ApiMyAnnouncement,
  type ApiMyReview,
  type ApiTicket,
  agoOf,
  announcementWords,
  loanState,
  reviewWords,
} from "../desk-view";
import { defineSources, NoWorkspaceError, type SourceContext } from "./types";

// ── The API's shapes (what this file reads of them) ─────────────────────────────────────────────

interface ApiFile {
  employeeId: string;
  orgId: string;
  businessName: string;
  displayName: string;
  employeeNumber: string;
  branchName: string | null;
  jobPositionTitle: string | null;
  status: "active" | "offboarded";
}
interface ApiPayslip {
  id: string;
  period: string;
  grossRwf: number;
  netRwf: number;
  paidAt: string | null;
}
interface ApiClaim {
  id: string;
  kind: "reimbursement" | "leave_encashment";
  amountRwf: number | null;
  leaveType: { name: string } | null;
  days: number | null;
  period: string;
  hasReceipt: boolean;
  reason: string;
  status: "requested" | "approved" | "rejected" | "cancelled";
  decisionNote?: string | null;
  createdAt?: string;
}
interface ApiLoan {
  id: string;
  kind: string;
  amountRwf: number;
  installments: number;
  remainingRwf: number;
  settledAt: string | null;
}
interface ApiBalance {
  leaveType: { id: string; code: string; name: string };
  balanceDays: number | null;
}
interface ApiLeaveType {
  id: string;
  code: string;
  name: string;
}
interface ApiLeave {
  id: string;
  leaveType: { name: string };
  startsOn: string;
  endsOn: string;
  days: number;
  reason: string | null;
  status: "requested" | "approved" | "rejected" | "cancelled";
  routedToName: string | null;
  decisionNote: string | null;
  createdAt: string;
}
interface ApiExtra {
  id: string;
  leaveType: { name: string };
  kind: "extra" | "compensatory";
  days: number;
  reason: string;
  status: "requested" | "approved" | "rejected" | "cancelled";
  routedTo: { displayName: string } | null;
  decidedByName?: string | null;
  decisionNote?: string | null;
  createdAt: string;
}
interface ApiShiftRequest {
  id: string;
  kind: "change" | "swap" | "rotation";
  shiftTemplate: { name: string } | null;
  swapWith: { displayName: string } | null;
  rotation?: { name: string } | null;
  decisionNote?: string | null;
  fromDate: string;
  toDate: string;
  reason: string;
  status: "requested" | "awaiting_colleague" | "approved" | "rejected" | "cancelled";
  createdAt: string;
}
interface ApiRecord {
  id: string;
  workDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  validated: boolean;
  status: string;
  autoClosed?: boolean;
  figures: { workedMinutes: number; lateMinutes: number } | null;
}
interface ApiFix {
  id: string;
  workDate: string;
  clockInAt: string;
  clockOutAt: string;
  reason: string;
  status: "requested" | "approved" | "rejected" | "cancelled";
  decisionNote?: string | null;
  createdAt?: string;
}
interface ApiSummary {
  daysWorked: number;
  workedMinutes: number;
  expectedMinutes: number;
  approvedOvertimeMinutes: number;
  lateCount: number;
}
interface ApiRosterEntry {
  id: string;
  shiftName: string | null;
  workDate: string;
  startsAt: string;
  endsAt: string;
  status: string;
}
interface ApiDocument {
  id: string;
  title: string;
  status: "requested" | "submitted" | "approved" | "rejected";
  expired: boolean;
  rejectReason: string | null;
  expiresOn: string | null;
  dueOn: string | null;
}
interface ApiChecklist {
  kind: "onboarding" | "offboarding";
  tasks: {
    id: string;
    label: string;
    byEmployee: boolean;
    dueOn: string;
    doneAt: string | null;
    doneByName: string | null;
  }[];
}

// ── Wording ─────────────────────────────────────────────────────────────────────────────────────

const TZ = "Africa/Kigali";
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: TZ });
const asDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
const dayText = (iso: string) => fmt({ weekday: "short", day: "numeric", month: "short" }).format(asDate(iso));
const dayMonth = (iso: string) => fmt({ day: "numeric", month: "short" }).format(asDate(iso));
const clock = (iso: string) => fmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const monthName = (period: string, year = true) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" }).format(
    new Date(`${period}-01T12:00:00Z`),
  );
const rwf = (n: number) => `RWF ${Math.round(n).toLocaleString("en-US")}`;
const hours = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (minutes === 0) return "0 h";
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
};
const span = (from: string, to: string) => (from === to ? dayText(from) : `${dayText(from)} – ${dayText(to)}`);
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

const STATUS: Record<"requested" | "approved" | "rejected" | "cancelled", { chip: string; tone: MyHrTone }> = {
  requested: { chip: "Pending", tone: "warning" },
  approved: { chip: "Approved", tone: "success" },
  rejected: { chip: "Declined", tone: "danger" },
  cancelled: { chip: "Withdrawn", tone: "default" },
};

/** A read the file has nothing for, or the person may not make, answers empty. */
async function orEmpty<T>(read: Promise<T>, empty: T): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && (error.forbidden || error.notFound || error.status === 409)) return empty;
    throw error;
  }
}

/** The person's file at the business this workspace is: else their first active file, else any. */
/** `GET /me/work/:id/clock`: the clock-in card's facts. */
interface ApiClock {
  branchName: string | null;
  clockMode: "anywhere" | "at_work" | "entrance";
  open: { id: string; clockInAt: string; validated: boolean } | null;
  shift: { startsAt: string; endsAt: string } | null;
  opensAt: string | null;
}

async function myFile(ctx: SourceContext): Promise<ApiFile | null> {
  const { files } = await ctx.api.get<{ files: ApiFile[] }>("/api/v1/me/work");
  let orgId: string | null = null;
  try {
    orgId = ctx.ops("hospitality").workspace.orgId;
  } catch (error) {
    if (!(error instanceof NoWorkspaceError)) throw error;
  }
  return (
    files.find((f) => f.orgId === orgId && f.status === "active") ??
    files.find((f) => f.status === "active") ??
    files[0] ??
    null
  );
}

function noFile(ctx: SourceContext): MyHr {
  const name = ctx.account?.user.name || ctx.persona?.name || "You";
  return {
    id: "none",
    hasFile: false,
    today: ctx.today.iso,
    readOnly: true,
    person: {
      employeeId: null,
      name,
      initials: initialsOf(name),
      job: "",
      branch: "",
      business: "",
      staffNo: "",
      manager: null,
      status: "none",
    },
    figures: [],
    shifts: [],
    payslips: [],
    claims: [],
    loans: [],
    balances: [],
    leaveTypes: [],
    requests: [],
    month: null,
    records: [],
    documents: [],
    tasks: [],
    kioskPin: null,
  };
}

async function myHr(ctx: SourceContext): Promise<MyHr> {
  const file = await myFile(ctx);
  if (!file) return noFile(ctx);
  const base = `/api/v1/me/work/${encodeURIComponent(file.employeeId)}`;
  const get = <T>(path: string, empty: T, query?: Record<string, string>) =>
    orEmpty(ctx.api.get<T>(`${base}${path}`, query ? { query } : undefined), empty);
  const today = ctx.today.iso;
  const month = today.slice(0, 7);
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 13);
  const to = end.toISOString().slice(0, 10);

  const [
    payslips,
    claims,
    loans,
    balances,
    types,
    leave,
    extra,
    shiftList,
    summary,
    attendance,
    roster,
    documents,
    checklists,
    pin,
    approvers,
  ] = await Promise.all([
    get<{ payslips: ApiPayslip[] }>("/payslips", { payslips: [] }),
    get<{ claims: ApiClaim[] }>("/claims", { claims: [] }),
    get<{ loans: ApiLoan[] }>("/loans", { loans: [] }),
    get<{ balances: ApiBalance[] }>("/leave/balances", { balances: [] }),
    get<{ types: ApiLeaveType[] }>("/leave/types", { types: [] }),
    get<{ requests: ApiLeave[] }>("/leave/requests", { requests: [] }),
    get<{ requests: ApiExtra[] }>("/leave/allocation-requests", { requests: [] }),
    get<{ mine: ApiShiftRequest[] }>("/shift-requests", { mine: [] }),
    get<{ summary: ApiSummary | null }>("/attendance/summary", { summary: null }, { month }),
    get<{ records: ApiRecord[]; requests: ApiFix[] }>(
      "/attendance",
      { records: [], requests: [] },
      { from: `${month}-01`, to: today },
    ),
    get<{ entries: ApiRosterEntry[] }>("/roster", { entries: [] }, { from: today, to }),
    get<{ documents: ApiDocument[] }>("/documents", { documents: [] }),
    get<{ checklists: ApiChecklist[] }>("/checklists", { checklists: [] }),
    get<{ hasPin: boolean; setAt: string | null } | null>("/kiosk-pin", null),
    get<{ steps: { role: string; name: string }[] }>("/leave/approvers", { steps: [] }),
  ]);
  const [tickets, lent, clockState] = await Promise.all([
    get<{ tickets: ApiTicket[] }>("/tickets", { tickets: [] }),
    get<{ loans: ApiAssetLoan[] }>("/assets", { loans: [] }),
    get<ApiClock | null>("/clock", null),
  ]);

  const [posted, ownReviews] = await Promise.all([
    get<{ announcements: ApiMyAnnouncement[] }>("/announcements", { announcements: [] }),
    get<{ reviews: ApiMyReview[] }>("/reviews", { reviews: [] }),
  ]);

  // ── Pay
  const slips = [...payslips.payslips].sort((a, b) => b.period.localeCompare(a.period));
  const last = slips[0] ?? null;
  const myClaims: MyHrItem[] = [...claims.claims]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .map((c) => {
      const what =
        c.kind === "reimbursement" ? c.reason : `${c.days ?? ""} days of ${c.leaveType?.name ?? "leave"} paid out`;
      const meta =
        c.status === "requested"
          ? `Waiting for approval${c.hasReceipt ? " · receipt attached" : ""}`
          : c.status === "approved"
            ? `Approved · paid with ${monthName(c.period)} payroll`
            : c.status === "rejected"
              ? c.decisionNote
                ? `Declined: ${c.decisionNote}`
                : "Declined"
              : "Withdrawn";
      return {
        id: c.id,
        title: what,
        amount: c.amountRwf,
        repaid: null,
        meta,
        ...STATUS[c.status],
        canCancel: c.status === "requested",
      };
    });
  const myLoans: MyHrItem[] = loans.loans.map((l) => ({
    id: l.id,
    title: l.kind === "advance" ? "Salary advance" : "Staff loan",
    amount: l.amountRwf,
    repaid: l.settledAt ? 1 : l.amountRwf > 0 ? Math.max(0, Math.min(1, 1 - l.remainingRwf / l.amountRwf)) : 0,
    meta: l.settledAt
      ? `Repaid ${dayMonth(l.settledAt)}`
      : `${rwf(l.remainingRwf)} outstanding · ${plural(l.installments, "instalment")}`,
    chip: l.settledAt ? "Repaid" : "Active",
    tone: l.settledAt ? "success" : "info",
    canCancel: false,
  }));

  // ── Leave and requests
  const annual =
    balances.balances.find((b) => b.leaveType.code === "annual") ??
    balances.balances.find((b) => b.balanceDays !== null);
  const requests: (MyHrRequest & { at: string })[] = [
    ...leave.requests.map((r) => ({
      id: `leave:${r.id}`,
      kind: r.leaveType.name,
      title: span(r.startsOn, r.endsOn),
      meta: [
        plural(r.days, "day"),
        r.status === "requested" && r.routedToName ? `with ${r.routedToName}` : null,
        r.decisionNote ? `“${r.decisionNote}”` : r.reason,
      ]
        .filter(Boolean)
        .join(" · "),
      ...STATUS[r.status],
      canCancel: r.status === "requested",
      at: r.createdAt,
    })),
    ...extra.requests.map((r) => ({
      id: `extra:${r.id}`,
      kind: r.kind === "extra" ? "Extra days" : "Day in lieu",
      title: `${plural(r.days, "more day")} of ${r.leaveType.name}`,
      meta: [
        r.status === "requested" && r.routedTo ? `with ${r.routedTo.displayName}` : null,
        r.status !== "requested" && r.decidedByName ? `decided by ${r.decidedByName}` : null,
        r.decisionNote ? `“${r.decisionNote}”` : r.reason,
      ]
        .filter(Boolean)
        .join(" · "),
      ...STATUS[r.status],
      canCancel: r.status === "requested",
      at: r.createdAt,
    })),
    ...shiftList.mine.map((r) => {
      const status = r.status === "awaiting_colleague" ? "requested" : r.status;
      return {
        id: `shift:${r.id}`,
        kind: r.kind === "swap" ? "Shift swap" : r.kind === "rotation" ? "Rotation" : "Shift change",
        title: span(r.fromDate, r.toDate),
        meta: [
          r.kind === "swap"
            ? `with ${r.swapWith?.displayName ?? "a colleague"}`
            : r.kind === "rotation"
              ? (r.rotation?.name ?? "a rotation").replace(/^Rotation [A-Za-z0-9]+ · /, "")
              : `${r.shiftTemplate?.name ?? "another"} shift`,
          r.status === "awaiting_colleague" ? `waiting for ${r.swapWith?.displayName ?? "the colleague"}` : null,
          r.status === "rejected" && r.decisionNote ? `“${r.decisionNote}”` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        ...STATUS[status],
        canCancel: r.status === "requested" || r.status === "awaiting_colleague",
        at: r.createdAt,
      };
    }),
    ...attendance.requests.map((r) => ({
      id: `fix:${r.id}`,
      kind: "Attendance correction",
      title: dayText(r.workDate),
      // HR's note comes first: it is what the person came here to read, and a long line is cut at its end.
      meta: [r.decisionNote ? `“${r.decisionNote}”` : null, `${clock(r.clockInAt)} – ${clock(r.clockOutAt)}`, r.reason]
        .filter(Boolean)
        .join(" · "),
      ...STATUS[r.status],
      canCancel: r.status === "requested",
      at: r.createdAt ?? r.workDate,
    })),
  ];

  // ── Time
  const s = summary.summary;
  const records: MyHrRecord[] = attendance.records
    .filter((r) => r.status !== "superseded")
    .sort((a, b) => b.clockInAt.localeCompare(a.clockInAt))
    .map((r) => {
      const open = r.status === "open";
      const late = r.figures?.lateMinutes ?? 0;
      return {
        id: r.id,
        day: dayText(r.workDate),
        times: `${clock(r.clockInAt)} – ${r.clockOutAt ? clock(r.clockOutAt) : "now"}`,
        worked: r.figures ? hours(r.figures.workedMinutes) : "—",
        note: r.autoClosed ? "No clock-out recorded" : late > 0 ? `${hours(late)} late` : "",
        chip: open ? "Clocked in" : r.validated ? "Verified" : "Pending validation",
        tone: open ? "success" : r.validated ? "default" : "warning",
        workDate: r.workDate,
        inAt: clock(r.clockInAt),
        outAt: r.clockOutAt ? clock(r.clockOutAt) : null,
        canAsk: !open && file.status === "active",
      };
    });
  const rostered = roster.entries
    .filter((e) => e.status !== "cancelled")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const shifts = rostered.map((e) => ({
    id: e.id,
    date: e.workDate,
    day: e.workDate === today ? "Today" : dayText(e.workDate),
    time: `${clock(e.startsAt)} – ${clock(e.endsAt)}`,
    name: e.shiftName ?? "Shift",
    today: e.workDate === today,
  }));
  // The next shift is the first one not yet over: today's, until it ends.
  const nextAt = rostered.findIndex((e) => Date.parse(e.endsAt) > Date.now());
  const next = nextAt === -1 ? null : (shifts[nextAt] ?? null);

  // ── My file
  const DOC: Record<ApiDocument["status"], { chip: string; tone: MyHrTone }> = {
    requested: { chip: "Requested", tone: "warning" },
    submitted: { chip: "Under review", tone: "info" },
    approved: { chip: "Verified", tone: "success" },
    rejected: { chip: "Returned", tone: "danger" },
  };
  const docs: MyHrDocument[] = documents.documents.map((d) => ({
    id: d.id,
    title: d.title,
    meta:
      d.status === "requested"
        ? d.dueOn
          ? `Requested by HR · due ${dayMonth(d.dueOn)}`
          : "Requested by HR"
        : d.status === "rejected"
          ? `Returned${d.rejectReason ? `: ${d.rejectReason}` : ""}`
          : d.status === "submitted"
            ? "Submitted · under HR review"
            : d.expiresOn
              ? `${d.expired ? "Expired" : "Valid to"} ${dayMonth(d.expiresOn)}`
              : "On file",
    ...(d.status === "approved" && d.expired ? { chip: "Expired", tone: "danger" as MyHrTone } : DOC[d.status]),
    canSend: d.status === "requested" || d.status === "rejected",
  }));
  const tasks: MyHrTask[] = checklists.checklists.flatMap((c) =>
    c.tasks.map((t) => ({
      id: t.id,
      label: t.label,
      meta: t.doneAt
        ? `Completed ${dayMonth(t.doneAt)}${t.doneByName ? ` by ${t.doneByName}` : ""}`
        : `Due ${dayMonth(t.dueOn)}${t.byEmployee ? "" : " · handled by HR"}`,
      done: t.doneAt !== null,
      mine: t.byEmployee,
      checklist: c.kind === "onboarding" ? "Onboarding" : "Offboarding",
    })),
  );
  const manager = approvers.steps.find((x) => x.role === "line_manager")?.name ?? null;

  return {
    id: file.employeeId,
    hasFile: true,
    today: ctx.today.iso,
    readOnly: file.status !== "active",
    person: {
      employeeId: file.employeeId,
      name: file.displayName,
      initials: initialsOf(file.displayName),
      job: file.jobPositionTitle ?? "No job on file",
      branch: file.branchName ?? "No branch on file",
      business: file.businessName,
      staffNo: file.employeeNumber,
      manager,
      status: file.status,
    },
    figures: [
      {
        id: "leave",
        label: annual ? `${annual.leaveType.name} balance` : "Leave balance",
        // Whole days, rounded down: nobody is shown more leave than they have.
        value: annual && annual.balanceDays !== null ? plural(Math.floor(annual.balanceDays), "day") : "—",
        foot: annual ? "Available this year" : "No annual leave on record",
      },
      {
        id: "shift",
        label: "Next shift",
        value: next ? next.day : "None published",
        foot: next ? `${next.time} · ${next.name}` : "No shifts scheduled",
      },
      {
        id: "month",
        label: "Hours this month",
        // Nothing scheduled and nothing worked reads as that, not as "0 h of 0 h".
        value: s && (s.workedMinutes > 0 || s.expectedMinutes > 0) ? hours(s.workedMinutes) : "—",
        foot:
          s && (s.workedMinutes > 0 || s.expectedMinutes > 0)
            ? `of ${hours(s.expectedMinutes)} scheduled · ${plural(s.daysWorked, "day")} worked`
            : "Nothing scheduled yet",
      },
      {
        id: "pay",
        label: "Last net pay",
        value: last ? rwf(last.netRwf) : "—",
        foot: last
          ? `${monthName(last.period)} · ${last.paidAt ? `paid ${dayMonth(last.paidAt)}` : "payment pending"}`
          : "No payslip issued yet",
      },
    ],
    shifts,
    payslips: slips.map((p) => ({
      id: p.id,
      period: p.period,
      month: monthName(p.period),
      gross: p.grossRwf,
      net: p.netRwf,
      paid: p.paidAt ? `Paid ${dayMonth(p.paidAt)}` : "Payment pending",
      tone: p.paidAt ? "success" : "warning",
    })),
    claims: myClaims,
    loans: myLoans,
    balances: balances.balances.map((b) => ({
      id: b.leaveType.id,
      name: b.leaveType.name,
      days: b.balanceDays === null ? null : Math.floor(b.balanceDays),
      foot: b.balanceDays === null ? "No fixed balance" : "Available",
    })),
    leaveTypes: types.types.map((t) => ({ id: t.id, name: t.name })),
    requests: requests.sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _at, ...r }) => r),
    month: s
      ? {
          label: monthName(month),
          daysWorked: s.daysWorked,
          worked: hours(s.workedMinutes),
          expected: hours(s.expectedMinutes),
          late: s.lateCount,
          overtime: hours(s.approvedOvertimeMinutes),
        }
      : null,
    records,
    documents: docs,
    tasks,
    kioskPin: pin ? { hasPin: pin.hasPin, setOn: pin.setAt ? dayMonth(pin.setAt) : null } : null,
    clock: clockState
      ? {
          branch: clockState.branchName,
          mode: clockState.clockMode,
          open: clockState.open ? { since: clockState.open.clockInAt, checked: clockState.open.validated } : null,
          shift: clockState.shift,
          opensAt: clockState.opensAt,
        }
      : null,
    tickets: tickets.tickets.map((t) => {
      const answer = [...t.messages].reverse().find((m) => !m.fromStaff);
      return {
        id: t.id,
        title: t.subject,
        meta: `${t.reference} · ${answer ? `${answer.authorName ?? "HR"} answered ${agoOf(answer.createdAt)}` : `asked ${agoOf(t.createdAt)}`}`,
        chip: t.status === "closed" ? "Resolved" : t.status === "answered" ? "Answered" : "Waiting for HR",
        tone: t.status === "closed" ? "success" : t.status === "answered" ? "accent" : "warning",
        answer: answer?.body ?? null,
      };
    }),
    announcements: posted.announcements.map(announcementWords),
    reviews: ownReviews.reviews.map(reviewWords),
    assets: lent.loans
      .filter((l) => !l.returnedOn)
      .map((l) => {
        const state = loanState(l, today);
        return {
          id: l.id,
          name: l.name,
          meta: [`Since ${dayMonth(l.issuedOn)}`, l.tag].filter(Boolean).join(" · "),
          chip: state.due ? "Return it" : l.dueBackOn ? `Back by ${dayMonth(l.dueBackOn)}` : "With you",
          tone: state.due ? "warning" : "default",
        };
      }),
  };
}

export const sources = defineSources({
  "shared.myHr": {
    naturalKey: "id",
    parity: "shape",
    async list(ctx): Promise<MyHr[]> {
      return [await myHr(ctx)];
    },
  },
});
