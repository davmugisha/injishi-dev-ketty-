"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecideAccessRequest = exports.AnswerRenewalRequest = exports.RecordNoticeRequest = exports.GiveNoticeRequest = exports.SendRentRemindersRequest = exports.RecordRentPaymentRequest = exports.IssueVisitorPassRequest = exports.ResidenceRepairMessageRequest = exports.MoveResidenceRepairRequest = exports.RaiseResidenceRepairRequest = exports.ResidenceWriteResult = exports.ResidenceView = exports.ResidenceNotificationRow = exports.ResidencePayoutRow = exports.ResidenceApplicationRow = exports.ResidenceClauseRow = exports.ResidenceVisitorLogRow = exports.ResidenceAccessRequestRow = exports.ResidencePassRow = exports.ResidenceTicketMessage = exports.ResidenceTicketNote = exports.ResidenceTicketRow = exports.ResidencePhoto = exports.ResidenceDepositRow = exports.ResidenceFilingRow = exports.ResidenceOfferRow = exports.ResidenceNoticeRow = exports.ResidenceReminderRow = exports.ResidencePaymentRow = exports.ResidenceChargeRow = exports.ResidenceLeaseRow = exports.ResidenceUnitRow = exports.ResidenceBlockRow = exports.ResidenceProperty = exports.MAX_OVERNIGHT_NIGHTS = exports.SCREENING_CHECK_IDS = exports.ScreeningCheckId = exports.ApplicationDocumentState = exports.ApplicationStage = exports.RepairCostBearer = exports.AccessRequestStatus = exports.AccessRequestKind = exports.VisitorPassStatus = exports.VisitorPassKind = exports.NoticeChannel = exports.NoticeReasonCode = exports.RenewalOfferStatus = exports.RentReminderChannel = exports.RentPaymentStatus = exports.RentPaymentMethod = void 0;
exports.ConvertApplicationRequest = exports.DeclineApplicationRequest = exports.RecordScreeningRequest = void 0;
const zod_1 = require("zod");
const ops_1 = require("./ops");
const primitives_1 = require("./primitives");
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
const IsoDate = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-15.");
const Instant = zod_1.z.string();
const Rwf = zod_1.z.number().int();
// ---------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------
/** How a rent payment arrived. A code, never the label a screen shows. */
exports.RentPaymentMethod = zod_1.z.enum(["mtn_momo", "airtel_money", "bank_transfer", "cash"]);
/**
 * Where a rent payment stands. `pending` and `unknown` are never counted as collected: only a
 * `verified` payment is money the landlord has, and `rent_charges.paid_amount_rwf` counts only those.
 */
exports.RentPaymentStatus = zod_1.z.enum(["pending", "verified", "unknown", "failed"]);
exports.RentReminderChannel = zod_1.z.enum(["in_app", "in_app_email", "email", "call", "letter"]);
/** A landlord's renewal offer, from sent to answered (and, once both sign the amendment, signed). */
exports.RenewalOfferStatus = zod_1.z.enum(["open", "accepted", "declined", "withdrawn", "signed"]);
/** Why a resident is leaving, as the notice form offers it (resident.noticeReasons). */
exports.NoticeReasonCode = zod_1.z.enum(["kigali", "leaving", "own-home", "terms", "other"]);
/** How a move-out notice reached the landlord. Notice in the app counts as written notice. */
exports.NoticeChannel = zod_1.z.enum(["app", "letter", "email", "in_person"]);
exports.VisitorPassKind = zod_1.z.enum(["guest", "contractor"]);
/** `expired` is also what an `expected` or `approved` code reads once its window has closed. */
exports.VisitorPassStatus = zod_1.z.enum(["expected", "approved", "used", "expired", "revoked"]);
/** What the gate asks management to decide: a long overnight stay, a delivery, an entry without a code. */
exports.AccessRequestKind = zod_1.z.enum(["overnight", "delivery", "gate_entry"]);
exports.AccessRequestStatus = zod_1.z.enum(["open", "approved", "declined"]);
/** Who pays for a repair: the landlord, the tenant (misuse), or not decided yet. */
exports.RepairCostBearer = zod_1.z.enum(["landlord", "tenant", "to_be_decided"]);
/** An application to rent a unit, from invitation to a lease draft. */
exports.ApplicationStage = zod_1.z.enum(["invited", "screening", "ready", "declined", "converted"]);
exports.ApplicationDocumentState = zod_1.z.enum(["requested", "waiting", "uploaded", "checked"]);
/**
 * The manual screening checklist, in the order the screen lists it (residence.screeningChecks).
 * An application is ready for a lease draft only when every one of them is recorded.
 */
exports.ScreeningCheckId = zod_1.z.enum(["identity", "income", "employment", "reference", "balance", "rules"]);
exports.SCREENING_CHECK_IDS = exports.ScreeningCheckId.options;
/** Overnight visits longer than this need management's approval (the "visitors" lease clause). */
exports.MAX_OVERNIGHT_NIGHTS = 7;
// ---------------------------------------------------------------------------
// The read model
// ---------------------------------------------------------------------------
exports.ResidenceProperty = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    /** The landlord's legal name. */
    landlord: zod_1.z.string(),
    /** A residence org carries a UPI and no TIN (D24); either may be absent. */
    upi: zod_1.z.string().nullable(),
    tin: zod_1.z.string().nullable(),
});
exports.ResidenceBlockRow = zod_1.z.object({ id: primitives_1.Uuid, code: zod_1.z.string(), name: zod_1.z.string(), kind: zod_1.z.string() });
exports.ResidenceUnitRow = zod_1.z.object({
    roomId: primitives_1.Uuid,
    label: zod_1.z.string(),
    /** The block's code ("A"). */
    block: zod_1.z.string(),
    type: zod_1.z.string(),
    askingRentRwf: Rwf,
    vacantSince: IsoDate.nullable(),
    note: zod_1.z.string().nullable(),
});
exports.ResidenceLeaseRow = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string().nullable(),
    roomId: primitives_1.Uuid,
    unitLabel: zod_1.z.string(),
    status: zod_1.z.enum(["draft", "pending_signature", "active", "ending", "ended", "cancelled"]),
    tenantUserId: primitives_1.Uuid.nullable(),
    tenantName: zod_1.z.string().nullable(),
    monthlyRentRwf: Rwf.nullable(),
    cautionRwf: Rwf.nullable(),
    startDate: IsoDate.nullable(),
    endDate: IsoDate.nullable(),
    rentDueDay: zod_1.z.number().int().nullable(),
    graceDays: zod_1.z.number().int().nullable(),
    noticePeriodDays: zod_1.z.number().int().nullable(),
    occupants: zod_1.z.string().nullable(),
    landlordSignedAt: Instant.nullable(),
    tenantSignedAt: Instant.nullable(),
});
exports.ResidenceChargeRow = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    periodMonth: IsoDate,
    amountRwf: Rwf,
    /** Verified money only. */
    paidAmountRwf: Rwf,
    status: zod_1.z.enum(["paid", "due", "overdue"]),
    dueDate: IsoDate.nullable(),
    paidAt: Instant.nullable(),
});
exports.ResidencePaymentRow = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    rentChargeId: primitives_1.Uuid,
    amountRwf: Rwf,
    method: exports.RentPaymentMethod,
    providerRef: zod_1.z.string(),
    status: exports.RentPaymentStatus,
    receivedAt: Instant,
    verifiedAt: Instant.nullable(),
    recordedByName: zod_1.z.string().nullable(),
});
exports.ResidenceReminderRow = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    channel: exports.RentReminderChannel,
    note: zod_1.z.string(),
    sentAt: Instant,
    readAt: Instant.nullable(),
    sentByName: zod_1.z.string().nullable(),
});
exports.ResidenceNoticeRow = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    moveOutDate: IsoDate,
    reasonCode: exports.NoticeReasonCode.nullable(),
    message: zod_1.z.string().nullable(),
    filedVia: exports.NoticeChannel.nullable(),
    filedAt: Instant,
    noticeGivenDays: zod_1.z.number().int().nullable(),
    isShortNotice: zod_1.z.boolean(),
});
exports.ResidenceOfferRow = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    status: exports.RenewalOfferStatus,
    offeredRentRwf: Rwf,
    termMonths: zod_1.z.number().int(),
    startsOn: IsoDate,
    endsOn: IsoDate,
    answerBy: IsoDate,
    depositTopupRwf: Rwf,
    otherTerms: zod_1.z.string().nullable(),
    sentAt: Instant,
    sentByName: zod_1.z.string().nullable(),
    openedAt: Instant.nullable(),
    remindedAt: Instant.nullable(),
    answeredAt: Instant.nullable(),
    signedAt: Instant.nullable(),
});
/** The filing of a signed lease (F-R10), as the adapter job records it. */
exports.ResidenceFilingRow = zod_1.z.object({
    leaseId: primitives_1.Uuid,
    status: zod_1.z.enum(["pending", "filed", "failed"]),
    dueBy: Instant.nullable(),
    clockStartAt: Instant.nullable(),
});
exports.ResidenceDepositRow = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    amountRwf: Rwf,
    status: zod_1.z.enum(["held", "refunded", "forfeited"]),
    heldAt: Instant,
    refundedRwf: Rwf.nullable(),
    forfeitedRwf: Rwf.nullable(),
    settledAt: Instant.nullable(),
});
exports.ResidencePhoto = zod_1.z.object({ key: zod_1.z.string(), caption: zod_1.z.string() });
exports.ResidenceTicketRow = zod_1.z.object({
    id: primitives_1.Uuid,
    /** "WO-345". */
    reference: zod_1.z.string().nullable(),
    leaseId: primitives_1.Uuid.nullable(),
    roomId: primitives_1.Uuid.nullable(),
    unitLabel: zod_1.z.string().nullable(),
    /** A common area ("Block B"), when the ticket is about one. */
    spaceName: zod_1.z.string().nullable(),
    title: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    category: ops_1.MaintenanceCategory.nullable(),
    status: ops_1.MaintenanceStatus,
    staffMayEnter: zod_1.z.boolean().nullable(),
    assignedContractor: zod_1.z.string().nullable(),
    assignedToName: zod_1.z.string().nullable(),
    scheduledFor: IsoDate.nullable(),
    visitWindow: zod_1.z.string().nullable(),
    costBearer: exports.RepairCostBearer.nullable(),
    costNote: zod_1.z.string().nullable(),
    raisedVia: zod_1.z.string().nullable(),
    raisedByName: zod_1.z.string().nullable(),
    raisedByRole: zod_1.z.enum(["guest", "tenant", "staff", "housekeeper"]).nullable(),
    photos: zod_1.z.array(exports.ResidencePhoto),
    createdAt: Instant,
    resolvedAt: Instant.nullable(),
    /** The conversation with the resident, when the ticket is on a tenancy. */
    threadId: primitives_1.Uuid.nullable(),
});
/** A staff note on a ticket: never shown to a resident. */
exports.ResidenceTicketNote = zod_1.z.object({
    id: primitives_1.Uuid,
    ticketId: primitives_1.Uuid,
    authorName: zod_1.z.string().nullable(),
    note: zod_1.z.string(),
    createdAt: Instant,
});
/** A line of a ticket's conversation with the resident, phone numbers scrubbed as on every surface. */
exports.ResidenceTicketMessage = zod_1.z.object({
    id: primitives_1.Uuid,
    ticketId: primitives_1.Uuid,
    fromTenant: zod_1.z.boolean(),
    senderName: zod_1.z.string().nullable(),
    body: zod_1.z.string(),
    createdAt: Instant,
});
exports.ResidencePassRow = zod_1.z.object({
    id: primitives_1.Uuid,
    roomId: primitives_1.Uuid,
    unitLabel: zod_1.z.string(),
    leaseId: primitives_1.Uuid.nullable(),
    kind: exports.VisitorPassKind,
    visitorName: zod_1.z.string(),
    code: zod_1.z.string(),
    validFrom: Instant,
    validTo: Instant,
    overnight: zod_1.z.boolean(),
    status: exports.VisitorPassStatus,
    createdByName: zod_1.z.string().nullable(),
    /** Registered by the resident rather than by management. */
    byTenant: zod_1.z.boolean(),
    usedAt: Instant.nullable(),
    leftAt: Instant.nullable(),
});
exports.ResidenceAccessRequestRow = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    kind: exports.AccessRequestKind,
    visitorName: zod_1.z.string().nullable(),
    reason: zod_1.z.string().nullable(),
    forDate: IsoDate.nullable(),
    toDate: IsoDate.nullable(),
    status: exports.AccessRequestStatus,
    requestedAt: Instant,
});
exports.ResidenceVisitorLogRow = zod_1.z.object({
    id: primitives_1.Uuid,
    visitorName: zod_1.z.string(),
    /** Masked: the log keeps who came, never a number anyone can call. */
    visitorPhone: zod_1.z.string().nullable(),
    roomId: primitives_1.Uuid.nullable(),
    unitLabel: zod_1.z.string().nullable(),
    leaseId: primitives_1.Uuid.nullable(),
    /** Where in the compound, when it is not a unit ("Block C · roof"). */
    place: zod_1.z.string().nullable(),
    admittedHow: zod_1.z.string().nullable(),
    recordedBy: zod_1.z.string().nullable(),
    arrivalAt: Instant.nullable(),
    departureAt: Instant.nullable(),
});
exports.ResidenceClauseRow = zod_1.z.object({
    code: zod_1.z.string(),
    title: zod_1.z.string(),
    note: zod_1.z.string(),
    needsReview: zod_1.z.boolean(),
});
exports.ResidenceApplicationRow = zod_1.z.object({
    id: primitives_1.Uuid,
    roomId: primitives_1.Uuid,
    unitLabel: zod_1.z.string(),
    name: zod_1.z.string(),
    email: zod_1.z.string().nullable(),
    phone: zod_1.z.string().nullable(),
    stage: exports.ApplicationStage,
    source: zod_1.z.string(),
    broker: zod_1.z
        .object({ name: zod_1.z.string(), referredAt: Instant, feeRwf: Rwf, terms: zod_1.z.string() })
        .nullable(),
    desiredMoveIn: IsoDate.nullable(),
    termMonths: zod_1.z.number().int().nullable(),
    occupants: zod_1.z.string().nullable(),
    offeredRentRwf: Rwf.nullable(),
    depositRwf: Rwf.nullable(),
    screening: zod_1.z.array(exports.ScreeningCheckId),
    documents: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), note: zod_1.z.string(), state: exports.ApplicationDocumentState })),
    createdAt: Instant,
    leaseId: primitives_1.Uuid.nullable(),
});
exports.ResidencePayoutRow = zod_1.z.object({
    id: primitives_1.Uuid,
    /** The month of rent the settlement covers. */
    periodMonth: IsoDate.nullable(),
    amountRwf: Rwf,
    status: zod_1.z.enum(["scheduled", "queued", "paid", "held"]),
    destination: zod_1.z.enum(["momo", "bank"]).nullable(),
    destinationRef: zod_1.z.string().nullable(),
    scheduledReleaseAt: Instant.nullable(),
    settledAt: Instant.nullable(),
});
/** An in-app notice to the tenant (water off, a renewal ready, a rent reminder). */
exports.ResidenceNotificationRow = zod_1.z.object({
    id: primitives_1.Uuid,
    title: zod_1.z.string(),
    body: zod_1.z.string().nullable(),
    category: zod_1.z.string(),
    createdAt: Instant,
    readAt: Instant.nullable(),
});
/**
 * Everything the residence screens read, for one business (`/ops/residence`) or one tenant
 * (`/me/residence`). A part the caller may not read comes back empty rather than refused: rent and
 * deposits need `money.view` or `rent.record`, tickets `ticket.advance`, the rest `lease.manage`.
 * The tenant's copy never carries staff notes, other tenants' rows, applications or clauses.
 */
exports.ResidenceView = zod_1.z.object({
    property: exports.ResidenceProperty.nullable(),
    blocks: zod_1.z.array(exports.ResidenceBlockRow),
    units: zod_1.z.array(exports.ResidenceUnitRow),
    leases: zod_1.z.array(exports.ResidenceLeaseRow),
    charges: zod_1.z.array(exports.ResidenceChargeRow),
    payments: zod_1.z.array(exports.ResidencePaymentRow),
    reminders: zod_1.z.array(exports.ResidenceReminderRow),
    notices: zod_1.z.array(exports.ResidenceNoticeRow),
    offers: zod_1.z.array(exports.ResidenceOfferRow),
    filings: zod_1.z.array(exports.ResidenceFilingRow),
    deposits: zod_1.z.array(exports.ResidenceDepositRow),
    tickets: zod_1.z.array(exports.ResidenceTicketRow),
    ticketNotes: zod_1.z.array(exports.ResidenceTicketNote),
    ticketMessages: zod_1.z.array(exports.ResidenceTicketMessage),
    passes: zod_1.z.array(exports.ResidencePassRow),
    accessRequests: zod_1.z.array(exports.ResidenceAccessRequestRow),
    visitorLog: zod_1.z.array(exports.ResidenceVisitorLogRow),
    clauses: zod_1.z.array(exports.ResidenceClauseRow),
    applications: zod_1.z.array(exports.ResidenceApplicationRow),
    payouts: zod_1.z.array(exports.ResidencePayoutRow),
    notifications: zod_1.z.array(exports.ResidenceNotificationRow),
});
// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
/** What every residence command answers: the record it wrote, by id and (where it has one) its human reference. */
exports.ResidenceWriteResult = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string().nullable(),
    /** A gate code, when the command issued one. */
    code: zod_1.z.string().nullable(),
});
/**
 * Raise a repair. `unit` is a unit label ("B-07"), or a block code ("B") for a common area, which
 * only management may raise. A resident names their own unit; any other is a 404.
 */
exports.RaiseResidenceRepairRequest = zod_1.z.object({
    unit: zod_1.z.string().trim().min(1).max(40),
    title: zod_1.z.string().trim().min(1, "Say what needs fixing.").max(200),
    description: zod_1.z.string().trim().max(4000).optional(),
    category: ops_1.MaintenanceCategory,
    /** May staff let themselves in when nobody is home? Null for a common area. */
    staffMayEnter: zod_1.z.boolean().nullable(),
});
/** Move a repair on the board. The board names where it goes; the API refuses a move its machine does not allow. */
exports.MoveResidenceRepairRequest = zod_1.z.object({
    to: zod_1.z.enum(["assigned", "in_progress", "resolved"]),
});
/** A reply to the resident (into the ticket's conversation) or an internal note (staff only). */
exports.ResidenceRepairMessageRequest = zod_1.z.object({
    text: zod_1.z.string().trim().min(1).max(4000),
    internal: zod_1.z.boolean(),
});
/** Issue a gate code. The window is Kigali time; the server mints the code. */
exports.IssueVisitorPassRequest = zod_1.z
    .object({
    unit: zod_1.z.string().trim().min(1).max(40),
    visitorName: zod_1.z.string().trim().min(1, "Name the visitor.").max(200),
    validFrom: zod_1.z.string().datetime({ offset: true }),
    validTo: zod_1.z.string().datetime({ offset: true }),
    overnight: zod_1.z.boolean(),
    kind: exports.VisitorPassKind.default("guest"),
})
    .refine((v) => Date.parse(v.validTo) > Date.parse(v.validFrom), {
    message: "The visit has to end after it starts.",
    path: ["validTo"],
});
/**
 * Record a rent payment received outside the app (a bank slip, cash at the office). It is saved as
 * PENDING and is not counted as collected until Payments matches it to the bank statement or the
 * provider's report; it goes to the oldest open charge of the lease. Takes an `Idempotency-Key`.
 */
exports.RecordRentPaymentRequest = zod_1.z.object({
    unit: zod_1.z.string().trim().min(1).max(40),
    amountRwf: zod_1.z.number().int().positive("Enter what was actually paid."),
    method: exports.RentPaymentMethod,
    providerRef: zod_1.z.string().trim().min(3, "Enter the bank or provider reference.").max(120),
});
/** Remind residents of rent they owe: an in-app notice to each tenant with an account, logged per lease. */
exports.SendRentRemindersRequest = zod_1.z.object({
    units: zod_1.z.array(zod_1.z.string().trim().min(1).max(40)).min(1).max(200),
    message: zod_1.z.string().trim().min(1, "Write the reminder.").max(2000),
});
/**
 * A move-out notice. The resident gives it in the app (`/me`); management records one that came by
 * letter, email or in person (`/ops`). Notice shorter than the lease's period is refused.
 */
exports.GiveNoticeRequest = zod_1.z.object({
    moveOutDate: IsoDate,
    reason: exports.NoticeReasonCode,
    message: zod_1.z.string().trim().max(4000).optional(),
});
exports.RecordNoticeRequest = zod_1.z.object({
    unit: zod_1.z.string().trim().min(1).max(40),
    receivedOn: IsoDate,
    moveOutDate: IsoDate,
    channel: exports.NoticeChannel,
});
/** The resident's answer to a renewal offer. */
exports.AnswerRenewalRequest = zod_1.z.object({ answer: zod_1.z.enum(["accepted", "declined"]) });
/** Management's decision on a gate or overnight request. */
exports.DecideAccessRequest = zod_1.z.object({ decision: zod_1.z.enum(["approved", "declined"]) });
/** The manual screening checks recorded so far, as a set. */
exports.RecordScreeningRequest = zod_1.z.object({ done: zod_1.z.array(exports.ScreeningCheckId).max(exports.SCREENING_CHECK_IDS.length) });
/** Decline an application, with the reason the applicant is told. */
exports.DeclineApplicationRequest = zod_1.z.object({ reason: zod_1.z.string().trim().min(3).max(1000) });
/**
 * Turn a ready application into a lease DRAFT. Nothing is signed: the draft holds the unit while it
 * is out for signature, and a lease goes active only through `/ops/leases/:id/advance` once both
 * sides have signed.
 */
exports.ConvertApplicationRequest = zod_1.z.object({
    startDate: IsoDate,
    termMonths: zod_1.z.number().int().min(1).max(120),
    monthlyRentRwf: zod_1.z.number().int().positive(),
    cautionRwf: zod_1.z.number().int().nonnegative(),
    noticePeriodDays: zod_1.z.number().int().min(0).max(365),
    rentDueDay: zod_1.z.number().int().min(1).max(28),
});
//# sourceMappingURL=interface-residence.js.map