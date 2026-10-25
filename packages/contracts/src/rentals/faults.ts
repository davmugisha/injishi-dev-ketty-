import { z } from "zod";
import { MaintenanceCategory, MaintenancePriority, MaintenanceStatus } from "../ops";
import { RwPhoneNumber } from "../phone";
import { Uuid } from "../primitives";
import { addDays, kigaliDateOf, kigaliToday } from "./dates";
import { FaultPaymentView } from "./expenses";

// ===========================================================================
// Faults: the one ticket lifecycle a rented home and a hotel share (WP 4.1)
// ===========================================================================
//
// A fault is a `maintenance_tickets` row, the same table a hotel work order
// is. Its chain is Reported, Seen, Assigned, In progress, Fixed, Closed, with
// "Won't fix" and "Cancelled" off any open state, and a way back to Reported:
// the landlord reopens a fixed, closed or refused fault, and the tenant does
// within 14 days of it being settled. The API is the only enforcer
// (`TicketLifecycle` in the operations module); this file is the rule both
// the API and the screens read, so a "Move to" menu offers only legal moves.

const IsoMoment = z.string();

/** The states a fault is still being worked in. `wont_fix` and `cancelled` can be reached from any of them. */
export const OPEN_TICKET_STATUSES: readonly MaintenanceStatus[] = ["open", "acknowledged", "assigned", "in_progress"];

/** Is the ticket still being worked? */
export function isOpenTicket(status: MaintenanceStatus): boolean {
  return OPEN_TICKET_STATUSES.includes(status);
}

/**
 * Which states a ticket may move to from each state, and nothing else.
 *
 * Forward along the chain, skipping steps (a landlord who fixes it the same
 * day goes from Reported to Fixed; a hotel order is assigned without being
 * "seen"); one step back inside the open states, to undo a mistaken press;
 * `wont_fix` and `cancelled` from any open state; and back to `open` from
 * Fixed, Closed and Won't fix (a reopen). `cancelled` is a ticket raised in
 * error and is final. Closing needs the fix first: Closed comes from Fixed.
 */
export const TICKET_MOVES: Readonly<Record<MaintenanceStatus, readonly MaintenanceStatus[]>> = {
  open: ["acknowledged", "assigned", "in_progress", "resolved", "wont_fix", "cancelled"],
  acknowledged: ["assigned", "in_progress", "resolved", "wont_fix", "cancelled"],
  assigned: ["acknowledged", "in_progress", "resolved", "wont_fix", "cancelled"],
  in_progress: ["assigned", "resolved", "wont_fix", "cancelled"],
  resolved: ["closed", "open"],
  closed: ["open"],
  wont_fix: ["open"],
  cancelled: [],
};

/** May a ticket go from `from` to `to`? Staying where it is is not a move. */
export function ticketMayMove(from: MaintenanceStatus, to: MaintenanceStatus): boolean {
  return TICKET_MOVES[from].includes(to);
}

/** The landlord's words for each state. */
export const FAULT_STATUS_LABEL: Readonly<Record<MaintenanceStatus, string>> = {
  open: "Reported",
  acknowledged: "Seen",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Fixed",
  closed: "Closed",
  wont_fix: "Won't fix",
  cancelled: "Cancelled",
};

/** The tenant's words for each state, as their list reads it. */
export const FAULT_STATUS_TENANT: Readonly<Record<MaintenanceStatus, string>> = {
  open: "Reported",
  acknowledged: "Seen by your landlord",
  assigned: "Someone is assigned",
  in_progress: "Being fixed",
  resolved: "Fixed",
  closed: "Closed",
  wont_fix: "Won't be fixed",
  cancelled: "Cancelled",
};

/** How long after a fault is settled (fixed, closed or refused) the tenant may say it is not right. */
export const FAULT_REOPEN_DAYS = 14;

/** The states a tenant may reopen. */
export const REOPENABLE_STATUSES: readonly MaintenanceStatus[] = ["resolved", "closed", "wont_fix"];

/**
 * The last Kigali day the tenant may reopen a fault settled at `resolvedAt`,
 * or null when it cannot be reopened (still open, cancelled, or the 14 days
 * have passed).
 */
export function faultReopenUntil(
  status: MaintenanceStatus,
  resolvedAt: string | Date | null,
  today: string = kigaliToday(),
): string | null {
  if (!REOPENABLE_STATUSES.includes(status) || !resolvedAt) return null;
  const until = addDays(kigaliDateOf(resolvedAt), FAULT_REOPEN_DAYS);
  return today <= until ? until : null;
}

// --- Words --------------------------------------------------------------------

export const FAULT_CATEGORY_LABEL: Readonly<Record<MaintenanceCategory, string>> = {
  plumbing: "Water and plumbing",
  electrical: "Electricity",
  hvac: "Heating or air",
  appliance: "Appliance",
  furniture: "Furniture",
  it_tech: "Internet or TV",
  safety: "Safety and security",
  other: "Something else",
  doors_windows: "Doors, windows and locks",
  decoration: "Walls and paint",
};

export const FAULT_URGENCY_LABEL: Readonly<Record<MaintenancePriority, string>> = {
  low: "Can wait",
  normal: "Soon",
  high: "Urgent",
  urgent: "Emergency",
};

/** Who did something on a fault's timeline. */
export const FaultActorRole = z.enum(["tenant", "landlord", "system"]);
export type FaultActorRole = z.infer<typeof FaultActorRole>;

/** Whom a fault is handed to: someone on the landlord's team, or an outside fixer. */
export const FaultAssigneeKind = z.enum(["member", "contractor"]);
export type FaultAssigneeKind = z.infer<typeof FaultAssigneeKind>;

/** When a photo was taken: with the report, while the work went on, or of the fix. */
export const FaultPhotoPhase = z.enum(["report", "progress", "fixed"]);
export type FaultPhotoPhase = z.infer<typeof FaultPhotoPhase>;
export const FAULT_PHOTO_PHASE_LABEL: Readonly<Record<FaultPhotoPhase, string>> = {
  report: "When reported",
  progress: "During the work",
  fixed: "After the fix",
};

/** At most this many photos in each phase. */
export const FAULT_PHOTOS_PER_PHASE = 4;
/** One photo is at most 10 MB. */
export const FAULT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * The sentence a timeline shows for a move, in plain words. `who` is the
 * assignee for an assignment ("Eric is assigned to fix it."). The tenant reads
 * the same sentence about their landlord.
 */
export function faultMoveWords(to: MaintenanceStatus, opts: { from?: MaintenanceStatus | null; who?: string | null; byTenant?: boolean } = {}): string {
  switch (to) {
    case "open":
      return opts.byTenant ? "Reopened: the tenant says it is not fixed." : opts.from ? "Reopened." : "Reported.";
    case "acknowledged":
      return "Your landlord has seen the report.";
    case "assigned":
      return opts.who ? `${opts.who} is assigned to fix it.` : "Someone is assigned to fix it.";
    case "in_progress":
      return "Work has started.";
    case "resolved":
      return "Marked fixed.";
    case "closed":
      return "Closed.";
    case "wont_fix":
      return "Your landlord won't fix this.";
    case "cancelled":
      return "Cancelled.";
  }
}

// --- Requests --------------------------------------------------------------------

/** Which faults a landlord's list shows. Reported is new (open or seen); In hand is assigned or being worked. */
export const FaultTab = z.enum(["open", "in_hand", "fixed", "closed"]);
export type FaultTab = z.infer<typeof FaultTab>;
export const FAULT_TAB_LABEL: Readonly<Record<FaultTab, string>> = {
  open: "Reported",
  in_hand: "In hand",
  fixed: "Fixed",
  closed: "Closed",
};
export const FAULT_TAB_STATUSES: Readonly<Record<FaultTab, readonly MaintenanceStatus[]>> = {
  open: ["open", "acknowledged"],
  in_hand: ["assigned", "in_progress"],
  fixed: ["resolved"],
  closed: ["closed", "wont_fix", "cancelled"],
};

/** The tab a status sits under. */
export function faultTabOf(status: MaintenanceStatus): FaultTab {
  return (Object.keys(FAULT_TAB_STATUSES) as FaultTab[]).find((tab) => FAULT_TAB_STATUSES[tab].includes(status)) ?? "closed";
}

/** The fault list's page size. */
export const FAULT_PAGE_SIZE = 25;

/** `GET /ops/faults?tab&unitId&q&page`. No tab: every fault. */
export const FaultListQuery = z.object({
  tab: FaultTab.optional(),
  unitId: Uuid.optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export type FaultListQuery = z.infer<typeof FaultListQuery>;

const FaultTitle = z
  .string({ required_error: "Say what is wrong." })
  .trim()
  .min(3, "Say what is wrong in a few words.")
  .max(120, "Keep the title under 120 characters.");

const FaultDescription = z
  .string()
  .trim()
  .max(2000, "Keep it under 2000 characters.")
  .optional()
  .transform((v) => (v ? v : undefined));

/** `true`, `false`, `"true"`, `"false"`, `"on"`: a checkbox from a form or a JSON body. */
const FormBoolean = z.preprocess((v) => {
  if (v === "true" || v === "on" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no" || v === "") return false;
  return v;
}, z.boolean());

/** The tenant reports a fault on their home (photos come as files beside these fields). */
export const ReportFaultRequest = z.object({
  title: FaultTitle,
  category: MaintenanceCategory.default("other"),
  description: FaultDescription,
  urgency: MaintenancePriority.default("normal"),
  /** May someone let themselves in when nobody is home? */
  staffMayEnter: FormBoolean.default(false),
});
export type ReportFaultRequest = z.infer<typeof ReportFaultRequest>;

/** The landlord writes down a fault on a unit: one a tenant phoned in, or one found on a visit. */
export const RaiseFaultRequest = z.object({
  unitId: Uuid,
  title: FaultTitle,
  category: MaintenanceCategory.default("other"),
  description: FaultDescription,
  urgency: MaintenancePriority.default("normal"),
  staffMayEnter: FormBoolean.optional(),
});
export type RaiseFaultRequest = z.infer<typeof RaiseFaultRequest>;

const FaultNote = z
  .string()
  .trim()
  .max(1000, "Keep it under 1000 characters.")
  .optional()
  .transform((v) => (v ? v : undefined));

/** Move a fault along its chain. "Won't fix" needs the reason, which the tenant is told. */
export const MoveFaultRequest = z
  .object({
    to: MaintenanceStatus,
    note: FaultNote,
  })
  .superRefine((v, ctx) => {
    if (v.to === "wont_fix" && (!v.note || v.note.length < 3)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "Say why it won't be fixed. The tenant is told." });
    }
  });
export type MoveFaultRequest = z.infer<typeof MoveFaultRequest>;

/** Hand a fault to someone on the team, or to an outside fixer with their phone. */
export const AssignFaultRequest = z
  .object({
    memberUserId: Uuid.optional(),
    contractorName: z
      .string()
      .trim()
      .max(120, "Keep the name under 120 characters.")
      .optional()
      .transform((v) => (v ? v : undefined)),
    contractorPhone: RwPhoneNumber.optional(),
    note: FaultNote,
  })
  .superRefine((v, ctx) => {
    const member = Boolean(v.memberUserId);
    const contractor = Boolean(v.contractorName || v.contractorPhone);
    if (member === contractor) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["memberUserId"], message: "Pick someone on your team, or name a fixer." });
      return;
    }
    if (contractor && (!v.contractorName || v.contractorName.length < 2)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contractorName"], message: "Enter the fixer's name." });
    }
    if (contractor && !v.contractorPhone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contractorPhone"], message: "Enter the fixer's phone, like 0788 123 456." });
    }
  });
export type AssignFaultRequest = z.infer<typeof AssignFaultRequest>;

const MessageBody = z
  .string({ required_error: "Write a message." })
  .trim()
  .min(1, "Write a message.")
  .max(2000, "Keep it under 2000 characters.");

/** A landlord's message on a fault: a reply the tenant sees, or a note for the team only. */
export const FaultMessageRequest = z.object({
  body: MessageBody,
  visibleToTenant: FormBoolean.default(true),
});
export type FaultMessageRequest = z.infer<typeof FaultMessageRequest>;

/** The tenant's message on their fault. */
export const TenantFaultMessageRequest = z.object({ body: MessageBody });
export type TenantFaultMessageRequest = z.infer<typeof TenantFaultMessageRequest>;

/** The tenant says the fix did not hold, or asks again after "won't fix". */
export const ReopenFaultRequest = z.object({
  reason: z
    .string({ required_error: "Say what is still wrong." })
    .trim()
    .min(3, "Say what is still wrong.")
    .max(1000, "Keep it under 1000 characters."),
});
export type ReopenFaultRequest = z.infer<typeof ReopenFaultRequest>;

/** `POST …/photos`: which phase the files are of (the files themselves are multipart). */
export const FaultPhotoFields = z.object({ phase: FaultPhotoPhase.default("report") });
export type FaultPhotoFields = z.infer<typeof FaultPhotoFields>;

// --- Views -------------------------------------------------------------------------

/** Whoever is fixing it. The phone is the landlord's to see; the tenant gets the name. */
export const FaultAssigneeView = z.object({
  kind: FaultAssigneeKind,
  userId: Uuid.nullable(),
  name: z.string(),
  phone: z.string().nullable(),
});
export type FaultAssigneeView = z.infer<typeof FaultAssigneeView>;

/** One row of the landlord's fault list. */
export const FaultListItem = z.object({
  id: Uuid,
  reference: z.string().nullable(),
  title: z.string(),
  category: MaintenanceCategory.nullable(),
  urgency: MaintenancePriority,
  status: MaintenanceStatus,
  tab: FaultTab,
  unitId: Uuid.nullable(),
  unitLabel: z.string().nullable(),
  propertyId: Uuid.nullable(),
  propertyName: z.string().nullable(),
  leaseId: Uuid.nullable(),
  leaseReference: z.string().nullable(),
  tenantName: z.string().nullable(),
  /** Who reported it: the tenant from their home, or the landlord's side. */
  reportedBy: z.enum(["tenant", "landlord"]),
  reportedAt: IsoMoment,
  updatedAt: IsoMoment,
  assigneeName: z.string().nullable(),
  photoCount: z.number().int(),
});
export type FaultListItem = z.infer<typeof FaultListItem>;

export const FaultCounts = z.record(FaultTab, z.number().int());
export type FaultCounts = z.infer<typeof FaultCounts>;

export const FaultListPage = z.object({
  items: z.array(FaultListItem),
  total: z.number().int(),
  page: z.number().int().min(1),
  pageSize: z.number().int(),
  tab: FaultTab.nullable(),
  counts: FaultCounts,
});
export type FaultListPage = z.infer<typeof FaultListPage>;

export const FaultPhotoView = z.object({
  id: Uuid,
  url: z.string(),
  phase: FaultPhotoPhase,
  position: z.number().int(),
  byTenant: z.boolean(),
  uploadedAt: IsoMoment,
});
export type FaultPhotoView = z.infer<typeof FaultPhotoView>;

/** One line of a fault's timeline. `words` is the plain sentence; `note` is what the person wrote. */
export const FaultEventView = z.object({
  id: Uuid,
  kind: z.string(),
  from: MaintenanceStatus.nullable(),
  to: MaintenanceStatus.nullable(),
  words: z.string(),
  note: z.string().nullable(),
  actorName: z.string().nullable(),
  actorRole: FaultActorRole,
  visibleToTenant: z.boolean(),
  at: IsoMoment,
});
export type FaultEventView = z.infer<typeof FaultEventView>;

/** One fault in full, for the landlord's side panel. */
export const FaultDetail = FaultListItem.extend({
  description: z.string().nullable(),
  staffMayEnter: z.boolean().nullable(),
  assignee: FaultAssigneeView.nullable(),
  acknowledgedAt: IsoMoment.nullable(),
  resolvedAt: IsoMoment.nullable(),
  wontFixReason: z.string().nullable(),
  reopenedCount: z.number().int(),
  /** The last day the tenant may reopen it, while they still may. */
  reopenUntil: z.string().nullable(),
  /** The moves the "Move to" menu offers: only the legal ones. */
  allowedMoves: z.array(MaintenanceStatus),
  /** The Kigali day it was reported: a payment for it cannot be dated before it. */
  reportedOn: z.string(),
  photos: z.array(FaultPhotoView),
  events: z.array(FaultEventView),
  /** What was paid for the fix (WP 4.3). Null for someone who may not see the money. */
  payments: z.array(FaultPaymentView).nullable(),
  /** The fix's cost so far: paid and recorded, not voided. Null with `payments`. */
  paidRwf: z.number().int().nullable(),
});
export type FaultDetail = z.infer<typeof FaultDetail>;

/** One of the tenant's faults: no money, no team notes, no fixer's phone. */
export const TenantFaultItem = z.object({
  id: Uuid,
  reference: z.string().nullable(),
  title: z.string(),
  category: MaintenanceCategory.nullable(),
  urgency: MaintenancePriority,
  status: MaintenanceStatus,
  statusWords: z.string(),
  reportedAt: IsoMoment,
  updatedAt: IsoMoment,
  assigneeName: z.string().nullable(),
  photoCount: z.number().int(),
  reopenUntil: z.string().nullable(),
});
export type TenantFaultItem = z.infer<typeof TenantFaultItem>;

export const TenantFaultList = z.object({ items: z.array(TenantFaultItem) });
export type TenantFaultList = z.infer<typeof TenantFaultList>;

export const TenantFaultDetail = TenantFaultItem.extend({
  description: z.string().nullable(),
  staffMayEnter: z.boolean().nullable(),
  wontFixReason: z.string().nullable(),
  canReopen: z.boolean(),
  photos: z.array(FaultPhotoView),
  /** Only what the tenant may see. */
  events: z.array(FaultEventView),
});
export type TenantFaultDetail = z.infer<typeof TenantFaultDetail>;

/** The app's fault pages a mail opens. */
export const FAULT_APP_PATHS = {
  tenantFaults: (leaseId: string): string => `/home/${encodeURIComponent(leaseId)}/faults`,
  landlordFault: (ticketId: string): string => `/faults/${encodeURIComponent(ticketId)}`,
} as const;
