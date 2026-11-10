/**
 * Live sources for the staff area: the housekeeper's, supervisor's and technician's phones, as the staff
 * fixture document types.
 *
 *   /staff/task, /staff/report   GET /api/v1/ops/housekeeping/board + /ops/housekeeping/phone, /ops/work-orders
 *   /staff/inspect               the same board and phone read, as the supervisor
 *   /staff/work-orders           GET /api/v1/ops/work-orders + /ops/maintenance-time-logs
 *   /staff/schedule, /staff/me   GET /api/v1/me/work/:employeeId/… (the caller's own file; SessionGuard only)
 *
 * The phone shows the caller's own work: "mine" is decided by the signed-in account's id against the
 * assignee the API returns, never by a name. Each read is fetched once per source context (a page render)
 * and forgotten by every staff mutation (`forgetStaff`).
 */

import type {
  ChecklistSection,
  CleaningRoom,
  FinishedRoom,
  FoundItem,
  HelpTicket,
  InspectionCheck,
  InspectionRoom,
  MinibarItem,
  Payslip,
  ProblemReport,
  ReportPlace,
  StaffProfile,
  WorkOrder,
  WorkOrderBlock,
  WorkOrderPart,
} from "@injishi/data/fixtures/staff";
import { type StockKey, stock } from "@injishi/data/media";
import type {
  HrFeatureId,
  LeaveApprover,
  StaffLeaveBalance as LeaveBalance,
  StaffLeaveType as LeaveType,
  LoanedAsset,
  RequestStatus,
  Shift,
  ShiftChoices,
  StaffAnnouncement,
  StaffClaim,
  StaffDocument,
  StaffLoan,
  StaffOwnReview,
  StaffRequest,
  StaffTone,
  SwapAsk,
  SwapColleague,
} from "@injishi/product-hr";
import { ApiError } from "../api";
import {
  type ApiLoan,
  type ApiMyAnnouncement,
  type ApiMyReview,
  type ApiTicket,
  ASSET,
  agoOf,
  announcementWords,
  loanOutcome,
  loanState,
  reviewWords,
  ticketState,
} from "../desk-view";
import { clock, dayMonth, dayMonthYear, kigaliDate } from "../format";
import { type ApiBoard, type ApiBoardTask, type ApiWorkOrder, readBoard, readWorkOrders } from "./operations";
import { defineSources, type SourceContext } from "./types";

// ── API shapes (as server/api answers) ────────────────────────────────────────────────────────────

interface ApiPhone {
  propertyId: string;
  checklist: {
    id: string;
    kind: "cleaning" | "inspection";
    sectionCode: string;
    sectionTitle: string;
    code: string;
    label: string;
    requiresPhoto: boolean;
    sortOrder: number;
  }[];
  checks: { taskId: string; itemId: string; result: "done" | "pass" | "fail"; photoObjectKey: string | null }[];
  minibarItems: { id: string; code: string; label: string; parLevel: number; sortOrder: number }[];
  minibarCounts: { taskId: string; itemId: string; parLevel: number; used: number; countedAt: string }[];
  arrivals: { roomId: string; guests: number }[];
  myFloors: number[];
  places: { spaceId: string; name: string; floor: number | null }[];
  supervisor: { userId: string; name: string } | null;
  foundItems: {
    id: string;
    reference: string;
    description: string;
    roomLabel: string | null;
    foundLocation: string;
    foundSpot: string | null;
    foundAt: string;
    category: string;
    photoCount: number;
    custodianName: string | null;
    status: string;
  }[];
}

interface ApiTimeLog {
  id: string;
  ticketId: string;
  userId: string;
  userName: string | null;
  kind: "diagnosis" | "repair";
  startedAt: string;
  endedAt: string | null;
}

interface ApiWorkFile {
  employeeId: string;
  orgId: string;
  displayName: string;
  /** MyWorkFile in @injishi/contracts time.ts. */
  businessName?: string;
  employeeNumber?: string;
  branchName?: string | null;
  jobPositionTitle?: string | null;
  status: string;
  openRecord: { id: string; clockInAt: string } | null;
}

interface ApiRosterEntry {
  id: string;
  shiftName: string | null;
  workDate: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

type ShiftRequestStatus = "requested" | "awaiting_colleague" | "approved" | "rejected" | "cancelled";

interface ApiShiftRequest {
  id: string;
  employee?: { employeeId: string; displayName: string };
  kind: string;
  swapWith: { employeeId: string; displayName: string } | null;
  shiftTemplate?: { id: string; name: string } | null;
  rotation?: { id: string; name: string } | null;
  fromDate: string;
  toDate: string;
  reason: string | null;
  status: ShiftRequestStatus;
  colleagueAcceptedAt: string | null;
  routedTo: { displayName: string } | null;
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  createdAt: string;
}

interface ApiLeaveType {
  id: string;
  code: string;
  name: string;
  payment: "paid" | "unpaid" | "partial";
  accrual: string;
  yearlyEntitlementDays: number | null;
  carryMaxDays: number | null;
  approvalSteps: number;
  needsAttachment: boolean;
}

interface ApiLeaveRequest {
  id: string;
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
  approvals: { step: number; decision: string; decidedByName: string | null; note: string | null; decidedAt: string }[];
}

interface ApiBalance {
  leaveType: ApiLeaveType;
  balanceDays: number | null;
  entries: { kind: string; days: number; effectiveOn: string }[];
}

interface ApiMyDocument {
  id: string;
  kind: "contract" | "document";
  title: string;
  status: string;
  contractType: string | null;
  startsOn: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  checkedAt: string | null;
  rejectReason: string | null;
}

interface ApiApprovalStep {
  order: number;
  role: "line_manager" | "office";
  name: string;
  jobTitle: string | null;
}

// ── Reads, once per page render ────────────────────────────────────────────────────────────────────

const memo = new WeakMap<SourceContext, Map<string, Promise<unknown>>>();

function once<T>(ctx: SourceContext, key: string, load: () => Promise<T>): Promise<T> {
  let entries = memo.get(ctx);
  if (!entries) {
    entries = new Map();
    memo.set(ctx, entries);
  }
  let p = entries.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load();
    entries.set(key, p);
    p.catch(() => entries?.delete(key));
  }
  return p;
}

/** Drop what this context read, so the next read sees a write. Every staff mutation calls it. */
export function forgetStaff(ctx: SourceContext): void {
  memo.delete(ctx);
}

export const readPhone = (ctx: SourceContext) =>
  once(ctx, "phone", () => ctx.ops().get<ApiPhone>("/api/v1/ops/housekeeping/phone"));
const readTimeLogs = (ctx: SourceContext) =>
  once(ctx, "time-logs", () => ctx.ops().get<{ logs: ApiTimeLog[] }>("/api/v1/ops/maintenance-time-logs"));

/** The caller holds no HR file at any business: their own pages say so instead of failing. */
class NoStaffFileError extends Error {
  constructor() {
    super("This account has no staff file at a business yet.");
    this.name = "NoStaffFileError";
  }
}

/**
 * Why a staff page's own reads cannot be shown, in words, or null when the error is not one of those: no staff file,
 * or the API refusing because something it needs is not set up (409, such as leave rules not configured) or found (404).
 */
export function staffReadRefusal(error: unknown): string | null {
  if (error instanceof NoStaffFileError) return error.message;
  if (error instanceof ApiError && (error.status === 409 || error.status === 404)) return error.message;
  return null;
}

/** The caller's own HR file at the business (the first active one). */
export async function myFile(ctx: SourceContext): Promise<ApiWorkFile> {
  const { files } = await once(ctx, "me-work", () => ctx.api.get<{ files: ApiWorkFile[] }>("/api/v1/me/work"));
  const file = files.find((f) => f.status === "active") ?? files[0];
  if (!file) throw new NoStaffFileError();
  return file;
}

/**
 * The caller's own profile, from their own HR file (`GET /me/work`): staff number, business, branch and job
 * title. The sample `staff.profiles` document is keyed by the shell persona, so every housekeeper read the demo
 * housekeeper's number and another persona's profile stood in for a caller with none; the phone pages read this
 * instead. What the file does not carry (start date, area, shift) is "" and the screens say it is not on file. Null
 * when the account has no staff file (or the API will not show it).
 */
export async function myProfile(ctx: SourceContext): Promise<StaffProfile | null> {
  let file: ApiWorkFile;
  try {
    file = await myFile(ctx);
  } catch (error) {
    if (error instanceof NoStaffFileError) return null;
    if (error instanceof ApiError && [403, 404, 409].includes(error.status)) return null;
    throw error;
  }
  return {
    id: file.employeeId,
    staffNo: file.employeeNumber ?? "",
    since: "",
    workplace: file.businessName ?? "",
    site: file.branchName ?? file.businessName ?? "",
    department: file.jobPositionTitle ?? "",
    area: "",
    shift: "",
    clockedInAt: file.openRecord ? clock(file.openRecord.clockInAt) : "",
    photo: null,
  };
}

/**
 * Facts a staff page states beside its collections, read from the same API answers (fetched once per page
 * render with them): who supervises housekeeping at the property today, and when the caller clocked in.
 * Null when the API names nobody, so a screen says "your supervisor" rather than a name it made up.
 */
export async function phoneSupervisor(ctx: SourceContext): Promise<string | null> {
  return (await readPhone(ctx)).supervisor?.name ?? null;
}

async function mine<T>(ctx: SourceContext, key: string, path: string): Promise<T> {
  const { employeeId } = await myFile(ctx);
  return once(ctx, key, () => ctx.api.get<T>(`/api/v1/me/work/${employeeId}${path}`));
}

const me = (ctx: SourceContext) => ctx.account?.user.id ?? null;

// ── Shared wording ─────────────────────────────────────────────────────────────────────────────────

const firstName = (name: string | null | undefined) => (name ?? "").split(" ")[0] ?? "";
const initialsOf = (name: string | null | undefined) =>
  (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
const minutesBetween = (from: string | Date, to: string | Date) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);
/** "45 min", "1 h 22 min", "2 h". */
function duration(minutes: number): string {
  const m = Math.max(0, minutes);
  if (m < 60) return `${m} min`;
  const rest = m % 60;
  return rest ? `${Math.floor(m / 60)} h ${rest} min` : `${Math.floor(m / 60)} h`;
}
/** How old something is: "20 min", "18 h", "2 days". */
function age(from: string, now: Date): string {
  const m = Math.max(0, minutesBetween(from, now));
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h`;
  return `${Math.floor(m / (24 * 60))} days`;
}
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Thu 15 Oct" for a calendar date. */
const dayLabel = (iso: string) => `${DOW[new Date(`${iso}T12:00:00Z`).getUTCDay()]} ${dayMonth(iso)}`;
/** "today 10:52" / "Sun 11 Oct 16:40". */
function whenSaid(at: string, today: string): string {
  const day = kigaliDate(at);
  return day === today ? `today ${clock(at)}` : `${dayLabel(day)} ${clock(at)}`;
}
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isStock = (key: string): key is StockKey => key in stock;
const stockOf = (key: string): StockKey | null => {
  const k = key.startsWith("stock:") ? key.slice(6) : "";
  return isStock(k) ? k : null;
};

// ── Housekeeping: the cleaner's rooms ──────────────────────────────────────────────────────────────

const KIND: Record<ApiBoardTask["taskType"], CleaningRoom["kind"] | null> = {
  checkout_clean: "Checkout",
  stayover_clean: "Stayover",
  deep_clean: "Deep clean",
  turndown: "Turndown",
  inspection: null,
};
const kindOf = (t: ApiBoardTask) => (t.reopenedFromTaskId ? "Re-clean" : KIND[t.taskType]);
const OPEN = new Set(["pending", "in_progress", "blocked"]);
const INSPECTABLE = new Set(["checkout_clean", "deep_clean"]);

/** The note's parts: "Due 12:00 · Arrival at 14:00 · …". The first one names the deadline when it says so. */
function noteParts(t: ApiBoardTask): { due: string | null; rest: string[] } {
  const parts = (t.note ?? "")
    .split(" · ")
    .map((p) => p.trim())
    .filter(Boolean);
  const due = parts[0] && /^(Due|By|After) /.test(parts[0]) ? parts[0] : null;
  return { due, rest: due ? parts.slice(1) : parts };
}

function dueOf(t: ApiBoardTask): string {
  if (t.dueAt) return `Due ${clock(t.dueAt)}`;
  return noteParts(t).due ?? "Today";
}

/** Time in the room so far, "18:24" (minutes and seconds). */
function timer(startedAt: string | null, now: Date): string {
  if (!startedAt) return "00:00";
  const s = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function arrivalOf(board: ApiBoard, phone: ApiPhone, t: ApiBoardTask): string {
  const room = board.rooms.find((r) => r.id === t.roomId);
  if (room?.arrival) {
    const guests = phone.arrivals.find((a) => a.roomId === t.roomId)?.guests;
    const time = room.arrival.checkInTime ? `Next arrival ${room.arrival.checkInTime.slice(0, 5)}` : "Arrival today";
    return guests ? `${time} · ${guests} ${guests === 1 ? "guest" : "guests"}` : time;
  }
  if (room?.occupiedBy) return "Guest staying tonight";
  return "No arrival today";
}

/** The open task the phone counts the minibar for: the one being cleaned, else the first waiting. */
function currentTask(board: ApiBoard, userId: string | null): ApiBoardTask | undefined {
  const open = board.tasks.filter((t) => t.assignedToUserId === userId && OPEN.has(t.status) && kindOf(t));
  return open.find((t) => t.status === "in_progress") ?? open[0];
}

async function cleaningRooms(ctx: SourceContext): Promise<CleaningRoom[]> {
  const [board, phone] = await Promise.all([readBoard(ctx), readPhone(ctx)]);
  const userId = me(ctx);
  const now = ctx.now;
  const tasks = board.tasks
    .filter((t) => t.assignedToUserId === userId && OPEN.has(t.status) && kindOf(t))
    .sort((a, b) => Number(b.status === "in_progress") - Number(a.status === "in_progress"));
  return tasks.map((t) => {
    const room = board.rooms.find((r) => r.id === t.roomId);
    const kind = kindOf(t) as CleaningRoom["kind"];
    const history = [
      `Task created ${clock(t.createdAt)}`,
      t.startedAt ? `you started ${clock(t.startedAt)}` : null,
    ].filter(Boolean);
    return {
      id: t.id,
      no: t.roomLabel ?? "",
      kind,
      type: room?.roomTypeName ?? "",
      due: dueOf(t),
      arrival: arrivalOf(board, phone, t),
      arrivalNote: noteParts(t).rest.join(" · "),
      history: history.join(" · "),
      timer: timer(t.startedAt, now),
      started: t.startedAt ? `Started ${clock(t.startedAt)}` : "Not started",
      status: t.status === "in_progress" ? "cleaning" : "waiting",
      ticked: phone.checks.filter((c) => c.taskId === t.id && c.result === "done").map((c) => c.itemId),
      floor: room?.floor !== null && room?.floor !== undefined ? `Floor ${room.floor}` : "",
    };
  });
}

async function finishedRooms(ctx: SourceContext): Promise<FinishedRoom[]> {
  const board = await readBoard(ctx);
  const userId = me(ctx);
  return board.tasks
    .filter(
      (t) =>
        t.assignedToUserId === userId &&
        (t.status === "done" || t.status === "inspected") &&
        t.completedAt &&
        kigaliDate(t.completedAt) === ctx.today.iso &&
        kindOf(t),
    )
    .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)))
    .map((t) => {
      const cleaned = `Cleaned ${clock(t.completedAt)}`;
      const waits = t.status === "done" && (INSPECTABLE.has(t.taskType) || Boolean(t.reopenedFromTaskId));
      const when =
        t.status === "inspected"
          ? t.inspectedAt
            ? `${cleaned} · inspected ${clock(t.inspectedAt)}`
            : cleaned
          : waits
            ? `${cleaned} · waiting for inspection`
            : cleaned;
      return {
        id: t.id,
        no: t.roomLabel ?? "",
        kind: kindOf(t) as string,
        when,
        state: t.status === "inspected" ? "Inspected" : "Clean",
        stateTone: "success" as StaffTone,
      };
    });
}

const SECTION_ICON: Record<string, string> = {
  bathroom: "Droplet",
  bedroom: "House",
  linen: "TShirt",
  amenities: "Gift",
};

async function checklistSections(ctx: SourceContext): Promise<ChecklistSection[]> {
  const phone = await readPhone(ctx);
  const sections = new Map<string, ChecklistSection>();
  for (const item of phone.checklist.filter((i) => i.kind === "cleaning")) {
    let section = sections.get(item.sectionCode);
    if (!section) {
      section = {
        id: item.sectionCode,
        title: item.sectionTitle,
        icon: SECTION_ICON[item.sectionCode] ?? "ListCheck",
        items: [],
      };
      sections.set(item.sectionCode, section);
    }
    section.items.push({ id: item.id, label: item.label });
  }
  return [...sections.values()];
}

async function minibarItems(ctx: SourceContext): Promise<MinibarItem[]> {
  const [board, phone] = await Promise.all([readBoard(ctx), readPhone(ctx)]);
  const task = currentTask(board, me(ctx));
  return phone.minibarItems.map((m) => ({
    id: m.id,
    label: m.label,
    stocked: m.parLevel,
    used: phone.minibarCounts.find((c) => c.taskId === task?.id && c.itemId === m.id)?.used ?? 0,
  }));
}

/** The phone's spot buttons (staff.foundSpots), by the phrase a logged item carries. */
const SPOT_BY_PHRASE: Record<string, string> = {
  "bedside drawer": "bedside",
  bathroom: "bathroom",
  wardrobe: "wardrobe",
  "under the bed": "bed",
  desk: "desk",
};

async function foundItems(ctx: SourceContext): Promise<FoundItem[]> {
  const phone = await readPhone(ctx);
  return phone.foundItems.map((f) => ({
    id: f.id,
    ref: f.reference,
    name: f.description.split(",")[0]?.trim() || f.description,
    description: f.description,
    room: f.roomLabel ?? "",
    spot: SPOT_BY_PHRASE[f.foundSpot ?? ""] ?? "bedside",
    // The phone shows the capture placeholder of a small item; no photo is uploaded from it yet.
    photo: "foundPhoneCharger",
    holder: firstName(f.custodianName ?? phone.supervisor?.name),
  }));
}

// ── Reporting a problem ────────────────────────────────────────────────────────────────────────────

async function reportPlaces(ctx: SourceContext): Promise<ReportPlace[]> {
  const [board, phone] = await Promise.all([readBoard(ctx), readPhone(ctx)]);
  const userId = me(ctx);
  const rooms = board.tasks
    .filter((t) => t.assignedToUserId === userId && OPEN.has(t.status) && kindOf(t) && t.roomLabel)
    .map((t) => t.roomLabel as string);
  return [
    ...[...new Set(rooms)].map((label) => ({ id: label, label, isRoom: true })),
    ...phone.places.map((p) => ({ id: p.name, label: p.name, isRoom: false })),
  ];
}

/** The API's maintenance categories, as the phone's category buttons (staff.problemCategories). */
const CATEGORY: Record<string, string> = {
  plumbing: "plumbing",
  electrical: "electrical",
  hvac: "ac",
  furniture: "furniture",
  safety: "safety",
};
const URGENCY: Record<ApiWorkOrder["priority"], string> = {
  urgent: "urgent",
  high: "today",
  normal: "low",
  low: "low",
};

async function problemReports(ctx: SourceContext): Promise<ProblemReport[]> {
  const list = await readWorkOrders(ctx);
  const name = ctx.account?.user.name ?? null;
  const open = list.workOrders.filter(
    (o) => o.raisedByName === name && !["resolved", "closed", "cancelled"].includes(o.status),
  );
  return open.map((o) => {
    const photo = o.photos.map((p) => ({ image: stockOf(p.key), caption: p.caption })).find((p) => p.image);
    const manager = o.block?.decidedByName ?? null;
    return {
      id: o.reference,
      ticket: o.reference,
      place: o.roomLabel ?? o.spaceName ?? o.assetName ?? "",
      category: CATEGORY[o.category ?? ""] ?? "other",
      urgency: URGENCY[o.priority],
      photos: o.photos.length,
      photo: photo?.image ?? "leakUnderBasin",
      photoCaption: photo ? `${photo.caption} · taken ${clock(o.raisedAt)}` : "",
      description: o.description ?? o.title,
      askBlock: Boolean(o.block),
      takenAt: clock(o.raisedAt),
      sentAt: clock(o.raisedAt),
      assignee: o.assignedToName ?? o.assignedContractor ?? "Maintenance",
      assigneeFirst: firstName(o.assignedToName ?? o.assignedContractor ?? "Maintenance"),
      manager: manager ?? "the manager",
      managerFirst: manager ? firstName(manager) : "the manager",
    };
  });
}

// ── Inspection ─────────────────────────────────────────────────────────────────────────────────────

/**
 * A room waiting for inspection, with the clean it follows: the task's own type ("checkout clean", "deep clean")
 * or "re-clean" for one reopened after a failed inspection. The prototype printed "checkout clean" for every room.
 */
async function inspectionRooms(ctx: SourceContext): Promise<(InspectionRoom & { task: string })[]> {
  const [board, phone] = await Promise.all([readBoard(ctx), readPhone(ctx)]);
  const now = ctx.now;
  const cleaning = phone.checklist.filter((i) => i.kind === "cleaning");
  return board.tasks
    .filter(
      (t) => t.status === "done" && (INSPECTABLE.has(t.taskType) || Boolean(t.reopenedFromTaskId)) && t.completedAt,
    )
    .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)))
    .map((t) => {
      const room = board.rooms.find((r) => r.id === t.roomId);
      const checks = phone.checks.filter((c) => c.taskId === t.id);
      const ticked = new Set(checks.filter((c) => c.result === "done").map((c) => c.itemId));
      const skipped = ticked.size ? cleaning.filter((i) => !ticked.has(i.id)) : [];
      const arrival = room?.arrival?.checkInTime?.slice(0, 5) ?? null;
      const arrivalAt = arrival ? new Date(`${ctx.today.iso}T${arrival}:00+02:00`) : null;
      const results: Record<string, "pass" | "fail"> = {};
      for (const c of checks) if (c.result !== "done") results[c.itemId] = c.result;
      const first = firstName(t.assignedToName);
      return {
        id: t.id,
        no: t.roomLabel ?? "",
        cleanedBy: t.assignedToName ?? "",
        cleanedByFirst: first,
        initials: initialsOf(t.assignedToName),
        type: room?.roomTypeName ?? "",
        cleaned: `Cleaned ${clock(t.completedAt)}`,
        task: t.reopenedFromTaskId ? "re-clean" : t.taskType === "deep_clean" ? "deep clean" : "checkout clean",
        wait: duration(minutesBetween(t.completedAt as string, now)),
        arrival: arrival ? `Arrival ${arrival}` : "No arrival today",
        late: arrivalAt !== null && minutesBetween(now, arrivalAt) < 120,
        skip: skipped.length
          ? `${first} marked it clean with ${skipped.length} check${skipped.length === 1 ? "" : "s"} skipped: ${skipped
              .map((i) => i.label.toLowerCase())
              .join(", ")}.`
          : null,
        results,
        photos: checks.filter((c) => c.result === "fail" && c.photoObjectKey).map((c) => c.itemId),
        outcome: null,
        note: "",
      };
    });
}

async function inspectionChecks(ctx: SourceContext): Promise<InspectionCheck[]> {
  const phone = await readPhone(ctx);
  // No photo is uploaded from the phone yet, so a failed check shows the placeholder tile.
  return phone.checklist.filter((i) => i.kind === "inspection").map((i) => ({ id: i.id, label: i.label, photo: null }));
}

// ── The technician's work orders ───────────────────────────────────────────────────────────────────

const ICON: Record<string, string> = {
  plumbing: "Droplet",
  electrical: "Thunderbolt",
  hvac: "Snowflake",
  appliance: "Wrench",
  furniture: "Wrench",
  it_tech: "Display",
  safety: "ShieldExclamation",
};
const PART: Record<ApiWorkOrder["parts"][number]["state"], { chip: string; tone: StaffTone }> = {
  requested: { chip: "Requested", tone: "warning" },
  ordered: { chip: "On order", tone: "warning" },
  issued: { chip: "Issued", tone: "default" },
  contractor: { chip: "Contractor", tone: "default" },
};
const FINISHED = new Set(["resolved", "closed", "cancelled"]);

function planned(o: ApiWorkOrder): boolean {
  return Boolean(o.scheduledFor) || o.raisedVia === "planned schedule";
}

function statusOf(o: ApiWorkOrder): WorkOrder["status"] {
  if (o.status === "in_progress") return "progress";
  if (o.parts.some((p) => p.state === "requested" || p.state === "ordered")) return "parts";
  if (planned(o)) return "planned";
  return "new";
}

function priorityOf(o: ApiWorkOrder): WorkOrder["priority"] {
  if (o.priority === "urgent") return "Urgent";
  if (o.priority === "high") return "High";
  return planned(o) && o.priority === "low" ? "Planned" : "Normal";
}

function blockOf(o: ApiWorkOrder): WorkOrderBlock | null {
  const b = o.block;
  if (!b || !o.roomId) return null;
  if (b.status === "requested")
    return {
      tone: "warning",
      title: "Out-of-order request waiting",
      text: `${b.requestedByName ?? "Someone"} asked to block room ${o.roomLabel}. It stays on sale until a manager approves.`,
      chip: "Still on sale",
      keep: "The request stays with the manager to decide.",
    };
  if (b.status === "active") {
    const until = b.endsAt ? dayLabel(kigaliDate(b.endsAt)) : null;
    const moved = b.affectedReservations
      ? // Counted, not moved: deciding a block moves no booking.
        ` ${b.affectedReservations} booking${b.affectedReservations === 1 ? " is" : "s are"} still on this room during the block.`
      : "";
    return {
      tone: "danger",
      title: until ? `Out of order until ${until}` : "Out of order",
      text: `Approved by ${b.decidedByName ?? "a manager"}${
        b.decidedAt ? ` on ${dayMonth(b.decidedAt)}, ${clock(b.decidedAt)}` : ""
      }.${moved}`,
      chip: "Not sellable",
      keep: until ? `The block stays until ${until}, as approved.` : "The block stays until a manager releases it.",
    };
  }
  return null;
}

function presentOrder(o: ApiWorkOrder, logs: ApiTimeLog[], ctx: SourceContext, now: Date): WorkOrder {
  const userId = me(ctx);
  const today = ctx.today.iso;
  const mineLogs = logs.filter((l) => l.ticketId === o.id).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const running = mineLogs.find((l) => !l.endedAt && l.userId === userId);
  const closed = mineLogs.filter((l) => l.endedAt);
  const total = mineLogs.reduce((a, l) => a + minutesBetween(l.startedAt, l.endedAt ?? now), 0);
  const parts: WorkOrderPart[] = o.parts.map((p) => ({
    name: p.name,
    qty: p.unit ? `${p.quantity} ${p.unit}` : `× ${p.quantity}`,
    meta: p.source,
    chip: PART[p.state].chip,
    tone: PART[p.state].tone,
  }));
  const fixed = [...o.events].reverse().find((e) => e.kind === "fixed");
  return {
    id: o.id,
    ref: o.reference,
    where: o.roomId ? `Room ${o.roomLabel ?? ""}` : (o.spaceName ?? o.assetName ?? ""),
    what: o.title,
    icon: ICON[o.category ?? ""] ?? "Wrench",
    priority: priorityOf(o),
    status: statusOf(o),
    age: age(o.raisedAt, now),
    opened:
      planned(o) && !o.raisedByName
        ? `Created by schedule on ${dayMonth(o.raisedAt)}`
        : `Opened ${whenSaid(o.raisedAt, today)}`,
    from: o.raisedByName
      ? [o.raisedByName, o.raisedVia].filter(Boolean).join(", ")
      : (o.raisedVia ?? "maintenance plan"),
    photos: o.photos.flatMap((p) => {
      const image = stockOf(p.key);
      return image ? [{ caption: p.caption, image }] : [];
    }),
    block: blockOf(o),
    recommendation: null,
    parts,
    log: closed.map((l) => ({
      what: l.kind === "diagnosis" ? "Diagnosis" : "Repair",
      when: `${kigaliDate(l.startedAt) === today ? "Today" : dayLabel(kigaliDate(l.startedAt))} · ${clock(l.startedAt)} – ${clock(
        l.endedAt,
      )}`,
      dur: duration(minutesBetween(l.startedAt, l.endedAt as string)),
    })),
    repair: running
      ? { start: clock(running.startedAt), stopped: "", dur: duration(minutesBetween(running.startedAt, now)) }
      : null,
    timeTotal: mineLogs.length ? `${duration(total)} total` : null,
    notes: o.events
      .filter((e) => (e.kind === "note" || e.kind === "reported") && e.note)
      .map((e) => ({
        initials: initialsOf(e.actorName),
        who: e.actorName && e.actorName === ctx.account?.user.name ? "You" : (e.actorName ?? "Someone"),
        when:
          kigaliDate(e.occurredAt) === today
            ? clock(e.occurredAt)
            : `${dayLabel(kigaliDate(e.occurredAt))} ${clock(e.occurredAt)}`,
        text: e.note as string,
      })),
    fix: fixed?.note ?? "",
  };
}

const RANK: Record<WorkOrder["priority"], number> = { Urgent: 0, High: 1, Normal: 2, Planned: 3 };

async function workOrders(ctx: SourceContext): Promise<WorkOrder[]> {
  const [list, { logs }] = await Promise.all([readWorkOrders(ctx), readTimeLogs(ctx)]);
  const userId = me(ctx);
  const now = ctx.now;
  return list.workOrders
    .filter((o) => !FINISHED.has(o.status))
    .filter((o) => o.assignedToUserId === userId || (!o.assignedToUserId && !o.assignedContractor))
    .map((o) => presentOrder(o, logs, ctx, now))
    .sort((a, b) => RANK[a.priority] - RANK[b.priority]);
}

// ── Schedule, leave and requests (the caller's own file) ───────────────────────────────────────────

/**
 * The phone's header of the person: their number, business and branch from their own file, and
 * today's shift from their roster. Their photo and floor are not recorded on the file.
 */
async function profile(ctx: SourceContext, id: string): Promise<StaffProfile> {
  const today = ctx.today.iso;
  const [file, roster] = await Promise.all([
    myFile(ctx),
    mine<{ entries: ApiRosterEntry[] }>(ctx, "roster", `/roster?from=${today}&to=${addDays(today, 6)}`),
  ]);
  const entry = roster.entries.find((e) => e.workDate === today && e.status !== "cancelled");
  return {
    id,
    staffNo: file.employeeNumber ?? "",
    since: "",
    workplace: file.businessName ?? "",
    site: (file.branchName ?? "").split(" ")[0] ?? "",
    department: file.jobPositionTitle ?? "",
    area: "",
    shift: entry ? `${entry.shiftName ?? "Shift"} · ${clock(entry.startsAt)}–${clock(entry.endsAt)}` : "No shift today",
    clockedInAt: file.openRecord ? clock(file.openRecord.clockInAt) : "",
    photo: null,
  };
}

async function shifts(ctx: SourceContext): Promise<Shift[]> {
  const today = ctx.today.iso;
  // Two weeks: the schedule shows this week and next.
  const to = addDays(today, 13);
  const [file, roster, requests] = await Promise.all([
    myFile(ctx),
    mine<{ entries: ApiRosterEntry[] }>(ctx, "roster", `/roster?from=${today}&to=${to}`),
    mine<{ mine: ApiShiftRequest[] }>(ctx, "shift-requests", "/shift-requests"),
  ]);
  const pending = requests.mine.filter((r) => r.status === "requested" || r.status === "awaiting_colleague");
  return Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, i);
    const entry = roster.entries.find((e) => e.workDate === date && e.status !== "cancelled");
    const isToday = date === today;
    const clockedIn = isToday && file.openRecord ? ` · clocked in ${clock(file.openRecord.clockInAt)}` : "";
    const swap = pending.find((r) => r.swapWith && r.fromDate <= date && date <= r.toDate);
    const change = pending.find((r) => r.kind === "change" && r.fromDate <= date && date <= r.toDate);
    return {
      id: date,
      week: i >= 7 ? 1 : 0,
      changePending: Boolean(change),
      dow: DOW[new Date(`${date}T12:00:00Z`).getUTCDay()] as string,
      date: String(Number(date.slice(8, 10))),
      long: dayLabel(date),
      time: entry ? `${clock(entry.startsAt)} – ${clock(entry.endsAt)}` : null,
      area: entry ? `${entry.shiftName ?? "Shift"}${clockedIn}` : null,
      isToday,
      isOff: !entry,
      swapPendingWith: swap ? firstName(swap.swapWith?.displayName) : null,
    };
  });
}

const SHIFT_STATUS: Record<ShiftRequestStatus, RequestStatus> = {
  awaiting_colleague: "colleague",
  requested: "manager",
  approved: "approved",
  rejected: "declined",
  cancelled: "cancelled",
};
const LEAVE_STATUS: Record<ApiLeaveRequest["status"], RequestStatus> = {
  requested: "manager",
  approved: "approved",
  rejected: "declined",
  cancelled: "cancelled",
};

/** "Thu 29 – Sat 31 Oct · 3 days". */
function leaveTitle(r: ApiLeaveRequest): string {
  const days = `${r.days} ${r.days === 1 ? "day" : "days"}`;
  if (r.startsOn === r.endsOn) return `${dayLabel(r.startsOn)} · ${days}`;
  const sameMonth = r.startsOn.slice(0, 7) === r.endsOn.slice(0, 7);
  const start = sameMonth
    ? `${DOW[new Date(`${r.startsOn}T12:00:00Z`).getUTCDay()]} ${Number(r.startsOn.slice(8, 10))}`
    : dayLabel(r.startsOn);
  return `${start} – ${dayLabel(r.endsOn)} · ${days}`;
}

function leaveSteps(r: ApiLeaveRequest): string {
  const decided = r.approvals
    .filter((a) => a.decision === "approved" || a.decision === "rejected")
    .map((a) => `${firstName(a.decidedByName)} on ${dayMonth(a.decidedAt)}`);
  if (r.status === "requested") {
    const next = r.routedToName ? `${firstName(r.routedToName)} to decide` : "Waiting for a decision";
    return [...decided, next].join(" · ");
  }
  // A note means the office cancelled it, and says why; the person's own cancelling carries none.
  if (r.status === "cancelled")
    return r.decisionNote ? `Cancelled by HR: ${r.decisionNote}` : "You cancelled this request";
  if (r.status === "rejected")
    return r.decisionNote ? `Declined: ${r.decisionNote}` : decided.join(" · ") || "Declined";
  return decided.length ? `Approved · ${decided.join(" · ")}` : "Approved";
}

function shiftSteps(r: ApiShiftRequest): string {
  const mate = firstName(r.swapWith?.displayName);
  if (r.status === "awaiting_colleague")
    return `Waiting for ${mate} · then ${firstName(r.routedTo?.displayName) || "your manager"} approves`;
  if (r.status === "requested")
    return [
      r.colleagueAcceptedAt && mate ? `${mate} said yes on ${dayMonth(r.colleagueAcceptedAt)}` : null,
      `${firstName(r.routedTo?.displayName) || "Your manager"} to approve`,
    ]
      .filter(Boolean)
      .join(" · ");
  if (r.status === "cancelled") return "You cancelled this request";
  if (r.status === "rejected") return r.decisionNote ? `Declined: ${r.decisionNote}` : "Declined";
  return r.decidedByName && r.decidedAt
    ? `Approved by ${firstName(r.decidedByName)} on ${dayMonth(r.decidedAt)}`
    : "Approved";
}

/**
 * Who a swap may be with: the active colleagues at the person's branch (GET .../shift-options), the
 * ones a swap request may name. Those in the person's own job come first. A colleague need not work
 * that day: approving a swap moves the shift to whoever does not have it.
 */
export async function swapColleagues(ctx: SourceContext): Promise<SwapColleague[]> {
  const [file, options] = await Promise.all([
    myFile(ctx),
    mine<{ colleagues: { employeeId: string; displayName: string; jobPositionTitle: string | null }[] }>(
      ctx,
      "shift-options",
      "/shift-options",
    ),
  ]);
  const own = file.jobPositionTitle ?? null;
  return [...options.colleagues]
    .sort(
      (a, b) =>
        Number(b.jobPositionTitle === own) - Number(a.jobPositionTitle === own) ||
        a.displayName.localeCompare(b.displayName),
    )
    .map((c) => ({
      id: c.employeeId,
      initials: initialsOf(c.displayName),
      name: c.displayName,
      first: firstName(c.displayName),
      note: c.jobPositionTitle ?? "Colleague",
      busy: false,
    }));
}

/** Whether the person has a PIN. Without one, nothing can be typed to prove it, so pay opens on their login. */
export async function hasOwnPin(ctx: SourceContext): Promise<boolean> {
  const state = await mine<{ hasPin: boolean }>(ctx, "kiosk-pin", "/kiosk-pin").catch(() => ({ hasPin: false }));
  return state.hasPin;
}

/** The HR features the person's business has switched off (`GET /me/work/:id/features`). */
export async function myFeaturesOff(ctx: SourceContext): Promise<HrFeatureId[]> {
  return (await mine<{ off: HrFeatureId[] }>(ctx, "features", "/features")).off;
}

/** "Rotation A · Mornings, then nights" reads "Mornings, then nights" to staff. */
const rotationLabel = (name: string) => name.replace(/^Rotation [A-Za-z0-9]+ · /, "");

/**
 * What a person may ask for on their schedule (GET .../shift-options), and what came of the swaps they
 * answered. Read by the phone's schedule and by Me.
 */
export async function shiftChoices(ctx: SourceContext): Promise<ShiftChoices> {
  const [options, list] = await Promise.all([
    mine<{
      shifts?: { id: string; name: string; startsAt: string; endsAt: string; status?: string }[];
      rotations?: { id: string; name: string; stepNames: string[] }[];
      currentRotation?: { name: string; startsOn: string } | null;
    }>(ctx, "shift-options", "/shift-options"),
    mine<{ answered?: ApiShiftRequest[] }>(ctx, "shift-requests", "/shift-requests"),
  ]);
  return {
    shifts: (options.shifts ?? [])
      .filter((s) => (s.status ?? "active") === "active")
      .map((s) => ({ id: s.id, name: s.name, hours: `${s.startsAt.slice(0, 5)}–${s.endsAt.slice(0, 5)}` })),
    rotations: (options.rotations ?? []).map((r) => ({ id: r.id, name: rotationLabel(r.name), steps: r.stepNames })),
    current: options.currentRotation
      ? { name: rotationLabel(options.currentRotation.name), since: dayLabel(options.currentRotation.startsOn) }
      : null,
    answered: (list.answered ?? []).map((r) => ({
      id: r.id,
      from: r.employee?.displayName ?? "A colleague",
      when: r.fromDate === r.toDate ? dayLabel(r.fromDate) : `${dayLabel(r.fromDate)} – ${dayLabel(r.toDate)}`,
      status: r.status === "approved" ? "approved" : r.status === "rejected" ? "declined" : "waiting",
      note: r.decisionNote ?? "",
    })),
  };
}

/** Swaps colleagues asked of the person, waiting for their yes or no. */
export async function swapAsks(ctx: SourceContext): Promise<SwapAsk[]> {
  const { askedOfMe } = await mine<{ askedOfMe: ApiShiftRequest[] }>(ctx, "shift-requests", "/shift-requests");
  // A day that has passed cannot be swapped any more, so it is not asked of anyone.
  return askedOfMe
    .filter((r) => r.status === "awaiting_colleague" && r.toDate >= ctx.today.iso)
    .map((r) => ({
      id: r.id,
      from: r.employee?.displayName ?? "A colleague",
      first: firstName(r.employee?.displayName) || "A colleague",
      initials: initialsOf(r.employee?.displayName),
      when: r.fromDate === r.toDate ? dayLabel(r.fromDate) : `${dayLabel(r.fromDate)} – ${dayLabel(r.toDate)}`,
      note: r.reason ?? "",
    }));
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
interface ApiExtraDays {
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
/** A clock correction the person asked for. */
interface ApiClockFix {
  id: string;
  workDate: string;
  clockInAt: string;
  clockOutAt: string;
  reason: string;
  status: "requested" | "approved" | "rejected" | "cancelled";
  routedTo: { displayName: string } | null;
  decidedByName?: string | null;
  decisionNote?: string | null;
  createdAt: string;
}

/** The answer to a request in a line: who decided, and what they said. */
const decidedLine = (r: { decidedByName?: string | null; decisionNote?: string | null }) =>
  [r.decidedByName ? `Decided by ${r.decidedByName}` : null, r.decisionNote].filter(Boolean).join(": ");

const monthOf = (period: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(`${period}-01T12:00:00Z`));
const rwfText = (n: number) => `RWF ${n.toLocaleString("en-US")}`;

/** Money the person asked to be paid back, newest first, with the office's answer. */
/** The person's questions to HR or IT, newest first. */
async function helpTickets(ctx: SourceContext): Promise<HelpTicket[]> {
  const { tickets } = await mine<{ tickets: ApiTicket[] }>(ctx, "tickets", "/tickets");
  return tickets.map((t) => {
    const state = ticketState(t);
    const last = t.messages.at(-1);
    const answer = [...t.messages].reverse().find((m) => !m.fromStaff);
    return {
      id: t.id,
      title: t.subject,
      meta: `${t.reference} · ${
        last && !last.fromStaff
          ? `${last.authorName ?? "HR"} answered ${agoOf(last.createdAt)}`
          : `asked ${agoOf(t.createdAt)}`
      }`,
      chip: t.status === "closed" ? "Resolved" : t.status === "answered" ? "Answered" : "Open",
      tone: state.tone,
      answer: answer?.body ?? null,
    };
  });
}

/** What HR posted that is for the person, newest first. */
export async function myAnnouncements(ctx: SourceContext): Promise<StaffAnnouncement[]> {
  const { announcements } = await mine<{ announcements: ApiMyAnnouncement[] }>(ctx, "announcements", "/announcements");
  return announcements.map(announcementWords);
}

/** The person's own reviews, the latest cycle first. */
export async function myReviews(ctx: SourceContext): Promise<StaffOwnReview[]> {
  const { reviews } = await mine<{ reviews: ApiMyReview[] }>(ctx, "reviews", "/reviews");
  return reviews.map(reviewWords);
}

/** What the person has signed out and not brought back, then what came back lately. */
async function loanedAssets(ctx: SourceContext): Promise<LoanedAsset[]> {
  const { loans } = await mine<{ loans: ApiLoan[] }>(ctx, "loans", "/assets");
  const today = ctx.today.iso;
  return loans
    .filter((l) => !l.returnedOn || l.returnedOn >= addDays(today, -30))
    .map((l) => {
      const state = loanState(l, today);
      const outcome = loanOutcome(l);
      return {
        id: l.id,
        icon: ASSET[l.kind].icon,
        name: l.name,
        meta: [`Since ${dayMonth(l.issuedOn)}`, l.tag].filter(Boolean).join(" · "),
        chip:
          outcome === "lost"
            ? "Lost"
            : outcome === "damaged"
              ? "Back damaged"
              : outcome === "good"
                ? "Returned"
                : state.due
                  ? "Return now"
                  : l.dueBackOn
                    ? `Back by ${dayMonth(l.dueBackOn)}`
                    : "With you",
        tone:
          outcome === "good" ? "success" : outcome === "lost" ? "danger" : outcome || state.due ? "warning" : "default",
      };
    });
}

/** The person's confirmed payslips (`GET /me/work/:id/payslips`), newest first, each with its PDF. */
async function payslips(ctx: SourceContext): Promise<Payslip[]> {
  const { employeeId } = await myFile(ctx);
  const { payslips: rows } = await mine<{
    payslips: { id: string; period: string; grossRwf: number; netRwf: number; paidAt: string | null }[];
  }>(ctx, "payslips", "/payslips");
  return [...rows]
    .sort((a, b) => b.period.localeCompare(a.period))
    .map((p) => ({
      id: p.id,
      month: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(`${p.period}-01T12:00:00Z`),
      ),
      status: "available" as const,
      note: null,
      net: p.netRwf,
      paid: p.paidAt ? dayMonth(p.paidAt) : null,
      ref: null,
      confirmed: null,
      confirmedBy: null,
      employer: "",
      rules: "",
      payTo: "",
      lines: [
        { label: "Gross pay", amount: p.grossRwf, kind: "earning" as const },
        { label: "Tax and RSSB", amount: p.grossRwf - p.netRwf, kind: "deduction" as const },
        { label: "Take-home", amount: p.netRwf, kind: "total" as const },
      ],
      pdfHref: `/me/payslip/${p.id}?file=${employeeId}`,
    }));
}

/** The person's own loans and advances (`GET /me/work/:id/loans`), still being repaid first. Read only. */
export async function myLoans(ctx: SourceContext): Promise<StaffLoan[]> {
  const { loans } = await mine<{
    loans: {
      id: string;
      kind: "loan" | "advance";
      amountRwf: number;
      remainingRwf: number;
      settledAt: string | null;
      schedule: { period: string; amountRwf: number; paid: boolean }[];
    }[];
  }>(ctx, "pay-loans", "/loans");
  return [...loans]
    .sort((a, b) => Number(a.settledAt !== null) - Number(b.settledAt !== null))
    .map((l) => {
      const next = l.schedule.filter((s) => !s.paid).sort((a, b) => a.period.localeCompare(b.period))[0];
      const repaid = l.settledAt !== null || !next;
      return {
        id: l.id,
        title: `${rwfText(l.amountRwf)} · ${l.kind === "advance" ? "Salary advance" : "Staff loan"}`,
        meta: repaid
          ? "All repaid"
          : `${rwfText(l.remainingRwf)} left · ${rwfText(next.amountRwf)} from your ${monthOf(next.period)} pay`,
        chip: repaid ? "Repaid" : "Repaying",
        tone: repaid ? ("success" as const) : ("default" as const),
      };
    });
}

async function claims(ctx: SourceContext): Promise<StaffClaim[]> {
  const { claims: rows } = await mine<{ claims: ApiClaim[] }>(ctx, "claims", "/claims");
  return [...rows]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .map((c) => {
      const what =
        c.kind === "reimbursement"
          ? `${c.amountRwf !== null ? rwfText(c.amountRwf) : "An amount"} · ${c.reason}`
          : `${c.days ?? ""} days of ${c.leaveType?.name ?? "leave"} paid out`;
      const answer: Record<ApiClaim["status"], { meta: string; chip: string; tone: StaffTone }> = {
        requested: {
          meta: `Waiting for approval${c.hasReceipt ? " · receipt attached" : ""}`,
          chip: "Waiting",
          tone: "warning",
        },
        approved: { meta: `Approved · paid with your ${monthOf(c.period)} pay`, chip: "Approved", tone: "success" },
        rejected: { meta: c.decisionNote ? `Refused: ${c.decisionNote}` : "Refused", chip: "Refused", tone: "danger" },
        cancelled: { meta: "You took it back", chip: "Taken back", tone: "default" },
      };
      return { id: c.id, title: what, ...answer[c.status], canCancel: c.status === "requested" };
    });
}

async function requests(ctx: SourceContext): Promise<StaffRequest[]> {
  const today = ctx.today.iso;
  const [shiftList, leave, extra, fixes] = await Promise.all([
    mine<{ mine: ApiShiftRequest[] }>(ctx, "shift-requests", "/shift-requests"),
    mine<{ requests: ApiLeaveRequest[] }>(ctx, "leave-requests", "/leave/requests"),
    mine<{ requests: ApiExtraDays[] }>(ctx, "extra-days", "/leave/allocation-requests"),
    // The API serves at most 31 days at a time.
    mine<{ requests: ApiClockFix[] }>(
      ctx,
      "clock-fixes",
      `/attendance/requests?from=${addDays(today, -30)}&to=${today}`,
    ),
  ]);
  const rows: (StaffRequest & { at: string })[] = [
    ...shiftList.mine.map((r) => ({
      id: `shift:${r.id}`,
      shift: r.fromDate,
      type: r.kind === "swap" ? "Shift swap" : r.kind === "rotation" ? "Rotation" : "Shift change",
      icon: "ArrowRightArrowLeft",
      title: r.fromDate === r.toDate ? dayLabel(r.fromDate) : `${dayLabel(r.fromDate)} – ${dayLabel(r.toDate)}`,
      sub: r.swapWith
        ? `With ${r.swapWith.displayName}`
        : r.rotation
          ? rotationLabel(r.rotation.name)
          : r.shiftTemplate
            ? r.shiftTemplate.name
            : (r.reason ?? "No note"),
      status: SHIFT_STATUS[r.status],
      steps: shiftSteps(r),
      days: 0,
      at: r.createdAt,
    })),
    ...leave.requests.map((r) => ({
      id: `leave:${r.id}`,
      shift: null,
      type: r.leaveType.name,
      icon: "Suitcase",
      title: leaveTitle(r),
      sub: r.reason ?? "No note",
      status: LEAVE_STATUS[r.status],
      steps: leaveSteps(r),
      days: r.days,
      at: r.createdAt,
    })),
    // Extra days asked for count against nothing until they are approved, so `days` stays 0.
    ...extra.requests.map((r) => ({
      id: `extra:${r.id}`,
      shift: null,
      type: r.kind === "extra" ? "Extra days" : "Day in lieu",
      icon: "Plus",
      title: `${r.days} more day${r.days === 1 ? "" : "s"} of ${r.leaveType.name}`,
      sub: r.reason,
      status: LEAVE_STATUS[r.status],
      steps: r.status === "requested" ? `With ${r.routedTo?.displayName ?? "your manager"}` : decidedLine(r),
      days: 0,
      at: r.createdAt,
    })),
    ...fixes.requests.map((r) => ({
      id: `fix:${r.id}`,
      shift: null,
      type: "Clock correction",
      icon: "Clock",
      title: `${dayLabel(r.workDate)} · ${clock(r.clockInAt)} – ${clock(r.clockOutAt)}`,
      sub: r.reason,
      status: LEAVE_STATUS[r.status],
      steps: r.status === "requested" ? `With ${r.routedTo?.displayName ?? "your manager"}` : decidedLine(r),
      days: 0,
      at: r.createdAt,
    })),
  ];
  return rows.sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _at, ...r }) => r);
}

async function leaveTypes(ctx: SourceContext): Promise<LeaveType[]> {
  const { types } = await mine<{ types: ApiLeaveType[] }>(ctx, "leave-types", "/leave/types");
  return [...types]
    .sort((a, b) => Number(b.code === "annual") - Number(a.code === "annual"))
    .map((t) => {
      const usesBalance = t.code === "annual";
      const label = t.name.replace(/ leave$/i, "");
      const hint = usesBalance
        ? "Uses your annual leave balance."
        : t.payment === "unpaid"
          ? "Does not use your balance. Your pay for those days is reduced."
          : t.needsAttachment
            ? "Needs a supporting document, which the phone cannot add yet. Ask HR to put it on your file."
            : `Does not use your annual leave balance. ${t.approvalSteps === 1 ? "One approval." : `${t.approvalSteps} approvals.`}`;
      return { id: t.id, label, hint, usesBalance };
    });
}

async function leaveBalances(ctx: SourceContext): Promise<LeaveBalance[]> {
  const year = ctx.today.iso.slice(0, 4);
  const [{ balances }, leave, holiday] = await Promise.all([
    mine<{ balances: ApiBalance[] }>(ctx, "leave-balances", "/leave/balances"),
    mine<{ requests: ApiLeaveRequest[] }>(ctx, "leave-requests", "/leave/requests"),
    mine<{ holiday: { date: string; name: string } | null }>(ctx, "next-holiday", "/holidays/next"),
  ]);
  const annual = balances.find((b) => b.leaveType.code === "annual");
  const sick = balances.find((b) => b.leaveType.code === "sick");
  const takenThisYear = (b: ApiBalance | undefined) =>
    (b?.entries ?? [])
      .filter((e) => e.effectiveOn.startsWith(year) && (e.kind === "taken" || e.kind === "reversal"))
      .reduce((a, e) => a - e.days, 0);
  const entitlement = annual?.leaveType.yearlyEntitlementDays ?? 0;
  const waiting = leave.requests.find((r) => r.status === "requested" && r.leaveType.code === "annual");
  return [
    {
      id: ctx.persona?.id ?? "me",
      // Whole days: what is left rounded down, what was used to the nearest day.
      left: Math.floor(annual?.balanceDays ?? 0),
      used: Math.round(takenThisYear(annual)),
      entitlement,
      accrual: annual?.leaveType.accrual === "monthly" ? Math.round((entitlement / 12) * 10) / 10 : 0,
      carryOver: annual?.leaveType.carryMaxDays ?? 0,
      carryYear: Number(year) + 1,
      sickUsed: takenThisYear(sick),
      nextHoliday: holiday.holiday ? `${dayLabel(holiday.holiday.date)} · ${holiday.holiday.name}` : "Not recorded yet",
      rules: `Leave rules ${year}`,
      waitingFor: firstName(waiting?.routedToName) || "nobody",
    },
  ];
}

async function leaveApprovers(ctx: SourceContext): Promise<LeaveApprover[]> {
  const { steps } = await mine<{ steps: ApiApprovalStep[] }>(ctx, "leave-approvers", "/leave/approvers");
  return steps.map((s) => ({
    id: `${s.order}-${s.role}`,
    order: s.order,
    initials: initialsOf(s.name),
    name: s.name,
    role: s.role === "line_manager" ? "Your line manager" : `${s.jobTitle ?? "Office"} · checks your balance`,
    tone: s.order === 1 ? "success" : "default",
  }));
}

function documentIcon(title: string, kind: ApiMyDocument["kind"]): string {
  if (kind === "contract") return "FileText";
  if (/\bID\b|passport/i.test(title)) return "Passport";
  if (/RSSB|insurance/i.test(title)) return "ShieldCheck";
  if (/certificate|training/i.test(title)) return "GraduationCap";
  return "FileText";
}

async function documents(ctx: SourceContext): Promise<StaffDocument[]> {
  const { documents: docs } = await mine<{ documents: ApiMyDocument[] }>(ctx, "papers", "/papers");
  return docs
    .filter((d) => d.kind === "document" || d.status === "active")
    .map((d) => {
      if (d.kind === "contract")
        return {
          id: d.id,
          icon: documentIcon(d.title, d.kind),
          name: d.title,
          meta: [d.startsOn ? `Since ${dayMonthYear(d.startsOn)}` : null, d.contractType].filter(Boolean).join(" · "),
          // An active contract; no signature is stored on it, so none is claimed.
          chip: "Active",
          tone: "default" as StaffTone,
        };
      const expired = !!d.expiresOn && d.expiresOn.slice(0, 10) < ctx.today.iso;
      const expires = d.expiresOn ? `${expired ? "Expired" : "Expires"} ${dayMonthYear(d.expiresOn)}` : null;
      const doc = { id: d.id, icon: documentIcon(d.title, d.kind), name: d.title };
      if (d.status === "approved")
        return {
          ...doc,
          meta: expires ?? (d.checkedAt ? `Checked by HR · ${dayMonthYear(d.checkedAt)}` : "On file"),
          chip: expired ? "Expired" : expires ? "Valid" : "Approved",
          tone: (expired ? "danger" : "success") as StaffTone,
        };
      if (d.status === "rejected")
        return {
          ...doc,
          meta: d.rejectReason ? `Sent back: ${d.rejectReason}` : "HR asked for it again",
          chip: "Sent back",
          tone: "danger" as StaffTone,
          canSend: true,
        };
      if (d.status === "requested")
        return {
          ...doc,
          meta: "HR asked for it · send a photo",
          chip: "Asked for",
          tone: "warning" as StaffTone,
          canSend: true,
        };
      return { ...doc, meta: expires ?? "Waiting for HR", chip: "With HR", tone: "warning" as StaffTone };
    });
}

export const sources = defineSources({
  "staff.rooms": { list: cleaningRooms, naturalKey: "no" },
  "staff.finishedRooms": { list: finishedRooms, naturalKey: "no" },
  "staff.checklistSections": { list: checklistSections, naturalKey: "id" },
  "staff.minibarItems": { list: minibarItems, naturalKey: "label" },
  "staff.foundItems": { list: foundItems, naturalKey: "ref" },
  "staff.reportPlaces": { list: reportPlaces, naturalKey: "label" },
  "staff.problemReports": { list: problemReports, naturalKey: "ticket" },
  "staff.shifts": { list: shifts, parity: "shape" },
  "staff.requests": { list: requests, parity: "shape" },
  "staff.swapColleagues": { list: swapColleagues, naturalKey: "name", parity: "shape" },
  "staff.swapAsks": { list: swapAsks, parity: "shape" },
  "staff.claims": { list: claims, parity: "shape" },
  "staff.payslips": { list: payslips, naturalKey: "id" },
  "staff.helpTickets": { list: helpTickets, naturalKey: "id" },
  "staff.assets": { list: loanedAssets, naturalKey: "id" },
  "staff.myProfile": {
    list: async (ctx) => [await profile(ctx, "me")],
    get: (ctx, id) => profile(ctx, id),
    naturalKey: "id",
  },
  "staff.leaveTypes": { list: leaveTypes, naturalKey: "label" },
  "staff.leaveBalances": { list: leaveBalances, naturalKey: "id" },
  "staff.leaveApprovers": { list: leaveApprovers, naturalKey: "name" },
  "staff.inspectionRooms": { list: inspectionRooms, naturalKey: "no" },
  "staff.inspectionChecks": { list: inspectionChecks, naturalKey: "label" },
  "staff.workOrders": { list: workOrders, naturalKey: "ref" },
  "staff.documents": { list: documents, naturalKey: "name" },
});
