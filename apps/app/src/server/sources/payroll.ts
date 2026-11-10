/**
 * Live sources for the payroll area: the Pay run board, read from the business's newest pay run
 * (ADR-058, 058-payroll) and presented in the board's document shapes.
 *
 * The board was drawn for one month moving from HR's draft to the owner's confirmation and the
 * release of the payment files. A live run says where it is: a draft being prepared ("review"),
 * a draft submitted to whoever confirms ("submitted", `POST .../submit`), or confirmed. Each
 * payslip's figures are the API's, carried on the line (`figures`), so the board never works out
 * tax itself on a live run. What stops the month is the run's blockers: each is fixed on the
 * person's file, or the person is paid next month (`POST .../hold`).
 *
 * The run is the hospitality business's: a person who keeps two employers' files sees the one
 * whose staff they work among, and each business files its own declarations.
 */

import type {
  FinalSettlement,
  HelpdeskTicket,
  PayLine,
  PaymentFile,
  PayRates,
  PayRunException,
  PayRunHistory,
  PayRunOutput,
  PayRunRule,
  PayRunState,
  PayRunStep,
  PayRunTotal,
  RuleGovernanceStep,
  RuleSet,
  StaffAsset,
} from "@injishi/data/fixtures/payroll";
import type { PayRunSummary } from "@injishi/data/fixtures/people";
import { ApiError } from "../api";
import { type ApiLoan, type ApiTicket, ASSET, ageOf, loanOutcome, loanState, TOPIC, ticketState } from "../desk-view";
import { defineSources, type ScopedApi, type SourceContext } from "./types";

// ── The API's shapes (what this file reads of them) ─────────────────────────────────────────────

interface ApiRun {
  id: string;
  period: string;
  status: "draft" | "confirmed";
  computedAt: string;
  ruleVersions: { configType: string; configEntryId: string; version: number }[];
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
interface ApiLine {
  code: string;
  label: string;
  basis: string;
  amountRwf: number;
  side: "earning" | "employee" | "employer" | "deduction" | "passthrough";
}
interface ApiPayslip {
  id: string;
  employeeId: string;
  displayName: string;
  payableDays: number;
  grossRwf: number;
  payeRwf: number;
  employeeContributionsRwf: number;
  employerContributionsRwf: number;
  otherDeductionsRwf: number;
  nonIncomeRwf: number;
  netRwf: number;
  lines: ApiLine[];
  /** The owner's payslip, which the API sends without figures to whoever does not hold `team.manage`. */
  confidential?: boolean;
}
interface ApiBlocker {
  code: string;
  employeeId: string | null;
  displayName: string;
  message: string;
  remedies?: string[];
  record?: { id: string; workDate: string; clockInAt: string };
}
interface ApiDetail {
  run: ApiRun;
  payslips: ApiPayslip[];
  blockers: ApiBlocker[];
}
interface ApiRule {
  configType: string;
  label: string;
  inForce: { configEntryId?: string; version: number; effectiveFrom: string | null; value: unknown } | null;
  history?: { configEntryId: string; version: number; effectiveFrom: string | null; effectiveTo: string | null }[];
}
interface ApiEmployee {
  id: string;
  displayName: string;
  jobPositionTitle: string | null;
  hiredOn: string;
  offboardedOn: string | null;
  orgRole: string | null;
}
interface ApiPayAccount {
  employeeId: string;
  kind: "bank" | "momo";
  provider: string;
}
interface ApiFile {
  id: string;
  kind: "bank" | "momo" | "paye" | "rssb";
  rowCount: number | null;
  totalRwf: number | null;
  createdAt: string;
  createdByName: string | null;
}
interface Page<T> {
  items: T[];
  total: number;
}

// ── Wording ─────────────────────────────────────────────────────────────────────────────────────

const TZ = "Africa/Kigali";
const monthName = (period: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${period}-01T12:00:00Z`),
  );
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(
    new Date(iso),
  );
const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(
    new Date(iso),
  );
const lastDay = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const previousMonth = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
const nextMonth = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
const sum = (lines: { amountRwf: number }[]) => lines.reduce((s, l) => s + l.amountRwf, 0);

/** A rule a sample database invented, or one looked up and not yet confirmed by an accountant. */
function awaitingSignOff(value: unknown): boolean {
  const note = (value as { note?: unknown } | null)?.note;
  return typeof note === "string" && /^(SAMPLE|RESEARCHED|DEMO)/i.test(note.trim());
}

// ── The national rules as tables ────────────────────────────────────────────────────────────────

const RULE_LOOK: Record<string, { id: string; name: string; icon: string; kind: string }> = {
  "hr.rw.paye": { id: "paye", name: "PAYE bands", icon: "Percent", kind: "Statutory · monthly taxable pay" },
  "hr.rw.rssb": {
    id: "rssb",
    name: "RSSB and insurance",
    icon: "ShieldCheck",
    kind: "Statutory · employee and business",
  },
  "hr.rw.public_holidays": { id: "holidays", name: "Public holidays", icon: "Calendar", kind: "National · this year" },
  "hr.rw.leave_defaults": { id: "leave", name: "Leave types", icon: "Briefcase", kind: "Defaults for a new business" },
  "hr.rw.overtime": { id: "overtime", name: "Overtime", icon: "Clock", kind: "How extra hours are paid" },
  "hr.rw.final_settlement": { id: "settlement", name: "Final pay", icon: "Sack", kind: "What a leaver is paid" },
  "hr.rw.declaration_formats": {
    id: "returns",
    name: "PAYE and RSSB returns",
    icon: "FileText",
    kind: "Declaration file formats",
  },
};

const pct = (rate: number) => `${+(rate * 100).toFixed(2)}%`;
const rwfOf = (n: number) => `RWF ${n.toLocaleString("en-US")}`;
const BASE: Record<string, string> = {
  gross: "of gross",
  basic: "of basic",
  contributable: "of pay counted for RSSB",
  net: "of net",
};
const dateLong = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(
    new Date(iso),
  );
const dateShort = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(
    new Date(iso),
  );

/** A rule's value as a table: its own columns and one row per line. */
function tableOf(type: string, value: Record<string, unknown>): { cols: string[]; rows: string[][] } {
  if (type === "hr.rw.paye") {
    const bands = (value.bands ?? []) as { fromRwf: number; toRwf: number | null; rate: number }[];
    return {
      cols: ["Band", "From", "To", "Rate"],
      rows: bands.map((b, i) => [
        String(i + 1),
        rwfOf(b.fromRwf),
        b.toRwf === null ? "and above" : rwfOf(b.toRwf),
        pct(b.rate),
      ]),
    };
  }
  if (type === "hr.rw.rssb") {
    const parts = (value.contributions ?? []) as {
      label: string;
      base: string;
      employeeRate: number;
      employerRate: number;
      optional?: boolean;
    }[];
    return {
      cols: ["Scheme", "Employee", "Business", "Required"],
      rows: parts.map((c) => [
        c.label,
        c.employeeRate ? `${pct(c.employeeRate)} ${BASE[c.base] ?? ""}`.trim() : "—",
        c.employerRate ? `${pct(c.employerRate)} ${BASE[c.base] ?? ""}`.trim() : "—",
        c.optional ? "Optional" : "Yes",
      ]),
    };
  }
  if (type === "hr.rw.public_holidays") {
    const dates = (value.dates ?? []) as { date: string; name: string }[];
    return { cols: ["Date", "Holiday"], rows: dates.map((d) => [dateShort(`${d.date}T12:00:00Z`), d.name]) };
  }
  if (type === "hr.rw.leave_defaults") {
    const types = (value.types ?? []) as {
      name: string;
      payment: string;
      yearlyEntitlementDays: number | null;
      approvalSteps?: number;
    }[];
    return {
      cols: ["Leave", "Days a year", "Paid", "Approval"],
      rows: types.map((t) => [
        t.name,
        t.yearlyEntitlementDays === null ? "No limit" : String(t.yearlyEntitlementDays),
        t.payment === "paid" ? "Yes" : t.payment === "unpaid" ? "No" : "Partly",
        t.approvalSteps === 0 ? "Automatic" : t.approvalSteps === 2 ? "Manager, then HR" : "HR",
      ]),
    };
  }
  if (type === "hr.rw.overtime") {
    const m = (value.multipliers ?? {}) as Record<string, number>;
    const words: Record<string, string> = {
      weekday: "A working day",
      weekly_off: "A day off",
      public_holiday: "A public holiday",
    };
    return {
      cols: ["Hours worked on", "Paid at"],
      rows: [
        ...Object.entries(m).map(([k, x]) => [words[k] ?? k, `${x} × the hourly rate`]),
        ["Hourly rate", `Monthly pay ÷ ${String(value.monthlyHoursDivisor ?? 200)} hours`],
      ],
    };
  }
  if (type === "hr.rw.final_settlement") {
    const u = (value.unusedLeave ?? {}) as { taxable?: boolean; contributable?: boolean };
    return {
      cols: ["Paid at the end", "Taxed", "Counted for RSSB"],
      rows: [["Unused leave", u.taxable ? "Yes" : "No", u.contributable ? "Yes" : "No"]],
    };
  }
  if (type === "hr.rw.declaration_formats") {
    const f = value as { paye?: { format?: string }; rssb?: { format?: string } };
    const fmt = (x?: string) => (x === "provisional_csv" ? "CSV (provisional layout)" : (x ?? "—"));
    return {
      cols: ["Return", "File"],
      rows: [
        ["PAYE to RRA", fmt(f.paye?.format)],
        ["RSSB", fmt(f.rssb?.format)],
      ],
    };
  }
  return { cols: ["Value"], rows: [[JSON.stringify(value)]] };
}

/** One national rule for the rules screen, with the runs that computed with its version in force. */
function ruleSetOf(r: ApiRule, runs: ApiRun[]): RuleSet {
  const look = RULE_LOOK[r.configType];
  const inForce = r.inForce as NonNullable<ApiRule["inForce"]>;
  const value = (inForce.value ?? {}) as Record<string, unknown>;
  const note = typeof value.note === "string" ? value.note : "";
  const sample = /^(SAMPLE|DEMO)/i.test(note.trim());
  const researched = /^RESEARCHED/i.test(note.trim());
  const history = [...(r.history ?? [])].sort((a, b) => b.version - a.version);
  const prev = history.find((h) => h.version < inForce.version);
  const from = inForce.effectiveFrom;
  const { cols, rows } = tableOf(r.configType, value);
  const used = runs.filter((run) =>
    run.ruleVersions.some((v) => v.configType === r.configType && v.version === inForce.version),
  );
  return {
    id: look.id,
    name: look.name,
    icon: look.icon,
    version: `v${inForce.version}`,
    prev: prev ? `v${prev.version}` : "—",
    eff: from ? dateShort(from) : "Always",
    effRange: from ? `${dateLong(from)} until replaced` : "Until replaced",
    status: sample || researched ? "awaiting" : "approved",
    statusLabel: sample ? "Sample values · replace" : researched ? "Researched · not confirmed" : "In force",
    kind: look.kind,
    // The note says where the values came from; its first sentence is the status, the rest the source.
    source:
      note.replace(/^(RESEARCHED, NOT CONFIRMED BY AN ACCOUNTANT|DEMO SAMPLE DATA)\.\s*/i, "") || "Recorded by Injishi",
    by: "Injishi · national rule",
    owner: "Not needed · a national rule",
    expert: sample
      ? "No · these are placeholder values"
      : researched
        ? "Not yet · not confirmed by an accountant"
        : "Confirmed",
    cols,
    rows,
    diff: [],
    note: sample
      ? "Placeholder values for the demo. Replace them from the accountant's sheet before paying anyone."
      : "Read only. Each pay run records the version it used.",
    history: history.map((h) => ({
      title: `v${h.version} · ${h.version === inForce.version ? "in force" : "replaced"}`,
      detail: h.effectiveFrom ? `From ${dateShort(h.effectiveFrom)}` : "From the start",
      status: h.version === inForce.version ? ("current" as const) : ("default" as const),
    })),
    used: used.map((run) => ({
      title: `${monthName(run.period)} pay run`,
      detail: run.status === "confirmed" ? "Confirmed" : run.submittedAt ? "Submitted · with the owner" : "Draft",
      board: "PayRun" as const,
    })),
  };
}

// ── One read of the board per request ───────────────────────────────────────────────────────────

interface Board {
  api: ScopedApi;
  orgName: string;
  canPrepare: boolean;
  canConfirm: boolean;
  runs: ApiRun[];
  detail: ApiDetail | null;
  rules: ApiRule[];
  people: Map<string, ApiEmployee>;
  accounts: Map<string, ApiPayAccount>;
  files: ApiFile[];
  ownerName: string;
  /** The viewer is the owner (manages the team): the owner's own pay line reads in full. */
  seesOwnerPay: boolean;
}

const memo = new WeakMap<SourceContext, Map<string, Promise<unknown>>>();
function once<T>(ctx: SourceContext, key: string, load: () => Promise<T>): Promise<T> {
  let m = memo.get(ctx);
  if (!m) {
    m = new Map();
    memo.set(ctx, m);
  }
  let p = m.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load();
    m.set(key, p);
  }
  return p;
}

/** A read the person's role may not hold answers nothing rather than failing the board. */
async function orEmpty<T>(read: Promise<T>, empty: T): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && (error.forbidden || error.notFound)) return empty;
    throw error;
  }
}

export async function allPages<T>(api: ScopedApi, path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page < 50; page++) {
    const body = await api.get<Page<T>>(path, { query: { size: "100", page: String(page) } });
    out.push(...body.items);
    if (out.length >= body.total || body.items.length === 0) break;
  }
  return out;
}

function board(ctx: SourceContext): Promise<Board> {
  return once(ctx, "board", async () => {
    const api = ctx.ops("hospitality");
    const permissions = new Set(api.workspace.permissions);
    const canConfirm = permissions.has("payroll.run");
    const canPrepare = canConfirm || permissions.has("payroll.draft");
    const runs = canPrepare
      ? (await api.get<Page<ApiRun>>("/api/v1/ops/pay-runs", { query: { size: "25", page: "1" } })).items
      : [];
    const current = runs[0] ?? null;
    const [detail, rules, employees, compensation, files] = await Promise.all([
      current ? api.get<ApiDetail>(`/api/v1/ops/pay-runs/${encodeURIComponent(current.id)}`) : Promise.resolve(null),
      orEmpty(api.get<{ rules: ApiRule[] }>("/api/v1/ops/payroll/rules"), { rules: [] }),
      orEmpty(allPages<ApiEmployee>(api, "/api/v1/ops/employees"), []),
      orEmpty(api.get<{ payAccounts: ApiPayAccount[] }>("/api/v1/ops/hr/compensation"), { payAccounts: [] }),
      current && canConfirm && current.status === "confirmed"
        ? orEmpty(api.get<{ files: ApiFile[] }>(`/api/v1/ops/pay-runs/${encodeURIComponent(current.id)}/files`), {
            files: [],
          })
        : Promise.resolve({ files: [] as ApiFile[] }),
    ]);
    const owner = employees.find((e) => e.orgRole === "owner");
    return {
      api,
      orgName: api.workspace.orgName ?? "This business",
      canPrepare,
      canConfirm,
      runs,
      detail,
      rules: rules.rules,
      people: new Map(employees.map((e) => [e.id, e])),
      accounts: new Map(compensation.payAccounts.map((a) => [a.employeeId, a])),
      files: files.files,
      ownerName: owner?.displayName ?? "the owner",
      seesOwnerPay: permissions.has("team.manage"),
    };
  });
}

// ── A payslip as a pay line ─────────────────────────────────────────────────────────────────────

const WAGE = new Set(["wage", "daily_wage", "hourly_wage", "paid_leave", "partly_paid_leave", "unpaid_leave"]);
/** Paid only on leaving. Leave paid out on a claim is not: a person who stays can ask for that. */
const FINAL = /^settlement_/;
const LEAVE_PAY = /^(settlement_leave|leave_encashment)$/;

interface LineFacts {
  line: PayLine;
  /** What makes it worth a look, or null for a regular month. */
  note: { title: string; icon: PayRunException["icon"] } | null;
  /** The person's last month here: a final settlement, whether or not something still stops it. */
  leaving: boolean;
}

function lineOf(b: Board, p: ApiPayslip, blocked: Set<string>, period: string): LineFacts {
  const earnings = p.lines.filter((l) => l.side === "earning");
  const wage = earnings.filter((l) => WAGE.has(l.code));
  const allowances = earnings.filter((l) => l.code.startsWith("allowance:"));
  const others = earnings.filter((l) => !WAGE.has(l.code) && !l.code.startsWith("allowance:"));
  const deductions = p.lines.filter((l) => l.side === "deduction");
  const person = b.people.get(p.employeeId);
  const account = b.accounts.get(p.employeeId);
  const joined = person?.hiredOn?.slice(0, 7) === period;
  const leaving = others.some((l) => FINAL.test(l.code)) || person?.offboardedOn?.slice(0, 7) === period;
  const overtime = others.some((l) => l.code === "overtime");
  const isBlocked = blocked.has(p.employeeId);

  const [flag, flagTone, note]: [string, PayLine["flagTone"], LineFacts["note"]] = isBlocked
    ? ["Fix first", "danger", null]
    : leaving
      ? ["Final pay", "warning", { title: "Final pay", icon: "ArrowRightFromSquare" }]
      : joined
        ? ["New joiner", "info", { title: "Joined this month", icon: "PersonPlus" }]
        : overtime
          ? ["Overtime", "info", { title: "Overtime this month", icon: "ArrowRotateLeft" }]
          : others.length > 0
            ? ["Adjusted", "info", { title: others.map((l) => l.label).join(", "), icon: "ArrowRotateLeft" }]
            : ["Regular", "default", null];

  const shown = [...wage, ...others].filter((l) => l.basis).slice(0, 3);
  // The owner's pay is his own business: HR prepares the month with it in the totals, and reads
  // only that the line is there. The API has already left its figures out.
  if (p.confidential || (person?.orgRole === "owner" && !b.seesOwnerPay)) {
    return {
      note: null,
      leaving: false,
      line: {
        id: p.id,
        name: "Owner",
        role: "Confidential",
        payBy: "—",
        base: 0,
        allowances: 0,
        other: 0,
        otherLabel: null,
        loan: 0,
        loanLabel: null,
        flag: "Confidential",
        flagTone: "default",
        isException: false,
        note: null,
        confidential: true,
        figures: {
          gross: 0,
          paye: 0,
          rssb: 0,
          otherDeductions: 0,
          nonIncome: 0,
          nonIncomeLabel: null,
          net: 0,
          employer: 0,
        },
      },
    };
  }
  const onTop = p.lines.filter((l) => l.side === "passthrough");
  return {
    note,
    leaving,
    line: {
      id: p.id,
      employeeId: p.employeeId,
      name: p.displayName,
      role: person?.jobPositionTitle ?? "No job on file",
      payBy: account ? account.provider : "No pay account",
      base: sum(wage),
      allowances: sum(allowances),
      other: sum(others),
      otherLabel: others.length > 0 ? others.map((l) => l.label).join(", ") : null,
      loan: sum(deductions),
      loanLabel: deductions.length > 0 ? deductions.map((l) => l.label).join(", ") : null,
      flag,
      flagTone,
      isException: flagTone !== "default",
      note: shown.length > 0 ? shown.map((l) => `${l.label}: ${l.basis}`).join(" · ") : null,
      figures: {
        gross: p.grossRwf,
        paye: p.payeRwf,
        rssb: p.employeeContributionsRwf,
        otherDeductions: p.otherDeductionsRwf,
        nonIncome: p.nonIncomeRwf,
        nonIncomeLabel: onTop.length > 0 ? onTop.map((l) => l.label).join(", ") : null,
        net: p.netRwf,
        employer: p.employerContributionsRwf,
      },
    },
  };
}

async function lines(ctx: SourceContext): Promise<LineFacts[]> {
  const b = await board(ctx);
  if (!b.detail) return [];
  const blocked = new Set(b.detail.blockers.map((x) => x.employeeId).filter((id): id is string => id !== null));
  const period = b.detail.run.period;
  return b.detail.payslips
    .map((p) => lineOf(b, p, blocked, period))
    .sort((x, y) => Number(y.line.isException) - Number(x.line.isException) || x.line.name.localeCompare(y.line.name));
}

// ── Where the run stands ────────────────────────────────────────────────────────────────────────

async function state(ctx: SourceContext): Promise<PayRunState> {
  const b = await board(ctx);
  const thisMonth = ctx.today.iso.slice(0, 7);
  const run = b.detail?.run ?? null;
  // A business's first run is last month's: it is closed, so nobody is still clocked in on it. After
  // that, the month after the newest confirmed one, up to this month; never while a draft is open.
  const next =
    run === null
      ? previousMonth(thisMonth)
      : run.status === "confirmed" && run.period < thisMonth
        ? nextMonth(run.period)
        : null;
  const period = run?.period ?? next ?? thisMonth;
  const stage: PayRunState["stage"] =
    run === null || run.status === "draft" ? (run?.submittedAt ? "submitted" : "review") : "confirmed";
  const name = monthName(period);
  return {
    id: run?.id ?? `none-${period}`,
    live: true,
    runId: run?.id ?? null,
    period,
    stage,
    eyebrow: `1–${lastDay(period)} ${name}`,
    title: run ? `${name} pay run` : `Pay run · ${b.orgName}`,
    description: run ? `${b.orgName} · ${run.headcount} staff` : `${b.orgName} · not prepared yet`,
    preparerName: run?.submittedByName ?? ctx.account?.user.name ?? "HR",
    confirmerName: b.ownerName,
    submittedLabel: run?.submittedAt ? `${dayLabel(run.submittedAt)} ${timeLabel(run.submittedAt)}` : null,
    submitNote: run?.submitNote ?? null,
    confirmedLabel: run?.confirmedAt
      ? `${run.confirmedByName ?? b.ownerName} · ${dayLabel(run.confirmedAt)} ${timeLabel(run.confirmedAt)}`
      : null,
    canPrepare: b.canPrepare,
    canConfirm: b.canConfirm,
    nextPeriod: next,
    nextPeriodLabel: next ? monthName(next) : null,
    blockerCount: b.detail?.blockers.length ?? 0,
  };
}

// ── The sources ─────────────────────────────────────────────────────────────────────────────────

export const sources = defineSources({
  "payroll.payRunState": {
    naturalKey: "title",
    parity: "shape",
    async list(ctx): Promise<PayRunState[]> {
      return [await state(ctx)];
    },
  },

  "payroll.payRates": {
    naturalKey: "id",
    parity: "shape",
    async list(ctx): Promise<PayRates[]> {
      const b = await board(ctx);
      const paye = b.rules.find((r) => r.configType === "hr.rw.paye")?.inForce ?? null;
      const rssb = b.rules.find((r) => r.configType === "hr.rw.rssb")?.inForce ?? null;
      const bands = ((paye?.value as { bands?: { toRwf: number | null; rate: number }[] } | null)?.bands ?? []).map(
        (band) => ({ upTo: band.toRwf, rate: band.rate }),
      );
      const contributions =
        (rssb?.value as { contributions?: { code: string; employeeRate: number; employerRate: number }[] } | null)
          ?.contributions ?? [];
      const rate = (code: string, side: "employeeRate" | "employerRate") =>
        contributions.find((c) => c.code === code)?.[side] ?? 0;
      return [
        {
          id: paye ? `v${paye.version}` : "not set",
          payeBands: bands,
          pension: rate("pension", "employeeRate"),
          maternity: rate("maternity", "employeeRate"),
          occupationalHazards: rate("occupational_hazards", "employerRate"),
        },
      ];
    },
  },

  "payroll.payLines": {
    naturalKey: "name",
    parity: "shape",
    async list(ctx): Promise<PayLine[]> {
      return (await lines(ctx)).map((l) => l.line);
    },
  },

  "payroll.payRunSteps": {
    naturalKey: "id",
    parity: "shape",
    async list(ctx): Promise<PayRunStep[]> {
      const [b, s] = await Promise.all([board(ctx), state(ctx)]);
      const run = b.detail?.run ?? null;
      const built = b.files.filter((f) => f.kind === "bank" || f.kind === "momo");
      return [
        {
          id: "draft",
          title: "Draft",
          desc: run ? `${run.submittedByName ?? "Computed"} · ${dayLabel(run.computedAt)}` : "Not prepared yet",
          confirmedDesc: null,
        },
        {
          id: "review",
          title: "Review",
          desc: s.blockerCount > 0 ? `${s.blockerCount} to fix or pay next month` : "Checks passed",
          confirmedDesc: null,
        },
        {
          id: "confirm",
          title: "Owner confirmation",
          desc: s.submittedLabel ? `With ${s.confirmerName} since ${s.submittedLabel}` : s.confirmerName,
          confirmedDesc: s.confirmedLabel,
        },
        {
          id: "release",
          title: "Payment file release",
          desc:
            built.length > 0
              ? `${built.length} file${built.length === 1 ? "" : "s"} built · ${dayLabel(built[0].createdAt)}`
              : "Not built yet",
          confirmedDesc: null,
        },
        { id: "payslips", title: "Payslips", desc: "", confirmedDesc: null },
      ];
    },
  },

  "payroll.payRunExceptions": {
    naturalKey: "title",
    parity: "shape",
    async list(ctx): Promise<PayRunException[]> {
      const [b, facts] = await Promise.all([board(ctx), lines(ctx)]);
      if (!b.detail) return [];
      const draft = b.detail.run.status === "draft" && !b.detail.run.submittedAt;
      const lineOfPerson = new Map(facts.map((f) => [f.line.employeeId, f.line.id]));
      const blockers: PayRunException[] = b.detail.blockers.map((x, i) => ({
        id: x.record?.id ?? `blocker-${x.code}-${x.employeeId ?? i}`,
        icon: "Lock",
        title: x.employeeId ? `${x.displayName} · fix first` : "The whole run",
        detail: x.message,
        reviewed: false,
        lineId: x.employeeId ? (lineOfPerson.get(x.employeeId) ?? null) : null,
        blocker: true,
        employeeId: x.employeeId,
        canHold: draft && b.canPrepare && x.employeeId !== null && (x.remedies?.includes("hold_payslip") ?? true),
        code: x.code,
        who: x.displayName,
        record: x.record,
      }));
      const notes: PayRunException[] = facts
        .filter((f) => f.note)
        .map((f) => ({
          id: `note-${f.line.id}`,
          icon: f.note?.icon ?? "Suitcase",
          title: `${f.line.name} · ${f.note?.title}`,
          detail: f.line.note ?? f.line.flag,
          reviewed: false,
          lineId: f.line.id,
          blocker: false,
          employeeId: f.line.employeeId ?? null,
          canHold: false,
        }));
      return [...blockers, ...notes];
    },
  },

  // The national rules in force, each as a table of its values, with its versions and the runs that
  // used it. They are read only: a new version is recorded by Injishi from a published source.
  "payroll.ruleSets": {
    naturalKey: "id",
    async list(ctx): Promise<RuleSet[]> {
      const api = ctx.ops("hospitality");
      const permissions = new Set(api.workspace.permissions);
      const canRead = permissions.has("payroll.run") || permissions.has("payroll.draft");
      if (!canRead) return [];
      const [{ rules }, runs] = await Promise.all([
        api.get<{ rules: ApiRule[] }>("/api/v1/ops/payroll/rules"),
        orEmpty(api.get<Page<ApiRun>>("/api/v1/ops/pay-runs", { query: { size: "25", page: "1" } }), {
          items: [] as ApiRun[],
        } as Page<ApiRun>),
      ]);
      return rules.filter((r) => r.inForce && RULE_LOOK[r.configType]).map((r) => ruleSetOf(r, runs.items));
    },
  },

  // Staff services: questions staff asked from Me or the phone, and the things lent to them.
  "payroll.helpdeskTickets": {
    naturalKey: "id",
    async list(ctx): Promise<HelpdeskTicket[]> {
      const api = ctx.ops("hospitality");
      const { tickets } = await orEmpty(api.get<{ tickets: ApiTicket[] }>("/api/v1/ops/hr-tickets"), {
        tickets: [] as ApiTicket[],
      });
      return tickets.map((t) => {
        const state = ticketState(t);
        return {
          id: t.id,
          icon: TOPIC[t.topic].icon,
          title: t.subject,
          who: t.employee.displayName,
          topic: TOPIC[t.topic].label,
          age: ageOf(t.updatedAt),
          state: state.label,
          stateTone: state.tone,
          hrOnly: t.topic === "pay" || t.topic === "leave",
          resolved: t.status === "closed",
          link:
            t.topic === "pay"
              ? { label: "Open the pay run", board: "PayRun" as const }
              : t.topic === "leave"
                ? { label: "Open leave", board: "Leave" as const }
                : null,
          thread: t.messages.map((m) => ({
            from: m.fromStaff ? ("them" as const) : ("me" as const),
            text: m.body,
            meta: `${m.fromStaff ? t.employee.displayName.split(" ")[0] : (m.authorName ?? "HR")} · ${ageOf(m.createdAt)}`,
          })),
        };
      });
    },
  },

  "payroll.staffAssets": {
    naturalKey: "id",
    async list(ctx): Promise<StaffAsset[]> {
      const api = ctx.ops("hospitality");
      const { loans } = await orEmpty(api.get<{ loans: ApiLoan[] }>("/api/v1/ops/asset-loans"), {
        loans: [] as ApiLoan[],
      });
      return loans.map((l) => {
        const state = loanState(l, ctx.today.iso);
        const outcome = loanOutcome(l);
        return {
          id: l.id,
          icon: ASSET[l.kind].icon,
          name: l.name,
          tag: l.tag ?? ASSET[l.kind].label,
          holder: l.employee.displayName,
          dept: l.employee.jobPositionTitle ?? "",
          custody: [`Since ${dayLabel(`${l.issuedOn}T12:00:00Z`)}`, l.issuedByName ? `lent by ${l.issuedByName}` : null]
            .filter(Boolean)
            .join(" · "),
          condition: outcome === "lost" ? "Lost" : outcome === "damaged" ? "Damaged" : "Good",
          status: state.label,
          statusTone: state.tone,
          highRisk: ASSET[l.kind].highRisk,
          kind: !l.employeeActive && !l.returnedOn ? "leaver" : state.due ? "due" : "out",
          returnDue: !l.returnedOn,
          note: l.note,
        };
      });
    },
  },

  "payroll.ruleGovernance": {
    naturalKey: "id",
    async list(): Promise<RuleGovernanceStep[]> {
      return [
        {
          id: "source",
          icon: "Paperclip",
          title: "Recorded from a published source",
          detail: "The source and the day it was read.",
        },
        {
          id: "expert",
          icon: "SealCheck",
          title: "Checked by an accountant",
          detail: "Until then it shows as researched.",
        },
        {
          id: "run",
          icon: "Sack",
          title: "Each pay run keeps its version",
          detail: "A confirmed month never changes.",
        },
        {
          id: "effective",
          icon: "Calendar",
          title: "A new version starts on a date",
          detail: "Earlier months keep the old one.",
        },
      ];
    },
  },

  "payroll.payRunRules": {
    naturalKey: "id",
    parity: "shape",
    async list(ctx): Promise<PayRunRule[]> {
      const b = await board(ctx);
      const used = b.detail?.run.ruleVersions ?? [];
      return used.map((v) => {
        const rule = b.rules.find((r) => r.configType === v.configType);
        const awaiting = rule?.inForce ? awaitingSignOff(rule.inForce.value) : false;
        // The API names a rule in a sentence ("the PAYE tax bands"); a chip starts with a capital.
        const name = (rule?.label ?? v.configType).replace(/^the /i, "");
        return {
          id: `${v.configType}:${v.version}`,
          label: `${name.charAt(0).toUpperCase()}${name.slice(1)} v${v.version} · ${awaiting ? "awaiting sign-off" : "in force"}`,
          status: awaiting ? "awaiting" : "approved",
        };
      });
    },
  },

  "payroll.payRunTotals": {
    naturalKey: "id",
    parity: "shape",
    async list(ctx): Promise<PayRunTotal[]> {
      const [b, facts] = await Promise.all([board(ctx), lines(ctx)]);
      const run = b.detail?.run;
      if (!run) return [];
      const withheld = facts.filter((f) => (f.line.figures?.otherDeductions ?? 0) > 0);
      const otherDeductions = withheld.reduce((s, f) => s + (f.line.figures?.otherDeductions ?? 0), 0);
      return [
        { id: "staff", label: "Staff", value: run.headcount, format: "count", foot: "", footAmount: null },
        {
          id: "gross",
          label: "Gross pay",
          value: run.grossRwf,
          format: "rwf",
          foot: "",
          footAmount: null,
        },
        { id: "paye", label: "PAYE", value: run.payeRwf, format: "rwf", foot: "", footAmount: null },
        {
          id: "rssb",
          label: "RSSB employee",
          value: run.employeeContributionsRwf,
          format: "rwf",
          foot: "Employer share",
          footAmount: run.employerContributionsRwf,
        },
        {
          id: "loans",
          label: "Loans and deductions",
          value: otherDeductions,
          format: "rwf",
          foot: `${withheld.length} staff`,
          footAmount: null,
        },
        {
          id: "net",
          label: "Net pay",
          value: run.netRwf,
          format: "rwf",
          foot: "Employer cost",
          footAmount: run.grossRwf + run.employerContributionsRwf,
        },
      ];
    },
  },

  "payroll.finalSettlements": {
    naturalKey: "name",
    parity: "shape",
    async list(ctx): Promise<FinalSettlement[]> {
      const [b, facts] = await Promise.all([board(ctx), lines(ctx)]);
      return facts
        .filter((f) => f.leaving)
        .flatMap((leaver): FinalSettlement[] => {
          const slip = b.detail?.payslips.find((p) => p.id === leaver.line.id);
          if (!slip) return [];
          const label = (pattern: RegExp, fallback: string) =>
            slip.lines.find((l) => pattern.test(l.code))?.label ?? fallback;
          return [
            {
              id: `settlement-${slip.employeeId}`,
              lineId: leaver.line.id,
              name: leaver.line.name,
              desc: "The last month's pay, unused leave and anything still owed, on this run.",
              payLabel: label(/^(wage|daily_wage|hourly_wage)$/, "Pay to the last day"),
              leaveLabel: label(/^(leave_encashment|settlement_leave)$/, "Unused leave"),
              advanceLabel: label(/^loan$/, "Advances recovered"),
              // The same lines the pay line adds up as its other pay, each under its own name.
              parts: slip.lines
                .filter((l) => l.side === "earning" && !WAGE.has(l.code) && !l.code.startsWith("allowance:"))
                .map((l) => ({
                  label: l.label,
                  amount: l.amountRwf,
                  kind: LEAVE_PAY.test(l.code) ? ("leave" as const) : ("other" as const),
                })),
              board: "Employees",
            },
          ];
        });
    },
  },

  "payroll.paymentFiles": {
    naturalKey: "rail",
    parity: "shape",
    async list(ctx): Promise<PaymentFile[]> {
      const b = await board(ctx);
      if (!b.detail) return [];
      const rails: { kind: "bank" | "momo" | null; rail: string }[] = [
        { kind: "bank", rail: "Bank transfer" },
        { kind: "momo", rail: "Mobile money" },
        { kind: null, rail: "No pay account" },
      ];
      // From the payslips, not the lines: the owner's line is masked for HR, but his pay still goes
      // through his own account, in the file with everyone else's. The API sends HR no figure for it,
      // and it is what the run's net has beyond the payslips.
      const slips = b.detail.payslips;
      const hiddenNet = b.detail.run.netRwf - slips.reduce((s, p) => s + p.netRwf, 0);
      return rails
        .map(({ kind, rail }) => {
          const paid = slips.filter((p) => (b.accounts.get(p.employeeId)?.kind ?? null) === kind);
          const providers = [
            ...new Set(paid.map((p) => b.accounts.get(p.employeeId)?.provider).filter((x): x is string => !!x)),
          ].join(", ");
          const built = kind ? b.files.find((f) => f.kind === kind) : undefined;
          const file: PaymentFile = {
            id: kind ?? "none",
            kind,
            rail,
            how: kind ? providers : "Paid in cash, or a pay account to add on the file",
            staff: paid.length,
            amount: paid.reduce((s, p) => s + p.netRwf, 0) + (paid.some((p) => p.confidential) ? hiddenNet : 0),
            confirmedGate: built
              ? `Built ${dayLabel(built.createdAt)}${built.createdByName ? ` by ${built.createdByName}` : ""}`
              : kind
                ? "Build the file"
                : "Pay by hand",
            confirmedIcon: kind ? "FileArrowDown" : "ShieldExclamation",
          };
          return file;
        })
        .filter((f) => f.staff > 0);
    },
  },

  "payroll.payRunOutputs": {
    naturalKey: "title",
    parity: "shape",
    async list(ctx): Promise<PayRunOutput[]> {
      const b = await board(ctx);
      const run = b.detail?.run;
      if (!run) return [];
      const built = (kind: "paye" | "rssb") => {
        const f = b.files.find((x) => x.kind === kind);
        return f ? ` · built ${dayLabel(f.createdAt)}` : "";
      };
      return [
        {
          id: "payslips",
          icon: "FileText",
          title: "Payslips",
          meta: `${run.headcount} payslips · on each person's phone`,
          readyAfter: "confirmation",
          kind: null,
        },
        {
          id: "paye",
          icon: "Receipt",
          title: "PAYE declaration",
          meta: `Rwanda Revenue Authority · ${monthName(run.period)}${built("paye")}`,
          readyAfter: "confirmation",
          kind: "paye",
        },
        {
          id: "rssb",
          icon: "Book",
          title: "RSSB declaration",
          meta: `Pension, maternity and occupational hazards${built("rssb")}`,
          readyAfter: "confirmation",
          kind: "rssb",
        },
      ];
    },
  },

  "payroll.payRunHistory": {
    naturalKey: "period",
    parity: "shape",
    async list(ctx): Promise<PayRunHistory[]> {
      const b = await board(ctx);
      const current = b.detail?.run.id;
      return b.runs
        .filter((r) => r.id !== current && r.status === "confirmed")
        .map((r) => ({
          id: r.id,
          period: monthName(r.period),
          staff: r.headcount,
          net: r.netRwf,
          gross: r.grossRwf,
          paye: r.payeRwf,
          rssb: r.employeeContributionsRwf,
          preparedBy: r.submittedByName ?? "—",
          preparedAt: r.submittedAt ? dayLabel(r.submittedAt) : dayLabel(r.computedAt),
          confirmedBy: r.confirmedByName ?? "—",
          confirmedAt: r.confirmedAt ? dayLabel(r.confirmedAt) : "",
          releasedBy: "—",
          releasedAt: "",
          outcome: "Confirmed",
          combinedPermission: !r.submittedByName || r.submittedByName === r.confirmedByName,
        }));
    },
  },
});

/** People home's card of the month: where the run stands, with whom, and what it pays. */
export async function payRunSummaryOf(ctx: SourceContext): Promise<PayRunSummary[]> {
  const b = await board(ctx);
  const run = b.detail?.run;
  if (!run) return [];
  const confirmed = run.status === "confirmed";
  const submitted = !!run.submittedAt && !confirmed;
  const blockers = b.detail?.blockers.length ?? 0;
  const [y, m] = run.period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0, 12)).toISOString();
  const paye = b.rules.find((r) => r.configType === "hr.rw.paye")?.inForce;
  const leavers = b.detail?.payslips.filter((p) => {
    const off = b.people.get(p.employeeId)?.offboardedOn;
    return !!off && off.slice(0, 7) === run.period;
  }).length;
  return [
    {
      id: run.period,
      title: `${monthName(run.period)} pay run`,
      entities: b.orgName,
      payDate: dayLabel(lastDay),
      status: confirmed
        ? "Confirmed"
        : submitted
          ? "Awaiting confirmation"
          : blockers
            ? `Draft · ${blockers} to fix`
            : "Draft · ready to submit",
      statusTone: confirmed ? "success" : submitted ? "warning" : blockers ? "danger" : "accent",
      steps: ["Draft", "Review", "Owner confirmation", "Payment files", "Payslips"],
      currentStep: confirmed ? 3 : submitted ? 2 : 1,
      // A draft is with HR until it is submitted; then the owner holds it.
      submittedTo: submitted || confirmed ? b.ownerName : "HR",
      submittedAt: run.submittedAt ? `submitted ${dayLabel(run.submittedAt)}` : "not submitted yet",
      staffPaid: run.headcount,
      leavers: leavers ?? 0,
      gross: run.grossRwf,
      net: run.netRwf,
      ruleVersion: paye ? `PAYE v${paye.version}` : "PAYE",
      ruleStatus: paye && awaitingSignOff(paye.value) ? "not confirmed by an accountant" : "in force",
    },
  ];
}
