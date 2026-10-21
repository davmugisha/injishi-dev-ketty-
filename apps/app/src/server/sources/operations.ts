/**
 * Live sources for the operations area: API responses presented as the operations fixture document types.
 *
 *   /housekeeping  GET /api/v1/ops/housekeeping/board   rooms, history, tasks, staff, escalations, rules
 *   /maintenance   GET /api/v1/ops/work-orders, /condition-signals
 *   /lost-found    GET /api/v1/ops/found-items
 *
 * The board is one read for six collections; it is fetched once per source context (a page render) and
 * forgotten by every mutation (`forgetOperations`), so a read after a write is never stale.
 */
import type {
  BlockState,
  CleaningTask,
  ConditionSignal,
  FoundItem,
  FoundItemStatus,
  HistoryEvent,
  HousekeepingEscalation,
  HousekeepingRoom,
  HousekeepingRule,
  HousekeepingStaff,
  RoomHistory,
  RoomStatus,
  Severity,
  SignalReview,
  TaskColumn,
  Tone,
  WorkOrder,
  WorkOrderPart,
  WorkOrderPhoto,
} from "@injishi/data/fixtures/operations";
import { type StockKey, stock } from "@injishi/data/media";
import type { Workspace } from "../auth";
import { clock, dayMonth, kigaliDate } from "../format";
import { defineSources, type SourceContext } from "./types";

// ── API shapes (as server/api answers; the app does not depend on @injishi/contracts) ─────────────

type HousekeepingStatus = "clean" | "dirty" | "inspected" | "out_of_order";
type TaskType = "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
type TaskStatus = "pending" | "in_progress" | "done" | "inspected" | "blocked" | "failed";

export interface ApiBoardRoom {
  id: string;
  label: string | null;
  floor: number | null;
  roomTypeName: string;
  status: "available" | "maintenance" | "out_of_service";
  housekeeping: HousekeepingStatus;
  housekeepingUpdatedAt: string | null;
  serviceFlag: "dnd" | "make_up_room" | null;
  occupiedBy: { stayId: string; guestName: string | null; plannedExitAt: string | null } | null;
  arrival: { guestName: string | null; bookingReference: string | null; checkInTime: string | null } | null;
  block: {
    id: string;
    status: "requested" | "active";
    workOrderId: string | null;
    workOrderReference: string | null;
    startsAt: string;
    endsAt: string | null;
  } | null;
}

export interface ApiBoardTask {
  id: string;
  roomId: string;
  roomLabel: string | null;
  taskType: TaskType;
  status: TaskStatus;
  reopenedFromTaskId: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  priority: number;
  note: string | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  ruleId: string | null;
  ruleName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  inspectedAt: string | null;
  inspectedByName: string | null;
  createdAt: string;
}

export interface ApiBoardStaff {
  id: string;
  userId: string;
  name: string;
  role: "attendant" | "supervisor";
  section: string;
  floors: number[];
  shiftStartsAt: string;
  shiftEndsAt: string;
}

export interface ApiBoardEscalation {
  id: string;
  taskId: string;
  kind: "not_started" | "awaiting_inspection";
  level: "supervisor" | "manager";
  escalatedToUserId: string | null;
  escalatedToName: string | null;
  raisedAt: string;
  remindedAt: string | null;
  remindedByName: string | null;
}

interface ApiBoardRule {
  id: string;
  code: "checkout" | "stayover" | "inspection" | "turndown" | "deep_clean";
  name: string;
  taskType: TaskType;
  description: string;
  estimatedMinutes: number | null;
  active: boolean;
}

interface ApiRoomEvent {
  id: string;
  roomId: string;
  kind: string;
  fromValue: string | null;
  toValue: string | null;
  summary: string;
  actorName: string | null;
  detail: string | null;
  occurredAt: string;
}

export interface ApiBoard {
  propertyId: string;
  propertyName: string;
  rooms: ApiBoardRoom[];
  tasks: ApiBoardTask[];
  staff: ApiBoardStaff[];
  escalations: ApiBoardEscalation[];
  rules: ApiBoardRule[];
  history: ApiRoomEvent[];
}

type Priority = "low" | "normal" | "high" | "urgent";

export interface ApiWorkOrder {
  id: string;
  reference: string;
  propertyId: string | null;
  roomId: string | null;
  roomLabel: string | null;
  roomTypeName: string | null;
  floor: number | null;
  spaceId: string | null;
  spaceName: string | null;
  assetId: string | null;
  assetName: string | null;
  title: string;
  description: string | null;
  category: string | null;
  priority: Priority;
  status: "open" | "assigned" | "in_progress" | "resolved" | "closed" | "cancelled";
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignedContractor: string | null;
  scheduledFor: string | null;
  raisedByName: string | null;
  raisedVia: string | null;
  raisedAt: string;
  impactNote: string | null;
  releaseNote: string | null;
  photos: { key: string; caption: string }[];
  parts: {
    id: string;
    name: string;
    quantity: number;
    unit: string | null;
    source: string;
    state: "requested" | "ordered" | "issued" | "contractor";
  }[];
  events: { id: string; kind: string; note: string | null; actorName: string | null; occurredAt: string }[];
  block: {
    id: string;
    status: "requested" | "active" | "declined" | "released";
    startsAt: string;
    endsAt: string | null;
    reason: string;
    requestedByName: string | null;
    requestedAt: string;
    decidedByName: string | null;
    decidedAt: string | null;
    decisionNote: string | null;
    releasedByName: string | null;
    releasedAt: string | null;
    affectedReservations: number;
  } | null;
  resolvedAt: string | null;
  verifiedAt: string | null;
}

export interface ApiWorkOrderList {
  workOrders: ApiWorkOrder[];
  assignees: { userId: string | null; name: string }[];
  suggestedAssignee: { userId: string | null; name: string } | null;
  medianHoursToClose: number | null;
}

export interface ApiSignal {
  id: string;
  ruleCode: string;
  ruleText: string;
  assetId: string | null;
  assetName: string;
  headline: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  dataQuality: string;
  recommendation: string;
  status: "open" | "actioned" | "dismissed";
  draft: { title: string; description: string; priority: Priority; location: string } | null;
  workOrderId: string | null;
  workOrderReference: string | null;
  raisedAt: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface ApiFoundItem {
  id: string;
  reference: string;
  propertyId: string;
  description: string;
  category: string;
  valuable: boolean;
  foundLocation: string;
  foundSpot: string | null;
  roomId: string | null;
  foundAt: string;
  foundByUserId: string | null;
  foundByName: string;
  custodianUserId: string | null;
  custodianName: string | null;
  storageLocation: string | null;
  status: "stored" | "claimed" | "returned" | "disposal_pending" | "disposed";
  retentionUntil: string;
  retentionNote: string | null;
  claim: {
    claimantName: string;
    bookingReference: string | null;
    statement: string;
    matched: boolean;
    matchNote: string;
    openedAt: string;
    openedByName: string | null;
  } | null;
  release: { method: string; releasedAt: string; releasedByName: string | null } | null;
  disposal: {
    note: string;
    rule: string;
    proposedByName: string | null;
    proposedAt: string;
    approvedByName: string | null;
    approvedAt: string | null;
  } | null;
  closedNote: string | null;
  events: {
    id: string;
    kind: string;
    summary: string;
    actorName: string | null;
    detail: string | null;
    occurredAt: string;
  }[];
}

export interface ApiFoundItemList {
  items: ApiFoundItem[];
  people: { userId: string; name: string }[];
  retentionRule: string;
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

/** Drop what this context read, so the next read sees a write. Every operations mutation calls it. */
export function forgetOperations(ctx: SourceContext): void {
  memo.delete(ctx);
}

/**
 * The place an operations screen is about, for its eyebrow: the one branch the person covers, else their
 * business, as the API names them. Never a prototype hotel's name.
 */
export function placeName(ctx: SourceContext): string {
  let ws: Workspace;
  try {
    ws = ctx.ops().workspace;
  } catch {
    return "Your business";
  }
  const branches = (ws.branches ?? []) as { name?: string }[];
  if (branches.length === 1 && branches[0]?.name) return branches[0].name;
  return ws.orgName?.trim() || ws.label;
}

export const readBoard = (ctx: SourceContext) =>
  once(ctx, "board", () => ctx.ops().get<ApiBoard>("/api/v1/ops/housekeeping/board"));
export const readWorkOrders = (ctx: SourceContext) =>
  once(ctx, "work-orders", () => ctx.ops().get<ApiWorkOrderList>("/api/v1/ops/work-orders"));
export const readSignals = (ctx: SourceContext) =>
  once(ctx, "signals", () => ctx.ops().get<{ signals: ApiSignal[] }>("/api/v1/ops/condition-signals"));
export const readFoundItems = (ctx: SourceContext) =>
  once(ctx, "found-items", () => ctx.ops().get<ApiFoundItemList>("/api/v1/ops/found-items"));

// ── Shared wording ─────────────────────────────────────────────────────────────────────────────────

const TASK_KIND: Record<TaskType, CleaningTask["kind"] | null> = {
  checkout_clean: "Checkout",
  stayover_clean: "Stayover",
  deep_clean: "Deep clean",
  turndown: "Turndown",
  // The board models inspection as its own column, not as a card.
  inspection: null,
};
const USUAL_MINUTES: Record<CleaningTask["kind"], number> = {
  Checkout: 45,
  Stayover: 20,
  "Deep clean": 90,
  Turndown: 15,
  "Re-clean": 25,
};
const RULE_ICON: Record<ApiBoardRule["code"], string> = {
  checkout: "ArrowRightFromSquare",
  stayover: "Sun",
  inspection: "CheckDouble",
  turndown: "Moon",
  deep_clean: "Bucket",
};

const isToday = (iso: string, today: string) => kigaliDate(iso) === today;
/** "09:42" today, "11 Oct 10:31" on another day. */
const when = (iso: string, today: string) => (isToday(iso, today) ? clock(iso) : `${dayMonth(iso)} ${clock(iso)}`);
const firstName = (name: string | null | undefined) => (name ?? "").split(" ")[0] ?? "";
const minutesBetween = (from: string | Date, to: string | Date) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);
/** A wait as the board's card says it, "2 h 30" or "45" (the board adds "min"). */
function waited(minutes: number): string {
  const m = Math.max(0, minutes);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : String(m);
}
/** The same wait in a sentence: "2 h 30 min". */
const waitedText = (minutes: number) => `${waited(minutes)} min`;
/** The due time a task carries: its own, else the "Due 12:00" a person wrote in its note. */
function dueClock(t: ApiBoardTask): string | null {
  if (t.dueAt) return clock(t.dueAt);
  return t.note?.match(/^Due (\d{2}:\d{2})/)?.[1] ?? null;
}

// ── Housekeeping board ─────────────────────────────────────────────────────────────────────────────

const OPEN: TaskStatus[] = ["pending", "in_progress", "blocked"];

function boardKind(t: ApiBoardTask): CleaningTask["kind"] | null {
  if (t.reopenedFromTaskId) return "Re-clean";
  return TASK_KIND[t.taskType];
}

/** Which column a task sits in, or null when it is off the board (a finished stayover, a failed clean). */
function columnOf(t: ApiBoardTask): TaskColumn | null {
  if (!boardKind(t)) return null;
  if (t.status === "pending" || t.status === "blocked") return "todo";
  if (t.status === "in_progress") return "doing";
  const inspectable = t.taskType === "checkout_clean" || t.taskType === "deep_clean" || Boolean(t.reopenedFromTaskId);
  if (t.status === "done") return inspectable ? "clean" : null;
  if (t.status === "inspected") return "insp";
  return null;
}

function openEscalationsByTask(board: ApiBoard): Map<string, ApiBoardEscalation> {
  const top = new Map<string, ApiBoardEscalation>();
  for (const e of board.escalations) {
    const held = top.get(e.taskId);
    if (!held || (held.level === "supervisor" && e.level === "manager")) top.set(e.taskId, e);
  }
  return top;
}

function roomState(r: ApiBoardRoom): RoomStatus {
  if (r.block?.status === "active" || r.status !== "available" || r.housekeeping === "out_of_order") return "ooo";
  if (r.occupiedBy) return "occupied";
  return r.housekeeping === "inspected" ? "inspected" : r.housekeeping === "clean" ? "clean" : "dirty";
}

function roomNote(r: ApiBoardRoom, status: RoomStatus, tasks: ApiBoardTask[], now: Date, today: string): string {
  const mine = tasks.filter((t) => t.roomId === r.id);
  const open = mine.filter((t) => OPEN.includes(t.status));
  const doing = mine.some((t) => t.status === "in_progress");
  if (status === "ooo") return r.block?.workOrderReference ?? "Out of order";
  if (r.serviceFlag === "dnd") return "DND";
  if (status === "occupied") {
    if (doing) return "Cleaning";
    if (open.some((t) => t.taskType === "stayover_clean")) return "Stayover";
    if (mine.some((t) => t.taskType === "stayover_clean" && t.status === "done")) return "Serviced";
    const exit = r.occupiedBy?.plannedExitAt;
    if (exit) {
      const days = Math.round(
        (Date.parse(`${kigaliDate(exit)}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000,
      );
      if (days === 0) return "Dep today";
      if (days > 0 && days <= 2) return `Dep ${dayMonth(exit)}`;
    }
    return "In house";
  }
  if (status === "dirty") {
    if (doing) return "Cleaning";
    if (r.arrival?.checkInTime) return `Arr ${r.arrival.checkInTime}`;
    if (open.some((t) => t.reopenedFromTaskId)) return "Re-clean";
    if (open.some((t) => t.taskType === "deep_clean")) return "Deep clean";
    if (open.some((t) => !t.assignedToUserId)) return "Unassigned";
    return "Checkout";
  }
  if (status === "clean") {
    const cleaned = mine
      .filter((t) => t.status === "done" && t.completedAt)
      .map((t) => t.completedAt as string)
      .sort()
      .at(-1);
    // Clean with no clean waiting for inspection: readiness someone set by hand.
    if (!cleaned) return "Clean";
    const wait = minutesBetween(cleaned, now);
    return wait >= 120 ? `Wait ${Math.floor(wait / 60)}h${String(wait % 60).padStart(2, "0")}` : "Wait insp.";
  }
  if (r.arrival?.checkInTime) return `Arr ${r.arrival.checkInTime}`;
  return "Ready";
}

function presentRooms(board: ApiBoard, now: Date, today: string): HousekeepingRoom[] {
  return board.rooms.map((r) => {
    const status = roomState(r);
    const room: HousekeepingRoom = {
      id: r.label ?? r.id,
      floor: r.floor ?? 0,
      type: r.roomTypeName as HousekeepingRoom["type"],
      status,
      note: roomNote(r, status, board.tasks, now, today),
    };
    if (r.arrival && status === "dirty") {
      room.hold = `${r.arrival.guestName ?? "A guest"} arrives at ${r.arrival.checkInTime ?? "check-in time"}; the front desk is holding this room for the arrival.`;
    }
    return room;
  });
}

function eventTone(e: ApiRoomEvent): HistoryEvent["tone"] {
  switch (e.kind) {
    case "escalation":
      return e.toValue === "manager" ? "danger" : "warning";
    case "fault_reported":
    case "inspection_failed":
      return "warning";
    case "inventory":
      return e.toValue === "available" ? "success" : "danger";
    case "block":
      return e.toValue === "requested" ? "warning" : "default";
    case "housekeeping":
      return e.toValue === "clean" || e.toValue === "inspected" || !e.toValue ? "success" : "default";
    default:
      return "default";
  }
}

function presentHistory(board: ApiBoard, today: string): RoomHistory[] {
  const labels = new Map(board.rooms.map((r) => [r.id, r.label ?? r.id]));
  const byRoom = new Map<string, HistoryEvent[]>();
  for (const e of board.history) {
    const events = byRoom.get(e.roomId) ?? [];
    events.push({
      what: e.summary,
      who: [e.actorName ?? "System", when(e.occurredAt, today), e.detail].filter(Boolean).join(" · "),
      tone: eventTone(e),
    });
    byRoom.set(e.roomId, events);
  }
  return [...byRoom.entries()]
    .filter(([roomId]) => labels.has(roomId))
    .map(([roomId, events]) => ({ id: labels.get(roomId) as string, events }));
}

function taskDue(t: ApiBoardTask, column: TaskColumn, escalated: ApiBoardEscalation | undefined, now: Date): string {
  if (column === "todo") {
    if (t.reopenedFromTaskId) return `Failed inspection ${clock(t.createdAt)}${t.note ? ` · ${t.note}` : ""}`;
    const note = t.note ?? "";
    // A note that already says when ("By 15:00", "Due 12:00 · …", "17:00 – 19:00") is shown as written.
    if (!t.dueAt || /^(by |due |before )?\d{1,2}:\d{2}/i.test(note)) return note || "No due time";
    return [`Due ${clock(t.dueAt)}`, note].filter(Boolean).join(" · ");
  }
  if (column === "doing") {
    return `Started ${clock(t.startedAt ?? t.createdAt)}${t.dueAt ? ` · due ${clock(t.dueAt)}` : ""}`;
  }
  if (column === "clean") {
    const cleaned = t.completedAt ?? t.createdAt;
    const wait = minutesBetween(cleaned, now);
    return `Cleaned ${clock(cleaned)}${escalated && wait > 0 ? ` · waiting ${waited(wait)}` : ""}`;
  }
  return [`Passed${t.inspectedAt ? ` ${clock(t.inspectedAt)}` : ""}`, t.inspectedByName].filter(Boolean).join(" · ");
}

const COLUMN_ORDER: Record<TaskColumn, number> = { todo: 0, doing: 1, clean: 2, insp: 3 };

function presentTasks(board: ApiBoard, now: Date): CleaningTask[] {
  const escalated = openEscalationsByTask(board);
  return board.tasks
    .flatMap((t) => {
      const column = columnOf(t);
      const kind = boardKind(t);
      if (!column || !kind) return [];
      const esc = escalated.get(t.id);
      const task: CleaningTask = {
        id: t.id,
        room: t.roomLabel ?? "",
        kind,
        column,
        assignee: t.assignedToUserId,
        due: taskDue(t, column, esc, now),
        auto: t.ruleId !== null,
      };
      if (column === "todo" || column === "doing") task.minutes = t.estimatedMinutes ?? USUAL_MINUTES[kind];
      if (esc) {
        task.priority = "Overdue";
        task.priorityTone = "danger";
      } else if (column === "todo" && t.priority >= 50) {
        task.priority = "High";
        task.priorityTone = "warning";
      }
      return [{ task, sort: [COLUMN_ORDER[column], esc ? 0 : 1, -t.priority, dueClock(t) ?? "~"] as const }];
    })
    .sort(
      (a, b) =>
        a.sort[0] - b.sort[0] ||
        a.sort[1] - b.sort[1] ||
        a.sort[2] - b.sort[2] ||
        a.sort[3].localeCompare(b.sort[3]) ||
        a.task.room.localeCompare(b.task.room, undefined, { numeric: true }),
    )
    .map((x) => x.task);
}

const STAFF_TONES: Tone[] = ["success", "accent", "warning", "default"];

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

function presentStaff(board: ApiBoard, now: Date): HousekeepingStaff[] {
  const attendants = board.staff
    .filter((s) => s.role === "attendant")
    .sort((a, b) => a.section.localeCompare(b.section, undefined, { numeric: true }));
  const supervisors = board.staff.filter((s) => s.role === "supervisor");
  return [...attendants, ...supervisors].map((s, i) => ({
    id: s.userId,
    role: s.role === "supervisor" ? "supervisor" : "housekeeper",
    name: s.name,
    initials: initials(s.name),
    area: s.section,
    shiftEnd: clock(s.shiftEndsAt),
    minutesLeft: Math.max(0, minutesBetween(now, s.shiftEndsAt)),
    tone: s.role === "supervisor" ? "accent" : (STAFF_TONES[i % STAFF_TONES.length] as Tone),
  }));
}

function presentEscalations(board: ApiBoard, now: Date): HousekeepingEscalation[] {
  const tasks = new Map(board.tasks.map((t) => [t.id, t]));
  const rooms = new Map(board.rooms.map((r) => [r.id, r]));
  const staff = presentStaff(board, now);
  const supervisor = board.staff.find((s) => s.role === "supervisor");
  const out: HousekeepingEscalation[] = [];
  for (const e of openEscalationsByTask(board).values()) {
    const t = tasks.get(e.taskId);
    if (!t) continue;
    const room = t.roomLabel ?? "";
    if (e.kind === "not_started") {
      const due = dueClock(t);
      const kind = (boardKind(t) ?? "Cleaning").toLowerCase();
      const parts = [`Room ${room} ${kind} ${due ? `was due at ${due} and ` : ""}has not started.`];
      const person = staff.find((s) => s.id === t.assignedToUserId);
      if (person) {
        const load = board.tasks
          .filter((x) => x.assignedToUserId === person.id && (x.status === "pending" || x.status === "in_progress"))
          .reduce((sum, x) => {
            const k = boardKind(x);
            return sum + (x.estimatedMinutes ?? (k ? USUAL_MINUTES[k] : 0));
          }, 0);
        parts.push(`${person.name} has ${load} minutes of work left and ${person.minutesLeft} minutes of shift.`);
      } else if (!t.assignedToUserId) {
        parts.push("Nobody has been given it yet.");
      }
      const arrival = rooms.get(t.roomId)?.arrival;
      if (arrival?.guestName && arrival.checkInTime)
        parts.push(`${arrival.guestName} arrives at ${arrival.checkInTime}.`);
      out.push({ id: e.id, task: t.id, action: "reassign", text: parts.join(" "), cta: `Reassign ${room}` });
    } else {
      const cleaned = t.completedAt ?? t.createdAt;
      const who = firstName(supervisor?.name ?? e.escalatedToName) || "the supervisor";
      // The API records the reminder on the escalation (reminded_at) and leaves an outbox row that
      // nothing delivers yet: no phone, staff screen or message reads it. So the control records a
      // reminder and says it is not delivered, and the time shown is the API's, never the clock's.
      const doneCta = "Reminder recorded · not delivered";
      const waited = `Room ${room} ${minutesBetween(cleaned, now) > 0 ? `has waited ${waitedText(minutesBetween(cleaned, now))}` : "is waiting"} for inspection after ${firstName(t.assignedToName) || "housekeeping"} cleaned it at ${clock(cleaned)}.`;
      const note = e.remindedAt
        ? ` A reminder was recorded on the task at ${clock(e.remindedAt)}${e.remindedByName ? ` by ${firstName(e.remindedByName)}` : ""}; it is not delivered to ${who} yet.`
        : ` A reminder is recorded on the task only; nothing delivers it to ${who} yet.`;
      out.push({
        id: e.id,
        task: t.id,
        action: "remind",
        text: `${waited}${note}`,
        // Already recorded: the button reads as done (the view starts disabled on it).
        cta: e.remindedAt ? doneCta : `Record a reminder for ${room}`,
        doneCta,
      });
    }
  }
  return out;
}

// ── Maintenance ────────────────────────────────────────────────────────────────────────────────────

const SEVERITY: Record<Priority, Severity> = { urgent: "Critical", high: "High", normal: "Normal", low: "Low" };
const DUE_WITHIN: Record<Severity, string> = {
  Critical: "due within 1 hour",
  High: "due within 4 hours",
  Normal: "due within 3 days",
  Low: "at the next routine visit",
};
const PART_STATE: Record<ApiWorkOrder["parts"][number]["state"], { label: string; tone: Tone }> = {
  requested: { label: "Requested", tone: "warning" },
  ordered: { label: "Ordered", tone: "warning" },
  issued: { label: "Issued", tone: "default" },
  contractor: { label: "Contractor", tone: "default" },
};

/** Nights a block covers, from its start day to its end day (a block to 14 Oct 12:00 frees the night of the 14th). */
function nights(startsAt: string, endsAt: string | null): number | null {
  if (!endsAt) return null;
  return Math.max(
    1,
    Math.round(
      (Date.parse(`${kigaliDate(endsAt)}T12:00:00Z`) - Date.parse(`${kigaliDate(startsAt)}T12:00:00Z`)) / 86_400_000,
    ),
  );
}
/** The nights a block covers, as a phrase: "for 12–13 Oct", "for 30 Sep–2 Oct", "from 15 Oct until released". */
const nightRange = (startsAt: string, endsAt: string | null) => {
  const first = kigaliDate(startsAt);
  if (!endsAt) return `from ${dayMonth(first)} until released`;
  const last = new Date(Date.parse(`${kigaliDate(endsAt)}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  if (last <= first) return `for ${dayMonth(first)}`;
  return first.slice(0, 7) === last.slice(0, 7)
    ? `for ${Number(first.slice(8, 10))}–${dayMonth(last)}`
    : `for ${dayMonth(first)}–${dayMonth(last)}`;
};
const stamp = (iso: string) => `${dayMonth(iso)} ${clock(iso)}`;
/** "11 Oct 14:00 → 14 Oct 12:00 · 3 room-nights". */
const span = (startsAt: string, endsAt: string | null) => {
  const n = nights(startsAt, endsAt);
  return `${stamp(startsAt)} → ${endsAt ? stamp(endsAt) : "until released"}${n ? ` · ${n} room-night${n === 1 ? "" : "s"}` : ""}`;
};

function statusLabel(o: ApiWorkOrder): string {
  switch (o.status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Done";
    case "closed":
      return o.verifiedAt ? "Done · verified" : "Done";
    case "cancelled":
      return "Cancelled";
    default:
      if (o.parts.some((p) => p.state === "requested" || p.state === "ordered")) return "Waiting for parts";
      if (o.scheduledFor) return `Scheduled ${dayMonth(o.scheduledFor)}`;
      return "Assigned";
  }
}

const EVENT_WHAT: Record<string, (o: ApiWorkOrder, note: string | null) => string> = {
  reported: (o) =>
    o.photos.length ? `Reported with ${o.photos.length} photo${o.photos.length === 1 ? "" : "s"}` : "Reported",
  assigned: (_o, note) => note ?? "Assigned",
  block_requested: (o) =>
    o.block ? `Block requested ${nightRange(o.block.startsAt, o.block.endsAt)}` : "Block requested",
  block_approved: () => "Block approved, room off sale",
  block_declined: (_o, note) => (note ? `Block declined: ${note}` : "Block declined"),
  block_released: () => "Room released, back on sale",
  parts: (_o, note) => note ?? "Parts",
  scheduled: (_o, note) => note ?? "Scheduled",
  started: () => "Work started",
  note: (_o, note) => note ?? "",
  next_step: (_o, note) => `Next: ${note ?? ""}`,
  fixed: () => "Fixed",
  verified: () => "Verified",
  from_signal: (_o, note) => note ?? "Created from a condition signal",
  planned: (_o, note) => note ?? "Created from the maintenance plan",
};
const EVENT_TONE: Record<string, HistoryEvent["tone"]> = {
  reported: "warning",
  block_approved: "danger",
  block_released: "success",
  fixed: "success",
  verified: "success",
};

function timelineOf(o: ApiWorkOrder, today: string): HistoryEvent[] {
  const open = !["resolved", "closed", "cancelled"].includes(o.status);
  const events = o.events.map((e) => ({
    kind: e.kind,
    event: {
      what: (EVENT_WHAT[e.kind] ?? ((_o, n) => n ?? e.kind))(o, e.note),
      who:
        e.kind === "next_step"
          ? "Planned next step"
          : e.kind === "note"
            ? `Note · ${e.actorName ?? "Staff"} · ${when(e.occurredAt, today)}`
            : `${e.actorName ?? "System"} · ${when(e.occurredAt, today)}`,
      tone: EVENT_TONE[e.kind] ?? "default",
    } as HistoryEvent,
  }));
  if (open) {
    const last = [...events]
      .reverse()
      .find((x) => x.kind !== "next_step" && x.kind !== "note" && x.kind !== "reported");
    if (last) last.event.tone = "current";
  }
  return events.map((x) => x.event);
}

function blockOf(o: ApiWorkOrder, persona: string, now: Date) {
  const b = o.block;
  const isRoom = Boolean(o.roomId);
  if (!isRoom) {
    return {
      block: "na" as BlockState,
      blockText: "Not a room",
      blockEffect: o.impactNote ?? "Not a room; nothing is taken off sale.",
    };
  }
  const reservations = (n: number, would: boolean) =>
    n === 0
      ? would
        ? "No reservations would be moved."
        : "No reservations were affected."
      : `${n} reservation${n === 1 ? "" : "s"} hold${n === 1 ? "s" : ""} the room in these dates and ${would ? "would need" : "need"} another room.`;
  if (b?.status === "active") {
    return {
      block: "active" as BlockState,
      blockText: span(b.startsAt, b.endsAt),
      blockEffect: `Removed from sale${b.decidedAt ? ` at ${clock(b.decidedAt)} on ${dayMonth(b.decidedAt)}` : ""}: front desk, booking page and every channel. ${reservations(b.affectedReservations, false)}`,
    };
  }
  if (b?.status === "requested") {
    const room = `Room ${o.roomLabel ?? ""}`.trim();
    const approvedSpan = span(new Date(Math.max(now.getTime(), Date.parse(b.startsAt))).toISOString(), b.endsAt);
    return {
      block: "requested" as BlockState,
      blockText: `Requested ${nightRange(b.startsAt, b.endsAt)}`,
      blockEffect: `${room} is still on sale. Approving removes it from sale ${nightRange(b.startsAt, b.endsAt)} on every channel. ${reservations(b.affectedReservations, true)}`,
      decision: {
        approved: {
          blockText: approvedSpan,
          blockEffect: `Removed from sale on every channel at ${clock(now)}. ${o.releaseNote ?? "Release after the repair and a passed housekeeping inspection."}`,
          event: { what: "Block approved, room off sale", who: `${persona} · ${clock(now)}`, tone: "danger" as const },
        },
        declined: {
          blockText: "Declined · room stays on sale",
          blockEffect: `Declined by ${persona} at ${clock(now)}: the room stays on sale while the work is done.`,
          event: { what: "Block declined", who: `${persona} · ${clock(now)}`, tone: "default" as const },
        },
      },
    };
  }
  if (b?.status === "declined") {
    return {
      block: "declined" as BlockState,
      blockText: "Declined · room stays on sale",
      blockEffect: `Declined by ${b.decidedByName ?? "a manager"}${b.decidedAt ? ` at ${clock(b.decidedAt)}` : ""}${b.decisionNote ? `: ${b.decisionNote}` : "."}`,
    };
  }
  return {
    block: "none" as BlockState,
    blockText: b?.status === "released" && b.releasedAt ? `Released ${dayMonth(b.releasedAt)}` : "None",
    blockEffect: o.impactNote ?? "No block. A block can be requested if the work needs the room empty.",
  };
}

const isStock = (key: string): key is StockKey => key in stock;

function presentWorkOrder(o: ApiWorkOrder, list: ApiWorkOrderList, ctx: SourceContext, now: Date): WorkOrder {
  const today = ctx.today.iso;
  const persona = ctx.account?.user.name ?? ctx.persona?.name ?? "You";
  const severity = SEVERITY[o.priority];
  const owner = o.assignedToName ?? o.assignedContractor ?? null;
  const asset = o.roomId ? `Room ${o.roomLabel ?? ""}` : (o.spaceName ?? o.assetName ?? "Unknown place");
  const area = o.roomId
    ? [o.roomTypeName, o.floor !== null ? `Floor ${o.floor}` : null].filter(Boolean).join(" · ")
    : o.spaceName && o.assetName
      ? o.assetName
      : "";
  const photos: WorkOrderPhoto[] = o.photos.flatMap((p) => {
    const key = p.key.startsWith("stock:") ? p.key.slice(6) : "";
    return isStock(key) ? [{ caption: p.caption, image: key }] : [];
  });
  const parts: WorkOrderPart[] = o.parts.map((p) => ({
    name: p.name,
    qty: p.unit ? `${p.quantity} ${p.unit}` : String(p.quantity),
    source: p.source,
    state: PART_STATE[p.state].label,
    tone: PART_STATE[p.state].tone,
  }));
  const blocked = blockOf(o, persona, now);
  const closed = ["resolved", "closed", "cancelled"].includes(o.status);
  const order: WorkOrder = {
    id: o.reference,
    asset,
    area,
    title: o.title,
    issue: o.description ?? o.title,
    severity,
    owner,
    status: statusLabel(o),
    block: blocked.block,
    blockText: blocked.blockText,
    blockEffect: blocked.blockEffect,
    reported: [
      o.raisedByName,
      o.raisedByName || !o.raisedVia ? o.raisedVia : o.raisedVia.charAt(0).toUpperCase() + o.raisedVia.slice(1),
      `${dayMonth(o.raisedAt)} ${clock(o.raisedAt)}`,
    ]
      .filter(Boolean)
      .join(" · "),
    photos,
    parts,
    timeline: timelineOf(o, today),
    releaseNote:
      o.releaseNote ??
      (blocked.block === "active" ? "Release needs the repair closed and a passed housekeeping inspection." : ""),
  };
  if (!owner && !closed && list.suggestedAssignee) order.suggestedOwner = list.suggestedAssignee.name;
  if (!owner && !closed) {
    order.pending = {
      what: "Not assigned yet",
      who: `${severity} severity: ${DUE_WITHIN[severity]}`,
      tone: severity === "Critical" || severity === "High" ? "danger" : "warning",
    };
  } else if (blocked.block === "requested") {
    order.pending = { what: "Waiting for your decision", who: "Blocks need a manager’s approval", tone: "default" };
  }
  if ("decision" in blocked && blocked.decision) order.decision = blocked.decision;
  return order;
}

const CONFIDENCE: Record<ApiSignal["confidence"], ConditionSignal["confidence"]> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function presentSignal(s: ApiSignal, list: ApiWorkOrderList, ctx: SourceContext, now: Date): ConditionSignal {
  const persona = ctx.account?.user.name ?? ctx.persona?.name ?? "You";
  const draft = s.draft;
  const severity = SEVERITY[draft?.priority ?? "normal"];
  const room = draft?.location.match(/^Room (.+)$/)?.[1];
  return {
    id: s.id,
    rule: s.ruleCode,
    asset: s.assetName,
    headline: s.headline,
    confidence: CONFIDENCE[s.confidence],
    tone: s.confidence === "low" ? "warning" : s.confidence === "high" ? "danger" : "default",
    evidence: s.evidence,
    dataQuality: s.dataQuality,
    recommendation: s.recommendation,
    ruleText: s.ruleText,
    // The work order the signal proposes, as it will look once created (its number is given then).
    draft: {
      id: "New work order",
      asset: draft?.location ?? s.assetName,
      area: room ? "" : s.assetName,
      title: draft?.title ?? s.headline,
      issue: draft?.description ?? s.recommendation,
      severity,
      owner: null,
      suggestedOwner: list.suggestedAssignee?.name,
      status: "Draft",
      block: room ? "none" : "na",
      blockText: room ? "None" : "Not a room",
      blockEffect: room
        ? "No block. A block can be requested if the inspection finds a fault."
        : "Not a room; nothing is taken off sale.",
      reported: `${persona} · from signal ${s.ruleCode} · ${dayMonth(now)} ${clock(now)}`,
      photos: [],
      parts: [],
      timeline: [
        {
          what: "Draft created from a condition signal",
          who: `${persona} · ${clock(now)} · evidence attached`,
          tone: "current",
        },
      ],
      releaseNote: "",
    },
  };
}

function presentReview(s: ApiSignal): SignalReview {
  const when = s.reviewedAt ? dayMonth(s.reviewedAt) : "";
  return s.status === "actioned"
    ? {
        id: s.id,
        outcome: "Work order",
        tone: "accent",
        what: s.headline,
        note: `${s.workOrderReference ?? "A work order"} created by ${s.reviewedByName ?? "staff"}, ${when}`,
      }
    : {
        id: s.id,
        outcome: "Dismissed",
        tone: "default",
        what: s.headline,
        note: `${s.reviewedByName ?? "Staff"}, ${when}: ${s.reviewNote ?? "dismissed"}`,
      };
}

// ── Lost and found ─────────────────────────────────────────────────────────────────────────────────

const ITEM_STATUS: Record<ApiFoundItem["status"], FoundItemStatus> = {
  stored: "stored",
  claimed: "claim",
  returned: "returned",
  disposal_pending: "disposal",
  disposed: "disposed",
};
const CATEGORY_LABEL: Record<string, string> = {
  electronics: "Electronics",
  jewellery: "Jewellery",
  clothing: "Clothing",
  accessories: "Accessories",
  documents: "Documents",
  cash: "Cash",
  other: "Other",
};

function presentFoundItem(i: ApiFoundItem, today: string): FoundItem {
  const open = i.status !== "returned" && i.status !== "disposed";
  const custody: HistoryEvent[] = i.events.map((e, n) => ({
    // The API words an intake "Logged, tag printed", but nothing prints a tag: staff write the reference on it.
    what: e.summary.replace(/, tag printed$/, ""),
    who: [e.actorName, when(e.occurredAt, today), e.detail].filter(Boolean).join(" · "),
    tone:
      e.kind === "returned" || e.kind === "disposal_approved"
        ? "success"
        : e.kind === "disposal_proposed"
          ? "warning"
          : open && n === i.events.length - 1
            ? "current"
            : "default",
  }));
  const item: FoundItem = {
    id: i.reference,
    item: i.description,
    category: CATEGORY_LABEL[i.category] ?? "Other",
    valuable: i.valuable,
    where: [i.foundLocation, i.foundSpot].filter(Boolean).join(" · "),
    when: `${dayMonth(i.foundAt)} ${clock(i.foundAt)}`,
    foundBy: i.foundByName,
    custodian: i.custodianName ?? "None",
    storage:
      i.status === "returned" && i.release
        ? `Returned ${dayMonth(i.release.releasedAt)}`
        : i.status === "disposed" && i.disposal?.approvedAt
          ? `Donated ${dayMonth(i.disposal.approvedAt)}`
          : (i.storageLocation ?? ""),
    status: ITEM_STATUS[i.status],
    custody,
  };
  if ((i.status === "stored" || i.status === "claimed") && i.retentionNote) item.retention = i.retentionNote;
  if (!open && i.closedNote) item.closedNote = i.closedNote;
  if (i.claim && i.status === "claimed") {
    item.claim = {
      claimant: i.claim.claimantName,
      booking: i.claim.bookingReference ?? "no booking",
      matched: i.claim.matched,
      match: i.claim.matchNote,
      statement: `Claimant: “${i.claim.statement}”`,
    };
  }
  if (i.disposal && i.status === "disposal_pending") {
    const held = Math.max(
      0,
      Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${kigaliDate(i.foundAt)}T12:00:00Z`)) / 86_400_000),
    );
    item.disposal = {
      note: `Held ${held} days. ${i.disposal.proposedByName ?? "The custodian"} proposed: ${i.disposal.note}, on ${dayMonth(i.disposal.proposedAt)}. Disposal is final, so a second person must approve.`,
      rule: i.disposal.rule,
    };
  }
  return item;
}

// ── The sources ────────────────────────────────────────────────────────────────────────────────────

export const sources = defineSources({
  "operations.rooms": {
    naturalKey: "id",
    async list(ctx): Promise<HousekeepingRoom[]> {
      return presentRooms(await readBoard(ctx), ctx.now, ctx.today.iso);
    },
  },
  "operations.roomHistory": {
    naturalKey: "id",
    async list(ctx): Promise<RoomHistory[]> {
      return presentHistory(await readBoard(ctx), ctx.today.iso);
    },
  },
  "operations.cleaningTasks": {
    naturalKey: "room",
    async list(ctx): Promise<CleaningTask[]> {
      return presentTasks(await readBoard(ctx), ctx.now);
    },
  },
  "operations.housekeepingStaff": {
    naturalKey: "name",
    async list(ctx): Promise<HousekeepingStaff[]> {
      return presentStaff(await readBoard(ctx), ctx.now);
    },
  },
  "operations.housekeepingEscalations": {
    naturalKey: "action",
    async list(ctx): Promise<HousekeepingEscalation[]> {
      return presentEscalations(await readBoard(ctx), ctx.now);
    },
  },
  "operations.housekeepingRules": {
    naturalKey: "kind",
    async list(ctx): Promise<HousekeepingRule[]> {
      return (await readBoard(ctx)).rules.map((r) => ({
        id: r.id,
        icon: RULE_ICON[r.code],
        kind: r.name,
        when: r.description,
      }));
    },
  },
  "operations.workOrders": {
    naturalKey: "id",
    async list(ctx): Promise<WorkOrder[]> {
      const list = await readWorkOrders(ctx);
      const now = ctx.now;
      return list.workOrders.map((o) => presentWorkOrder(o, list, ctx, now));
    },
  },
  "operations.conditionSignals": {
    naturalKey: "rule",
    async list(ctx): Promise<ConditionSignal[]> {
      const [{ signals }, list] = await Promise.all([readSignals(ctx), readWorkOrders(ctx)]);
      const now = ctx.now;
      return signals.filter((s) => s.status === "open").map((s) => presentSignal(s, list, ctx, now));
    },
  },
  "operations.signalReviews": {
    naturalKey: "what",
    async list(ctx): Promise<SignalReview[]> {
      const { signals } = await readSignals(ctx);
      return signals.filter((s) => s.status !== "open").map(presentReview);
    },
  },
  "operations.foundItems": {
    naturalKey: "id",
    async list(ctx): Promise<FoundItem[]> {
      const { items } = await readFoundItems(ctx);
      return items.map((i) => presentFoundItem(i, ctx.today.iso));
    },
  },
});
