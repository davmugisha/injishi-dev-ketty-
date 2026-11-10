/**
 * Live sources for the people area (HR: People home, Employees, Roster, Attendance, Leave): the HR
 * module's routes (ADR-058) and the real-data workforce reads (`/ops/hr/teams`, `/ops/roster/cover`,
 * `/ops/hr/compensation`, …), presented as the people fixture document types.
 *
 * The HR officer keeps both employers' files (the hotel group and its residences business), so every
 * read is made once per business workspace the person holds and the answers are put together.
 *
 * DAYS. "Today" is the Kigali day (`ctx.today`). The roster shows the seven days from today ("this
 * week") and the seven after ("next week"); the leave calendar the 21 days from today.
 */
import type {
  AccessRequestView,
  AttendanceException,
  AttendanceSummary,
  ClockCorrection,
  ClockRecord,
  ClockSource,
  CompensationChange,
  DeptPresence,
  DeskEmployee,
  DocumentToCheck,
  Employee,
  EmployeeStatus,
  ExpiringItem,
  ExtraDaysAsk,
  FamilyMember,
  FileDocument,
  HelpdeskTicket,
  LeaveBalance,
  LeaveCalendarEntry,
  LeaveMonth,
  LeaveRequest,
  LeaveStep,
  LeaveStretch,
  LeaveType,
  NewEmployeeForm,
  OffboardingTask,
  OrgNode,
  PeopleProperty,
  PolicyAck,
  PropertyId,
  PublicHoliday,
  RosterGap,
  RosterGroup,
  RosterStaff,
  RosterWeek,
  Rotation,
  ShiftCode,
  ShiftSwap,
  Tone,
  WeekId,
} from "@injishi/product-hr";
import { type ApiAccessOptions, type ApiAccessRequest, toOptionsView, toRequestView } from "../access-view";
import { ApiError } from "../api";
import type { Workspace } from "../auth";
import { type ApiTicket, ageOf, TOPIC, ticketState } from "../desk-view";
import { clock, dayMonth, dayMonthYear, kigaliDate } from "../format";
import { chosenRosterBranch } from "../roster-branch";
import { payRunSummaryOf } from "./payroll";
import { defineSources, NoWorkspaceError, type ScopedApi, type SourceContext } from "./types";

// ── What the API answers (the shapes in @injishi/contracts, the fields read here) ─────────────────

interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
interface Card {
  employeeId: string;
  displayName: string;
  jobPositionTitle: string | null;
}
interface ApiEmployee {
  id: string;
  employeeNumber: string;
  displayName: string;
  email: string | null;
  workPropertyId: string | null;
  workPropertyName: string | null;
  jobPositionTitle: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  hiredOn: string;
  status: "active" | "offboarded";
  offboardedOn: string | null;
  hasAccount: boolean;
  orgRole: string | null;
  currentContract: {
    contractType: "permanent" | "fixed_term" | "casual";
    startsOn: string;
    endsOn: string | null;
    wageRwf?: number;
  } | null;
}
interface ApiTeam {
  id: string;
  code: string;
  name: string;
  propertyId: string;
  leadEmployeeId: string | null;
  sortOrder: number;
}
interface ApiPlacement {
  employeeId: string;
  teamId: string | null;
  grade: string | null;
  hasKioskPin: boolean;
  probationEndsOn: string | null;
}
interface ApiContractTerms {
  contractId: string;
  employeeId: string;
  contractType: "permanent" | "fixed_term" | "casual";
  startsOn: string;
  endsOn: string | null;
  status: "scheduled" | "active" | "ended";
  wageRwf: number;
  allowanceRwf: number;
  probationEndsOn: string | null;
  changeReason: string | null;
  decidedByName: string | null;
  decidedAt: string;
}
interface ApiPayAccount {
  employeeId: string;
  provider: string;
  lastDigits: string;
}
interface ApiCover {
  id: string;
  propertyId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  label: string;
  shiftTemplateIds: string[];
  minByWeekday: number[];
  note: string | null;
  setByName: string | null;
  sortOrder: number;
}
interface ApiTemplate {
  status?: string;
  id: string;
  propertyId: string;
  name: string;
  startsAt: string;
  endsAt: string;
}
interface ApiEntry {
  id: string;
  employee: Card;
  shiftTemplateId: string;
  shiftName: string;
  propertyId: string;
  workDate: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "cancelled";
  publishedAt: string | null;
}
interface ApiPublication {
  id: string;
  propertyId: string;
  fromDate: string;
  toDate: string;
  publishedAt: string;
}
interface ApiRecord {
  id: string;
  employee: Card;
  rosterEntryId: string | null;
  workDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  source: "supervisor" | "self" | "phone" | "kiosk";
  validated: boolean;
  /** `rejected`: HR found the person was not at work, so it counts for nothing. */
  status: "open" | "closed" | "superseded" | "rejected";
  supersedesId: string | null;
  note: string | null;
  autoClosed: boolean;
  location: { inDistanceM: number | null } | null;
  /** The entrance tablet a punch came from: its PIN pad, or its code scanned by a phone. */
  kioskId?: string | null;
}
interface ApiAttendanceRequest {
  id: string;
  employee: Card;
  workDate: string;
  clockInAt: string;
  clockOutAt: string;
  recordId: string | null;
  reason: string;
  status: "requested" | "approved" | "rejected" | "cancelled";
  routedTo: Card | null;
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  createdAt: string;
  evidence?: string | null;
  managerConfirmedByName?: string | null;
  managerConfirmedAt?: string | null;
  recordClockInAt?: string | null;
  recordClockOutAt?: string | null;
}
interface ApiLeaveType {
  id: string;
  code: string;
  name: string;
  payment: "paid" | "unpaid" | "partial";
  paymentPercent: number | null;
  yearlyEntitlementDays: number | null;
  accrual: "yearly_upfront" | "monthly" | "none";
  reset: "yearly" | "monthly" | "never";
  carry: "none" | "carry" | "carry_with_expiry";
  carryMaxDays: number;
  carryExpiresMonths: number | null;
  approvalSteps: number;
  needsAttachment: boolean;
  status: "active" | "archived";
  verifiedAt?: string | null;
  verifiedByName?: string | null;
}
interface ApiLeaveRequest {
  id: string;
  employee: Card;
  leaveType: { id: string; code: string; name: string };
  startsOn: string;
  endsOn: string;
  days: number;
  reason: string | null;
  status: "requested" | "approved" | "rejected" | "cancelled";
  routedToName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  approvalSteps: number;
  currentStep: number;
  approvals: {
    step: number;
    decision: "approved" | "rejected" | "skipped";
    decidedByName: string | null;
    note: string | null;
    decidedAt: string;
  }[];
  hasAttachment: boolean;
}
/** `GET /ops/leave/allocation-requests`: days asked for on top of an entitlement. */
interface ApiAllocation {
  id: string;
  employee: Card;
  leaveType: { id: string; name: string };
  kind: "extra" | "compensatory";
  days: number;
  reason: string;
  status: "requested" | "approved" | "rejected" | "cancelled";
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  createdAt: string;
}
/** `GET /ops/documents?status=submitted`: what people handed in, waiting to be checked. */
interface ApiHandedIn {
  id: string;
  employee: Card;
  title: string;
  versions: { uploadedAt: string }[];
  updatedAt: string;
}
interface ApiLedgerEntry {
  kind: "accrual" | "taken" | "reversal" | "carry_forward" | "expiry" | "adjustment" | "encashed";
  days: number;
  effectiveOn: string;
}
interface ApiBalances {
  employeeId: string;
  balances: { leaveType: ApiLeaveType; balanceDays: number | null; entries: ApiLedgerEntry[] }[];
}
interface ApiPattern {
  id: string;
  propertyId: string;
  name: string;
  status: "active" | "archived";
  stepNames: string[];
  rule: "every_n_days" | "weekly" | "monthly";
  ruleValue: number;
}
interface ApiAssignment {
  id: string;
  employee: Card;
  patternId: string;
  startsOn: string;
  endsOn: string | null;
  startStep: number;
}
interface ApiShiftRequest {
  id: string;
  employee: Card;
  kind: "change" | "swap" | "rotation";
  swapWith: Card | null;
  shiftTemplate: { id: string; name: string } | null;
  rotation: { id: string; name: string } | null;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
}
interface ApiChecklistItem {
  id: string;
  employeeId: string;
  code: string;
  title: string;
  detail: string | null;
  ownerOnly: boolean;
  sortOrder: number;
  doneAt: string | null;
}
/** `GET /ops/hr/checklists`: every joining and leaving checklist in the caller's branches, with its tasks. */
interface ApiChecklistBoard {
  checklists: {
    employee: { employeeId: string };
    kind: "onboarding" | "offboarding";
    tasks: {
      id: string;
      label: string;
      code: string | null;
      detail: string | null;
      ownerOnly: boolean;
      doneAt: string | null;
    }[];
  }[];
}
interface ApiDependant {
  id: string;
  employeeId: string;
  name: string;
  relation: "spouse" | "child" | "parent" | "sibling" | "other";
  sex: "female" | "male" | null;
  dateOfBirth: string | null;
  phone: string | null;
  isEmergencyContact: boolean;
  medicalDependant: boolean;
  beneficiaryPercent: number | null;
}

// ── Days ────────────────────────────────────────────────────────────────────────────────────────

const WEEKDAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Monday 0. */
function weekdayIndex(iso: string): number {
  return (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
}
const weekdayShort = (iso: string) => WEEKDAY[weekdayIndex(iso)].slice(0, 3);
const dayNo = (iso: string) => Number(iso.slice(8, 10));
const monthName = (iso: string) => MONTH[Number(iso.slice(5, 7)) - 1];
/** "Thu 15" */
const wkdDay = (iso: string) => `${weekdayShort(iso)} ${dayNo(iso)}`;
/** "Thu 15 Oct" */
const wkdDayMonth = (iso: string) => `${weekdayShort(iso)} ${dayMonth(iso)}`;
/** "Thursday 15 October" */
const longDay = (iso: string) => `${WEEKDAY[weekdayIndex(iso)]} ${dayNo(iso)} ${monthName(iso)}`;
/** Whole days from a to b. */
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
/** "12–18 October", or "26 October – 1 November" across months. */
function range(from: string, to: string, short = false): string {
  const m = (iso: string) => (short ? monthName(iso).slice(0, 3) : monthName(iso));
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${dayNo(from)}–${dayNo(to)} ${m(to)}`
    : `${dayNo(from)} ${m(from)} – ${dayNo(to)} ${m(to)}`;
}
/** "Mon 26 – Wed 28 Oct", "Sat 17 Oct". */
function dateSpan(from: string, to: string): string {
  if (from === to) return wkdDayMonth(from);
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${wkdDay(from)} – ${wkdDayMonth(to)}`
    : `${wkdDayMonth(from)} – ${wkdDayMonth(to)}`;
}
/** ISO week number of a date. */
function isoWeek(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}
const mondayOf = (iso: string) => addDays(iso, -weekdayIndex(iso));
/** "1.5", "8", "13.5": a tenth at most. */
const fmtDays = (n: number) => String(Math.round(n * 10) / 10);
/** A leave balance in whole days, rounded down: nobody is shown more leave than they have. */
const wholeDays = (n: number) => String(Math.floor(n));
const plural = (n: number, one: string, many = `${one}s`) => `${fmtDays(n)} ${n === 1 ? one : many}`;
const firstName = (name: string) => name.split(" ")[0] ?? name;

/** "Isangano Lakeside Hotel" → "Isangano"; "Kacyiru Court Residences" → "Kacyiru Court". */
function shortName(name: string): string {
  const generic = new Set([
    "hotel",
    "lodge",
    "residences",
    "residence",
    "resort",
    "apartments",
    "inn",
    "lakeside",
    "forest",
    "suites",
    "guesthouse",
  ]);
  const words = name.split(/\s+/);
  while (words.length > 1 && generic.has(words[words.length - 1].toLowerCase())) words.pop();
  return words.join(" ");
}

// ── One read per request ────────────────────────────────────────────────────────────────────────

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
    // A failed read is not remembered: the next screen asks again.
    p.catch(() => m?.delete(key));
  }
  return p;
}

interface Biz {
  api: ScopedApi;
  ws: Workspace;
}

/**
 * The steps of one kind of checklist, from the checklists board (one checklist for HR, ADR-058):
 * every task of the joining or leaving checklists in scope, or of one person's, in their order.
 * A task with no code of its own is named by its id.
 */
async function checklistSteps(
  api: Biz["api"],
  kind: "onboarding" | "offboarding",
  employeeId?: string,
): Promise<{ items: ApiChecklistItem[] }> {
  const board = await api.get<ApiChecklistBoard>("/api/v1/ops/hr/checklists");
  return {
    items: board.checklists
      .filter((c) => c.kind === kind && (!employeeId || c.employee.employeeId === employeeId))
      .flatMap((c) =>
        c.tasks.map((t, index) => ({
          id: t.id,
          employeeId: c.employee.employeeId,
          code: t.code ?? t.id,
          title: t.label,
          detail: t.detail,
          ownerOnly: t.ownerOnly,
          sortOrder: index,
          doneAt: t.doneAt,
        })),
      ),
  };
}

/** The business workspaces whose staff the person keeps: the hotel group first, then the residences. */
function businesses(ctx: SourceContext): Biz[] {
  const out: Biz[] = [];
  for (const domain of ["hospitality", "residence"] as const) {
    try {
      const api = ctx.ops(domain);
      if (!out.some((b) => b.ws.workspaceId === api.workspace.workspaceId)) out.push({ api, ws: api.workspace });
    } catch (error) {
      if (!(error instanceof NoWorkspaceError)) throw error;
    }
  }
  if (out.length === 0) throw new NoWorkspaceError("hospitality");
  return out;
}

/** Every page of a list route. */
async function allPages<T>(api: ScopedApi, path: string, query: Record<string, string> = {}): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page < 50; page++) {
    const body = await api.get<Page<T>>(path, { query: { ...query, size: "100", page: String(page) } });
    out.push(...body.items);
    if (out.length >= body.total || body.items.length === 0) break;
  }
  return out;
}

/** A read the person's role may not hold answers nothing rather than failing the screen. */
async function orEmpty<T>(read: Promise<T>, empty: T): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && (error.forbidden || error.notFound)) return empty;
    throw error;
  }
}

interface Person extends ApiEmployee {
  orgName: string;
  team: ApiTeam | null;
  placement: ApiPlacement | null;
}

interface Workforce {
  people: Person[];
  byId: Map<string, Person>;
  teams: ApiTeam[];
  teamById: Map<string, ApiTeam>;
  branches: { id: string; name: string; isHeadOffice: boolean }[];
  branchName: (id: string | null) => string;
}

/** Every file still on the books (active, or leaving on a day not yet past), with its team. */
function workforce(ctx: SourceContext): Promise<Workforce> {
  return once(ctx, "workforce", async () => {
    const today = ctx.today.iso;
    const per = await Promise.all(
      businesses(ctx).map(async ({ api, ws }) => {
        const [employees, teams] = await Promise.all([
          allPages<ApiEmployee>(api, "/api/v1/ops/employees"),
          api.get<{ teams: ApiTeam[]; placements: ApiPlacement[] }>("/api/v1/ops/hr/teams"),
        ]);
        return { ws, employees, teams };
      }),
    );
    const teams = per
      .flatMap((p) => p.teams.teams)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const placements = new Map(per.flatMap((p) => p.teams.placements).map((pl) => [pl.employeeId, pl]));
    const people: Person[] = per.flatMap(({ ws, employees }) =>
      employees
        .filter((e) => e.status === "active" || (e.offboardedOn !== null && e.offboardedOn >= today))
        .map((e) => {
          const placement = placements.get(e.id) ?? null;
          return {
            ...e,
            orgName: ws.orgName ?? "",
            placement,
            team: placement?.teamId ? (teamById.get(placement.teamId) ?? null) : null,
          };
        }),
    );
    const branches = per.flatMap(({ ws }) =>
      ((ws.branches ?? []) as { id: string; name: string; isHeadOffice?: boolean }[]).map((b) => ({
        id: b.id,
        name: b.name,
        isHeadOffice: Boolean(b.isHeadOffice),
      })),
    );
    const names = new Map(branches.map((b) => [b.id, b.name]));
    return {
      people,
      byId: new Map(people.map((p) => [p.id, p])),
      teams,
      teamById,
      branches,
      branchName: (id) => (id ? (names.get(id) ?? "") : ""),
    };
  });
}

/** The branch the roster screen works on: the hotel group's head office. */
async function rosterBranch(ctx: SourceContext): Promise<{ id: string; name: string }> {
  const [{ branches }, chosen] = await Promise.all([workforce(ctx), chosenRosterBranch()]);
  const branch = branches.find((b) => b.id === chosen) ?? branches.find((b) => b.isHeadOffice) ?? branches[0];
  if (!branch) throw new Error("This business has no branch to roster.");
  return branch;
}

/** The roster's group for people working at the branch who are on no team yet. */
const NO_TEAM = "no-team";

/**
 * The teams the roster draws at its branch: each one with a minimum cover set, in its order, then every
 * other team of the branch with someone active on it, then (`unteamed`) the people working there on no
 * team. A minimum is a target to roster against, not a gate: a branch that has set none, or a person not
 * yet on a team, can still be put on shifts.
 */
async function rosterTeams(ctx: SourceContext): Promise<{
  branch: { id: string; name: string };
  covered: ApiCover[];
  open: ApiTeam[];
  unteamed: number;
}> {
  const [branch, cover, { people, teams }] = await Promise.all([rosterBranch(ctx), coverOf(ctx), workforce(ctx)]);
  const covered = cover.filter((c) => c.propertyId === branch.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const coveredIds = new Set(covered.map((c) => c.teamId));
  const staffed = new Set(people.flatMap((p) => (p.status === "active" && p.team ? [p.team.id] : [])));
  const open = teams
    .filter((t) => t.propertyId === branch.id && !coveredIds.has(t.id) && staffed.has(t.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const unteamed = people.filter((p) => p.status === "active" && !p.team && p.workPropertyId === branch.id).length;
  return { branch, covered, open, unteamed };
}

function templatesOf(ctx: SourceContext): Promise<Map<string, ApiTemplate>> {
  return once(ctx, "templates", async () => {
    const lists = await Promise.all(
      businesses(ctx).map(({ api }) => api.get<{ templates: ApiTemplate[] }>("/api/v1/ops/shift-templates")),
    );
    return new Map(lists.flatMap((l) => l.templates).map((t) => [t.id, t]));
  });
}

/** Entries of every branch from `from` to `to` (Monday-to-Sunday weeks are what the API serves). */
function entriesOf(
  ctx: SourceContext,
  from: string,
  to: string,
): Promise<{ entries: ApiEntry[]; publications: ApiPublication[] }> {
  return once(ctx, `entries:${from}:${to}`, async () => {
    const { branches } = await workforce(ctx);
    const mondays: string[] = [];
    for (let m = mondayOf(from); m <= to; m = addDays(m, 7)) mondays.push(m);
    const bizByBranch = new Map<string, ScopedApi>();
    for (const { api, ws } of businesses(ctx)) {
      for (const b of (ws.branches ?? []) as { id: string }[]) bizByBranch.set(b.id, api);
    }
    const weeks = await Promise.all(
      branches.flatMap((b) =>
        mondays.map((m) => {
          const api = bizByBranch.get(b.id);
          return api
            ? api.get<{ entries: ApiEntry[]; publications: ApiPublication[] }>("/api/v1/ops/roster/week", {
                query: { propertyId: b.id, from: m },
              })
            : Promise.resolve({ entries: [], publications: [] });
        }),
      ),
    );
    const entries = new Map<string, ApiEntry>();
    const publications = new Map<string, ApiPublication>();
    for (const w of weeks) {
      for (const e of w.entries) if (e.workDate >= from && e.workDate <= to) entries.set(e.id, e);
      for (const p of w.publications) publications.set(p.id, p);
    }
    return { entries: [...entries.values()], publications: [...publications.values()] };
  });
}

/** The 14 days the roster screen and the people board read. */
const fortnight = (ctx: SourceContext) => entriesOf(ctx, addDays(ctx.today.iso, -1), addDays(ctx.today.iso, 13));

function coverOf(ctx: SourceContext): Promise<ApiCover[]> {
  return once(ctx, "cover", async () => {
    const lists = await Promise.all(
      businesses(ctx).map(({ api }) =>
        orEmpty(api.get<{ requirements: ApiCover[] }>("/api/v1/ops/roster/cover"), { requirements: [] }),
      ),
    );
    return lists.flatMap((l) => l.requirements);
  });
}

function compensationOf(ctx: SourceContext): Promise<{ contracts: ApiContractTerms[]; payAccounts: ApiPayAccount[] }> {
  return once(ctx, "compensation", async () => {
    const lists = await Promise.all(
      businesses(ctx).map(({ api }) =>
        orEmpty(
          api.get<{ contracts: ApiContractTerms[]; payAccounts: ApiPayAccount[] }>("/api/v1/ops/hr/compensation"),
          { contracts: [], payAccounts: [] },
        ),
      ),
    );
    return { contracts: lists.flatMap((l) => l.contracts), payAccounts: lists.flatMap((l) => l.payAccounts) };
  });
}

/** Clock records of yesterday and today, as one list (the sheet reads across days when the day is named). */
function recordsOf(ctx: SourceContext): Promise<ApiRecord[]> {
  return once(ctx, "records", async () => {
    const from = addDays(ctx.today.iso, -1);
    const lists = await Promise.all(
      businesses(ctx).map(({ api }) =>
        allPages<ApiRecord>(api, "/api/v1/ops/attendance", {
          f: JSON.stringify([["workDate", "between", [from, ctx.today.iso]]]),
        }),
      ),
    );
    return lists.flat();
  });
}

/**
 * Clock-ins of the week before yesterday never clocked out: each blocks that person's next clock-in
 * until it is closed. Seven days back is as far as the API lets a clock-out be recorded.
 */
function openBeforeOf(ctx: SourceContext): Promise<ApiRecord[]> {
  return once(ctx, "open-before", async () => {
    const from = addDays(ctx.today.iso, -7);
    const to = addDays(ctx.today.iso, -2);
    const lists = await Promise.all(
      businesses(ctx).map(({ api }) =>
        orEmpty(
          allPages<ApiRecord>(api, "/api/v1/ops/attendance", {
            f: JSON.stringify([["workDate", "between", [from, to]]]),
          }),
          [],
        ),
      ),
    );
    return lists.flat().filter((r) => r.status === "open" && !r.clockOutAt);
  });
}

function attendanceRequestsOf(ctx: SourceContext): Promise<ApiAttendanceRequest[]> {
  return once(ctx, "attendance-requests", async () => {
    const lists = await Promise.all(
      businesses(ctx).map(({ api }) =>
        orEmpty(allPages<ApiAttendanceRequest>(api, "/api/v1/ops/attendance-requests"), []),
      ),
    );
    return lists.flat();
  });
}

/** The entrance tablets' names, for "Scanned at Staff entrance". */
function tabletNamesOf(ctx: SourceContext): Promise<Map<string, string>> {
  return once(ctx, "tablet-names", async () => {
    const lists = await Promise.all(
      businesses(ctx).map(({ api }) =>
        orEmpty(api.get<{ kiosks: { id: string; name: string }[] }>("/api/v1/ops/attendance/kiosks"), { kiosks: [] }),
      ),
    );
    return new Map(lists.flatMap((l) => l.kiosks.map((k) => [k.id, k.name] as const)));
  });
}

/** "350 m", "3.2 km". */
function distanceWords(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

function graceOf(ctx: SourceContext): Promise<number | null> {
  return once(ctx, "grace", async () => {
    const [{ api }] = businesses(ctx);
    const settings = await orEmpty(
      api.get<{ policies: { propertyId: string | null; graceInMinutes: number; saved: boolean }[] }>(
        "/api/v1/ops/attendance/policies",
      ),
      { policies: [] },
    );
    const policy = settings.policies.find((p) => p.propertyId === null) ?? settings.policies[0];
    return policy ? policy.graceInMinutes : null;
  });
}

/** This year's leave requests and anything still open. */
function leaveOf(ctx: SourceContext): Promise<ApiLeaveRequest[]> {
  return once(ctx, "leave", async () => {
    const yearStart = `${ctx.today.iso.slice(0, 4)}-01-01`;
    const lists = await Promise.all(
      businesses(ctx).map(({ api }) =>
        orEmpty(
          allPages<ApiLeaveRequest>(api, "/api/v1/ops/leave/requests", {
            f: JSON.stringify([["endsOn", "gte", yearStart]]),
          }),
          [],
        ),
      ),
    );
    return lists.flat();
  });
}

function leaveTypesOf(ctx: SourceContext): Promise<ApiLeaveType[]> {
  return once(ctx, "leave-types", async () => {
    const [{ api }] = businesses(ctx);
    return (await api.get<{ types: ApiLeaveType[] }>("/api/v1/ops/leave/types")).types;
  });
}

function balancesOf(ctx: SourceContext, people: Person[]): Promise<Map<string, ApiBalances>> {
  return once(
    ctx,
    `balances:${people
      .map((p) => p.id)
      .sort()
      .join(",")}`,
    async () => {
      const out = new Map<string, ApiBalances>();
      const orgOfPerson = new Map<string, ScopedApi>();
      for (const { api, ws } of businesses(ctx)) {
        for (const p of people) if (p.orgName === ws.orgName) orgOfPerson.set(p.id, api);
      }
      await Promise.all(
        people.map(async (p) => {
          const api = orgOfPerson.get(p.id);
          if (!api) return;
          out.set(p.id, await api.get<ApiBalances>(`/api/v1/ops/employees/${p.id}/leave-balances`));
        }),
      );
      return out;
    },
  );
}

/** The caller's own staff files: nobody decides their own requests, and the screen says so before the API does. */
function myFileIds(ctx: SourceContext): Promise<Set<string>> {
  return once(ctx, "my-file-ids", async () => {
    const { files } = await orEmpty(ctx.api.get<{ files: { employeeId: string }[] }>("/api/v1/me/work"), { files: [] });
    return new Set(files.map((f) => f.employeeId));
  });
}

/** Approved leave of a person on a day, if any. */
function onLeave(leave: ApiLeaveRequest[], employeeId: string, date: string): ApiLeaveRequest | undefined {
  return leave.find(
    (l) => l.employee.employeeId === employeeId && l.status === "approved" && l.startsOn <= date && l.endsOn >= date,
  );
}

// ── Shared presentation ─────────────────────────────────────────────────────────────────────────

/** A template as the roster grid's letter: morning, evening or night by when it starts. */
function codeOf(t: { startsAt: string } | undefined): ShiftCode {
  if (!t) return "O";
  const h = Number(t.startsAt.slice(0, 2));
  return h >= 21 || h < 4 ? "N" : h >= 12 ? "E" : "M";
}
const times = (t: { startsAt: string; endsAt: string } | undefined) => (t ? `${t.startsAt}–${t.endsAt}` : "—");
/** How long a shift is, in hours; one that ends the next day counts across midnight. */
const shiftLength = (t: { startsAt: string; endsAt: string }) => {
  const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const minutes = at(t.endsAt) - at(t.startsAt);
  return (minutes <= 0 ? minutes + 1440 : minutes) / 60;
};
/** A shift's hours for a roster cell: "08–17", or "08:30–17" when a time is not on the hour. */
const shortHours = (t: { startsAt: string; endsAt: string }) => {
  const part = (hhmm: string) => (hhmm.slice(3, 5) === "00" ? hhmm.slice(0, 2) : hhmm.slice(0, 5));
  return `${part(t.startsAt)}–${part(t.endsAt)}`;
};
const entryTimes = (e: ApiEntry) => `${clock(e.startsAt)}–${clock(e.endsAt)}`;

const CONTRACT: Record<string, string> = { permanent: "Permanent", fixed_term: "Fixed-term", casual: "Casual" };
const ROLE: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  receptionist: "Front desk",
  finance: "Finance",
  hr: "HR",
  housekeeper: "Housekeeper",
};

function statusOf(p: Person, today: string, leave: ApiLeaveRequest[]): EmployeeStatus {
  if (p.status === "offboarded") return "leaving";
  if (onLeave(leave, p.id, today)) return "leave";
  if (p.placement?.probationEndsOn && p.placement.probationEndsOn >= today) return "probation";
  return "active";
}

/** Team order, the lead first, then by name: the directory's "sorted by department". */
function byTeam(a: Person, b: Person): number {
  const ta = a.team?.sortOrder ?? 99;
  const tb = b.team?.sortOrder ?? 99;
  if (ta !== tb) return ta - tb;
  const la = a.team?.leadEmployeeId === a.id ? 0 : 1;
  const lb = b.team?.leadEmployeeId === b.id ? 0 : 1;
  return la - lb || a.displayName.localeCompare(b.displayName);
}

const deptOf = (p: Person | undefined) => p?.team?.name ?? "No team";

// ── The sources ─────────────────────────────────────────────────────────────────────────────────

/** The banks a salary is most often paid to in Rwanda, for the new employee form's payment step. */
const BANKS = [
  "Bank of Kigali",
  "Equity Bank Rwanda",
  "I&M Bank Rwanda",
  "BPR Bank Rwanda",
  "Access Bank Rwanda",
  "Ecobank Rwanda",
  "KCB Bank Rwanda",
  "NCBA Bank Rwanda",
  "GT Bank Rwanda",
  "Urwego Bank",
  "Zigama CSS",
];

interface ApiCatalog {
  items: { id: string; title: string; status: "active" | "archived" }[];
}

export const sources = defineSources({
  /**
   * The new employee form's choices, per employer HR keeps files for: its branches, job positions
   * and employee types (the HR catalogue), the active files a new person may report to, and the
   * roles a login may be given into there (`GET /ops/employees/access-options`).
   */
  "people.newEmployeeForm": {
    naturalKey: "id",
    async list(ctx): Promise<NewEmployeeForm[]> {
      const { people } = await workforce(ctx);
      const employers = await Promise.all(
        businesses(ctx).map(async ({ api, ws }) => {
          const [positions, types, options] = await Promise.all([
            orEmpty(api.get<ApiCatalog>("/api/v1/ops/hr/catalog/job-positions"), { items: [] }),
            orEmpty(api.get<ApiCatalog>("/api/v1/ops/hr/catalog/employee-types"), { items: [] }),
            orEmpty<ApiAccessOptions>(api.get<ApiAccessOptions>("/api/v1/ops/employees/access-options"), {
              roles: [],
              branches: [],
              canGrant: false,
              grantsEveryRole: false,
            }),
          ]);
          const branches = ((ws.branches ?? []) as { id: string; name: string }[]).map((b) => ({
            id: b.id,
            name: b.name,
          }));
          return {
            id: ws.workspaceId,
            name: ws.orgName ?? "This business",
            kind: ws.domain === "residence" ? ("residence" as const) : ("hospitality" as const),
            branches,
            positions: positions.items.filter((i) => i.status === "active").map((i) => ({ id: i.id, title: i.title })),
            employeeTypes: types.items.filter((i) => i.status === "active").map((i) => ({ id: i.id, title: i.title })),
            managers: people
              .filter((p) => p.orgName === (ws.orgName ?? "") && p.status === "active")
              .sort((a, b) => a.displayName.localeCompare(b.displayName))
              .map((p) => ({ id: p.id, name: p.displayName, title: p.jobPositionTitle ?? "No position" })),
            access: toOptionsView(options),
          };
        }),
      );
      return [{ id: "form", employers, banks: BANKS, today: ctx.today.iso }];
    },
  },

  /**
   * Logins HR asked the owner for (`GET /ops/team/access-requests`), in every business the person
   * manages the team of. Anyone else reads none: the route is the owner's.
   */
  "people.accessRequests": {
    naturalKey: "name",
    async list(ctx): Promise<AccessRequestView[]> {
      const per = await Promise.all(
        businesses(ctx)
          .filter(({ ws }) => ws.permissions.includes("team.manage"))
          .map(async ({ api, ws }) => {
            const { requests } = await orEmpty(
              api.get<{ requests: ApiAccessRequest[] }>("/api/v1/ops/team/access-requests"),
              { requests: [] },
            );
            const names = new Map(
              ((ws.branches ?? []) as { id: string; name: string }[]).map((b) => [b.id, b.name] as const),
            );
            return requests.map((r) => toRequestView(r, names));
          }),
      );
      return per.flat();
    },
  },

  "people.properties": {
    naturalKey: "name",
    async list(ctx): Promise<PeopleProperty[]> {
      const { branches } = await workforce(ctx);
      return branches.map((b) => ({ id: b.id as PropertyId, name: b.name, short: shortName(b.name) }));
    },
  },

  "people.employees": {
    naturalKey: "name",
    async list(ctx): Promise<Employee[]> {
      const today = ctx.today.iso;
      const [{ people, byId, branchName }, comp, leave, { entries }] = await Promise.all([
        workforce(ctx),
        compensationOf(ctx),
        leaveOf(ctx),
        fortnight(ctx),
      ]);
      const current = new Map<string, ApiContractTerms>();
      const hire = new Map<string, ApiContractTerms>();
      for (const c of comp.contracts) {
        if (
          c.status !== "ended" &&
          (!current.has(c.employeeId) || c.startsOn > (current.get(c.employeeId)?.startsOn ?? ""))
        ) {
          current.set(c.employeeId, c);
        }
        if (!hire.has(c.employeeId) || c.startsOn < (hire.get(c.employeeId)?.startsOn ?? "9999"))
          hire.set(c.employeeId, c);
      }
      const pay = new Map(comp.payAccounts.map((a) => [a.employeeId, a]));
      // An owner's own file lives in their portal (Me): HR's directory lists everyone else.
      const seesOwners = businesses(ctx).some(({ ws }) => ws.permissions.includes("team.manage"));
      return [...people]
        .filter((p) => seesOwners || p.orgRole !== "owner")
        .sort(byTeam)
        .map((p) => {
          const status = statusOf(p, today, leave);
          const terms = current.get(p.id);
          const first = hire.get(p.id);
          const type = terms?.contractType ?? p.currentContract?.contractType ?? null;
          const endsOn = terms?.endsOn ?? p.currentContract?.endsOn ?? null;
          const probation = p.placement?.probationEndsOn ?? null;
          const pastProbation = first?.probationEndsOn && first.probationEndsOn < today ? first.probationEndsOn : null;
          const contractShort =
            status === "leaving" && p.offboardedOn
              ? `Last day ${dayMonth(p.offboardedOn)}`
              : status === "probation" && probation
                ? `Probation to ${dayMonth(probation)}`
                : type === "fixed_term" && endsOn
                  ? `Ends ${dayMonthYear(endsOn)}`
                  : `Since ${dayMonthYear(p.hiredOn)}`;
          const contractDates =
            type === "fixed_term" && endsOn
              ? `${dayMonthYear(terms?.startsOn ?? p.hiredOn)} to ${dayMonthYear(endsOn)}`
              : [
                  `Open-ended from ${dayMonthYear(p.hiredOn)}`,
                  status === "probation" && probation ? `probation to ${dayMonthYear(probation)}` : null,
                  status !== "probation" && pastProbation ? `probation ended ${dayMonthYear(pastProbation)}` : null,
                  status === "leaving" && p.offboardedOn ? `last day ${dayMonthYear(p.offboardedOn)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
          const manager = p.reportingManagerId ? byId.get(p.reportingManagerId) : undefined;
          const elsewhere = [
            ...new Set(
              entries
                .filter((e) => e.employee.employeeId === p.id && e.status === "scheduled" && e.workDate >= today)
                .filter((e) => e.propertyId !== p.workPropertyId)
                .map((e) => branchName(e.propertyId)),
            ),
          ];
          const account = pay.get(p.id);
          return {
            id: p.id,
            name: p.displayName,
            no: p.employeeNumber,
            position: p.jobPositionTitle ?? "No position",
            grade: p.placement?.grade ?? "—",
            dept: deptOf(p),
            property: (p.workPropertyId ?? "") as PropertyId,
            manager: p.reportingManagerName
              ? `${p.reportingManagerName}${manager?.jobPositionTitle ? `, ${manager.jobPositionTitle.toLowerCase()}` : ""}`
              : p.orgRole === "owner"
                ? "None · owner of the business"
                : "None recorded",
            contract: type ? CONTRACT[type] : "No contract",
            contractShort,
            contractDates,
            status,
            login:
              p.hasAccount && p.orgRole
                ? `${(p.email ?? "").split("@")[0] || firstName(p.displayName).toLowerCase()} · ${ROLE[p.orgRole] ?? p.orgRole}`
                : null,
            base: terms?.wageRwf ?? p.currentContract?.wageRwf ?? 0,
            allowance: terms?.allowanceRwf ?? 0,
            since: dayMonthYear(p.hiredOn),
            payMethod: account ? `${account.provider} ···${account.lastDigits}` : "Not set",
            alsoRostered: elsewhere.length ? elsewhere.join(", ") : "None",
            employer: p.orgName,
          };
        });
    },
  },

  "people.compensation": {
    naturalKey: "reason",
    async list(ctx): Promise<CompensationChange[]> {
      const [{ byId }, comp] = await Promise.all([workforce(ctx), compensationOf(ctx)]);
      const year = ctx.today.iso.slice(0, 4);
      return comp.contracts
        .filter((c) => byId.has(c.employeeId))
        .map((c) => {
          const reason = c.changeReason ?? "New contract";
          const when = c.decidedAt.slice(0, 4) === year ? dayMonth(c.decidedAt) : dayMonthYear(c.decidedAt);
          const by = c.decidedByName ?? "the business";
          return {
            id: c.contractId,
            employeeId: c.employeeId,
            effective: dayMonthYear(c.startsOn),
            base: c.wageRwf,
            allowance: c.allowanceRwf,
            reason,
            approvedBy: reason === "Hire" ? `Offer approved by ${by}` : `Approved by ${by}, ${when}`,
          };
        });
    },
  },

  "people.fileDocuments": {
    naturalKey: "title",
    async list(ctx): Promise<FileDocument[]> {
      const [{ api }] = businesses(ctx);
      const { requests } = await api.get<{ requests: { id: string; title: string; description: string | null }[] }>(
        "/api/v1/ops/document-requests",
      );
      const icon = (title: string): FileDocument["icon"] => {
        const t = title.toLowerCase();
        if (/\bid\b|passport|identity/.test(t)) return "Passport";
        if (/payment|bank|momo/.test(t)) return "Wallet";
        if (/medical|health/.test(t)) return "Stethoscope";
        if (/certificate|cv|diploma/.test(t)) return "GraduationCap";
        return "FileText";
      };
      return requests.map((r) => ({ id: r.id, icon: icon(r.title), title: r.title, meta: r.description ?? "" }));
    },
  },

  "people.family": {
    naturalKey: "name",
    async list(ctx): Promise<FamilyMember[]> {
      const lists = await Promise.all(
        businesses(ctx).map(({ api }) =>
          orEmpty(api.get<{ dependants: ApiDependant[] }>("/api/v1/ops/hr/dependants"), { dependants: [] }),
        ),
      );
      const mask = (phone: string) => {
        const d = phone.replace(/\D/g, "");
        return `+${d.slice(0, 3)} ${d.slice(3, 6)} ··· ${d.slice(-3)}`;
      };
      const RELATION: Record<string, [string, string, string]> = {
        spouse: ["Husband", "Wife", "Spouse"],
        child: ["Son", "Daughter", "Child"],
        parent: ["Father", "Mother", "Parent"],
        sibling: ["Brother", "Sister", "Sibling"],
        other: ["Relative", "Relative", "Relative"],
      };
      return lists
        .flatMap((l) => l.dependants)
        .map((d) => {
          const [m, f, any] = RELATION[d.relation];
          const label = d.relation === "spouse" ? any : d.sex === "male" ? m : d.sex === "female" ? f : any;
          const parts = [
            label,
            d.dateOfBirth && d.relation === "child" ? `born ${d.dateOfBirth.slice(0, 4)}` : null,
            d.isEmergencyContact ? `emergency contact${d.phone ? ` ${mask(d.phone)}` : ""}` : null,
            d.medicalDependant ? "medical scheme dependant" : null,
          ].filter(Boolean);
          return {
            id: d.id,
            employeeId: d.employeeId,
            name: d.name,
            relation: parts.join(" · "),
            role: d.beneficiaryPercent ? `Beneficiary ${fmtDays(d.beneficiaryPercent)}%` : "Dependant",
          };
        });
    },
  },

  "people.orgChart": {
    naturalKey: "name",
    async list(ctx): Promise<OrgNode[]> {
      const { people } = await workforce(ctx);
      const reports = new Map<string, Person[]>();
      for (const p of people) {
        if (!p.reportingManagerId) continue;
        reports.set(p.reportingManagerId, [...(reports.get(p.reportingManagerId) ?? []), p]);
      }
      const size = (p: Person): number => 1 + (reports.get(p.id) ?? []).reduce((n, r) => n + size(r), 0);
      const leads = new Set(people.filter((p) => p.team?.leadEmployeeId === p.id).map((p) => p.id));
      // The group's owner heads the chart; the top of every other business it owns sits under them.
      const roots = people.filter((p) => !p.reportingManagerId || !people.some((x) => x.id === p.reportingManagerId));
      const owner = roots.find((r) => r.orgRole === "owner");
      const top = owner ? [owner] : roots;
      const under = (root: Person) => [
        ...(reports.get(root.id) ?? []),
        ...(owner && root === owner ? roots.filter((r) => r !== owner) : []),
      ];
      const role = (p: Person, level: number) => {
        const title = p.jobPositionTitle ?? "No position";
        if (level === 0) return `${title} · ${p.orgName}`;
        if (level === 1 && p.workPropertyName && /manager/i.test(title)) return `${title} · ${p.workPropertyName}`;
        return title;
      };
      const nodes: OrgNode[] = [];
      for (const root of top) {
        const total =
          size(root) +
          (owner && root === owner ? roots.filter((r) => r !== owner).reduce((n, r) => n + size(r), 0) : 0);
        nodes.push({ id: root.id, name: root.displayName, role: role(root, 0), count: `${total} staff`, level: 0 });
        for (const one of under(root).sort(byTeam)) {
          nodes.push({ id: one.id, name: one.displayName, role: role(one, 1), count: String(size(one)), level: 1 });
          for (const two of (reports.get(one.id) ?? []).filter((r) => leads.has(r.id)).sort(byTeam)) {
            nodes.push({ id: two.id, name: two.displayName, role: role(two, 2), count: String(size(two)), level: 2 });
          }
        }
      }
      return nodes;
    },
  },

  "people.offboarding": {
    naturalKey: "title",
    async list(ctx): Promise<OffboardingTask[]> {
      const { people } = await workforce(ctx);
      // Every leaver's steps, each saying whose it is: the Employees screen shows a person their own.
      const leavers = new Set(people.filter((p) => p.status === "offboarded").map((p) => p.id));
      if (leavers.size === 0) return [];
      const lists = await Promise.all(
        businesses(ctx).map(async ({ api, ws }) => {
          const { items } = await orEmpty(checklistSteps(api, "offboarding"), { items: [] });
          // An owner-only step takes `team.manage` (`POST /ops/hr/checklist-tasks/:id/done`).
          const canTickOwnerOnly = ws.permissions.includes("team.manage");
          return items.map((item) => ({ ...item, canTickOwnerOnly }));
        }),
      );
      const LINK: Record<string, [OffboardingTask["board"], string]> = {
        settle: ["PayRun", "Open pay run"],
        assets: ["StaffServices", "Assets"],
      };
      return lists
        .flat()
        .filter((i) => leavers.has(i.employeeId))
        .sort((a, b) => a.employeeId.localeCompare(b.employeeId) || a.sortOrder - b.sortOrder)
        .map((i) => ({
          id: i.id,
          employeeId: i.employeeId,
          title: i.title,
          detail: i.detail ?? "",
          ownerOnly: i.ownerOnly,
          canTickOwnerOnly: i.canTickOwnerOnly,
          done: i.doneAt !== null,
          board: LINK[i.code]?.[0] ?? null,
          linkLabel: LINK[i.code]?.[1] ?? null,
        }));
    },
  },

  // ── Roster ──────────────────────────────────────────────────────────────────────────────────

  "people.rosterGroups": {
    naturalKey: "name",
    async list(ctx): Promise<RosterGroup[]> {
      const [{ branch, covered, open, unteamed }, templates] = await Promise.all([rosterTeams(ctx), templatesOf(ctx)]);
      const branchShifts = [
        ...new Set([...templates.values()].filter((t) => t.propertyId === branch.id).map((t) => codeOf(t))),
      ];
      return [
        ...covered.map((c) => ({
          id: c.teamId,
          name: c.teamName,
          rule: c.label,
          shifts: [...new Set(c.shiftTemplateIds.map((id) => codeOf(templates.get(id))))],
          // The grid's columns are the seven days from today: each takes its weekday's minimum.
          min: Array.from({ length: 7 }, (_, i) => c.minByWeekday[weekdayIndex(addDays(ctx.today.iso, i))] ?? 0),
          minByWeekday: c.minByWeekday,
          note: c.note ?? (c.setByName ? `minimum set by ${c.setByName}` : ""),
        })),
        // A team with no minimum is still rostered: any of the branch's shifts, and nothing to fall short of.
        ...open.map((t) => ({
          id: t.id,
          name: t.name,
          rule: "No minimum set",
          shifts: branchShifts,
          min: Array.from({ length: 7 }, () => 0),
          note: "",
        })),
        ...(unteamed > 0
          ? [
              {
                id: NO_TEAM,
                name: "No team yet",
                rule: "No minimum set",
                shifts: branchShifts,
                min: Array.from({ length: 7 }, () => 0),
                note: "put them on a team in their file",
              },
            ]
          : []),
      ];
    },
  },

  "people.rosterStaff": {
    naturalKey: "name",
    async list(ctx): Promise<RosterStaff[]> {
      const today = ctx.today.iso;
      const [{ branch, covered, open }, { people }, { entries }, templates, leave, rotations] = await Promise.all([
        rosterTeams(ctx),
        workforce(ctx),
        fortnight(ctx),
        templatesOf(ctx),
        leaveOf(ctx),
        rotationsOf(ctx),
      ]);
      const groups = new Set([...covered.map((c) => c.teamId), ...open.map((t) => t.id)]);
      // People on a team the roster draws, and the people working at the branch who are on no team yet.
      const staff = people
        .filter((p) => p.status === "active" && (p.team ? groups.has(p.team.id) : p.workPropertyId === branch.id))
        .sort(byTeam);
      const week = (p: Person, start: string) =>
        Array.from({ length: 7 }, (_, i) => {
          const date = addDays(start, i);
          if (onLeave(leave, p.id, date)) return "L";
          const e = entries.find(
            (x) => x.employee.employeeId === p.id && x.workDate === date && x.status === "scheduled",
          );
          return e ? codeOf(templates.get(e.shiftTemplateId)) : "O";
        }).join("");
      const hours = (p: Person, start: string) =>
        Array.from({ length: 7 }, (_, i) => {
          const date = addDays(start, i);
          const e = entries.find(
            (x) => x.employee.employeeId === p.id && x.workDate === date && x.status === "scheduled",
          );
          const t = e ? templates.get(e.shiftTemplateId) : undefined;
          return t ? shortHours(t) : null;
        });
      const lengths = (p: Person, start: string) =>
        Array.from({ length: 7 }, (_, i) => {
          const date = addDays(start, i);
          const e = entries.find(
            (x) => x.employee.employeeId === p.id && x.workDate === date && x.status === "scheduled",
          );
          const t = e ? templates.get(e.shiftTemplateId) : undefined;
          return t ? shiftLength(t) : 0;
        });
      return staff.map((p) => ({
        id: p.id,
        group: p.team?.id ?? NO_TEAM,
        name: p.displayName,
        role: p.jobPositionTitle ?? "",
        rotation: rotations.codeOf.get(p.id) ?? "—",
        shifts: { this: week(p, today), next: week(p, addDays(today, 7)) },
        times: { this: hours(p, today), next: hours(p, addDays(today, 7)) },
        lengths: { this: lengths(p, today), next: lengths(p, addDays(today, 7)) },
      }));
    },
  },

  "people.rosterWeeks": {
    naturalKey: "id",
    async list(ctx): Promise<RosterWeek[]> {
      const today = ctx.today.iso;
      const [branch, { people }, { entries, publications }, templates] = await Promise.all([
        rosterBranch(ctx),
        workforce(ctx),
        fortnight(ctx),
        templatesOf(ctx),
      ]);
      const home = new Map(people.map((p) => [p.id, p.workPropertyId]));
      const shiftTimes: Partial<Record<"M" | "E" | "N", string>> = {};
      const shiftLengths: Partial<Record<"M" | "E" | "N", number>> = {};
      const STANDARD = { M: "morning", E: "evening", N: "night" } as const;
      const here = [...templates.values()]
        .filter((t) => t.propertyId === branch.id && (t.status ?? "active") === "active")
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      for (const code of ["M", "E", "N"] as const) {
        const t = here.find((x) => x.name.toLowerCase() === STANDARD[code]) ?? here.find((x) => codeOf(x) === code);
        if (t) {
          shiftTimes[code] = shortHours(t);
          shiftLengths[code] = shiftLength(t);
        }
      }
      return (["this", "next"] as WeekId[]).map((id, w) => {
        const from = addDays(today, w * 7);
        const to = addDays(from, 6);
        const inWeek = entries.filter((e) => e.status === "scheduled" && e.workDate >= from && e.workDate <= to);
        const covering = publications
          .filter((p) => p.propertyId === branch.id && p.fromDate <= to && p.toDate >= from)
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
        const drafts = inWeek.filter((e) => e.propertyId === branch.id && e.publishedAt === null).length;
        const published = covering.length > 0;
        const lent = inWeek
          .filter((e) => e.propertyId !== branch.id && home.get(e.employee.employeeId) === branch.id)
          .map((e) => `${e.employee.employeeId}-${daysBetween(from, e.workDate)}`);
        return {
          id,
          number: isoWeek(from),
          start: dayNo(from),
          label: `Week ${isoWeek(from)} · ${wkdDay(from)} – ${wkdDay(to)} ${monthName(to)} ${to.slice(0, 4)}`,
          segment: `${id === "this" ? "This week" : "Next week"} · ${range(from, to, true)}`,
          range: range(from, to),
          status: published ? "published" : "draft",
          publishedAt: published ? wkdDayMonth(kigaliDate(covering[0].publishedAt)) : null,
          lent,
          pendingChanges: published ? drafts : 0,
          shiftTimes,
          shiftLengths,
        };
      });
    },
  },

  // Every open request of a person's shifts: swaps, another shift, joining a rotation. The Roster decides them.
  "people.shiftSwaps": {
    naturalKey: "id",
    async list(ctx): Promise<ShiftSwap[]> {
      const today = ctx.today.iso;
      const [{ people }, lists] = await Promise.all([
        workforce(ctx),
        Promise.all(
          businesses(ctx).flatMap(({ api }) =>
            ["requested", "awaiting_colleague"].map((status) =>
              orEmpty(
                allPages<ApiShiftRequest>(api, "/api/v1/ops/shift-requests", {
                  f: JSON.stringify([["status", "eq", status]]),
                }),
                [],
              ),
            ),
          ),
        ),
      ]);
      const hasLogin = new Map(people.map((p) => [p.id, p.hasAccount]));
      const span = (r: ApiShiftRequest) =>
        r.fromDate === r.toDate ? wkdDay(r.fromDate) : `${wkdDay(r.fromDate)} – ${wkdDay(r.toDate)}`;
      return lists
        .flat()
        .sort((a, b) => a.fromDate.localeCompare(b.fromDate))
        .map((r) => {
          const offset = daysBetween(today, r.fromDate);
          const onGrid = r.kind === "swap" && r.fromDate === r.toDate && offset >= 0 && offset <= 13;
          const who = r.employee.displayName;
          const title =
            r.kind === "swap"
              ? `${who} ⇄ ${r.swapWith?.displayName ?? ""} · ${span(r)}`
              : r.kind === "rotation"
                ? `${who} asks to join ${r.rotation?.name.replace(/^Rotation /, "") ?? "a rotation"} · from ${wkdDay(r.fromDate)}`
                : `${who} asks for ${r.shiftTemplate?.name ?? "another shift"} · ${span(r)}`;
          return {
            id: r.id,
            a: r.employee.employeeId,
            b: r.swapWith?.employeeId ?? "",
            kind: r.kind,
            week: offset >= 7 ? ("next" as const) : ("this" as const),
            day: onGrid ? offset % 7 : -1,
            title,
            detail: r.reason,
            waiting: r.status === "awaiting_colleague",
            canAcceptFor:
              r.status === "awaiting_colleague" &&
              Boolean(r.swapWith) &&
              hasLogin.get(r.swapWith?.employeeId ?? "") === false,
            colleague: firstName(r.swapWith?.displayName ?? ""),
            overdue: r.toDate < today,
          };
        });
    },
  },

  "people.rotations": {
    naturalKey: "code",
    async list(ctx): Promise<Rotation[]> {
      return (await rotationsOf(ctx)).rotations;
    },
  },

  // People home's help desk: the questions still waiting, newest first.
  "people.tickets": {
    naturalKey: "id",
    async list(ctx): Promise<HelpdeskTicket[]> {
      const api = ctx.ops("hospitality");
      const { tickets } = await orEmpty(api.get<{ tickets: ApiTicket[] }>("/api/v1/ops/hr-tickets"), {
        tickets: [] as ApiTicket[],
      });
      return tickets
        .filter((t) => t.status !== "closed")
        .slice(0, 6)
        .map((t) => {
          const state = ticketState(t);
          return {
            id: t.id,
            icon: TOPIC[t.topic].icon,
            title: t.subject,
            who: t.employee.displayName,
            age: ageOf(t.updatedAt),
            state: state.label,
            tone: state.tone,
          };
        });
    },
  },

  // People home's card of the month, read from the pay run board.
  "people.payRunSummary": {
    naturalKey: "id",
    list: payRunSummaryOf,
  },

  // The business's staff policies (`GET /ops/policies`). Who has read one is not recorded yet, so a
  // policy says whom it is shared with rather than inventing acknowledgements.
  "people.policies": {
    naturalKey: "id",
    async list(ctx): Promise<PolicyAck[]> {
      const api = ctx.ops("hospitality");
      const { policies } = await orEmpty(
        api.get<{
          policies: { id: string; title: string; audience: "all" | "targeted"; status: string; updatedAt: string }[];
        }>("/api/v1/ops/policies"),
        { policies: [] },
      );
      return policies
        .filter((x) => x.status === "published")
        .map((x) => ({
          id: x.id,
          title: x.title,
          meta: `${x.audience === "all" ? "Everyone" : "Some staff"} · updated ${dayMonth(x.updatedAt)}`,
          state: "Shared",
          tone: "success" as const,
        }));
    },
  },

  // The next public holidays: the national list in force (`hr.rw.public_holidays`, which the pay
  // and leave counts use) and the business's own days, with who is on shift on each in the fortnight.
  "people.holidays": {
    naturalKey: "id",
    async list(ctx): Promise<PublicHoliday[]> {
      const today = ctx.today.iso;
      // The hotel business holds the pay rules HR reads (as the pay run does).
      const api = ctx.ops("hospitality");
      const [rules, own, { entries }] = await Promise.all([
        orEmpty(
          api.get<{ rules: { configType: string; inForce: { value: unknown } | null }[] }>("/api/v1/ops/payroll/rules"),
          { rules: [] },
        ),
        orEmpty(api.get<{ holidays: { id: string; name: string; fromDate: string }[] }>("/api/v1/ops/hr/holidays"), {
          holidays: [],
        }),
        fortnight(ctx),
      ]);
      const national = rules.rules.find((r) => r.configType === "hr.rw.public_holidays")?.inForce?.value as
        | { dates?: { date: string; name: string }[] }
        | undefined;
      const days = [
        ...(national?.dates ?? []).map((d) => ({ id: `rw-${d.date}`, name: d.name, date: d.date })),
        ...own.holidays.map((h) => ({ id: h.id, name: h.name, date: h.fromDate })),
      ]
        .filter((h) => h.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4);
      const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return days.map((h) => {
        const d = new Date(`${h.date}T12:00:00Z`);
        const away = Math.round((d.getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000);
        const on = entries.filter((e) => e.workDate === h.date && e.status !== "cancelled").length;
        return {
          id: h.id,
          name: h.name,
          date: `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`,
          // Inside the fortnight the roster holds, say who works it; further out, how far away it is.
          rostered: away <= 13 ? (on ? `${on} on shift · holiday pay` : "Not rostered yet") : `In ${away} days`,
        };
      });
    },
  },

  // ── Attendance ──────────────────────────────────────────────────────────────────────────────

  "people.clockRecords": {
    naturalKey: "name",
    async list(ctx): Promise<ClockRecord[]> {
      const day = await attendanceDay(ctx);
      return day.rows;
    },
  },

  "people.corrections": {
    naturalKey: "name",
    async list(ctx): Promise<ClockCorrection[]> {
      const today = ctx.today.iso;
      const [requests, records] = await Promise.all([attendanceRequestsOf(ctx), recordsOf(ctx)]);
      // A record the sweep closed has a guessed clock-out: to the person it is still missing.
      const guessed = new Set(records.filter((r) => r.autoClosed && !r.validated).map((r) => r.id));
      return requests
        .filter((r) => r.status === "requested" || (r.decidedAt && daysBetween(kigaliDate(r.decidedAt), today) <= 14))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => {
          const outMissing =
            r.recordClockInAt && (!r.recordClockOutAt || (r.recordId !== null && guessed.has(r.recordId)));
          const changesIn = r.recordClockInAt && clock(r.recordClockInAt) !== clock(r.clockInAt);
          const from = !r.recordId
            ? "No record"
            : changesIn
              ? `In ${clock(r.recordClockInAt)}`
              : outMissing || !r.recordClockOutAt
                ? "Out: missing"
                : `Out ${clock(r.recordClockOutAt)}`;
          // A day with no record asks for both times; a record changes the one that is wrong.
          const to = !r.recordId
            ? `${clock(r.clockInAt)} – ${clock(r.clockOutAt)}`
            : changesIn
              ? `In ${clock(r.clockInAt)}`
              : `Out ${clock(r.clockOutAt)}`;
          const asked = kigaliDate(r.createdAt) === r.workDate ? clock(r.createdAt) : dayMonth(r.createdAt);
          const state = r.status === "requested" ? "pending" : r.status === "approved" ? "approved" : "declined";
          return {
            id: r.id,
            name: r.employee.displayName,
            when: `${longDay(r.workDate)} · requested ${asked}`,
            from,
            to,
            reason: r.reason,
            evidence: r.evidence ?? "No evidence attached",
            // Who the request names as the person's line manager, and no more: nothing in the product asks
            // them to confirm a correction (only the demo seed fills `managerConfirmedAt`), so no
            // confirmation is ever shown as a fact.
            manager: r.routedTo
              ? `Line manager ${r.routedTo.displayName} · no confirmation step yet`
              : "No line manager on file",
            state,
            outcome:
              state === "pending"
                ? null
                : `${state === "approved" ? "Approved" : "Declined"} by ${r.decidedByName ?? "the office"} on ${dayMonth(r.decidedAt ?? r.createdAt)}${r.decisionNote ? `: ${r.decisionNote}` : "."}`,
            hrNote: r.decisionNote,
          } satisfies ClockCorrection;
        });
    },
  },

  "people.attendanceExceptions": {
    naturalKey: "id",
    async list(ctx): Promise<AttendanceException[]> {
      return (await attendanceDay(ctx)).exceptions;
    },
  },

  "people.deskEmployees": {
    naturalKey: "name",
    async list(ctx): Promise<DeskEmployee[]> {
      return (await attendanceDay(ctx)).desk;
    },
  },

  "people.attendanceSummary": {
    naturalKey: "grace",
    async list(ctx): Promise<AttendanceSummary[]> {
      return [(await attendanceDay(ctx)).summary];
    },
  },

  // ── People home ─────────────────────────────────────────────────────────────────────────────

  "people.presence": {
    naturalKey: "id",
    async list(ctx): Promise<DeptPresence[]> {
      return (await attendanceDay(ctx)).presence;
    },
  },

  "people.rosterGaps": {
    naturalKey: "dept",
    async list(ctx): Promise<RosterGap[]> {
      const today = ctx.today.iso;
      const [{ people, teamById, branchName }, cover, { entries }, templates, leave] = await Promise.all([
        workforce(ctx),
        coverOf(ctx),
        fortnight(ctx),
        templatesOf(ctx),
        leaveOf(ctx),
      ]);
      const gaps: (RosterGap & { date: string })[] = [];
      for (const c of cover) {
        const team = teamById.get(c.teamId);
        const members = people.filter((p) => p.team?.id === c.teamId);
        const counted = new Set(c.shiftTemplateIds);
        for (let i = 0; i < 7; i++) {
          const date = addDays(today, i);
          const needed = c.minByWeekday[weekdayIndex(date)] ?? 0;
          const covered = entries.filter(
            (e) =>
              e.status === "scheduled" &&
              e.workDate === date &&
              e.propertyId === c.propertyId &&
              counted.has(e.shiftTemplateId) &&
              members.some((m) => m.id === e.employee.employeeId),
          ).length;
          if (covered >= needed) continue;
          const shift = templates.get(c.shiftTemplateIds[0]);
          const away = members.filter((m) => onLeave(leave, m.id, date));
          gaps.push({
            date,
            id: `${c.id}:${date}`,
            property: c.propertyId as PropertyId,
            day: wkdDayMonth(date),
            dept: `${team?.name ?? c.teamName}, ${shortName(branchName(c.propertyId))}`,
            detail: [
              `${shift?.name ?? c.label} ${times(shift)}`,
              `needs ${needed}, ${covered} rostered`,
              ...away.map(
                (m) =>
                  `${firstName(m.displayName)} on ${leave.find((l) => l.employee.employeeId === m.id && l.status === "approved" && l.startsOn <= date && l.endsOn >= date)?.leaveType.name.toLowerCase() ?? "leave"}`,
              ),
            ].join(" · "),
            covered,
            needed,
          });
        }
      }
      return gaps
        .sort((a, b) => a.date.localeCompare(b.date) || a.dept.localeCompare(b.dept))
        .map(({ date: _date, ...gap }) => gap);
    },
  },

  "people.expiring": {
    naturalKey: "id",
    async list(ctx): Promise<ExpiringItem[]> {
      const today = ctx.today.iso;
      const horizon = addDays(today, 45);
      const [{ people, byId }, comp, docs, offboarding] = await Promise.all([
        workforce(ctx),
        compensationOf(ctx),
        Promise.all(
          businesses(ctx).map(({ api }) =>
            orEmpty(
              api.get<{ documents: { documentId: string; employeeId: string; title: string; expiresOn: string }[] }>(
                "/api/v1/ops/hr/expiring-documents",
                { query: { withinDays: "45" } },
              ),
              { documents: [] },
            ),
          ),
        ),
        Promise.all(businesses(ctx).map(({ api }) => orEmpty(checklistSteps(api, "offboarding"), { items: [] }))),
      ]);
      const steps = offboarding.flatMap((l) => l.items);
      const items: (ExpiringItem & { on: string })[] = [];
      const used = new Set<string>();
      const idFor = (name: string, kind: string) => {
        const base = `x-${firstName(name)
          .toLowerCase()
          .replace(/[^a-z]/g, "")}-${kind}`;
        let id = base;
        for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
        used.add(id);
        return id;
      };
      const within = (iso: string | null | undefined) => !!iso && iso >= today && iso <= horizon;
      const soon = (iso: string) => (daysBetween(today, iso) <= 21 ? "warning" : "default");
      const current = new Map<string, ApiContractTerms>();
      for (const c of comp.contracts) if (c.status === "active") current.set(c.employeeId, c);
      for (const p of people) {
        if (p.status === "offboarded" && within(p.offboardedOn)) {
          items.push({
            id: idFor(p.displayName, "leaving"),
            status: "current",
            icon: "ArrowRightFromSquare",
            title: `${p.displayName} · leaving ${dayMonth(p.offboardedOn as string)}`,
            detail: (() => {
              const mine = steps.filter((x) => x.employeeId === p.id);
              const done = mine.filter((x) => x.doneAt !== null).length;
              return mine.length
                ? `Offboarding ${done} of ${mine.length} done · final settlement in the month's run`
                : "No offboarding checklist yet · final settlement in the month's run";
            })(),
            board: "Employees",
            employee: p.id,
            on: p.offboardedOn as string,
          });
          continue;
        }
        const c = current.get(p.id);
        if (c?.contractType === "fixed_term" && within(c.endsOn)) {
          items.push({
            id: idFor(p.displayName, "contract"),
            status: soon(c.endsOn as string),
            icon: "FileText",
            title: `${p.displayName} · fixed-term contract ends ${dayMonth(c.endsOn as string)}`,
            detail: "No renewal decision recorded",
            board: "Employees",
            employee: p.id,
            on: c.endsOn as string,
          });
        }
        if (within(p.placement?.probationEndsOn)) {
          const end = p.placement?.probationEndsOn as string;
          items.push({
            id: idFor(p.displayName, "probation"),
            status: soon(end),
            icon: "Hourglass",
            title: `${p.displayName} · probation ends ${dayMonth(end)}`,
            detail: p.reportingManagerName ? `Review by ${p.reportingManagerName}` : "Confirm or extend before then",
            board: "Talent",
            employee: p.id,
            on: end,
          });
        }
      }
      for (const d of docs.flatMap((l) => l.documents)) {
        const p = byId.get(d.employeeId);
        if (!p) continue;
        items.push({
          id: idFor(p.displayName, /certificate/i.test(d.title) ? "certificate" : "document"),
          status: "default",
          icon: /medical|health|food|certificate/i.test(d.title) ? "Stethoscope" : "FileText",
          title: `${p.displayName} · ${d.title.toLowerCase()} expires ${dayMonth(d.expiresOn)}`,
          // Not "reminder sent": the document.expiring trigger waits in the outbox and nothing delivers it yet.
          detail: "Renewal due · no reminder is sent automatically",
          board: "Employees",
          employee: p.id,
          on: d.expiresOn,
        });
      }
      return items.sort((a, b) => a.on.localeCompare(b.on)).map(({ on: _on, ...item }) => item);
    },
  },

  // ── Leave ───────────────────────────────────────────────────────────────────────────────────

  "people.leaveRequests": {
    naturalKey: "name",
    async list(ctx): Promise<LeaveRequest[]> {
      return (await leaveView(ctx)).requests;
    },
  },

  "people.leaveCalendar": {
    naturalKey: "name",
    async list(ctx): Promise<LeaveCalendarEntry[]> {
      return (await leaveView(ctx)).calendar;
    },
  },

  "people.leaveStretches": {
    naturalKey: "id",
    parity: "shape",
    async list(ctx): Promise<LeaveStretch[]> {
      const [leave, { earlier }] = await Promise.all([leaveOf(ctx), leaveView(ctx)]);
      return leave
        .filter((l) => l.status === "approved" || l.status === "requested")
        .map((l) => ({
          id: l.id,
          name: l.employee.displayName,
          type: l.leaveType.name,
          from: l.startsOn,
          to: l.endsOn,
          days: l.days,
          approved: l.status === "approved",
          request: earlier.get(l.id) ?? null,
        }));
    },
  },

  "people.leaveByMonth": {
    naturalKey: "id",
    parity: "shape",
    async list(ctx): Promise<LeaveMonth[]> {
      const today = ctx.today.iso;
      const year = today.slice(0, 4);
      // A request counts whole in the month it starts, even when it runs into the next.
      const taken = (await leaveOf(ctx)).filter((l) => l.status === "approved" && l.startsOn <= today);
      return Array.from({ length: Number(today.slice(5, 7)) }, (_, i) => {
        const month = `${year}-${String(i + 1).padStart(2, "0")}`;
        const inMonth = taken.filter((l) => l.startsOn.startsWith(month));
        const days = (test: (code: string) => boolean) =>
          inMonth.filter((l) => test(l.leaveType.code)).reduce((n, l) => n + l.days, 0);
        return {
          id: month,
          annual: days((c) => c === "annual"),
          sick: days((c) => c === "sick"),
          other: days((c) => c !== "annual" && c !== "sick"),
        };
      });
    },
  },

  "people.leaveBalances": {
    naturalKey: "name",
    async list(ctx): Promise<LeaveBalance[]> {
      const today = ctx.today.iso;
      const year = today.slice(0, 4);
      const [{ people, byId }, leave] = await Promise.all([workforce(ctx), leaveOf(ctx)]);
      // Who has used annual leave this year, or is asking for some now: the balances HR weighs.
      const ids = [
        ...new Set(
          leave
            .filter(
              (l) =>
                l.leaveType.code === "annual" &&
                (l.status === "requested" ||
                  (l.status === "approved" && l.startsOn.slice(0, 4) === year && l.startsOn <= today)),
            )
            .map((l) => l.employee.employeeId),
        ),
      ].filter((id) => byId.has(id));
      const chosen = people.filter((p) => ids.includes(p.id)).sort(byTeam);
      const balances = await balancesOf(ctx, chosen);
      const sum = (entries: ApiLedgerEntry[], kinds: ApiLedgerEntry["kind"][]) =>
        entries
          .filter((e) => kinds.includes(e.kind) && e.effectiveOn.slice(0, 4) === year)
          .reduce((n, e) => n + e.days, 0);
      return chosen.map((p) => {
        const b = balances.get(p.id)?.balances ?? [];
        const annual = b.find((x) => x.leaveType.code === "annual")?.entries ?? [];
        const sick = b.find((x) => x.leaveType.code === "sick")?.entries ?? [];
        const pendingReq = leave.find(
          (l) => l.employee.employeeId === p.id && l.status === "requested" && l.leaveType.code === "annual",
        );
        return {
          id: p.id,
          name: p.displayName,
          carried: Math.round(sum(annual, ["carry_forward"]) * 10) / 10,
          accrued: Math.round(sum(annual, ["accrual", "adjustment"]) * 10) / 10,
          taken: Math.round(-sum(annual, ["taken", "reversal", "encashed"]) * 10) / 10 || 0,
          // The API's balance: the whole ledger, so days that expired are not counted as left.
          left: b.find((x) => x.leaveType.code === "annual")?.balanceDays ?? null,
          pending: leave
            .filter((l) => l.employee.employeeId === p.id && l.status === "requested" && l.leaveType.code === "annual")
            .reduce((n, l) => n + l.days, 0),
          // `|| 0`: nothing taken is 0, not the -0 a negated empty sum makes, which reads "-0".
          sick: Math.round(-sum(sick, ["taken", "reversal"]) * 10) / 10 || 0,
          request: pendingReq?.id ?? null,
        };
      });
    },
  },

  /** Days asked for on top of an entitlement: what waits, and what was decided in the last two weeks. */
  "people.extraDays": {
    naturalKey: "id",
    parity: "shape",
    async list(ctx): Promise<ExtraDaysAsk[]> {
      const today = ctx.today.iso;
      const [{ byId, branchName }, lists, mine] = await Promise.all([
        workforce(ctx),
        Promise.all(
          businesses(ctx).map(({ api }) =>
            orEmpty(allPages<ApiAllocation>(api, "/api/v1/ops/leave/allocation-requests"), []),
          ),
        ),
        myFileIds(ctx),
      ]);
      return lists
        .flat()
        .filter(
          (r) =>
            r.status === "requested" ||
            ((r.status === "approved" || r.status === "rejected") &&
              r.decidedAt !== null &&
              daysBetween(kigaliDate(r.decidedAt), today) <= 14),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((r) => {
          const p = byId.get(r.employee.employeeId);
          const state = r.status === "requested" ? "pending" : r.status === "approved" ? "approved" : "declined";
          return {
            id: r.id,
            name: r.employee.displayName,
            dept: `${deptOf(p)} · ${shortName(branchName(p?.workPropertyId ?? null))}`,
            kind: r.kind === "extra" ? "Extra days" : "Day in lieu",
            leaveType: r.leaveType.name,
            days: r.days,
            reason: r.reason,
            asked: dayMonth(r.createdAt),
            state,
            outcome:
              state === "pending"
                ? null
                : `${state === "approved" ? "Approved" : "Declined"} by ${r.decidedByName ?? "the office"} on ${dayMonth(r.decidedAt ?? r.createdAt)}${r.decisionNote ? `: ${r.decisionNote}` : "."}`,
            blockedWhy:
              r.status === "requested" && mine.has(r.employee.employeeId)
                ? "This is your own request. Someone else decides it."
                : null,
          } satisfies ExtraDaysAsk;
        });
    },
  },

  /** What people handed in and HR has not checked yet, oldest first. */
  "people.documentsToCheck": {
    naturalKey: "id",
    parity: "shape",
    async list(ctx): Promise<DocumentToCheck[]> {
      const lists = await Promise.all(
        businesses(ctx).map(({ api }) =>
          orEmpty(api.get<{ documents: ApiHandedIn[] }>("/api/v1/ops/documents", { query: { status: "submitted" } }), {
            documents: [],
          }),
        ),
      );
      return lists
        .flatMap((l) => l.documents)
        .map((d) => ({ d, at: d.versions.at(-1)?.uploadedAt ?? d.updatedAt }))
        .sort((a, b) => a.at.localeCompare(b.at))
        .map(({ d, at }) => ({
          id: d.id,
          employeeId: d.employee.employeeId,
          name: d.employee.displayName,
          title: d.title,
          handedIn: dayMonth(at),
        }));
    },
  },

  "people.leaveTypes": {
    naturalKey: "name",
    async list(ctx): Promise<LeaveType[]> {
      const types = await leaveTypesOf(ctx);
      return types
        .filter((t) => t.status === "active")
        .map((t) => {
          const ent = t.yearlyEntitlementDays;
          const accrual =
            ent === null
              ? t.needsAttachment
                ? "Days per event, against the paper that proves it"
                : "None"
              : t.accrual === "monthly"
                ? `${fmtDays(ent / 12)} days per month worked · ${fmtDays(ent)} a year`
                : `${fmtDays(ent)} days a year`;
          const carry =
            ent === null || t.reset !== "yearly"
              ? "Not applicable"
              : t.carry === "none"
                ? "None"
                : t.carry === "carry"
                  ? `Up to ${fmtDays(t.carryMaxDays)} days`
                  : `Up to ${fmtDays(t.carryMaxDays)} days, used within ${t.carryExpiresMonths} months`;
          return {
            id: t.id,
            name: t.name,
            paid:
              t.payment === "unpaid"
                ? "No · deducted pro-rata in payroll"
                : t.payment === "partial"
                  ? `${t.paymentPercent ?? 0}% of pay`
                  : t.needsAttachment
                    ? "Yes, with proof attached"
                    : "Yes",
            accrual,
            carry,
            flow:
              t.approvalSteps === 0 ? "Approved when asked" : t.approvalSteps === 1 ? "HR only" : "Line manager → HR",
            status: t.verifiedAt
              ? `Business policy · approved by ${t.verifiedByName ?? "the owner"}`
              : "Configured · unverified",
            verified: Boolean(t.verifiedAt),
          };
        });
    },
  },
});

// ── Rotations ───────────────────────────────────────────────────────────────────────────────────

/** "Rotation N1 · Nights, Thursday and Friday off" → code N1, family N, description. */
function rotationsOf(ctx: SourceContext): Promise<{ rotations: Rotation[]; codeOf: Map<string, string> }> {
  return once(ctx, "rotations", async () => {
    const branch = await rosterBranch(ctx);
    const [{ api }] = businesses(ctx);
    const [{ patterns }, assignments] = await Promise.all([
      api.get<{ patterns: ApiPattern[] }>("/api/v1/ops/rotation-patterns", { query: { propertyId: branch.id } }),
      orEmpty(api.get<{ assignments: ApiAssignment[] }>("/api/v1/ops/rotation-assignments"), { assignments: [] }),
    ]);
    const parsed = patterns
      .filter((p) => p.status === "active")
      .map((p) => {
        const m = p.name.match(/^Rotation ([A-Za-z0-9]+) · (.+)$/);
        const code = m?.[1] ?? p.name;
        return {
          id: p.id,
          code,
          family: code.replace(/\d+$/, ""),
          description: m?.[2] ?? p.name,
          steps: p.stepNames,
          rule: p.rule,
          ruleValue: p.ruleValue,
        };
      });
    const open = assignments.assignments.filter((a) => a.endsOn === null);
    const codeOf = new Map<string, string>();
    for (const a of open) {
      const p = parsed.find((x) => x.id === a.patternId);
      if (p) codeOf.set(a.employee.employeeId, p.code);
    }
    const families = new Map<string, typeof parsed>();
    for (const p of parsed) families.set(p.family, [...(families.get(p.family) ?? []), p]);
    const rotations: Rotation[] = [...families.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([family, members]) => {
        members.sort((a, b) => a.code.localeCompare(b.code));
        const people = open.filter((a) => members.some((m) => m.id === a.patternId));
        return {
          id: family,
          code: members.length > 1 ? `${members[0].code}–${members[members.length - 1].code}` : members[0].code,
          name:
            members.length > 1 ? `Staggered: ${members.map((m) => m.description).join("; ")}` : members[0].description,
          who: people.map((a) => firstName(a.employee.displayName)).join(", ") || "Nobody yet",
          staff: people.length,
          patterns: Object.fromEntries(members.map((m) => [m.code, m.description])),
          members: members.map(({ family: _, ...m }) => m),
          people: people.map((a) => ({
            assignmentId: a.id,
            employeeId: a.employee.employeeId,
            name: a.employee.displayName,
            title: a.employee.jobPositionTitle,
            patternId: a.patternId,
            code: members.find((m) => m.id === a.patternId)?.code ?? "",
            startsOn: a.startsOn,
            startStep: a.startStep,
          })),
        };
      });
    return { rotations, codeOf };
  });
}

// ── The attendance day ──────────────────────────────────────────────────────────────────────────

interface AttendanceDay {
  rows: ClockRecord[];
  exceptions: AttendanceException[];
  desk: DeskEmployee[];
  summary: AttendanceSummary;
  presence: DeptPresence[];
}

const SOURCE: Record<ApiRecord["source"], ClockSource> = {
  kiosk: "kiosk",
  phone: "phone",
  self: "phone",
  supervisor: "desk",
};
const SOURCE_WORD: Record<ClockSource, string> = { kiosk: "kiosk", phone: "phone", desk: "desk" };

/**
 * Today and yesterday on the attendance board, worked out once: the records, who is late, absent
 * or missed a clock-out, who may need a desk entry, the summary and who is in per team.
 *
 * - Late: clocked in after the shift's start plus the grace.
 * - Absent: rostered today on a shift that has started, no clock-in, and no leave that day.
 * - Missed clock-out: a record of an earlier day the sweep closed, nobody has put right.
 * - Desk entry: absent today, a missed clock-out with no correction asked, or rostered this week
 *   with no kiosk PIN issued yet.
 */
function attendanceDay(ctx: SourceContext): Promise<AttendanceDay> {
  return once(ctx, "attendance-day", async () => {
    const today = ctx.today.iso;
    const yesterday = addDays(today, -1);
    const now = ctx.now.getTime();
    const [{ people, byId, teams, branchName }, records, requests, { entries }, leave, grace, openBefore, tablets] =
      await Promise.all([
        workforce(ctx),
        recordsOf(ctx),
        attendanceRequestsOf(ctx),
        fortnight(ctx),
        leaveOf(ctx),
        graceOf(ctx),
        openBeforeOf(ctx),
        tabletNamesOf(ctx),
      ]);
    const graceMin = grace ?? 0;
    // The latest clock-in each person left open on an earlier day, yesterday included: the API
    // refuses today's clock-in while one is open.
    const staleBy = new Map<string, ApiRecord>();
    const openYesterday = records.filter((r) => r.workDate === yesterday && r.status === "open" && !r.clockOutAt);
    for (const r of [...openBefore, ...openYesterday].sort((a, b) => a.clockInAt.localeCompare(b.clockInAt))) {
      staleBy.set(r.employee.employeeId, r);
    }
    const entryById = new Map(entries.map((e) => [e.id, e]));
    // Rejected clock-ins show on the sheet as not counted, and count for nothing else.
    const shown = records.filter((r) => r.status !== "superseded");
    const live = shown.filter((r) => r.status !== "rejected");
    const lateBy = (r: ApiRecord): number => {
      const e = r.rosterEntryId ? entryById.get(r.rosterEntryId) : undefined;
      if (!e) return 0;
      const m = Math.floor((Date.parse(r.clockInAt) - Date.parse(e.startsAt)) / 60_000);
      return m > graceMin ? m : 0;
    };
    const pendingFor = (recordId: string) => requests.find((q) => q.recordId === recordId && q.status === "requested");
    const shiftOf = (r: ApiRecord) => {
      const e = r.rosterEntryId ? entryById.get(r.rosterEntryId) : undefined;
      return e ? entryTimes(e) : "Not rostered";
    };
    const where = (employeeId: string) => {
      const p = byId.get(employeeId);
      return { dept: deptOf(p), property: shortName(branchName(p?.workPropertyId ?? null)) };
    };

    // Records of today and yesterday.
    const rows: ClockRecord[] = [];
    for (const r of shown
      .filter((x) => x.workDate === today || x.workDate === yesterday)
      .sort((a, b) => a.clockInAt.localeCompare(b.clockInAt))) {
      const day = r.workDate === today ? "today" : "yesterday";
      const source = SOURCE[r.source];
      const late = lateBy(r);
      const missed = r.autoClosed && !r.validated;
      const worked = r.clockOutAt ? Math.round((Date.parse(r.clockOutAt) - Date.parse(r.clockInAt)) / 60_000) : 0;
      const tablet = r.kioskId ? (tablets.get(r.kioskId) ?? "the entrance tablet") : null;
      const away = r.location?.inDistanceM ?? null;
      const sourceNote =
        // The Desk chip already says where it came from; the note keeps the reason and who.
        r.note?.replace(/^Desk entry · /, "") ??
        (source === "kiosk"
          ? `${tablet ?? "Kiosk"} · PIN`
          : source === "phone"
            ? tablet
              ? away !== null && away > 150
                ? `Scanned at ${tablet}, but the phone was ${distanceWords(away)} away`
                : `Scanned at ${tablet}`
              : !r.location
                ? "From the staff app"
                : away === null
                  ? "No location sent"
                  : away <= 150
                    ? "At work"
                    : `${distanceWords(away)} from work`
            : "Desk entry");
      const status =
        r.status === "rejected"
          ? { status: "Not counted", tone: "danger" as Tone }
          : missed
            ? { status: "Missed clock-out", tone: "warning" as Tone }
            : r.clockOutAt
              ? {
                  status: `Complete ${Math.floor(worked / 60)} h ${String(worked % 60).padStart(2, "0")} min`,
                  tone: "success" as Tone,
                }
              : !r.validated
                ? { status: "Awaiting validation", tone: "info" as Tone }
                : late
                  ? { status: `Late ${late} min`, tone: "warning" as Tone }
                  : { status: "On shift", tone: "success" as Tone };
      rows.push({
        id: r.id,
        day,
        name: r.employee.displayName,
        ...where(r.employee.employeeId),
        shift: shiftOf(r),
        clockIn: clock(r.clockInAt),
        clockedOn: kigaliDate(r.clockInAt),
        source,
        sourceNote,
        clockOut: missed ? "Missing" : r.clockOutAt ? `${clock(r.clockOutAt)} · ${SOURCE_WORD[source]}` : "—",
        ...status,
        employeeId: r.employee.employeeId,
        // Someone still on shift can be clocked out from the row; a closed record is put right by correction.
        action: !r.clockOutAt && !missed && r.status !== "rejected" ? "clock_out" : null,
        check:
          !r.validated && !r.autoClosed && r.status !== "rejected" && source === "phone"
            ? { recordId: r.id, why: sourceNote }
            : null,
      });
    }

    // Absent: rostered today, the shift has started, no clock-in, no leave.
    const clockedToday = new Set(live.filter((r) => r.workDate === today).map((r) => r.employee.employeeId));
    const absent = entries.filter(
      (e) =>
        e.status === "scheduled" &&
        e.workDate === today &&
        Date.parse(e.startsAt) <= now &&
        !clockedToday.has(e.employee.employeeId) &&
        !onLeave(leave, e.employee.employeeId, today) &&
        byId.has(e.employee.employeeId),
    );
    for (const e of absent) {
      rows.push({
        id: `absent:${e.id}`,
        day: "today",
        name: e.employee.displayName,
        ...where(e.employee.employeeId),
        shift: entryTimes(e),
        clockIn: "No clock-in",
        source: null,
        sourceNote: "",
        clockOut: "—",
        status: "Absent",
        tone: "danger",
        employeeId: e.employee.employeeId,
        action: "clock_in",
        shiftStart: clock(e.startsAt),
        stale: (() => {
          const open = staleBy.get(e.employee.employeeId);
          if (!open) return undefined;
          // The end offered: eight hours after the clock-in, the length of a standard shift.
          const end = new Date(Date.parse(open.clockInAt) + 8 * 3_600_000).toISOString();
          return {
            recordId: open.id,
            date: open.workDate,
            since: wkdDayMonth(open.workDate),
            clockIn: clock(open.clockInAt),
            clockOut: clock(end),
          };
        })(),
      });
    }

    // Exceptions.
    const used = new Set<string>();
    const xid = (name: string) => {
      const base = `x-${firstName(name)
        .toLowerCase()
        .replace(/[^a-z]/g, "")}`;
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      return id;
    };
    const exceptions: AttendanceException[] = [];
    const monthStart = `${today.slice(0, 7)}-01`;
    for (const e of absent) {
      const p = byId.get(e.employee.employeeId);
      const lead = p?.team?.leadEmployeeId ? byId.get(p.team.leadEmployeeId) : undefined;
      const w = where(e.employee.employeeId);
      exceptions.push({
        id: xid(e.employee.displayName),
        kind: "absent",
        icon: "PersonXmark",
        title: `${e.employee.displayName} · no clock-in today`,
        // The line manager is named, not "informed": the attendance trigger waits in the outbox and nothing
        // delivers it yet (people/infrastructure/hr-events.ts).
        detail: `${w.dept}, ${w.property} · shift ${entryTimes(e)} · no leave recorded${lead && lead.id !== p?.id ? ` · line manager ${lead.displayName}` : ""}`,
        state: "Absent",
        tone: "danger",
        deskEmployee: e.employee.employeeId,
        correction: null,
        resolvedDetail: null,
      });
    }
    for (const r of live.filter((x) => x.workDate === today && lateBy(x) > 0)) {
      const w = where(r.employee.employeeId);
      const lateThisMonth = live.filter(
        (x) => x.employee.employeeId === r.employee.employeeId && x.workDate >= monthStart && lateBy(x) > 0,
      ).length;
      exceptions.push({
        id: xid(r.employee.displayName),
        kind: "late",
        icon: "Clock",
        title: `${r.employee.displayName} · late ${lateBy(r)} min today`,
        detail: `${w.dept}, ${w.property} · ${SOURCE_WORD[SOURCE[r.source]]} clock-in ${clock(r.clockInAt)}${lateThisMonth > 1 ? ` · late ${lateThisMonth} times this month` : ""}`,
        state: "Late",
        tone: "warning",
        deskEmployee: null,
        correction: null,
        resolvedDetail: null,
      });
    }
    const missed = live.filter(
      (x) => x.workDate < today && x.autoClosed && !x.validated && x.workDate >= addDays(today, -7),
    );
    for (const r of missed) {
      const asked = pendingFor(r.id);
      exceptions.push({
        id: xid(r.employee.displayName),
        kind: "missed",
        icon: "ArrowRightFromSquare",
        title: `${r.employee.displayName} · missed clock-out ${wkdDay(r.workDate)}`,
        detail: asked
          ? "Correction requested · waiting for your decision"
          : "No correction requested yet · closed by the sweep at the default shift length",
        state: asked ? "Correction pending" : "Open",
        tone: asked ? "info" : "warning",
        deskEmployee: asked ? null : r.employee.employeeId,
        correction: asked?.id ?? null,
        resolvedDetail: asked ? `Correction approved · out ${clock(asked.clockOutAt)}` : null,
        workDate: r.workDate,
        clockIn: clock(r.clockInAt),
      });
    }

    // Who may need a desk entry.
    const desk = new Map<string, DeskEmployee>();
    const addDesk = (employeeId: string, shift: string, due = true) => {
      const p = byId.get(employeeId);
      if (!p || desk.has(employeeId)) return;
      desk.set(employeeId, {
        id: employeeId,
        label: `${p.displayName} · ${deptOf(p)}`,
        name: p.displayName,
        dept: deptOf(p),
        property: shortName(branchName(p.workPropertyId)),
        shift,
        due,
      });
    };
    for (const e of absent) addDesk(e.employee.employeeId, entryTimes(e));
    for (const r of missed) if (!pendingFor(r.id)) addDesk(r.employee.employeeId, shiftOf(r));
    const weekEnd = addDays(today, 6);
    for (const p of people.filter((x) => x.placement && !x.placement.hasKioskPin && x.status === "active")) {
      const next = entries
        .filter(
          (e) =>
            e.employee.employeeId === p.id && e.status === "scheduled" && e.workDate >= today && e.workDate <= weekEnd,
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
      if (next) addDesk(p.id, entryTimes(next));
    }
    // Anyone else on staff: a kiosk down or a phone lost can need a desk entry for anybody.
    for (const p of [...people]
      .filter((x) => x.status === "active" && x.orgRole !== "owner")
      .sort((a, b) => a.displayName.localeCompare(b.displayName))) {
      const next = entries
        .filter((e) => e.employee.employeeId === p.id && e.status === "scheduled" && e.workDate >= today)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
      addDesk(p.id, next ? entryTimes(next) : "No shift rostered", false);
    }

    // The summary.
    const todayRecords = live.filter((r) => r.workDate === today);
    const rosteredToday = new Set(
      entries
        .filter(
          (e) =>
            e.workDate === today &&
            e.status === "scheduled" &&
            Date.parse(e.startsAt) <= now &&
            !onLeave(leave, e.employee.employeeId, today),
        )
        .map((e) => e.employee.employeeId),
    );
    for (const r of todayRecords) rosteredToday.add(r.employee.employeeId);
    const lateToday = todayRecords.filter((r) => lateBy(r) > 0);
    const count = (s: ClockSource) => todayRecords.filter((r) => SOURCE[r.source] === s).length;
    const summary: AttendanceSummary = {
      id: today,
      clockedIn: todayRecords.length,
      rostered: rosteredToday.size,
      lateNote: lateToday.length
        ? lateToday.map((r) => `${firstName(r.employee.displayName)} ${lateBy(r)} min`).join(" · ")
        : "Nobody late",
      missedDay: missed.length ? longDay(missed[0].workDate) : "None this week",
      kiosk: count("kiosk"),
      phone: count("phone"),
      desk: count("desk"),
      grace: grace === null ? "no grace period" : `${grace} min grace`,
      yesterdayNote: `${longDay(yesterday)} · every record of the day`,
    };

    // Who is in now, per team.
    const presence: DeptPresence[] = [];
    const deptLine = (id: string, name: string, propertyId: string, members: Person[]): DeptPresence | null => {
      const ids = new Set(members.map((m) => m.id));
      const rostered = entries.some(
        (e) => e.workDate === today && e.status === "scheduled" && ids.has(e.employee.employeeId),
      );
      const recs = todayRecords
        .filter((r) => ids.has(r.employee.employeeId))
        .sort((a, b) => a.clockInAt.localeCompare(b.clockInAt));
      const away = members.filter((m) => onLeave(leave, m.id, today));
      if (!rostered && recs.length === 0 && away.length === 0) return null;
      return {
        id,
        name,
        property: propertyId as PropertyId,
        // In now is clocked in and not out again; whoever has clocked out is rostered but gone.
        present: recs.filter((r) => !r.clockOutAt && lateBy(r) === 0).map((r) => r.employee.displayName),
        late: recs
          .filter((r) => lateBy(r) > 0)
          .map((r) => ({
            name: r.employee.displayName,
            why: `in ${clock(r.clockInAt)} for ${clock(entryById.get(r.rosterEntryId ?? "")?.startsAt)} · ${SOURCE_WORD[SOURCE[r.source]]}`,
            gone: Boolean(r.clockOutAt),
          })),
        finished: recs.filter((r) => r.clockOutAt).map((r) => r.employee.displayName),
        // Leave is not an absence, and someone on leave is not rostered: the same count Attendance makes.
        onLeave: away.map((m) => {
          const l = onLeave(leave, m.id, today);
          return {
            name: m.displayName,
            why: `${l?.leaveType.name.toLowerCase() ?? "on leave"}${l?.reason ? ` · ${l.reason.charAt(0).toLowerCase()}${l.reason.slice(1)}` : ""}`,
          };
        }),
        absent: absent
          .filter((e) => ids.has(e.employee.employeeId))
          .map((e) => ({ name: e.employee.displayName, why: "no clock-in", explained: false })),
      };
    };
    for (const t of teams) {
      const line = deptLine(
        t.code,
        t.name,
        t.propertyId,
        people.filter((p) => p.team?.id === t.id),
      );
      if (line) presence.push(line);
    }

    // People on no team still come to work. They count under their branch, so People home agrees with Attendance.
    const noTeamByBranch = new Map<string, Person[]>();
    for (const p of people) {
      if (p.team || !p.workPropertyId || p.status !== "active") continue;
      noTeamByBranch.set(p.workPropertyId, [...(noTeamByBranch.get(p.workPropertyId) ?? []), p]);
    }
    for (const [propertyId, members] of noTeamByBranch) {
      const line = deptLine(`no-team-${propertyId}`, "No team yet", propertyId, members);
      if (line) presence.push(line);
    }

    return { rows, exceptions, desk: [...desk.values()], summary, presence };
  });
}

// ── The leave view ──────────────────────────────────────────────────────────────────────────────

interface LeaveViewData {
  requests: LeaveRequest[];
  calendar: LeaveCalendarEntry[];
  /** Approved leave not over yet, decided too long ago for the queue: HR can still open and cancel it. */
  earlier: Map<string, LeaveRequest>;
}

/**
 * The HR leave queue and its calendar. The queue is what waits (with the line manager or HR) and
 * what was decided in the last two weeks; approved leave decided earlier that falls in the
 * calendar's three weeks is drawn on the calendar on its own.
 */
function leaveView(ctx: SourceContext): Promise<LeaveViewData> {
  return once(ctx, "leave-view", async () => {
    const today = ctx.today.iso;
    const calEnd = addDays(today, 20);
    const [{ people, byId, branchName }, cover, { entries }, leave, mine] = await Promise.all([
      workforce(ctx),
      coverOf(ctx),
      fortnight(ctx),
      leaveOf(ctx),
      myFileIds(ctx),
    ]);
    const myName = ctx.account?.user.name ?? null;
    const recent = (l: ApiLeaveRequest) => l.decidedAt !== null && daysBetween(kigaliDate(l.decidedAt), today) <= 14;
    const inQueue = leave.filter(
      (l) => byId.has(l.employee.employeeId) && (l.status === "requested" || (l.status !== "cancelled" && recent(l))),
    );
    const stillRunning = leave.filter(
      (l) => l.status === "approved" && l.endsOn >= today && byId.has(l.employee.employeeId) && !inQueue.includes(l),
    );
    const waiting = [...new Set([...inQueue, ...stillRunning].map((l) => l.employee.employeeId))]
      .map((id) => byId.get(id))
      .filter((p): p is Person => Boolean(p));
    const bal = await balancesOf(ctx, waiting);
    const balanceOf = (employeeId: string, code: string) =>
      bal.get(employeeId)?.balances.find((b) => b.leaveType.code === code)?.balanceDays ?? null;
    const typeWord = (name: string) => name.replace(/ leave$/i, "");

    const coverWarning = (l: ApiLeaveRequest): { warn: string; homeWarn: string } => {
      const p = byId.get(l.employee.employeeId);
      if (!p?.team) return { warn: "", homeWarn: "" };
      for (const c of cover.filter((x) => x.teamId === p.team?.id)) {
        const counted = new Set(c.shiftTemplateIds);
        for (let d = l.startsOn; d <= l.endsOn; d = addDays(d, 1)) {
          const mine = entries.find(
            (e) =>
              e.employee.employeeId === p.id &&
              e.workDate === d &&
              e.status === "scheduled" &&
              counted.has(e.shiftTemplateId),
          );
          if (!mine) continue;
          const covered = entries.filter(
            (e) =>
              e.workDate === d &&
              e.status === "scheduled" &&
              e.propertyId === c.propertyId &&
              counted.has(e.shiftTemplateId) &&
              people.some((m) => m.id === e.employee.employeeId && m.team?.id === c.teamId),
          ).length;
          const needed = c.minByWeekday[weekdayIndex(d)] ?? 0;
          if (covered - 1 < needed) {
            return {
              warn: `${WEEKDAY[weekdayIndex(d)]} ${p.team.name.toLowerCase()} would drop to ${covered - 1} of ${needed}`,
              homeWarn:
                covered < needed
                  ? `${p.team.name} already low on staff that day`
                  : `${p.team.name} drops below minimum that day`,
            };
          }
        }
      }
      return { warn: "", homeWarn: "" };
    };

    const present = (l: ApiLeaveRequest): LeaveRequest => {
      const p = byId.get(l.employee.employeeId);
      const first = l.approvals.find((a) => a.step === 1);
      const second = l.approvals.find((a) => a.step === 2);
      const twoSteps = l.approvalSteps === 2;
      const step: LeaveStep =
        l.status === "approved"
          ? "approved"
          : l.status === "rejected"
            ? twoSteps && second?.decision !== "rejected" && first?.decision === "rejected"
              ? "lmdeclined"
              : "declined"
            : twoSteps && l.currentStep === 1
              ? "lm"
              : "hr";
      // Only a two-step type has a line manager step, and step one of it is theirs. A one-step type
      // (the default) goes straight to HR: its step-one row is HR's own decision, so no line manager
      // is named, and `lm` stays empty for the screen to say there was no such step.
      const lm = !twoSteps
        ? ""
        : first?.decidedByName && first.decision !== "skipped"
          ? first.decidedByName
          : (l.routedToName ?? "No line manager");
      const lmNote =
        twoSteps && first && first.decision !== "skipped"
          ? `${first.decision === "approved" ? "Approved" : "Declined"} ${dayMonth(first.decidedAt)}${first.note ? ` · “${first.note}”` : ""}`
          : "";
      const code = l.leaveType.code;
      const now = balanceOf(l.employee.employeeId, code);
      const after = now === null ? null : l.status === "approved" ? now : now - l.days;
      const word = typeWord(l.leaveType.name);
      const decider = second?.decidedByName ?? first?.decidedByName ?? null;
      const { warn, homeWarn } = l.status === "requested" ? coverWarning(l) : { warn: "", homeWarn: "" };
      const inRoster = entries.filter(
        (e) =>
          e.employee.employeeId === l.employee.employeeId &&
          e.status === "scheduled" &&
          e.workDate >= l.startsOn &&
          e.workDate <= l.endsOn,
      ).length;
      const offset = daysBetween(today, l.startsOn);
      const end = daysBetween(today, l.endsOn);
      const visible = end >= 0 && offset <= 20 && step !== "declined" && step !== "lmdeclined";
      // What the API refuses, said before the press: one's own leave, and a second step by whoever took the first.
      const blockedWhy =
        l.status !== "requested"
          ? null
          : mine.has(l.employee.employeeId)
            ? "This is your own request. Someone else decides it."
            : twoSteps && l.currentStep === 2 && myName && first?.decidedByName === myName
              ? "You approved the first step. Someone else decides this one."
              : null;
      return {
        id: l.id,
        name: l.employee.displayName,
        dept: `${deptOf(p)} · ${shortName(branchName(p?.workPropertyId ?? null))}`,
        type: l.reason && code === "circumstantial" ? `${l.leaveType.name} · ${l.reason}` : l.leaveType.name,
        homeType:
          l.reason && code === "circumstantial"
            ? `${l.leaveType.name} · ${l.reason.replace(/^own /, "")}`
            : l.leaveType.name,
        dates: dateSpan(l.startsOn, l.endsOn),
        days: l.days,
        sub: dayMonth(l.createdAt),
        lm,
        lmNote,
        step,
        hrDecision: null,
        hrReason: step === "declined" ? l.decisionNote : null,
        blockedWhy,
        homeStep:
          step === "hr"
            ? `${twoSteps && first?.decidedByName ? `${firstName(first.decidedByName)} approved · ` : ""}${blockedWhy ? "someone else decides" : "now with you"}`
            : step === "lm"
              ? `With ${l.routedToName ?? "the line manager"}`
              : step === "approved"
                ? "Approved"
                : step === "lmdeclined"
                  ? "Declined by manager"
                  : "Declined by HR",
        balanceAfter: after === null ? "no balance kept" : plural(Math.floor(Math.max(after, 0)), "day"),
        homeWarn,
        balance:
          now === null
            ? "No balance kept for this type"
            : l.status === "requested"
              ? `${word} ${wholeDays(now)} → ${wholeDays(now - l.days)} days`
              : l.status === "approved"
                ? `${word} ${wholeDays(now)} days left`
                : `Unchanged · ${wholeDays(now)} days`,
        roster:
          l.endsOn < today
            ? "Past dates"
            : l.status === "approved"
              ? "Shifts released"
              : inRoster
                ? `${plural(inRoster, "shift")} released when approved`
                : "Not rostered on these days yet",
        attach: l.hasAttachment ? "Attachment on file (restricted)" : "None needed",
        warn,
        by:
          step === "approved"
            ? `Approved by ${decider ?? "HR"} on ${dayMonth(l.decidedAt ?? l.createdAt)}`
            : step === "lmdeclined"
              ? `Declined by ${first?.decidedByName ?? lm}; it never reached HR`
              : step === "declined"
                ? `Declined by ${second?.decidedByName ?? decider ?? "HR"} on ${dayMonth(l.decidedAt ?? l.createdAt)}`
                : null,
        cal: visible ? [Math.max(offset, 0), Math.min(end, 20) - Math.max(offset, 0) + 1] : null,
      };
    };
    const requests = inQueue.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(present);
    const earlier = new Map(stillRunning.map((l) => [l.id, present(l)]));
    const listed = new Set(requests.map((r) => r.id));
    const calendar: LeaveCalendarEntry[] = leave
      .filter((l) => l.status === "approved" && !listed.has(l.id) && byId.has(l.employee.employeeId))
      .filter((l) => l.endsOn >= today && l.startsOn <= calEnd)
      .map((l) => {
        const offset = Math.max(daysBetween(today, l.startsOn), 0);
        const end = Math.min(daysBetween(today, l.endsOn), 20);
        return {
          id: l.id,
          name: l.employee.displayName,
          type: l.leaveType.name,
          step: "approved" as const,
          cal: [offset, end - offset + 1] as [number, number],
        };
      });
    return { requests, calendar, earlier };
  });
}
