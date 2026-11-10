/**
 * The owner's approvals, built from what is really waiting on them in Injishi: the month's pay run
 * HR submitted, expense claims staff made, logins HR asked for, guest refunds above the desk's limit,
 * and shift swaps, clock corrections, extra leave days and documents to check. Each item's id says
 * what it is ("payrun:<id>", "claim:<id>", "access:<id>", "refund:<id>", "swap:<id>",
 * "correction:<id>", "extra:<id>", "document:<id>"), and deciding it runs that thing's own command
 * on the API. What a person may not decide does not show: each read is behind its own permission.
 */
import type { ApprovalHistoryEntry, ApprovalRequest } from "@injishi/data/fixtures/owner";
import type { ApiAccessRequest } from "./access-view";
import { ApiError } from "./api";
import { clock, dayMonth } from "./format";
import { hrFeaturesOff } from "./hr-features";
import { decideClaim } from "./mutations/payroll";
import type { ScopedApi, SourceContext } from "./sources/types";

interface ApiRun {
  id: string;
  period: string;
  status: "draft" | "confirmed";
  computedAt: string;
  ruleVersions: { configType: string; version: number }[];
  confirmedAt: string | null;
  confirmedByName: string | null;
  submittedAt: string | null;
  submittedByName: string | null;
  submitNote: string | null;
  headcount: number;
  grossRwf: number;
  netRwf: number;
  payeRwf: number;
  employeeContributionsRwf: number;
  employerContributionsRwf: number;
}
interface ApiClaim {
  id: string;
  employee: { employeeId: string; displayName: string; jobPositionTitle: string | null };
  kind: "reimbursement" | "leave_encashment";
  amountRwf: number | null;
  leaveType: { name: string } | null;
  days: number | null;
  period: string;
  hasReceipt: boolean;
  reason: string;
  status: "requested" | "approved" | "rejected" | "cancelled";
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  createdAt: string;
}
interface ApiRefund {
  id: string;
  reference: string;
  propertyName: string | null;
  roomLabel: string | null;
  guestName: string | null;
  reason: string;
  detail: string;
  requestedRwf: number | null;
  state: string;
  policyEligible: boolean;
  policyMaxRwf: number;
  policyRule: string;
  approvedRwf: number | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

/** A shift swap both colleagues agreed to (`GET /ops/shift-requests`). */
interface ApiSwap {
  id: string;
  employee: { displayName: string; jobPositionTitle: string | null };
  swapWith: { displayName: string } | null;
  fromDate: string;
  reason: string;
  createdAt: string;
}
/** A clock correction someone asked for (`GET /ops/attendance-requests`). */
interface ApiCorrection {
  id: string;
  employee: { displayName: string; jobPositionTitle: string | null };
  workDate: string;
  clockInAt: string;
  clockOutAt: string;
  recordId: string | null;
  reason: string;
  createdAt: string;
}
/** Days asked for on top of an entitlement (`GET /ops/leave/allocation-requests`). */
interface ApiExtraDays {
  id: string;
  employee: { displayName: string; jobPositionTitle: string | null };
  leaveType: { name: string };
  kind: "extra" | "compensatory";
  days: number;
  reason: string;
  createdAt: string;
}
/** A document handed in and not checked yet (`GET /ops/documents?status=submitted`). */
interface ApiHandedIn {
  id: string;
  employee: { displayName: string; jobPositionTitle: string | null };
  title: string;
  updatedAt: string;
}

const onlyWaiting = JSON.stringify([["status", "eq", "requested"]]);

const rwf = (n: number) => `RWF ${n.toLocaleString("en-US")}`;
const monthName = (period: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${period}-01T12:00:00Z`),
  );
const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
const when = (iso: string) => `${dayMonth(iso)}, ${clock(iso)}`;
const daysSince = (iso: string, today: string) =>
  Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(iso)) / 86_400_000);

/** A read the person may not hold answers nothing rather than failing the inbox. */
async function orEmpty<T>(read: Promise<T>, empty: T): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && (error.forbidden || error.notFound || error.status === 400)) return empty;
    throw error;
  }
}

/** The base of every item: the fields each kind fills the same way. */
function item(
  part: Pick<ApprovalRequest, "id" | "area" | "icon" | "type" | "title" | "who" | "whoRole" | "reason"> &
    Partial<ApprovalRequest> & { askedAt: string; today: string },
): ApprovalRequest {
  const age = daysSince(part.askedAt, part.today);
  const { askedAt, today: _, ...rest } = part;
  return {
    tone: "warning",
    initials: initialsOf(part.who),
    whoProposed: false,
    when: when(askedAt),
    due: age >= 3 ? `Waiting ${age} days` : age >= 1 ? "Since yesterday" : "New today",
    dueTone: age >= 3 ? "danger" : "warning",
    isNew: age < 1,
    stepUp: false,
    needAck: false,
    figures: [],
    facts: [],
    checks: [],
    rules: [],
    exceptions: [],
    after: [],
    links: [],
    approveLabel: "Approve",
    footNote: "",
    okTitle: "Approved",
    okDesc: "",
    decision: null,
    decisionReason: "",
    ...rest,
  };
}

/** Everything waiting on the owner, oldest first within each kind. */
export async function approvalInbox(ctx: SourceContext): Promise<ApprovalRequest[]> {
  const today = ctx.today.iso;
  const api = ctx.ops("hospitality");
  const can = new Set(api.workspace.permissions);
  // Expense claims are a feature Injishi may switch off: then none waits here. Swaps, corrections,
  // extra days and documents are not optional, so they always show.
  const claimsOn = !(await hrFeaturesOff()).includes("claims");
  const [runs, claims, access, refunds, swaps, corrections, extraDays, documents] = await Promise.all([
    can.has("payroll.run")
      ? orEmpty(api.get<{ items: ApiRun[] }>("/api/v1/ops/pay-runs", { query: { size: "25", page: "1" } }), {
          items: [],
        })
      : { items: [] as ApiRun[] },
    can.has("payroll.run") && claimsOn
      ? orEmpty(api.get<{ items: ApiClaim[] }>("/api/v1/ops/pay-claims", { query: { size: "100", page: "1" } }), {
          items: [],
        })
      : { items: [] as ApiClaim[] },
    can.has("team.manage")
      ? orEmpty(api.get<{ requests: ApiAccessRequest[] }>("/api/v1/ops/team/access-requests"), { requests: [] })
      : { requests: [] as ApiAccessRequest[] },
    can.has("refund.decide")
      ? orEmpty(api.get<{ requests: ApiRefund[] }>("/api/v1/ops/refund-requests", { query: { state: "submitted" } }), {
          requests: [],
        })
      : { requests: [] as ApiRefund[] },
    can.has("roster.manage")
      ? orEmpty(
          api.get<{ items: ApiSwap[] }>("/api/v1/ops/shift-requests", {
            query: {
              size: "100",
              page: "1",
              f: JSON.stringify([
                ["kind", "eq", "swap"],
                ["status", "eq", "requested"],
              ]),
            },
          }),
          { items: [] },
        )
      : { items: [] as ApiSwap[] },
    can.has("attendance.approve")
      ? orEmpty(
          api.get<{ items: ApiCorrection[] }>("/api/v1/ops/attendance-requests", {
            query: { size: "100", page: "1", f: onlyWaiting },
          }),
          { items: [] },
        )
      : { items: [] as ApiCorrection[] },
    can.has("leave.approve")
      ? orEmpty(
          api.get<{ items: ApiExtraDays[] }>("/api/v1/ops/leave/allocation-requests", {
            query: { size: "100", page: "1", f: onlyWaiting },
          }),
          { items: [] },
        )
      : { items: [] as ApiExtraDays[] },
    can.has("people.manage")
      ? orEmpty(api.get<{ documents: ApiHandedIn[] }>("/api/v1/ops/documents", { query: { status: "submitted" } }), {
          documents: [],
        })
      : { documents: [] as ApiHandedIn[] },
  ]);

  const out: ApprovalRequest[] = [];

  for (const run of runs.items.filter((r) => r.status === "draft" && r.submittedAt)) {
    const month = monthName(run.period);
    out.push(
      item({
        id: `payrun:${run.id}`,
        area: "people",
        icon: "Sack",
        type: "Payroll · HR prepared, you confirm",
        title: `Confirm the ${month} pay run`,
        who: run.submittedByName ?? "HR",
        whoRole: "HR officer",
        reason: run.submitNote || `${run.headcount} staff for ${month}, ready to pay.`,
        askedAt: run.submittedAt as string,
        today,
        needAck: true,
        figures: [
          { label: "Staff", value: String(run.headcount) },
          { label: "Gross", value: rwf(run.grossRwf) },
          { label: "Net to pay", value: rwf(run.netRwf) },
          { label: "PAYE", value: rwf(run.payeRwf) },
        ],
        facts: [
          { label: "RSSB, staff share", value: rwf(run.employeeContributionsRwf) },
          { label: "RSSB, business share", value: rwf(run.employerContributionsRwf) },
          { label: "Computed", value: when(run.computedAt) },
        ],
        checks: [{ kind: "info", text: "Confirming freezes the month: no line changes after it." }],
        rules: run.ruleVersions.map((v) => ({
          name: v.configType.replace(/^hr\.rw\./, "").replace(/_/g, " "),
          version: `v${v.version}`,
        })),
        after: [
          {
            status: "current",
            title: "Payment files and returns",
            detail: "Bank, mobile money, PAYE and RSSB files can be built.",
          },
          { status: "default", title: "Payslips open to staff", detail: "Each person sees their payslip in Me." },
        ],
        links: [{ label: "Open the pay run", board: "PayRun" }],
        approveLabel: "Confirm pay run",
        footNote: "Declining sends it back to HR with your reason.",
        okTitle: "Pay run confirmed",
        okDesc: `${month} is confirmed. The payment files can be built.`,
      }),
    );
  }

  for (const c of claims.items.filter((x) => x.status === "requested")) {
    const ask =
      c.amountRwf !== null ? rwf(c.amountRwf) : `${c.days ?? 0} days of ${c.leaveType?.name ?? "leave"} paid out`;
    out.push(
      item({
        id: `claim:${c.id}`,
        area: "money",
        icon: "Receipt",
        type: c.kind === "reimbursement" ? "Expense claim" : "Leave paid out",
        title: `${ask} for ${c.employee.displayName}`,
        who: c.employee.displayName,
        whoRole: c.employee.jobPositionTitle ?? "Staff",
        reason: c.reason,
        askedAt: c.createdAt,
        today,
        figures: [{ label: "Asked", value: ask }],
        facts: [
          { label: "Receipt", value: c.hasReceipt ? "Attached" : "None" },
          { label: "Paid with", value: `${monthName(c.period)} pay` },
        ],
        checks: c.hasReceipt
          ? [{ kind: "ok", text: "A receipt is attached." }]
          : [{ kind: "warn", text: "No receipt was attached." }],
        after: [{ status: "current", title: "Paid with the next pay", detail: "Untaxed, beside the salary." }],
        links: [{ label: "Claims on the pay run", board: "PayRun" }],
        approveLabel: "Approve claim",
        footNote: "Declining tells the person why on their phone.",
        okTitle: "Claim approved",
        okDesc: "It is paid with the next pay.",
      }),
    );
  }

  for (const a of access.requests.filter((x) => x.status === "pending")) {
    out.push(
      item({
        id: `access:${a.id}`,
        area: "people",
        icon: "PersonPlus",
        type: "Login for a staff member",
        title: `Give ${a.employeeName} a login as ${a.orgRole.replace(/_/g, " ")}`,
        who: a.requestedByName ?? "HR",
        whoRole: "HR officer",
        reason: a.note || `${a.employeeName} (${a.jobTitle ?? "staff"}) needs Injishi for their work.`,
        askedAt: a.requestedAt,
        today,
        facts: [
          { label: "Email", value: a.email },
          { label: "Role", value: a.orgRole.replace(/_/g, " ") },
          { label: "Branches", value: a.branchIds === null ? "All" : `${a.branchIds.length}` },
        ],
        after: [{ status: "current", title: "Invitation sent", detail: "Valid for 7 days." }],
        links: [{ label: "Team and roles", board: "TeamRoles" }],
        approveLabel: "Approve login",
        footNote: "Declining tells HR why.",
        okTitle: "Login approved",
        okDesc: `${a.employeeName} gets an invitation by email.`,
      }),
    );
  }

  for (const r of refunds.requests.filter((x) => x.state === "submitted")) {
    const asked = r.requestedRwf ?? r.policyMaxRwf;
    out.push(
      item({
        id: `refund:${r.id}`,
        area: "money",
        icon: "ArrowRotateLeft",
        type: "Guest refund",
        title: `Refund ${rwf(asked)} to ${r.guestName ?? "a guest"}`,
        who: r.guestName ?? "Guest",
        whoRole: [r.propertyName, r.roomLabel].filter(Boolean).join(" · ") || "Guest",
        reason: r.detail,
        askedAt: r.createdAt,
        today,
        figures: [
          { label: "Asked", value: rwf(asked) },
          { label: "Rules allow", value: rwf(r.policyMaxRwf) },
        ],
        facts: [{ label: "Reference", value: r.reference }],
        checks: [{ kind: r.policyEligible ? "ok" : "warn", text: r.policyRule }],
        links: [],
        approveLabel: "Approve refund",
        footNote: "Approving sends the money through the payment adapter.",
        okTitle: "Refund approved",
        okDesc: "The money is sent back to the guest.",
      }),
    );
  }

  for (const r of swaps.items) {
    out.push(
      item({
        id: `swap:${r.id}`,
        area: "people",
        icon: "ArrowRightArrowLeft",
        type: "Shift swap",
        title: `${r.employee.displayName} and ${r.swapWith?.displayName ?? "a colleague"} swap ${dayMonth(r.fromDate)}`,
        who: r.employee.displayName,
        whoRole: r.employee.jobPositionTitle ?? "Staff",
        reason: r.reason,
        askedAt: r.createdAt,
        today,
        after: [{ status: "current", title: "The roster changes", detail: "Both people see their new shift." }],
        links: [{ label: "Open the roster", board: "Roster" }],
        approveLabel: "Approve swap",
        footNote: "Declining tells them why.",
        okTitle: "Swap approved",
        okDesc: "The roster shows the new shifts.",
      }),
    );
  }

  for (const c of corrections.items) {
    const times = `${clock(c.clockInAt)} – ${clock(c.clockOutAt)}`;
    out.push(
      item({
        id: `correction:${c.id}`,
        area: "people",
        icon: "Clock",
        type: c.recordId ? "Clock correction" : "Missing clock record",
        title: `${times} on ${dayMonth(c.workDate)} for ${c.employee.displayName}`,
        who: c.employee.displayName,
        whoRole: c.employee.jobPositionTitle ?? "Staff",
        reason: c.reason,
        askedAt: c.createdAt,
        today,
        facts: [
          { label: "Day", value: dayMonth(c.workDate) },
          { label: "Times asked", value: times },
        ],
        after: [{ status: "current", title: "The record changes", detail: "The old one is kept behind it." }],
        links: [{ label: "Open attendance", board: "Attendance" }],
        approveLabel: "Approve correction",
        footNote: "Declining tells them why.",
        okTitle: "Correction approved",
        okDesc: "The clock record is put right.",
      }),
    );
  }

  for (const x of extraDays.items) {
    const ask = `${x.days} ${x.days === 1 ? "day" : "days"} of ${x.leaveType.name}`;
    out.push(
      item({
        id: `extra:${x.id}`,
        area: "people",
        icon: "Suitcase",
        type: x.kind === "extra" ? "Extra leave days" : "Day in lieu",
        title: `${ask} for ${x.employee.displayName}`,
        who: x.employee.displayName,
        whoRole: x.employee.jobPositionTitle ?? "Staff",
        reason: x.reason,
        askedAt: x.createdAt,
        today,
        figures: [{ label: "Asked", value: ask }],
        after: [{ status: "current", title: "Added to the balance", detail: "They can take the days as leave." }],
        links: [{ label: "Open leave", board: "Leave" }],
        approveLabel: "Approve days",
        footNote: "Declining tells them why.",
        okTitle: "Days approved",
        okDesc: "The days are on their balance.",
      }),
    );
  }

  for (const d of documents.documents) {
    out.push(
      item({
        id: `document:${d.id}`,
        area: "people",
        icon: "FileText",
        type: "Document to check",
        title: `${d.title} from ${d.employee.displayName}`,
        who: d.employee.displayName,
        whoRole: d.employee.jobPositionTitle ?? "Staff",
        reason: "Handed in and waiting to be checked.",
        askedAt: d.updatedAt,
        today,
        links: [{ label: "Open employees", board: "Employees" }],
        approveLabel: "Approve document",
        footNote: "Declining sends it back with your reason.",
        okTitle: "Document approved",
        okDesc: "It stays on their file.",
      }),
    );
  }
  return out;
}

/** What was decided lately: confirmed months, decided claims and logins. */
export async function approvalHistory(ctx: SourceContext): Promise<ApprovalHistoryEntry[]> {
  const api = ctx.ops("hospitality");
  const can = new Set(api.workspace.permissions);
  // With expense claims switched off, the claims decided before are hidden too; switched on, they come back.
  const claimsOn = !(await hrFeaturesOff()).includes("claims");
  const [runs, claims, access] = await Promise.all([
    can.has("payroll.run")
      ? orEmpty(api.get<{ items: ApiRun[] }>("/api/v1/ops/pay-runs", { query: { size: "25", page: "1" } }), {
          items: [],
        })
      : { items: [] as ApiRun[] },
    can.has("payroll.run") && claimsOn
      ? orEmpty(api.get<{ items: ApiClaim[] }>("/api/v1/ops/pay-claims", { query: { size: "100", page: "1" } }), {
          items: [],
        })
      : { items: [] as ApiClaim[] },
    can.has("team.manage")
      ? orEmpty(api.get<{ requests: ApiAccessRequest[] }>("/api/v1/ops/team/access-requests"), { requests: [] })
      : { requests: [] as ApiAccessRequest[] },
  ]);
  const rows: (ApprovalHistoryEntry & { at: string })[] = [
    ...runs.items
      .filter((r) => r.status === "confirmed" && r.confirmedAt)
      .map((r) => ({
        id: `payrun:${r.id}`,
        at: r.confirmedAt as string,
        when: when(r.confirmedAt as string),
        title: `${monthName(r.period)} pay run`,
        ref: `${r.headcount} staff · ${rwf(r.netRwf)} net`,
        by: r.submittedByName ?? "HR",
        decision: "Confirmed",
        decisionTone: "success" as const,
        decider: r.confirmedByName ?? "Owner",
        note: "",
      })),
    ...claims.items
      .filter((c) => (c.status === "approved" || c.status === "rejected") && c.decidedAt)
      .map((c) => ({
        id: `claim:${c.id}`,
        at: c.decidedAt as string,
        when: when(c.decidedAt as string),
        title: `${c.amountRwf !== null ? rwf(c.amountRwf) : "Leave paid out"} for ${c.employee.displayName}`,
        ref: c.reason,
        by: c.employee.displayName,
        decision: c.status === "approved" ? "Approved" : "Declined",
        decisionTone: (c.status === "approved" ? "success" : "default") as "success" | "default",
        decider: c.decidedByName ?? "Owner",
        note: c.decisionNote ?? "",
      })),
    ...access.requests
      .filter((a) => (a.status === "approved" || a.status === "declined") && a.decidedAt)
      .map((a) => ({
        id: `access:${a.id}`,
        at: a.decidedAt as string,
        when: when(a.decidedAt as string),
        title: `Login for ${a.employeeName}`,
        ref: a.orgRole.replace(/_/g, " "),
        by: a.requestedByName ?? "HR",
        decision: a.status === "approved" ? "Approved" : "Declined",
        decisionTone: (a.status === "approved" ? "success" : "default") as "success" | "default",
        decider: a.decidedByName ?? "Owner",
        note: a.decisionNote ?? "",
      })),
  ];
  return rows.sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _, ...r }) => r);
}

/** Run the decision on the thing itself. */
export async function decideApprovalItem(
  ctx: SourceContext,
  id: string,
  decision: "approved" | "declined",
  reason: string,
): Promise<void> {
  const [kind, raw] = id.split(":");
  const key = encodeURIComponent(raw ?? "");
  const api: ScopedApi = ctx.ops("hospitality");
  const note = reason.trim();
  if (kind === "payrun") {
    if (decision === "approved") await api.post(`/api/v1/ops/pay-runs/${key}/confirm`);
    else await api.post(`/api/v1/ops/pay-runs/${key}/withdraw`, { reason: note || null });
    return;
  }
  if (kind === "claim") {
    await decideClaim(ctx, raw ?? "", decision === "approved" ? "approve" : "reject", note || null);
    return;
  }
  if (kind === "access") {
    await api.post(
      `/api/v1/ops/team/access-requests/${key}/${decision === "approved" ? "approve" : "decline"}`,
      decision === "approved" ? {} : { note },
    );
    return;
  }
  if (kind === "swap" || kind === "correction" || kind === "extra") {
    const path =
      kind === "swap" ? "shift-requests" : kind === "correction" ? "attendance-requests" : "leave/allocation-requests";
    await api.post(`/api/v1/ops/${path}/${key}/${decision === "approved" ? "approve" : "reject"}`, {
      note: note || null,
    });
    return;
  }
  if (kind === "document") {
    await api.post(
      `/api/v1/ops/documents/${key}/decide`,
      decision === "approved" ? { decision: "approve" } : { decision: "reject", reason: note },
    );
    return;
  }
  if (kind === "refund") {
    if (decision === "approved") {
      const { requests } = await api.get<{ requests: ApiRefund[] }>("/api/v1/ops/refund-requests", {
        query: { state: "submitted" },
      });
      const r = requests.find((x) => x.id === raw);
      await api.post(`/api/v1/ops/refund-requests/${key}/decision`, {
        decision: "approve",
        approvedRwf: r?.requestedRwf ?? r?.policyMaxRwf ?? 0,
      });
    } else {
      await api.post(`/api/v1/ops/refund-requests/${key}/decision`, {
        decision: "reject",
        refusalReason: "other",
        note: note || "Declined by the owner.",
      });
    }
    return;
  }
  throw new Error("That request is not one Injishi knows.");
}
