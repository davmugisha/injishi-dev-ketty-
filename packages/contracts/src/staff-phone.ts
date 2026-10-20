import { z } from "zod";
import { FoundItemCategory } from "./lost-found";
import { Uuid } from "./primitives";

/**
 * The staff phone (real-data leaf 1.3.3): what a housekeeper, the housekeeping supervisor and the
 * maintenance technician read and record from their phones, beside the housekeeping board
 * (`housekeeping-board.ts`) and the work orders (`maintenance.ts`) they share with the office.
 *
 * Operator routes (`/ops/housekeeping/phone`, `/ops/housekeeping/tasks/:id/…`, `/ops/work-orders/:id/…`)
 * sit behind the same permissions as the boards they extend. Self routes (`/me/work/:employeeId/…`) are
 * `SessionGuard` only: the person's own file is the guard, and any other id is a 404.
 */

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------

export const HousekeepingChecklistKind = z.enum(["cleaning", "inspection"]);
export type HousekeepingChecklistKind = z.infer<typeof HousekeepingChecklistKind>;

export const HousekeepingChecklistItem = z.object({
  id: Uuid,
  kind: HousekeepingChecklistKind,
  sectionCode: z.string(),
  sectionTitle: z.string(),
  code: z.string(),
  label: z.string(),
  requiresPhoto: z.boolean(),
  sortOrder: z.number().int(),
});
export type HousekeepingChecklistItem = z.infer<typeof HousekeepingChecklistItem>;

export const HousekeepingCheckResult = z.enum(["done", "pass", "fail"]);
export type HousekeepingCheckResult = z.infer<typeof HousekeepingCheckResult>;

/** The result one checklist item got on one task. */
export const HousekeepingTaskCheck = z.object({
  taskId: Uuid,
  itemId: Uuid,
  result: HousekeepingCheckResult,
  photoObjectKey: z.string().nullable(),
  checkedByName: z.string().nullable(),
  checkedAt: z.string(),
});
export type HousekeepingTaskCheck = z.infer<typeof HousekeepingTaskCheck>;

/** `POST /ops/housekeeping/tasks/:id/checks`: tick (or untick) one cleaning step. */
export const SetHousekeepingCheckRequest = z.object({
  itemId: Uuid,
  done: z.boolean(),
});
export type SetHousekeepingCheckRequest = z.infer<typeof SetHousekeepingCheckRequest>;

/** One inspection check's verdict, sent with the inspection decision. */
export const InspectionCheckVerdict = z.object({
  itemId: Uuid,
  result: z.enum(["pass", "fail"]),
  photoObjectKey: z.string().trim().max(500).optional(),
});
export type InspectionCheckVerdict = z.infer<typeof InspectionCheckVerdict>;

// ---------------------------------------------------------------------------
// Minibar
// ---------------------------------------------------------------------------

export const MinibarStockItem = z.object({
  id: Uuid,
  code: z.string(),
  label: z.string(),
  /** How many a room is stocked with. */
  parLevel: z.number().int(),
  sortOrder: z.number().int(),
});
export type MinibarStockItem = z.infer<typeof MinibarStockItem>;

export const MinibarCount = z.object({
  taskId: Uuid,
  itemId: Uuid,
  parLevel: z.number().int(),
  used: z.number().int(),
  countedByName: z.string().nullable(),
  countedAt: z.string(),
});
export type MinibarCount = z.infer<typeof MinibarCount>;

/**
 * `POST /ops/housekeeping/tasks/:id/minibar`: what was used, one line per item. Sending again replaces
 * the count. A report for the front desk, never a charge.
 */
export const SendMinibarCountRequest = z.object({
  counts: z
    .array(z.object({ itemId: Uuid, used: z.number().int().min(0).max(99) }))
    .min(1, "Count at least one item.")
    .max(50),
});
export type SendMinibarCountRequest = z.infer<typeof SendMinibarCountRequest>;

// ---------------------------------------------------------------------------
// Found items, logged from the room being cleaned
// ---------------------------------------------------------------------------

/**
 * `POST /ops/housekeeping/tasks/:id/found-items`: the cleaner logs what she found in the task's room.
 * It goes into the lost and found register (`found_items`) with her as the finder and today's
 * supervisor as the custodian it is handed to; the register itself stays `lostfound.manage`'s.
 */
export const LogPhoneFoundItemRequest = z.object({
  description: z.string().trim().min(1, "Say what it is.").max(300),
  /** Where in the room: "bedside drawer". */
  spot: z.string().trim().min(1).max(200),
  /** What kind of thing it is; "other" when the phone does not ask. Valuables are never logged from the phone. */
  category: FoundItemCategory.optional(),
  photoCount: z.number().int().min(0).max(20).optional(),
});
export type LogPhoneFoundItemRequest = z.infer<typeof LogPhoneFoundItemRequest>;

/** An item the caller found, as the phone shows it. */
export const PhoneFoundItem = z.object({
  id: Uuid,
  reference: z.string(),
  description: z.string(),
  roomLabel: z.string().nullable(),
  foundLocation: z.string(),
  foundSpot: z.string().nullable(),
  foundAt: z.string(),
  category: z.string(),
  photoCount: z.number().int(),
  custodianName: z.string().nullable(),
  status: z.string(),
});
export type PhoneFoundItem = z.infer<typeof PhoneFoundItem>;

// ---------------------------------------------------------------------------
// The phone's read
// ---------------------------------------------------------------------------

/** A booking arriving today into a room, with its party size (the board names the guest only). */
export const PhoneArrival = z.object({
  roomId: Uuid,
  guests: z.number().int(),
});
export type PhoneArrival = z.infer<typeof PhoneArrival>;

/** A place on the caller's floors that is not a room ("Corridor F2"), for reporting a fault. */
export const PhonePlace = z.object({
  spaceId: Uuid,
  name: z.string(),
  floor: z.number().int().nullable(),
});
export type PhonePlace = z.infer<typeof PhonePlace>;

/**
 * `GET /ops/housekeeping/phone`: the property's checklists, the results its open and today's tasks
 * got, the minibar stock and counts, today's arrivals' party sizes, the spaces on the caller's
 * floors, today's supervisor and the items the caller found. Read beside the housekeeping board.
 */
export const HousekeepingPhone = z.object({
  propertyId: Uuid,
  checklist: z.array(HousekeepingChecklistItem),
  checks: z.array(HousekeepingTaskCheck),
  minibarItems: z.array(MinibarStockItem),
  minibarCounts: z.array(MinibarCount),
  arrivals: z.array(PhoneArrival),
  /** The floors today's allocation sheet gives the caller (empty when they are not on it). */
  myFloors: z.array(z.number().int()),
  places: z.array(PhonePlace),
  supervisor: z.object({ userId: Uuid, name: z.string() }).nullable(),
  /** Newest first: what the caller found and logged in the last thirty days. */
  foundItems: z.array(PhoneFoundItem),
});
export type HousekeepingPhone = z.infer<typeof HousekeepingPhone>;

// ---------------------------------------------------------------------------
// Time on a work order
// ---------------------------------------------------------------------------

export const WorkOrderTimeKind = z.enum(["diagnosis", "repair"]);
export type WorkOrderTimeKind = z.infer<typeof WorkOrderTimeKind>;

export const WorkOrderTimeLog = z.object({
  id: Uuid,
  ticketId: Uuid,
  userId: Uuid,
  userName: z.string().nullable(),
  kind: WorkOrderTimeKind,
  startedAt: z.string(),
  /** Null while the timer runs. */
  endedAt: z.string().nullable(),
});
export type WorkOrderTimeLog = z.infer<typeof WorkOrderTimeLog>;

/** `GET /ops/maintenance-time-logs`: the sessions on the workspace's open orders (and those closed this week). */
export const WorkOrderTimeLogList = z.object({ logs: z.array(WorkOrderTimeLog) });
export type WorkOrderTimeLogList = z.infer<typeof WorkOrderTimeLogList>;

/** `POST /ops/work-orders/:id/timer`: start or stop the caller's own session. */
export const WorkOrderTimerRequest = z.object({ running: z.boolean() });
export type WorkOrderTimerRequest = z.infer<typeof WorkOrderTimerRequest>;

/**
 * `POST /ops/work-orders/:id/resolve`: what was done, and, for a room taken off sale, whether the
 * technician asks for it to go back on sale. Asking never releases it: housekeeping inspects and a
 * manager releases (`listing.manage`).
 */
export const ResolveWorkOrderRequest = z.object({
  fix: z.string().trim().min(1, "Say what you did.").max(2000),
  askRelease: z.boolean().default(false),
});
export type ResolveWorkOrderRequest = z.infer<typeof ResolveWorkOrderRequest>;

// ---------------------------------------------------------------------------
// Self service: documents, who approves leave
// ---------------------------------------------------------------------------

/** One of the person's own papers: their contract, or a document kept on their file. */
export const MyDocument = z.object({
  id: Uuid,
  kind: z.enum(["contract", "document"]),
  title: z.string(),
  /** A document's state (requested, submitted, approved, rejected), or the contract's (active, …). */
  status: z.string(),
  contractType: z.string().nullable(),
  startsOn: IsoDate.nullable(),
  issuedOn: IsoDate.nullable(),
  expiresOn: IsoDate.nullable(),
  /** When HR last acted on it (approved a document). */
  checkedAt: z.string().nullable(),
});
export type MyDocument = z.infer<typeof MyDocument>;

/** `GET /me/work/:employeeId/documents`. */
export const MyDocumentList = z.object({ documents: z.array(MyDocument) });
export type MyDocumentList = z.infer<typeof MyDocumentList>;

export const LeaveApproversQuery = z.object({ leaveTypeId: Uuid.optional() });
export type LeaveApproversQuery = z.infer<typeof LeaveApproversQuery>;

/** One step of the approval a leave request will go through, and who decides it. */
export const LeaveApprovalStep = z.object({
  order: z.number().int(),
  /** `line_manager` (the reporting manager) or `office` (whoever holds `leave.approve`, HR first). */
  role: z.enum(["line_manager", "office"]),
  name: z.string(),
  jobTitle: z.string().nullable(),
});
export type LeaveApprovalStep = z.infer<typeof LeaveApprovalStep>;

/** `GET /me/work/:employeeId/leave/approvers`: before asking, who will decide. */
export const LeaveApproverList = z.object({ steps: z.array(LeaveApprovalStep) });
export type LeaveApproverList = z.infer<typeof LeaveApproverList>;

/**
 * `GET /me/work/:employeeId/holidays/next`: the next national public holiday from today, read from the
 * recorded rule (`hr.rw.public_holidays`). Null when this year's and next year's are not recorded.
 */
export const NextPublicHoliday = z.object({
  holiday: z.object({ date: IsoDate, name: z.string() }).nullable(),
});
export type NextPublicHoliday = z.infer<typeof NextPublicHoliday>;
