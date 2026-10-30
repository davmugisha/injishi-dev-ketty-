import { z } from "zod";
import { MaintenanceCategory, MaintenanceStatus } from "./ops";
import { Uuid } from "./primitives";

/**
 * The residence screens of the new interface (real-data 1.3.1): the residence manager's board
 * (`GET /api/v1/ops/residence`, the business's read model) and the tenant's phone
 * (`GET /api/v1/me/residence`, the same shape narrowed to the caller's own tenancies), plus the
 * commands those screens send.
 *
 * One read model per surface rather than one route per collection, because every residence screen
 * joins the same handful of rows (a unit, its lease, the month's charge, the payment in flight) and
 * the joins belong in one place. Money is whole francs. Dates are `YYYY-MM-DD` calendar days in
 * Kigali; instants are ISO strings.
 */

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-15.");
const Instant = z.string();
const Rwf = z.number().int();

// ---------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------

/** How a rent payment arrived. A code, never the label a screen shows. */
export const RentPaymentMethod = z.enum(["mtn_momo", "airtel_money", "bank_transfer", "cash"]);
export type RentPaymentMethod = z.infer<typeof RentPaymentMethod>;

/**
 * Where a rent payment stands. `pending` and `unknown` are never counted as collected: only a
 * `verified` payment is money the landlord has, and `rent_charges.paid_amount_rwf` counts only those.
 */
export const RentPaymentStatus = z.enum(["pending", "verified", "unknown", "failed"]);
export type RentPaymentStatus = z.infer<typeof RentPaymentStatus>;

export const RentReminderChannel = z.enum(["in_app", "in_app_email", "email", "call", "letter"]);
export type RentReminderChannel = z.infer<typeof RentReminderChannel>;

/** A landlord's renewal offer, from sent to answered (and, once both sign the amendment, signed). */
export const RenewalOfferStatus = z.enum(["open", "accepted", "declined", "withdrawn", "signed"]);
export type RenewalOfferStatus = z.infer<typeof RenewalOfferStatus>;

/** Why a resident is leaving, as the notice form offers it (resident.noticeReasons). */
export const NoticeReasonCode = z.enum(["kigali", "leaving", "own-home", "terms", "other"]);
export type NoticeReasonCode = z.infer<typeof NoticeReasonCode>;

/** How a move-out notice reached the landlord. Notice in the app counts as written notice. */
export const NoticeChannel = z.enum(["app", "letter", "email", "in_person"]);
export type NoticeChannel = z.infer<typeof NoticeChannel>;

export const VisitorPassKind = z.enum(["guest", "contractor"]);
export type VisitorPassKind = z.infer<typeof VisitorPassKind>;

/** `expired` is also what an `expected` or `approved` code reads once its window has closed. */
export const VisitorPassStatus = z.enum(["expected", "approved", "used", "expired", "revoked"]);
export type VisitorPassStatus = z.infer<typeof VisitorPassStatus>;

/** What the gate asks management to decide: a long overnight stay, a delivery, an entry without a code. */
export const AccessRequestKind = z.enum(["overnight", "delivery", "gate_entry"]);
export type AccessRequestKind = z.infer<typeof AccessRequestKind>;

export const AccessRequestStatus = z.enum(["open", "approved", "declined"]);
export type AccessRequestStatus = z.infer<typeof AccessRequestStatus>;

/** Who pays for a repair: the landlord, the tenant (misuse), or not decided yet. */
export const RepairCostBearer = z.enum(["landlord", "tenant", "to_be_decided"]);
export type RepairCostBearer = z.infer<typeof RepairCostBearer>;

/** An application to rent a unit, from invitation to a lease draft. */
export const ApplicationStage = z.enum(["invited", "screening", "ready", "declined", "converted"]);
export type ApplicationStage = z.infer<typeof ApplicationStage>;

export const ApplicationDocumentState = z.enum(["requested", "waiting", "uploaded", "checked"]);
export type ApplicationDocumentState = z.infer<typeof ApplicationDocumentState>;

/**
 * The manual screening checklist, in the order the screen lists it (residence.screeningChecks).
 * An application is ready for a lease draft only when every one of them is recorded.
 */
export const ScreeningCheckId = z.enum(["identity", "income", "employment", "reference", "balance", "rules"]);
export type ScreeningCheckId = z.infer<typeof ScreeningCheckId>;
export const SCREENING_CHECK_IDS = ScreeningCheckId.options;

/** Overnight visits longer than this need management's approval (the "visitors" lease clause). */
export const MAX_OVERNIGHT_NIGHTS = 7;

// ---------------------------------------------------------------------------
// The read model
// ---------------------------------------------------------------------------

export const ResidenceProperty = z.object({
    id: Uuid,
    name: z.string(),
    /** The landlord's legal name. */
    landlord: z.string(),
    /** A residence org carries a UPI and no TIN (D24); either may be absent. */
    upi: z.string().nullable(),
    tin: z.string().nullable(),
});

export const ResidenceBlockRow = z.object({ id: Uuid, code: z.string(), name: z.string(), kind: z.string() });

export const ResidenceUnitRow = z.object({
    roomId: Uuid,
    label: z.string(),
    /** The block's code ("A"). */
    block: z.string(),
    type: z.string(),
    askingRentRwf: Rwf,
    vacantSince: IsoDate.nullable(),
    note: z.string().nullable(),
});

export const ResidenceLeaseRow = z.object({
    id: Uuid,
    reference: z.string().nullable(),
    roomId: Uuid,
    unitLabel: z.string(),
    status: z.enum(["draft", "pending_signature", "active", "ending", "ended", "cancelled"]),
    tenantUserId: Uuid.nullable(),
    tenantName: z.string().nullable(),
    monthlyRentRwf: Rwf.nullable(),
    cautionRwf: Rwf.nullable(),
    startDate: IsoDate.nullable(),
    endDate: IsoDate.nullable(),
    rentDueDay: z.number().int().nullable(),
    graceDays: z.number().int().nullable(),
    noticePeriodDays: z.number().int().nullable(),
    occupants: z.string().nullable(),
    landlordSignedAt: Instant.nullable(),
    tenantSignedAt: Instant.nullable(),
});

export const ResidenceChargeRow = z.object({
    id: Uuid,
    leaseId: Uuid,
    periodMonth: IsoDate,
    amountRwf: Rwf,
    /** Verified money only. */
    paidAmountRwf: Rwf,
    status: z.enum(["paid", "due", "overdue"]),
    dueDate: IsoDate.nullable(),
    paidAt: Instant.nullable(),
});

export const ResidencePaymentRow = z.object({
    id: Uuid,
    leaseId: Uuid,
    rentChargeId: Uuid,
    amountRwf: Rwf,
    method: RentPaymentMethod,
    providerRef: z.string(),
    status: RentPaymentStatus,
    receivedAt: Instant,
    verifiedAt: Instant.nullable(),
    recordedByName: z.string().nullable(),
});

export const ResidenceReminderRow = z.object({
    id: Uuid,
    leaseId: Uuid,
    channel: RentReminderChannel,
    note: z.string(),
    sentAt: Instant,
    readAt: Instant.nullable(),
    sentByName: z.string().nullable(),
});

export const ResidenceNoticeRow = z.object({
    id: Uuid,
    leaseId: Uuid,
    moveOutDate: IsoDate,
    reasonCode: NoticeReasonCode.nullable(),
    message: z.string().nullable(),
    filedVia: NoticeChannel.nullable(),
    filedAt: Instant,
    noticeGivenDays: z.number().int().nullable(),
    isShortNotice: z.boolean(),
});

export const ResidenceOfferRow = z.object({
    id: Uuid,
    leaseId: Uuid,
    status: RenewalOfferStatus,
    offeredRentRwf: Rwf,
    termMonths: z.number().int(),
    startsOn: IsoDate,
    endsOn: IsoDate,
    answerBy: IsoDate,
    depositTopupRwf: Rwf,
    otherTerms: z.string().nullable(),
    sentAt: Instant,
    sentByName: z.string().nullable(),
    openedAt: Instant.nullable(),
    remindedAt: Instant.nullable(),
    answeredAt: Instant.nullable(),
    signedAt: Instant.nullable(),
});

/** The filing of a signed lease (F-R10), as the adapter job records it. */
export const ResidenceFilingRow = z.object({
    leaseId: Uuid,
    status: z.enum(["pending", "filed", "failed"]),
    dueBy: Instant.nullable(),
    clockStartAt: Instant.nullable(),
});

export const ResidenceDepositRow = z.object({
    id: Uuid,
    leaseId: Uuid,
    amountRwf: Rwf,
    status: z.enum(["held", "refunded", "forfeited"]),
    heldAt: Instant,
    refundedRwf: Rwf.nullable(),
    forfeitedRwf: Rwf.nullable(),
    settledAt: Instant.nullable(),
});

export const ResidencePhoto = z.object({ key: z.string(), caption: z.string() });

export const ResidenceTicketRow = z.object({
    id: Uuid,
    /** "WO-345". */
    reference: z.string().nullable(),
    leaseId: Uuid.nullable(),
    roomId: Uuid.nullable(),
    unitLabel: z.string().nullable(),
    /** A common area ("Block B"), when the ticket is about one. */
    spaceName: z.string().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    category: MaintenanceCategory.nullable(),
    status: MaintenanceStatus,
    staffMayEnter: z.boolean().nullable(),
    assignedContractor: z.string().nullable(),
    assignedToName: z.string().nullable(),
    scheduledFor: IsoDate.nullable(),
    visitWindow: z.string().nullable(),
    costBearer: RepairCostBearer.nullable(),
    costNote: z.string().nullable(),
    raisedVia: z.string().nullable(),
    raisedByName: z.string().nullable(),
    raisedByRole: z.enum(["guest", "tenant", "staff", "housekeeper"]).nullable(),
    photos: z.array(ResidencePhoto),
    createdAt: Instant,
    resolvedAt: Instant.nullable(),
    /** The conversation with the resident, when the ticket is on a tenancy. */
    threadId: Uuid.nullable(),
});

/** A staff note on a ticket: never shown to a resident. */
export const ResidenceTicketNote = z.object({
    id: Uuid,
    ticketId: Uuid,
    authorName: z.string().nullable(),
    note: z.string(),
    createdAt: Instant,
});

/** A line of a ticket's conversation with the resident, phone numbers scrubbed as on every surface. */
export const ResidenceTicketMessage = z.object({
    id: Uuid,
    ticketId: Uuid,
    fromTenant: z.boolean(),
    senderName: z.string().nullable(),
    body: z.string(),
    createdAt: Instant,
});

export const ResidencePassRow = z.object({
    id: Uuid,
    roomId: Uuid,
    unitLabel: z.string(),
    leaseId: Uuid.nullable(),
    kind: VisitorPassKind,
    visitorName: z.string(),
    code: z.string(),
    validFrom: Instant,
    validTo: Instant,
    overnight: z.boolean(),
    status: VisitorPassStatus,
    createdByName: z.string().nullable(),
    /** Registered by the resident rather than by management. */
    byTenant: z.boolean(),
    usedAt: Instant.nullable(),
    leftAt: Instant.nullable(),
});

export const ResidenceAccessRequestRow = z.object({
    id: Uuid,
    leaseId: Uuid,
    kind: AccessRequestKind,
    visitorName: z.string().nullable(),
    reason: z.string().nullable(),
    forDate: IsoDate.nullable(),
    toDate: IsoDate.nullable(),
    status: AccessRequestStatus,
    requestedAt: Instant,
});

export const ResidenceVisitorLogRow = z.object({
    id: Uuid,
    visitorName: z.string(),
    /** Masked: the log keeps who came, never a number anyone can call. */
    visitorPhone: z.string().nullable(),
    roomId: Uuid.nullable(),
    unitLabel: z.string().nullable(),
    leaseId: Uuid.nullable(),
    /** Where in the compound, when it is not a unit ("Block C · roof"). */
    place: z.string().nullable(),
    admittedHow: z.string().nullable(),
    recordedBy: z.string().nullable(),
    arrivalAt: Instant.nullable(),
    departureAt: Instant.nullable(),
});

export const ResidenceClauseRow = z.object({
    code: z.string(),
    title: z.string(),
    note: z.string(),
    needsReview: z.boolean(),
});

export const ResidenceApplicationRow = z.object({
    id: Uuid,
    roomId: Uuid,
    unitLabel: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    stage: ApplicationStage,
    source: z.string(),
    broker: z
        .object({ name: z.string(), referredAt: Instant, feeRwf: Rwf, terms: z.string() })
        .nullable(),
    desiredMoveIn: IsoDate.nullable(),
    termMonths: z.number().int().nullable(),
    occupants: z.string().nullable(),
    offeredRentRwf: Rwf.nullable(),
    depositRwf: Rwf.nullable(),
    screening: z.array(ScreeningCheckId),
    documents: z.array(z.object({ name: z.string(), note: z.string(), state: ApplicationDocumentState })),
    createdAt: Instant,
    leaseId: Uuid.nullable(),
});

export const ResidencePayoutRow = z.object({
    id: Uuid,
    /** The month of rent the settlement covers. */
    periodMonth: IsoDate.nullable(),
    amountRwf: Rwf,
    status: z.enum(["scheduled", "queued", "paid", "held"]),
    destination: z.enum(["momo", "bank"]).nullable(),
    destinationRef: z.string().nullable(),
    scheduledReleaseAt: Instant.nullable(),
    settledAt: Instant.nullable(),
});

/** An in-app notice to the tenant (water off, a renewal ready, a rent reminder). */
export const ResidenceNotificationRow = z.object({
    id: Uuid,
    title: z.string(),
    body: z.string().nullable(),
    category: z.string(),
    createdAt: Instant,
    readAt: Instant.nullable(),
});

/**
 * Everything the residence screens read, for one business (`/ops/residence`) or one tenant
 * (`/me/residence`). A part the caller may not read comes back empty rather than refused: rent and
 * deposits need `money.view` or `rent.record`, tickets `ticket.advance`, the rest `lease.manage`.
 * The tenant's copy never carries staff notes, other tenants' rows, applications or clauses.
 */
export const ResidenceView = z.object({
    property: ResidenceProperty.nullable(),
    blocks: z.array(ResidenceBlockRow),
    units: z.array(ResidenceUnitRow),
    leases: z.array(ResidenceLeaseRow),
    charges: z.array(ResidenceChargeRow),
    payments: z.array(ResidencePaymentRow),
    reminders: z.array(ResidenceReminderRow),
    notices: z.array(ResidenceNoticeRow),
    offers: z.array(ResidenceOfferRow),
    filings: z.array(ResidenceFilingRow),
    deposits: z.array(ResidenceDepositRow),
    tickets: z.array(ResidenceTicketRow),
    ticketNotes: z.array(ResidenceTicketNote),
    ticketMessages: z.array(ResidenceTicketMessage),
    passes: z.array(ResidencePassRow),
    accessRequests: z.array(ResidenceAccessRequestRow),
    visitorLog: z.array(ResidenceVisitorLogRow),
    clauses: z.array(ResidenceClauseRow),
    applications: z.array(ResidenceApplicationRow),
    payouts: z.array(ResidencePayoutRow),
    notifications: z.array(ResidenceNotificationRow),
});
export type ResidenceView = z.infer<typeof ResidenceView>;

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** What every residence command answers: the record it wrote, by id and (where it has one) its human reference. */
export const ResidenceWriteResult = z.object({
    id: Uuid,
    reference: z.string().nullable(),
    /** A gate code, when the command issued one. */
    code: z.string().nullable(),
});
export type ResidenceWriteResult = z.infer<typeof ResidenceWriteResult>;

/**
 * Raise a repair. `unit` is a unit label ("B-07"), or a block code ("B") for a common area, which
 * only management may raise. A resident names their own unit; any other is a 404.
 */
export const RaiseResidenceRepairRequest = z.object({
    unit: z.string().trim().min(1).max(40),
    title: z.string().trim().min(1, "Say what needs fixing.").max(200),
    description: z.string().trim().max(4000).optional(),
    category: MaintenanceCategory,
    /** May staff let themselves in when nobody is home? Null for a common area. */
    staffMayEnter: z.boolean().nullable(),
});
export type RaiseResidenceRepairRequest = z.infer<typeof RaiseResidenceRepairRequest>;

/** Move a repair on the board. The board names where it goes; the API refuses a move its machine does not allow. */
export const MoveResidenceRepairRequest = z.object({
    to: z.enum(["assigned", "in_progress", "resolved"]),
});
export type MoveResidenceRepairRequest = z.infer<typeof MoveResidenceRepairRequest>;

/** A reply to the resident (into the ticket's conversation) or an internal note (staff only). */
export const ResidenceRepairMessageRequest = z.object({
    text: z.string().trim().min(1).max(4000),
    internal: z.boolean(),
});
export type ResidenceRepairMessageRequest = z.infer<typeof ResidenceRepairMessageRequest>;

/** Issue a gate code. The window is Kigali time; the server mints the code. */
export const IssueVisitorPassRequest = z
    .object({
        unit: z.string().trim().min(1).max(40),
        visitorName: z.string().trim().min(1, "Name the visitor.").max(200),
        validFrom: z.string().datetime({ offset: true }),
        validTo: z.string().datetime({ offset: true }),
        overnight: z.boolean(),
        kind: VisitorPassKind.default("guest"),
    })
    .refine((v) => Date.parse(v.validTo) > Date.parse(v.validFrom), {
        message: "The visit has to end after it starts.",
        path: ["validTo"],
    });
export type IssueVisitorPassRequest = z.infer<typeof IssueVisitorPassRequest>;

/**
 * Record a rent payment received outside the app (a bank slip, cash at the office). It is saved as
 * PENDING and is not counted as collected until Payments matches it to the bank statement or the
 * provider's report; it goes to the oldest open charge of the lease. Takes an `Idempotency-Key`.
 */
export const RecordRentPaymentRequest = z.object({
    unit: z.string().trim().min(1).max(40),
    amountRwf: z.number().int().positive("Enter what was actually paid."),
    method: RentPaymentMethod,
    providerRef: z.string().trim().min(3, "Enter the bank or provider reference.").max(120),
});
export type RecordRentPaymentRequest = z.infer<typeof RecordRentPaymentRequest>;

/** Remind residents of rent they owe: an in-app notice to each tenant with an account, logged per lease. */
export const SendRentRemindersRequest = z.object({
    units: z.array(z.string().trim().min(1).max(40)).min(1).max(200),
    message: z.string().trim().min(1, "Write the reminder.").max(2000),
});
export type SendRentRemindersRequest = z.infer<typeof SendRentRemindersRequest>;

/**
 * A move-out notice. The resident gives it in the app (`/me`); management records one that came by
 * letter, email or in person (`/ops`). Notice shorter than the lease's period is refused.
 */
export const GiveNoticeRequest = z.object({
    moveOutDate: IsoDate,
    reason: NoticeReasonCode,
    message: z.string().trim().max(4000).optional(),
});
export type GiveNoticeRequest = z.infer<typeof GiveNoticeRequest>;

export const RecordNoticeRequest = z.object({
    unit: z.string().trim().min(1).max(40),
    receivedOn: IsoDate,
    moveOutDate: IsoDate,
    channel: NoticeChannel,
});
export type RecordNoticeRequest = z.infer<typeof RecordNoticeRequest>;

/** The resident's answer to a renewal offer. */
export const AnswerRenewalRequest = z.object({ answer: z.enum(["accepted", "declined"]) });
export type AnswerRenewalRequest = z.infer<typeof AnswerRenewalRequest>;

/** Management's decision on a gate or overnight request. */
export const DecideAccessRequest = z.object({ decision: z.enum(["approved", "declined"]) });
export type DecideAccessRequest = z.infer<typeof DecideAccessRequest>;

/** The manual screening checks recorded so far, as a set. */
export const RecordScreeningRequest = z.object({ done: z.array(ScreeningCheckId).max(SCREENING_CHECK_IDS.length) });
export type RecordScreeningRequest = z.infer<typeof RecordScreeningRequest>;

/** Decline an application, with the reason the applicant is told. */
export const DeclineApplicationRequest = z.object({ reason: z.string().trim().min(3).max(1000) });
export type DeclineApplicationRequest = z.infer<typeof DeclineApplicationRequest>;

/**
 * Turn a ready application into a lease DRAFT. Nothing is signed: the draft holds the unit while it
 * is out for signature, and a lease goes active only through `/ops/leases/:id/advance` once both
 * sides have signed.
 */
export const ConvertApplicationRequest = z.object({
    startDate: IsoDate,
    termMonths: z.number().int().min(1).max(120),
    monthlyRentRwf: z.number().int().positive(),
    cautionRwf: z.number().int().nonnegative(),
    noticePeriodDays: z.number().int().min(0).max(365),
    rentDueDay: z.number().int().min(1).max(28),
});
export type ConvertApplicationRequest = z.infer<typeof ConvertApplicationRequest>;
