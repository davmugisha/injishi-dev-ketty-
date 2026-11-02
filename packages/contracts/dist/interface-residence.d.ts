import { z } from "zod";
/** How a rent payment arrived. A code, never the label a screen shows. */
export declare const RentPaymentMethod: z.ZodEnum<["mtn_momo", "airtel_money", "bank_transfer", "cash"]>;
export type RentPaymentMethod = z.infer<typeof RentPaymentMethod>;
/**
 * Where a rent payment stands. `pending` and `unknown` are never counted as collected: only a
 * `verified` payment is money the landlord has, and `rent_charges.paid_amount_rwf` counts only those.
 */
export declare const RentPaymentStatus: z.ZodEnum<["pending", "verified", "unknown", "failed"]>;
export type RentPaymentStatus = z.infer<typeof RentPaymentStatus>;
export declare const RentReminderChannel: z.ZodEnum<["in_app", "in_app_email", "email", "call", "letter"]>;
export type RentReminderChannel = z.infer<typeof RentReminderChannel>;
/** A landlord's renewal offer, from sent to answered (and, once both sign the amendment, signed). */
export declare const RenewalOfferStatus: z.ZodEnum<["open", "accepted", "declined", "withdrawn", "signed"]>;
export type RenewalOfferStatus = z.infer<typeof RenewalOfferStatus>;
/** Why a resident is leaving, as the notice form offers it (resident.noticeReasons). */
export declare const NoticeReasonCode: z.ZodEnum<["kigali", "leaving", "own-home", "terms", "other"]>;
export type NoticeReasonCode = z.infer<typeof NoticeReasonCode>;
/** How a move-out notice reached the landlord. Notice in the app counts as written notice. */
export declare const NoticeChannel: z.ZodEnum<["app", "letter", "email", "in_person"]>;
export type NoticeChannel = z.infer<typeof NoticeChannel>;
export declare const VisitorPassKind: z.ZodEnum<["guest", "contractor"]>;
export type VisitorPassKind = z.infer<typeof VisitorPassKind>;
/** `expired` is also what an `expected` or `approved` code reads once its window has closed. */
export declare const VisitorPassStatus: z.ZodEnum<["expected", "approved", "used", "expired", "revoked"]>;
export type VisitorPassStatus = z.infer<typeof VisitorPassStatus>;
/** What the gate asks management to decide: a long overnight stay, a delivery, an entry without a code. */
export declare const AccessRequestKind: z.ZodEnum<["overnight", "delivery", "gate_entry"]>;
export type AccessRequestKind = z.infer<typeof AccessRequestKind>;
export declare const AccessRequestStatus: z.ZodEnum<["open", "approved", "declined"]>;
export type AccessRequestStatus = z.infer<typeof AccessRequestStatus>;
/** Who pays for a repair: the landlord, the tenant (misuse), or not decided yet. */
export declare const RepairCostBearer: z.ZodEnum<["landlord", "tenant", "to_be_decided"]>;
export type RepairCostBearer = z.infer<typeof RepairCostBearer>;
/** An application to rent a unit, from invitation to a lease draft. */
export declare const ApplicationStage: z.ZodEnum<["invited", "screening", "ready", "declined", "converted"]>;
export type ApplicationStage = z.infer<typeof ApplicationStage>;
export declare const ApplicationDocumentState: z.ZodEnum<["requested", "waiting", "uploaded", "checked"]>;
export type ApplicationDocumentState = z.infer<typeof ApplicationDocumentState>;
/**
 * The manual screening checklist, in the order the screen lists it (residence.screeningChecks).
 * An application is ready for a lease draft only when every one of them is recorded.
 */
export declare const ScreeningCheckId: z.ZodEnum<["identity", "income", "employment", "reference", "balance", "rules"]>;
export type ScreeningCheckId = z.infer<typeof ScreeningCheckId>;
export declare const SCREENING_CHECK_IDS: ["identity", "income", "employment", "reference", "balance", "rules"];
/** Overnight visits longer than this need management's approval (the "visitors" lease clause). */
export declare const MAX_OVERNIGHT_NIGHTS = 7;
export declare const ResidenceProperty: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    /** The landlord's legal name. */
    landlord: z.ZodString;
    /** A residence org carries a UPI and no TIN (D24); either may be absent. */
    upi: z.ZodNullable<z.ZodString>;
    tin: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    landlord: string;
    tin: string | null;
    upi: string | null;
}, {
    name: string;
    id: string;
    landlord: string;
    tin: string | null;
    upi: string | null;
}>;
export declare const ResidenceBlockRow: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    name: z.ZodString;
    kind: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    id: string;
    kind: string;
}, {
    code: string;
    name: string;
    id: string;
    kind: string;
}>;
export declare const ResidenceUnitRow: z.ZodObject<{
    roomId: z.ZodString;
    label: z.ZodString;
    /** The block's code ("A"). */
    block: z.ZodString;
    type: z.ZodString;
    askingRentRwf: z.ZodNumber;
    vacantSince: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: string;
    note: string | null;
    label: string;
    roomId: string;
    block: string;
    askingRentRwf: number;
    vacantSince: string | null;
}, {
    type: string;
    note: string | null;
    label: string;
    roomId: string;
    block: string;
    askingRentRwf: number;
    vacantSince: string | null;
}>;
export declare const ResidenceLeaseRow: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodNullable<z.ZodString>;
    roomId: z.ZodString;
    unitLabel: z.ZodString;
    status: z.ZodEnum<["draft", "pending_signature", "active", "ending", "ended", "cancelled"]>;
    tenantUserId: z.ZodNullable<z.ZodString>;
    tenantName: z.ZodNullable<z.ZodString>;
    monthlyRentRwf: z.ZodNullable<z.ZodNumber>;
    cautionRwf: z.ZodNullable<z.ZodNumber>;
    startDate: z.ZodNullable<z.ZodString>;
    endDate: z.ZodNullable<z.ZodString>;
    rentDueDay: z.ZodNullable<z.ZodNumber>;
    graceDays: z.ZodNullable<z.ZodNumber>;
    noticePeriodDays: z.ZodNullable<z.ZodNumber>;
    occupants: z.ZodNullable<z.ZodString>;
    landlordSignedAt: z.ZodNullable<z.ZodString>;
    tenantSignedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended";
    id: string;
    reference: string | null;
    roomId: string;
    unitLabel: string;
    tenantName: string | null;
    monthlyRentRwf: number | null;
    cautionRwf: number | null;
    startDate: string | null;
    endDate: string | null;
    landlordSignedAt: string | null;
    tenantSignedAt: string | null;
    tenantUserId: string | null;
    rentDueDay: number | null;
    graceDays: number | null;
    noticePeriodDays: number | null;
    occupants: string | null;
}, {
    status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended";
    id: string;
    reference: string | null;
    roomId: string;
    unitLabel: string;
    tenantName: string | null;
    monthlyRentRwf: number | null;
    cautionRwf: number | null;
    startDate: string | null;
    endDate: string | null;
    landlordSignedAt: string | null;
    tenantSignedAt: string | null;
    tenantUserId: string | null;
    rentDueDay: number | null;
    graceDays: number | null;
    noticePeriodDays: number | null;
    occupants: string | null;
}>;
export declare const ResidenceChargeRow: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    periodMonth: z.ZodString;
    amountRwf: z.ZodNumber;
    /** Verified money only. */
    paidAmountRwf: z.ZodNumber;
    status: z.ZodEnum<["paid", "due", "overdue"]>;
    dueDate: z.ZodNullable<z.ZodString>;
    paidAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "due" | "paid" | "overdue";
    id: string;
    amountRwf: number;
    paidAt: string | null;
    leaseId: string;
    periodMonth: string;
    paidAmountRwf: number;
    dueDate: string | null;
}, {
    status: "due" | "paid" | "overdue";
    id: string;
    amountRwf: number;
    paidAt: string | null;
    leaseId: string;
    periodMonth: string;
    paidAmountRwf: number;
    dueDate: string | null;
}>;
export declare const ResidencePaymentRow: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    rentChargeId: z.ZodString;
    amountRwf: z.ZodNumber;
    method: z.ZodEnum<["mtn_momo", "airtel_money", "bank_transfer", "cash"]>;
    providerRef: z.ZodString;
    status: z.ZodEnum<["pending", "verified", "unknown", "failed"]>;
    receivedAt: z.ZodString;
    verifiedAt: z.ZodNullable<z.ZodString>;
    recordedByName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "verified" | "unknown" | "failed";
    id: string;
    amountRwf: number;
    leaseId: string;
    method: "mtn_momo" | "airtel_money" | "cash" | "bank_transfer";
    verifiedAt: string | null;
    providerRef: string;
    rentChargeId: string;
    receivedAt: string;
    recordedByName: string | null;
}, {
    status: "pending" | "verified" | "unknown" | "failed";
    id: string;
    amountRwf: number;
    leaseId: string;
    method: "mtn_momo" | "airtel_money" | "cash" | "bank_transfer";
    verifiedAt: string | null;
    providerRef: string;
    rentChargeId: string;
    receivedAt: string;
    recordedByName: string | null;
}>;
export declare const ResidenceReminderRow: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    channel: z.ZodEnum<["in_app", "in_app_email", "email", "call", "letter"]>;
    note: z.ZodString;
    sentAt: z.ZodString;
    readAt: z.ZodNullable<z.ZodString>;
    sentByName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    note: string;
    leaseId: string;
    channel: "email" | "in_app" | "in_app_email" | "call" | "letter";
    sentAt: string;
    readAt: string | null;
    sentByName: string | null;
}, {
    id: string;
    note: string;
    leaseId: string;
    channel: "email" | "in_app" | "in_app_email" | "call" | "letter";
    sentAt: string;
    readAt: string | null;
    sentByName: string | null;
}>;
export declare const ResidenceNoticeRow: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    moveOutDate: z.ZodString;
    reasonCode: z.ZodNullable<z.ZodEnum<["kigali", "leaving", "own-home", "terms", "other"]>>;
    message: z.ZodNullable<z.ZodString>;
    filedVia: z.ZodNullable<z.ZodEnum<["app", "letter", "email", "in_person"]>>;
    filedAt: z.ZodString;
    noticeGivenDays: z.ZodNullable<z.ZodNumber>;
    isShortNotice: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    message: string | null;
    id: string;
    reasonCode: "other" | "terms" | "kigali" | "leaving" | "own-home" | null;
    leaseId: string;
    moveOutDate: string;
    filedVia: "email" | "app" | "letter" | "in_person" | null;
    filedAt: string;
    noticeGivenDays: number | null;
    isShortNotice: boolean;
}, {
    message: string | null;
    id: string;
    reasonCode: "other" | "terms" | "kigali" | "leaving" | "own-home" | null;
    leaseId: string;
    moveOutDate: string;
    filedVia: "email" | "app" | "letter" | "in_person" | null;
    filedAt: string;
    noticeGivenDays: number | null;
    isShortNotice: boolean;
}>;
export declare const ResidenceOfferRow: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    status: z.ZodEnum<["open", "accepted", "declined", "withdrawn", "signed"]>;
    offeredRentRwf: z.ZodNumber;
    termMonths: z.ZodNumber;
    startsOn: z.ZodString;
    endsOn: z.ZodString;
    answerBy: z.ZodString;
    depositTopupRwf: z.ZodNumber;
    otherTerms: z.ZodNullable<z.ZodString>;
    sentAt: z.ZodString;
    sentByName: z.ZodNullable<z.ZodString>;
    openedAt: z.ZodNullable<z.ZodString>;
    remindedAt: z.ZodNullable<z.ZodString>;
    answeredAt: z.ZodNullable<z.ZodString>;
    signedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "declined" | "withdrawn" | "open" | "accepted" | "signed";
    id: string;
    startsOn: string;
    leaseId: string;
    signedAt: string | null;
    openedAt: string | null;
    endsOn: string;
    remindedAt: string | null;
    sentAt: string;
    sentByName: string | null;
    offeredRentRwf: number;
    termMonths: number;
    answerBy: string;
    depositTopupRwf: number;
    otherTerms: string | null;
    answeredAt: string | null;
}, {
    status: "declined" | "withdrawn" | "open" | "accepted" | "signed";
    id: string;
    startsOn: string;
    leaseId: string;
    signedAt: string | null;
    openedAt: string | null;
    endsOn: string;
    remindedAt: string | null;
    sentAt: string;
    sentByName: string | null;
    offeredRentRwf: number;
    termMonths: number;
    answerBy: string;
    depositTopupRwf: number;
    otherTerms: string | null;
    answeredAt: string | null;
}>;
/** The filing of a signed lease (F-R10), as the adapter job records it. */
export declare const ResidenceFilingRow: z.ZodObject<{
    leaseId: z.ZodString;
    status: z.ZodEnum<["pending", "filed", "failed"]>;
    dueBy: z.ZodNullable<z.ZodString>;
    clockStartAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "failed" | "filed";
    leaseId: string;
    clockStartAt: string | null;
    dueBy: string | null;
}, {
    status: "pending" | "failed" | "filed";
    leaseId: string;
    clockStartAt: string | null;
    dueBy: string | null;
}>;
export declare const ResidenceDepositRow: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    amountRwf: z.ZodNumber;
    status: z.ZodEnum<["held", "refunded", "forfeited"]>;
    heldAt: z.ZodString;
    refundedRwf: z.ZodNullable<z.ZodNumber>;
    forfeitedRwf: z.ZodNullable<z.ZodNumber>;
    settledAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "forfeited" | "held" | "refunded";
    id: string;
    amountRwf: number;
    settledAt: string | null;
    leaseId: string;
    heldAt: string;
    refundedRwf: number | null;
    forfeitedRwf: number | null;
}, {
    status: "forfeited" | "held" | "refunded";
    id: string;
    amountRwf: number;
    settledAt: string | null;
    leaseId: string;
    heldAt: string;
    refundedRwf: number | null;
    forfeitedRwf: number | null;
}>;
export declare const ResidencePhoto: z.ZodObject<{
    key: z.ZodString;
    caption: z.ZodString;
}, "strip", z.ZodTypeAny, {
    key: string;
    caption: string;
}, {
    key: string;
    caption: string;
}>;
export declare const ResidenceTicketRow: z.ZodObject<{
    id: z.ZodString;
    /** "WO-345". */
    reference: z.ZodNullable<z.ZodString>;
    leaseId: z.ZodNullable<z.ZodString>;
    roomId: z.ZodNullable<z.ZodString>;
    unitLabel: z.ZodNullable<z.ZodString>;
    /** A common area ("Block B"), when the ticket is about one. */
    spaceName: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    category: z.ZodNullable<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>>;
    status: z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>;
    staffMayEnter: z.ZodNullable<z.ZodBoolean>;
    assignedContractor: z.ZodNullable<z.ZodString>;
    assignedToName: z.ZodNullable<z.ZodString>;
    scheduledFor: z.ZodNullable<z.ZodString>;
    visitWindow: z.ZodNullable<z.ZodString>;
    costBearer: z.ZodNullable<z.ZodEnum<["landlord", "tenant", "to_be_decided"]>>;
    costNote: z.ZodNullable<z.ZodString>;
    raisedVia: z.ZodNullable<z.ZodString>;
    raisedByName: z.ZodNullable<z.ZodString>;
    raisedByRole: z.ZodNullable<z.ZodEnum<["guest", "tenant", "staff", "housekeeper"]>>;
    photos: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        caption: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        caption: string;
    }, {
        key: string;
        caption: string;
    }>, "many">;
    createdAt: z.ZodString;
    resolvedAt: z.ZodNullable<z.ZodString>;
    /** The conversation with the resident, when the ticket is on a tenancy. */
    threadId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    id: string;
    reference: string | null;
    description: string | null;
    title: string;
    createdAt: string;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
    resolvedAt: string | null;
    roomId: string | null;
    threadId: string | null;
    leaseId: string | null;
    unitLabel: string | null;
    raisedByName: string | null;
    assignedToName: string | null;
    photos: {
        key: string;
        caption: string;
    }[];
    spaceName: string | null;
    assignedContractor: string | null;
    scheduledFor: string | null;
    raisedVia: string | null;
    staffMayEnter: boolean | null;
    visitWindow: string | null;
    costBearer: "landlord" | "tenant" | "to_be_decided" | null;
    costNote: string | null;
    raisedByRole: "housekeeper" | "guest" | "tenant" | "staff" | null;
}, {
    status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    id: string;
    reference: string | null;
    description: string | null;
    title: string;
    createdAt: string;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
    resolvedAt: string | null;
    roomId: string | null;
    threadId: string | null;
    leaseId: string | null;
    unitLabel: string | null;
    raisedByName: string | null;
    assignedToName: string | null;
    photos: {
        key: string;
        caption: string;
    }[];
    spaceName: string | null;
    assignedContractor: string | null;
    scheduledFor: string | null;
    raisedVia: string | null;
    staffMayEnter: boolean | null;
    visitWindow: string | null;
    costBearer: "landlord" | "tenant" | "to_be_decided" | null;
    costNote: string | null;
    raisedByRole: "housekeeper" | "guest" | "tenant" | "staff" | null;
}>;
/** A staff note on a ticket: never shown to a resident. */
export declare const ResidenceTicketNote: z.ZodObject<{
    id: z.ZodString;
    ticketId: z.ZodString;
    authorName: z.ZodNullable<z.ZodString>;
    note: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    note: string;
    createdAt: string;
    authorName: string | null;
    ticketId: string;
}, {
    id: string;
    note: string;
    createdAt: string;
    authorName: string | null;
    ticketId: string;
}>;
/** A line of a ticket's conversation with the resident, phone numbers scrubbed as on every surface. */
export declare const ResidenceTicketMessage: z.ZodObject<{
    id: z.ZodString;
    ticketId: z.ZodString;
    fromTenant: z.ZodBoolean;
    senderName: z.ZodNullable<z.ZodString>;
    body: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    body: string;
    ticketId: string;
    senderName: string | null;
    fromTenant: boolean;
}, {
    id: string;
    createdAt: string;
    body: string;
    ticketId: string;
    senderName: string | null;
    fromTenant: boolean;
}>;
export declare const ResidencePassRow: z.ZodObject<{
    id: z.ZodString;
    roomId: z.ZodString;
    unitLabel: z.ZodString;
    leaseId: z.ZodNullable<z.ZodString>;
    kind: z.ZodEnum<["guest", "contractor"]>;
    visitorName: z.ZodString;
    code: z.ZodString;
    validFrom: z.ZodString;
    validTo: z.ZodString;
    overnight: z.ZodBoolean;
    status: z.ZodEnum<["expected", "approved", "used", "expired", "revoked"]>;
    createdByName: z.ZodNullable<z.ZodString>;
    /** Registered by the resident rather than by management. */
    byTenant: z.ZodBoolean;
    usedAt: z.ZodNullable<z.ZodString>;
    leftAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    status: "expected" | "approved" | "expired" | "revoked" | "used";
    id: string;
    kind: "guest" | "contractor";
    roomId: string;
    leaseId: string | null;
    unitLabel: string;
    createdByName: string | null;
    overnight: boolean;
    visitorName: string;
    validFrom: string;
    validTo: string;
    byTenant: boolean;
    usedAt: string | null;
    leftAt: string | null;
}, {
    code: string;
    status: "expected" | "approved" | "expired" | "revoked" | "used";
    id: string;
    kind: "guest" | "contractor";
    roomId: string;
    leaseId: string | null;
    unitLabel: string;
    createdByName: string | null;
    overnight: boolean;
    visitorName: string;
    validFrom: string;
    validTo: string;
    byTenant: boolean;
    usedAt: string | null;
    leftAt: string | null;
}>;
export declare const ResidenceAccessRequestRow: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    kind: z.ZodEnum<["overnight", "delivery", "gate_entry"]>;
    visitorName: z.ZodNullable<z.ZodString>;
    reason: z.ZodNullable<z.ZodString>;
    forDate: z.ZodNullable<z.ZodString>;
    toDate: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["open", "approved", "declined"]>;
    requestedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "approved" | "declined" | "open";
    id: string;
    kind: "overnight" | "delivery" | "gate_entry";
    reason: string | null;
    leaseId: string;
    toDate: string | null;
    requestedAt: string;
    visitorName: string | null;
    forDate: string | null;
}, {
    status: "approved" | "declined" | "open";
    id: string;
    kind: "overnight" | "delivery" | "gate_entry";
    reason: string | null;
    leaseId: string;
    toDate: string | null;
    requestedAt: string;
    visitorName: string | null;
    forDate: string | null;
}>;
export declare const ResidenceVisitorLogRow: z.ZodObject<{
    id: z.ZodString;
    visitorName: z.ZodString;
    /** Masked: the log keeps who came, never a number anyone can call. */
    visitorPhone: z.ZodNullable<z.ZodString>;
    roomId: z.ZodNullable<z.ZodString>;
    unitLabel: z.ZodNullable<z.ZodString>;
    leaseId: z.ZodNullable<z.ZodString>;
    /** Where in the compound, when it is not a unit ("Block C · roof"). */
    place: z.ZodNullable<z.ZodString>;
    admittedHow: z.ZodNullable<z.ZodString>;
    recordedBy: z.ZodNullable<z.ZodString>;
    arrivalAt: z.ZodNullable<z.ZodString>;
    departureAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    roomId: string | null;
    leaseId: string | null;
    unitLabel: string | null;
    place: string | null;
    visitorName: string;
    visitorPhone: string | null;
    admittedHow: string | null;
    recordedBy: string | null;
    arrivalAt: string | null;
    departureAt: string | null;
}, {
    id: string;
    roomId: string | null;
    leaseId: string | null;
    unitLabel: string | null;
    place: string | null;
    visitorName: string;
    visitorPhone: string | null;
    admittedHow: string | null;
    recordedBy: string | null;
    arrivalAt: string | null;
    departureAt: string | null;
}>;
export declare const ResidenceClauseRow: z.ZodObject<{
    code: z.ZodString;
    title: z.ZodString;
    note: z.ZodString;
    needsReview: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    code: string;
    note: string;
    title: string;
    needsReview: boolean;
}, {
    code: string;
    note: string;
    title: string;
    needsReview: boolean;
}>;
export declare const ResidenceApplicationRow: z.ZodObject<{
    id: z.ZodString;
    roomId: z.ZodString;
    unitLabel: z.ZodString;
    name: z.ZodString;
    email: z.ZodNullable<z.ZodString>;
    phone: z.ZodNullable<z.ZodString>;
    stage: z.ZodEnum<["invited", "screening", "ready", "declined", "converted"]>;
    source: z.ZodString;
    broker: z.ZodNullable<z.ZodObject<{
        name: z.ZodString;
        referredAt: z.ZodString;
        feeRwf: z.ZodNumber;
        terms: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        feeRwf: number;
        terms: string;
        referredAt: string;
    }, {
        name: string;
        feeRwf: number;
        terms: string;
        referredAt: string;
    }>>;
    desiredMoveIn: z.ZodNullable<z.ZodString>;
    termMonths: z.ZodNullable<z.ZodNumber>;
    occupants: z.ZodNullable<z.ZodString>;
    offeredRentRwf: z.ZodNullable<z.ZodNumber>;
    depositRwf: z.ZodNullable<z.ZodNumber>;
    screening: z.ZodArray<z.ZodEnum<["identity", "income", "employment", "reference", "balance", "rules"]>, "many">;
    documents: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        note: z.ZodString;
        state: z.ZodEnum<["requested", "waiting", "uploaded", "checked"]>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        state: "waiting" | "requested" | "checked" | "uploaded";
        note: string;
    }, {
        name: string;
        state: "waiting" | "requested" | "checked" | "uploaded";
        note: string;
    }>, "many">;
    createdAt: z.ZodString;
    leaseId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    broker: {
        name: string;
        feeRwf: number;
        terms: string;
        referredAt: string;
    } | null;
    name: string;
    id: string;
    email: string | null;
    documents: {
        name: string;
        state: "waiting" | "requested" | "checked" | "uploaded";
        note: string;
    }[];
    stage: "declined" | "converted" | "ready" | "invited" | "screening";
    source: string;
    createdAt: string;
    phone: string | null;
    roomId: string;
    leaseId: string | null;
    unitLabel: string;
    depositRwf: number | null;
    screening: ("reference" | "identity" | "rules" | "income" | "employment" | "balance")[];
    occupants: string | null;
    offeredRentRwf: number | null;
    termMonths: number | null;
    desiredMoveIn: string | null;
}, {
    broker: {
        name: string;
        feeRwf: number;
        terms: string;
        referredAt: string;
    } | null;
    name: string;
    id: string;
    email: string | null;
    documents: {
        name: string;
        state: "waiting" | "requested" | "checked" | "uploaded";
        note: string;
    }[];
    stage: "declined" | "converted" | "ready" | "invited" | "screening";
    source: string;
    createdAt: string;
    phone: string | null;
    roomId: string;
    leaseId: string | null;
    unitLabel: string;
    depositRwf: number | null;
    screening: ("reference" | "identity" | "rules" | "income" | "employment" | "balance")[];
    occupants: string | null;
    offeredRentRwf: number | null;
    termMonths: number | null;
    desiredMoveIn: string | null;
}>;
export declare const ResidencePayoutRow: z.ZodObject<{
    id: z.ZodString;
    /** The month of rent the settlement covers. */
    periodMonth: z.ZodNullable<z.ZodString>;
    amountRwf: z.ZodNumber;
    status: z.ZodEnum<["scheduled", "queued", "paid", "held"]>;
    destination: z.ZodNullable<z.ZodEnum<["momo", "bank"]>>;
    destinationRef: z.ZodNullable<z.ZodString>;
    scheduledReleaseAt: z.ZodNullable<z.ZodString>;
    settledAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "held" | "paid" | "scheduled" | "queued";
    id: string;
    amountRwf: number;
    settledAt: string | null;
    periodMonth: string | null;
    destination: "momo" | "bank" | null;
    destinationRef: string | null;
    scheduledReleaseAt: string | null;
}, {
    status: "held" | "paid" | "scheduled" | "queued";
    id: string;
    amountRwf: number;
    settledAt: string | null;
    periodMonth: string | null;
    destination: "momo" | "bank" | null;
    destinationRef: string | null;
    scheduledReleaseAt: string | null;
}>;
/** An in-app notice to the tenant (water off, a renewal ready, a rent reminder). */
export declare const ResidenceNotificationRow: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    body: z.ZodNullable<z.ZodString>;
    category: z.ZodString;
    createdAt: z.ZodString;
    readAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    createdAt: string;
    body: string | null;
    category: string;
    readAt: string | null;
}, {
    id: string;
    title: string;
    createdAt: string;
    body: string | null;
    category: string;
    readAt: string | null;
}>;
/**
 * Everything the residence screens read, for one business (`/ops/residence`) or one tenant
 * (`/me/residence`). A part the caller may not read comes back empty rather than refused: rent and
 * deposits need `money.view` or `rent.record`, tickets `ticket.advance`, the rest `lease.manage`.
 * The tenant's copy never carries staff notes, other tenants' rows, applications or clauses.
 */
export declare const ResidenceView: z.ZodObject<{
    property: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        /** The landlord's legal name. */
        landlord: z.ZodString;
        /** A residence org carries a UPI and no TIN (D24); either may be absent. */
        upi: z.ZodNullable<z.ZodString>;
        tin: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        landlord: string;
        tin: string | null;
        upi: string | null;
    }, {
        name: string;
        id: string;
        landlord: string;
        tin: string | null;
        upi: string | null;
    }>>;
    blocks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        code: z.ZodString;
        name: z.ZodString;
        kind: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        name: string;
        id: string;
        kind: string;
    }, {
        code: string;
        name: string;
        id: string;
        kind: string;
    }>, "many">;
    units: z.ZodArray<z.ZodObject<{
        roomId: z.ZodString;
        label: z.ZodString;
        /** The block's code ("A"). */
        block: z.ZodString;
        type: z.ZodString;
        askingRentRwf: z.ZodNumber;
        vacantSince: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        note: string | null;
        label: string;
        roomId: string;
        block: string;
        askingRentRwf: number;
        vacantSince: string | null;
    }, {
        type: string;
        note: string | null;
        label: string;
        roomId: string;
        block: string;
        askingRentRwf: number;
        vacantSince: string | null;
    }>, "many">;
    leases: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodNullable<z.ZodString>;
        roomId: z.ZodString;
        unitLabel: z.ZodString;
        status: z.ZodEnum<["draft", "pending_signature", "active", "ending", "ended", "cancelled"]>;
        tenantUserId: z.ZodNullable<z.ZodString>;
        tenantName: z.ZodNullable<z.ZodString>;
        monthlyRentRwf: z.ZodNullable<z.ZodNumber>;
        cautionRwf: z.ZodNullable<z.ZodNumber>;
        startDate: z.ZodNullable<z.ZodString>;
        endDate: z.ZodNullable<z.ZodString>;
        rentDueDay: z.ZodNullable<z.ZodNumber>;
        graceDays: z.ZodNullable<z.ZodNumber>;
        noticePeriodDays: z.ZodNullable<z.ZodNumber>;
        occupants: z.ZodNullable<z.ZodString>;
        landlordSignedAt: z.ZodNullable<z.ZodString>;
        tenantSignedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended";
        id: string;
        reference: string | null;
        roomId: string;
        unitLabel: string;
        tenantName: string | null;
        monthlyRentRwf: number | null;
        cautionRwf: number | null;
        startDate: string | null;
        endDate: string | null;
        landlordSignedAt: string | null;
        tenantSignedAt: string | null;
        tenantUserId: string | null;
        rentDueDay: number | null;
        graceDays: number | null;
        noticePeriodDays: number | null;
        occupants: string | null;
    }, {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended";
        id: string;
        reference: string | null;
        roomId: string;
        unitLabel: string;
        tenantName: string | null;
        monthlyRentRwf: number | null;
        cautionRwf: number | null;
        startDate: string | null;
        endDate: string | null;
        landlordSignedAt: string | null;
        tenantSignedAt: string | null;
        tenantUserId: string | null;
        rentDueDay: number | null;
        graceDays: number | null;
        noticePeriodDays: number | null;
        occupants: string | null;
    }>, "many">;
    charges: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        periodMonth: z.ZodString;
        amountRwf: z.ZodNumber;
        /** Verified money only. */
        paidAmountRwf: z.ZodNumber;
        status: z.ZodEnum<["paid", "due", "overdue"]>;
        dueDate: z.ZodNullable<z.ZodString>;
        paidAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "due" | "paid" | "overdue";
        id: string;
        amountRwf: number;
        paidAt: string | null;
        leaseId: string;
        periodMonth: string;
        paidAmountRwf: number;
        dueDate: string | null;
    }, {
        status: "due" | "paid" | "overdue";
        id: string;
        amountRwf: number;
        paidAt: string | null;
        leaseId: string;
        periodMonth: string;
        paidAmountRwf: number;
        dueDate: string | null;
    }>, "many">;
    payments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        rentChargeId: z.ZodString;
        amountRwf: z.ZodNumber;
        method: z.ZodEnum<["mtn_momo", "airtel_money", "bank_transfer", "cash"]>;
        providerRef: z.ZodString;
        status: z.ZodEnum<["pending", "verified", "unknown", "failed"]>;
        receivedAt: z.ZodString;
        verifiedAt: z.ZodNullable<z.ZodString>;
        recordedByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "verified" | "unknown" | "failed";
        id: string;
        amountRwf: number;
        leaseId: string;
        method: "mtn_momo" | "airtel_money" | "cash" | "bank_transfer";
        verifiedAt: string | null;
        providerRef: string;
        rentChargeId: string;
        receivedAt: string;
        recordedByName: string | null;
    }, {
        status: "pending" | "verified" | "unknown" | "failed";
        id: string;
        amountRwf: number;
        leaseId: string;
        method: "mtn_momo" | "airtel_money" | "cash" | "bank_transfer";
        verifiedAt: string | null;
        providerRef: string;
        rentChargeId: string;
        receivedAt: string;
        recordedByName: string | null;
    }>, "many">;
    reminders: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        channel: z.ZodEnum<["in_app", "in_app_email", "email", "call", "letter"]>;
        note: z.ZodString;
        sentAt: z.ZodString;
        readAt: z.ZodNullable<z.ZodString>;
        sentByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        note: string;
        leaseId: string;
        channel: "email" | "in_app" | "in_app_email" | "call" | "letter";
        sentAt: string;
        readAt: string | null;
        sentByName: string | null;
    }, {
        id: string;
        note: string;
        leaseId: string;
        channel: "email" | "in_app" | "in_app_email" | "call" | "letter";
        sentAt: string;
        readAt: string | null;
        sentByName: string | null;
    }>, "many">;
    notices: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        moveOutDate: z.ZodString;
        reasonCode: z.ZodNullable<z.ZodEnum<["kigali", "leaving", "own-home", "terms", "other"]>>;
        message: z.ZodNullable<z.ZodString>;
        filedVia: z.ZodNullable<z.ZodEnum<["app", "letter", "email", "in_person"]>>;
        filedAt: z.ZodString;
        noticeGivenDays: z.ZodNullable<z.ZodNumber>;
        isShortNotice: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        message: string | null;
        id: string;
        reasonCode: "other" | "terms" | "kigali" | "leaving" | "own-home" | null;
        leaseId: string;
        moveOutDate: string;
        filedVia: "email" | "app" | "letter" | "in_person" | null;
        filedAt: string;
        noticeGivenDays: number | null;
        isShortNotice: boolean;
    }, {
        message: string | null;
        id: string;
        reasonCode: "other" | "terms" | "kigali" | "leaving" | "own-home" | null;
        leaseId: string;
        moveOutDate: string;
        filedVia: "email" | "app" | "letter" | "in_person" | null;
        filedAt: string;
        noticeGivenDays: number | null;
        isShortNotice: boolean;
    }>, "many">;
    offers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        status: z.ZodEnum<["open", "accepted", "declined", "withdrawn", "signed"]>;
        offeredRentRwf: z.ZodNumber;
        termMonths: z.ZodNumber;
        startsOn: z.ZodString;
        endsOn: z.ZodString;
        answerBy: z.ZodString;
        depositTopupRwf: z.ZodNumber;
        otherTerms: z.ZodNullable<z.ZodString>;
        sentAt: z.ZodString;
        sentByName: z.ZodNullable<z.ZodString>;
        openedAt: z.ZodNullable<z.ZodString>;
        remindedAt: z.ZodNullable<z.ZodString>;
        answeredAt: z.ZodNullable<z.ZodString>;
        signedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "declined" | "withdrawn" | "open" | "accepted" | "signed";
        id: string;
        startsOn: string;
        leaseId: string;
        signedAt: string | null;
        openedAt: string | null;
        endsOn: string;
        remindedAt: string | null;
        sentAt: string;
        sentByName: string | null;
        offeredRentRwf: number;
        termMonths: number;
        answerBy: string;
        depositTopupRwf: number;
        otherTerms: string | null;
        answeredAt: string | null;
    }, {
        status: "declined" | "withdrawn" | "open" | "accepted" | "signed";
        id: string;
        startsOn: string;
        leaseId: string;
        signedAt: string | null;
        openedAt: string | null;
        endsOn: string;
        remindedAt: string | null;
        sentAt: string;
        sentByName: string | null;
        offeredRentRwf: number;
        termMonths: number;
        answerBy: string;
        depositTopupRwf: number;
        otherTerms: string | null;
        answeredAt: string | null;
    }>, "many">;
    filings: z.ZodArray<z.ZodObject<{
        leaseId: z.ZodString;
        status: z.ZodEnum<["pending", "filed", "failed"]>;
        dueBy: z.ZodNullable<z.ZodString>;
        clockStartAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "failed" | "filed";
        leaseId: string;
        clockStartAt: string | null;
        dueBy: string | null;
    }, {
        status: "pending" | "failed" | "filed";
        leaseId: string;
        clockStartAt: string | null;
        dueBy: string | null;
    }>, "many">;
    deposits: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        amountRwf: z.ZodNumber;
        status: z.ZodEnum<["held", "refunded", "forfeited"]>;
        heldAt: z.ZodString;
        refundedRwf: z.ZodNullable<z.ZodNumber>;
        forfeitedRwf: z.ZodNullable<z.ZodNumber>;
        settledAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "forfeited" | "held" | "refunded";
        id: string;
        amountRwf: number;
        settledAt: string | null;
        leaseId: string;
        heldAt: string;
        refundedRwf: number | null;
        forfeitedRwf: number | null;
    }, {
        status: "forfeited" | "held" | "refunded";
        id: string;
        amountRwf: number;
        settledAt: string | null;
        leaseId: string;
        heldAt: string;
        refundedRwf: number | null;
        forfeitedRwf: number | null;
    }>, "many">;
    tickets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** "WO-345". */
        reference: z.ZodNullable<z.ZodString>;
        leaseId: z.ZodNullable<z.ZodString>;
        roomId: z.ZodNullable<z.ZodString>;
        unitLabel: z.ZodNullable<z.ZodString>;
        /** A common area ("Block B"), when the ticket is about one. */
        spaceName: z.ZodNullable<z.ZodString>;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        category: z.ZodNullable<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>>;
        status: z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>;
        staffMayEnter: z.ZodNullable<z.ZodBoolean>;
        assignedContractor: z.ZodNullable<z.ZodString>;
        assignedToName: z.ZodNullable<z.ZodString>;
        scheduledFor: z.ZodNullable<z.ZodString>;
        visitWindow: z.ZodNullable<z.ZodString>;
        costBearer: z.ZodNullable<z.ZodEnum<["landlord", "tenant", "to_be_decided"]>>;
        costNote: z.ZodNullable<z.ZodString>;
        raisedVia: z.ZodNullable<z.ZodString>;
        raisedByName: z.ZodNullable<z.ZodString>;
        raisedByRole: z.ZodNullable<z.ZodEnum<["guest", "tenant", "staff", "housekeeper"]>>;
        photos: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            caption: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            key: string;
            caption: string;
        }, {
            key: string;
            caption: string;
        }>, "many">;
        createdAt: z.ZodString;
        resolvedAt: z.ZodNullable<z.ZodString>;
        /** The conversation with the resident, when the ticket is on a tenancy. */
        threadId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
        id: string;
        reference: string | null;
        description: string | null;
        title: string;
        createdAt: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        resolvedAt: string | null;
        roomId: string | null;
        threadId: string | null;
        leaseId: string | null;
        unitLabel: string | null;
        raisedByName: string | null;
        assignedToName: string | null;
        photos: {
            key: string;
            caption: string;
        }[];
        spaceName: string | null;
        assignedContractor: string | null;
        scheduledFor: string | null;
        raisedVia: string | null;
        staffMayEnter: boolean | null;
        visitWindow: string | null;
        costBearer: "landlord" | "tenant" | "to_be_decided" | null;
        costNote: string | null;
        raisedByRole: "housekeeper" | "guest" | "tenant" | "staff" | null;
    }, {
        status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
        id: string;
        reference: string | null;
        description: string | null;
        title: string;
        createdAt: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        resolvedAt: string | null;
        roomId: string | null;
        threadId: string | null;
        leaseId: string | null;
        unitLabel: string | null;
        raisedByName: string | null;
        assignedToName: string | null;
        photos: {
            key: string;
            caption: string;
        }[];
        spaceName: string | null;
        assignedContractor: string | null;
        scheduledFor: string | null;
        raisedVia: string | null;
        staffMayEnter: boolean | null;
        visitWindow: string | null;
        costBearer: "landlord" | "tenant" | "to_be_decided" | null;
        costNote: string | null;
        raisedByRole: "housekeeper" | "guest" | "tenant" | "staff" | null;
    }>, "many">;
    ticketNotes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ticketId: z.ZodString;
        authorName: z.ZodNullable<z.ZodString>;
        note: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        note: string;
        createdAt: string;
        authorName: string | null;
        ticketId: string;
    }, {
        id: string;
        note: string;
        createdAt: string;
        authorName: string | null;
        ticketId: string;
    }>, "many">;
    ticketMessages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ticketId: z.ZodString;
        fromTenant: z.ZodBoolean;
        senderName: z.ZodNullable<z.ZodString>;
        body: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        body: string;
        ticketId: string;
        senderName: string | null;
        fromTenant: boolean;
    }, {
        id: string;
        createdAt: string;
        body: string;
        ticketId: string;
        senderName: string | null;
        fromTenant: boolean;
    }>, "many">;
    passes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roomId: z.ZodString;
        unitLabel: z.ZodString;
        leaseId: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<["guest", "contractor"]>;
        visitorName: z.ZodString;
        code: z.ZodString;
        validFrom: z.ZodString;
        validTo: z.ZodString;
        overnight: z.ZodBoolean;
        status: z.ZodEnum<["expected", "approved", "used", "expired", "revoked"]>;
        createdByName: z.ZodNullable<z.ZodString>;
        /** Registered by the resident rather than by management. */
        byTenant: z.ZodBoolean;
        usedAt: z.ZodNullable<z.ZodString>;
        leftAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        status: "expected" | "approved" | "expired" | "revoked" | "used";
        id: string;
        kind: "guest" | "contractor";
        roomId: string;
        leaseId: string | null;
        unitLabel: string;
        createdByName: string | null;
        overnight: boolean;
        visitorName: string;
        validFrom: string;
        validTo: string;
        byTenant: boolean;
        usedAt: string | null;
        leftAt: string | null;
    }, {
        code: string;
        status: "expected" | "approved" | "expired" | "revoked" | "used";
        id: string;
        kind: "guest" | "contractor";
        roomId: string;
        leaseId: string | null;
        unitLabel: string;
        createdByName: string | null;
        overnight: boolean;
        visitorName: string;
        validFrom: string;
        validTo: string;
        byTenant: boolean;
        usedAt: string | null;
        leftAt: string | null;
    }>, "many">;
    accessRequests: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        kind: z.ZodEnum<["overnight", "delivery", "gate_entry"]>;
        visitorName: z.ZodNullable<z.ZodString>;
        reason: z.ZodNullable<z.ZodString>;
        forDate: z.ZodNullable<z.ZodString>;
        toDate: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["open", "approved", "declined"]>;
        requestedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "declined" | "open";
        id: string;
        kind: "overnight" | "delivery" | "gate_entry";
        reason: string | null;
        leaseId: string;
        toDate: string | null;
        requestedAt: string;
        visitorName: string | null;
        forDate: string | null;
    }, {
        status: "approved" | "declined" | "open";
        id: string;
        kind: "overnight" | "delivery" | "gate_entry";
        reason: string | null;
        leaseId: string;
        toDate: string | null;
        requestedAt: string;
        visitorName: string | null;
        forDate: string | null;
    }>, "many">;
    visitorLog: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        visitorName: z.ZodString;
        /** Masked: the log keeps who came, never a number anyone can call. */
        visitorPhone: z.ZodNullable<z.ZodString>;
        roomId: z.ZodNullable<z.ZodString>;
        unitLabel: z.ZodNullable<z.ZodString>;
        leaseId: z.ZodNullable<z.ZodString>;
        /** Where in the compound, when it is not a unit ("Block C · roof"). */
        place: z.ZodNullable<z.ZodString>;
        admittedHow: z.ZodNullable<z.ZodString>;
        recordedBy: z.ZodNullable<z.ZodString>;
        arrivalAt: z.ZodNullable<z.ZodString>;
        departureAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        roomId: string | null;
        leaseId: string | null;
        unitLabel: string | null;
        place: string | null;
        visitorName: string;
        visitorPhone: string | null;
        admittedHow: string | null;
        recordedBy: string | null;
        arrivalAt: string | null;
        departureAt: string | null;
    }, {
        id: string;
        roomId: string | null;
        leaseId: string | null;
        unitLabel: string | null;
        place: string | null;
        visitorName: string;
        visitorPhone: string | null;
        admittedHow: string | null;
        recordedBy: string | null;
        arrivalAt: string | null;
        departureAt: string | null;
    }>, "many">;
    clauses: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        title: z.ZodString;
        note: z.ZodString;
        needsReview: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        code: string;
        note: string;
        title: string;
        needsReview: boolean;
    }, {
        code: string;
        note: string;
        title: string;
        needsReview: boolean;
    }>, "many">;
    applications: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roomId: z.ZodString;
        unitLabel: z.ZodString;
        name: z.ZodString;
        email: z.ZodNullable<z.ZodString>;
        phone: z.ZodNullable<z.ZodString>;
        stage: z.ZodEnum<["invited", "screening", "ready", "declined", "converted"]>;
        source: z.ZodString;
        broker: z.ZodNullable<z.ZodObject<{
            name: z.ZodString;
            referredAt: z.ZodString;
            feeRwf: z.ZodNumber;
            terms: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            feeRwf: number;
            terms: string;
            referredAt: string;
        }, {
            name: string;
            feeRwf: number;
            terms: string;
            referredAt: string;
        }>>;
        desiredMoveIn: z.ZodNullable<z.ZodString>;
        termMonths: z.ZodNullable<z.ZodNumber>;
        occupants: z.ZodNullable<z.ZodString>;
        offeredRentRwf: z.ZodNullable<z.ZodNumber>;
        depositRwf: z.ZodNullable<z.ZodNumber>;
        screening: z.ZodArray<z.ZodEnum<["identity", "income", "employment", "reference", "balance", "rules"]>, "many">;
        documents: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            note: z.ZodString;
            state: z.ZodEnum<["requested", "waiting", "uploaded", "checked"]>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            state: "waiting" | "requested" | "checked" | "uploaded";
            note: string;
        }, {
            name: string;
            state: "waiting" | "requested" | "checked" | "uploaded";
            note: string;
        }>, "many">;
        createdAt: z.ZodString;
        leaseId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        broker: {
            name: string;
            feeRwf: number;
            terms: string;
            referredAt: string;
        } | null;
        name: string;
        id: string;
        email: string | null;
        documents: {
            name: string;
            state: "waiting" | "requested" | "checked" | "uploaded";
            note: string;
        }[];
        stage: "declined" | "converted" | "ready" | "invited" | "screening";
        source: string;
        createdAt: string;
        phone: string | null;
        roomId: string;
        leaseId: string | null;
        unitLabel: string;
        depositRwf: number | null;
        screening: ("reference" | "identity" | "rules" | "income" | "employment" | "balance")[];
        occupants: string | null;
        offeredRentRwf: number | null;
        termMonths: number | null;
        desiredMoveIn: string | null;
    }, {
        broker: {
            name: string;
            feeRwf: number;
            terms: string;
            referredAt: string;
        } | null;
        name: string;
        id: string;
        email: string | null;
        documents: {
            name: string;
            state: "waiting" | "requested" | "checked" | "uploaded";
            note: string;
        }[];
        stage: "declined" | "converted" | "ready" | "invited" | "screening";
        source: string;
        createdAt: string;
        phone: string | null;
        roomId: string;
        leaseId: string | null;
        unitLabel: string;
        depositRwf: number | null;
        screening: ("reference" | "identity" | "rules" | "income" | "employment" | "balance")[];
        occupants: string | null;
        offeredRentRwf: number | null;
        termMonths: number | null;
        desiredMoveIn: string | null;
    }>, "many">;
    payouts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** The month of rent the settlement covers. */
        periodMonth: z.ZodNullable<z.ZodString>;
        amountRwf: z.ZodNumber;
        status: z.ZodEnum<["scheduled", "queued", "paid", "held"]>;
        destination: z.ZodNullable<z.ZodEnum<["momo", "bank"]>>;
        destinationRef: z.ZodNullable<z.ZodString>;
        scheduledReleaseAt: z.ZodNullable<z.ZodString>;
        settledAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "held" | "paid" | "scheduled" | "queued";
        id: string;
        amountRwf: number;
        settledAt: string | null;
        periodMonth: string | null;
        destination: "momo" | "bank" | null;
        destinationRef: string | null;
        scheduledReleaseAt: string | null;
    }, {
        status: "held" | "paid" | "scheduled" | "queued";
        id: string;
        amountRwf: number;
        settledAt: string | null;
        periodMonth: string | null;
        destination: "momo" | "bank" | null;
        destinationRef: string | null;
        scheduledReleaseAt: string | null;
    }>, "many">;
    notifications: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        body: z.ZodNullable<z.ZodString>;
        category: z.ZodString;
        createdAt: z.ZodString;
        readAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        createdAt: string;
        body: string | null;
        category: string;
        readAt: string | null;
    }, {
        id: string;
        title: string;
        createdAt: string;
        body: string | null;
        category: string;
        readAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    property: {
        name: string;
        id: string;
        landlord: string;
        tin: string | null;
        upi: string | null;
    } | null;
    applications: {
        broker: {
            name: string;
            feeRwf: number;
            terms: string;
            referredAt: string;
        } | null;
        name: string;
        id: string;
        email: string | null;
        documents: {
            name: string;
            state: "waiting" | "requested" | "checked" | "uploaded";
            note: string;
        }[];
        stage: "declined" | "converted" | "ready" | "invited" | "screening";
        source: string;
        createdAt: string;
        phone: string | null;
        roomId: string;
        leaseId: string | null;
        unitLabel: string;
        depositRwf: number | null;
        screening: ("reference" | "identity" | "rules" | "income" | "employment" | "balance")[];
        occupants: string | null;
        offeredRentRwf: number | null;
        termMonths: number | null;
        desiredMoveIn: string | null;
    }[];
    payouts: {
        status: "held" | "paid" | "scheduled" | "queued";
        id: string;
        amountRwf: number;
        settledAt: string | null;
        periodMonth: string | null;
        destination: "momo" | "bank" | null;
        destinationRef: string | null;
        scheduledReleaseAt: string | null;
    }[];
    payments: {
        status: "pending" | "verified" | "unknown" | "failed";
        id: string;
        amountRwf: number;
        leaseId: string;
        method: "mtn_momo" | "airtel_money" | "cash" | "bank_transfer";
        verifiedAt: string | null;
        providerRef: string;
        rentChargeId: string;
        receivedAt: string;
        recordedByName: string | null;
    }[];
    tickets: {
        status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
        id: string;
        reference: string | null;
        description: string | null;
        title: string;
        createdAt: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        resolvedAt: string | null;
        roomId: string | null;
        threadId: string | null;
        leaseId: string | null;
        unitLabel: string | null;
        raisedByName: string | null;
        assignedToName: string | null;
        photos: {
            key: string;
            caption: string;
        }[];
        spaceName: string | null;
        assignedContractor: string | null;
        scheduledFor: string | null;
        raisedVia: string | null;
        staffMayEnter: boolean | null;
        visitWindow: string | null;
        costBearer: "landlord" | "tenant" | "to_be_decided" | null;
        costNote: string | null;
        raisedByRole: "housekeeper" | "guest" | "tenant" | "staff" | null;
    }[];
    leases: {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended";
        id: string;
        reference: string | null;
        roomId: string;
        unitLabel: string;
        tenantName: string | null;
        monthlyRentRwf: number | null;
        cautionRwf: number | null;
        startDate: string | null;
        endDate: string | null;
        landlordSignedAt: string | null;
        tenantSignedAt: string | null;
        tenantUserId: string | null;
        rentDueDay: number | null;
        graceDays: number | null;
        noticePeriodDays: number | null;
        occupants: string | null;
    }[];
    charges: {
        status: "due" | "paid" | "overdue";
        id: string;
        amountRwf: number;
        paidAt: string | null;
        leaseId: string;
        periodMonth: string;
        paidAmountRwf: number;
        dueDate: string | null;
    }[];
    filings: {
        status: "pending" | "failed" | "filed";
        leaseId: string;
        clockStartAt: string | null;
        dueBy: string | null;
    }[];
    deposits: {
        status: "forfeited" | "held" | "refunded";
        id: string;
        amountRwf: number;
        settledAt: string | null;
        leaseId: string;
        heldAt: string;
        refundedRwf: number | null;
        forfeitedRwf: number | null;
    }[];
    units: {
        type: string;
        note: string | null;
        label: string;
        roomId: string;
        block: string;
        askingRentRwf: number;
        vacantSince: string | null;
    }[];
    offers: {
        status: "declined" | "withdrawn" | "open" | "accepted" | "signed";
        id: string;
        startsOn: string;
        leaseId: string;
        signedAt: string | null;
        openedAt: string | null;
        endsOn: string;
        remindedAt: string | null;
        sentAt: string;
        sentByName: string | null;
        offeredRentRwf: number;
        termMonths: number;
        answerBy: string;
        depositTopupRwf: number;
        otherTerms: string | null;
        answeredAt: string | null;
    }[];
    blocks: {
        code: string;
        name: string;
        id: string;
        kind: string;
    }[];
    reminders: {
        id: string;
        note: string;
        leaseId: string;
        channel: "email" | "in_app" | "in_app_email" | "call" | "letter";
        sentAt: string;
        readAt: string | null;
        sentByName: string | null;
    }[];
    notices: {
        message: string | null;
        id: string;
        reasonCode: "other" | "terms" | "kigali" | "leaving" | "own-home" | null;
        leaseId: string;
        moveOutDate: string;
        filedVia: "email" | "app" | "letter" | "in_person" | null;
        filedAt: string;
        noticeGivenDays: number | null;
        isShortNotice: boolean;
    }[];
    ticketNotes: {
        id: string;
        note: string;
        createdAt: string;
        authorName: string | null;
        ticketId: string;
    }[];
    ticketMessages: {
        id: string;
        createdAt: string;
        body: string;
        ticketId: string;
        senderName: string | null;
        fromTenant: boolean;
    }[];
    passes: {
        code: string;
        status: "expected" | "approved" | "expired" | "revoked" | "used";
        id: string;
        kind: "guest" | "contractor";
        roomId: string;
        leaseId: string | null;
        unitLabel: string;
        createdByName: string | null;
        overnight: boolean;
        visitorName: string;
        validFrom: string;
        validTo: string;
        byTenant: boolean;
        usedAt: string | null;
        leftAt: string | null;
    }[];
    accessRequests: {
        status: "approved" | "declined" | "open";
        id: string;
        kind: "overnight" | "delivery" | "gate_entry";
        reason: string | null;
        leaseId: string;
        toDate: string | null;
        requestedAt: string;
        visitorName: string | null;
        forDate: string | null;
    }[];
    visitorLog: {
        id: string;
        roomId: string | null;
        leaseId: string | null;
        unitLabel: string | null;
        place: string | null;
        visitorName: string;
        visitorPhone: string | null;
        admittedHow: string | null;
        recordedBy: string | null;
        arrivalAt: string | null;
        departureAt: string | null;
    }[];
    clauses: {
        code: string;
        note: string;
        title: string;
        needsReview: boolean;
    }[];
    notifications: {
        id: string;
        title: string;
        createdAt: string;
        body: string | null;
        category: string;
        readAt: string | null;
    }[];
}, {
    property: {
        name: string;
        id: string;
        landlord: string;
        tin: string | null;
        upi: string | null;
    } | null;
    applications: {
        broker: {
            name: string;
            feeRwf: number;
            terms: string;
            referredAt: string;
        } | null;
        name: string;
        id: string;
        email: string | null;
        documents: {
            name: string;
            state: "waiting" | "requested" | "checked" | "uploaded";
            note: string;
        }[];
        stage: "declined" | "converted" | "ready" | "invited" | "screening";
        source: string;
        createdAt: string;
        phone: string | null;
        roomId: string;
        leaseId: string | null;
        unitLabel: string;
        depositRwf: number | null;
        screening: ("reference" | "identity" | "rules" | "income" | "employment" | "balance")[];
        occupants: string | null;
        offeredRentRwf: number | null;
        termMonths: number | null;
        desiredMoveIn: string | null;
    }[];
    payouts: {
        status: "held" | "paid" | "scheduled" | "queued";
        id: string;
        amountRwf: number;
        settledAt: string | null;
        periodMonth: string | null;
        destination: "momo" | "bank" | null;
        destinationRef: string | null;
        scheduledReleaseAt: string | null;
    }[];
    payments: {
        status: "pending" | "verified" | "unknown" | "failed";
        id: string;
        amountRwf: number;
        leaseId: string;
        method: "mtn_momo" | "airtel_money" | "cash" | "bank_transfer";
        verifiedAt: string | null;
        providerRef: string;
        rentChargeId: string;
        receivedAt: string;
        recordedByName: string | null;
    }[];
    tickets: {
        status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
        id: string;
        reference: string | null;
        description: string | null;
        title: string;
        createdAt: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        resolvedAt: string | null;
        roomId: string | null;
        threadId: string | null;
        leaseId: string | null;
        unitLabel: string | null;
        raisedByName: string | null;
        assignedToName: string | null;
        photos: {
            key: string;
            caption: string;
        }[];
        spaceName: string | null;
        assignedContractor: string | null;
        scheduledFor: string | null;
        raisedVia: string | null;
        staffMayEnter: boolean | null;
        visitWindow: string | null;
        costBearer: "landlord" | "tenant" | "to_be_decided" | null;
        costNote: string | null;
        raisedByRole: "housekeeper" | "guest" | "tenant" | "staff" | null;
    }[];
    leases: {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended";
        id: string;
        reference: string | null;
        roomId: string;
        unitLabel: string;
        tenantName: string | null;
        monthlyRentRwf: number | null;
        cautionRwf: number | null;
        startDate: string | null;
        endDate: string | null;
        landlordSignedAt: string | null;
        tenantSignedAt: string | null;
        tenantUserId: string | null;
        rentDueDay: number | null;
        graceDays: number | null;
        noticePeriodDays: number | null;
        occupants: string | null;
    }[];
    charges: {
        status: "due" | "paid" | "overdue";
        id: string;
        amountRwf: number;
        paidAt: string | null;
        leaseId: string;
        periodMonth: string;
        paidAmountRwf: number;
        dueDate: string | null;
    }[];
    filings: {
        status: "pending" | "failed" | "filed";
        leaseId: string;
        clockStartAt: string | null;
        dueBy: string | null;
    }[];
    deposits: {
        status: "forfeited" | "held" | "refunded";
        id: string;
        amountRwf: number;
        settledAt: string | null;
        leaseId: string;
        heldAt: string;
        refundedRwf: number | null;
        forfeitedRwf: number | null;
    }[];
    units: {
        type: string;
        note: string | null;
        label: string;
        roomId: string;
        block: string;
        askingRentRwf: number;
        vacantSince: string | null;
    }[];
    offers: {
        status: "declined" | "withdrawn" | "open" | "accepted" | "signed";
        id: string;
        startsOn: string;
        leaseId: string;
        signedAt: string | null;
        openedAt: string | null;
        endsOn: string;
        remindedAt: string | null;
        sentAt: string;
        sentByName: string | null;
        offeredRentRwf: number;
        termMonths: number;
        answerBy: string;
        depositTopupRwf: number;
        otherTerms: string | null;
        answeredAt: string | null;
    }[];
    blocks: {
        code: string;
        name: string;
        id: string;
        kind: string;
    }[];
    reminders: {
        id: string;
        note: string;
        leaseId: string;
        channel: "email" | "in_app" | "in_app_email" | "call" | "letter";
        sentAt: string;
        readAt: string | null;
        sentByName: string | null;
    }[];
    notices: {
        message: string | null;
        id: string;
        reasonCode: "other" | "terms" | "kigali" | "leaving" | "own-home" | null;
        leaseId: string;
        moveOutDate: string;
        filedVia: "email" | "app" | "letter" | "in_person" | null;
        filedAt: string;
        noticeGivenDays: number | null;
        isShortNotice: boolean;
    }[];
    ticketNotes: {
        id: string;
        note: string;
        createdAt: string;
        authorName: string | null;
        ticketId: string;
    }[];
    ticketMessages: {
        id: string;
        createdAt: string;
        body: string;
        ticketId: string;
        senderName: string | null;
        fromTenant: boolean;
    }[];
    passes: {
        code: string;
        status: "expected" | "approved" | "expired" | "revoked" | "used";
        id: string;
        kind: "guest" | "contractor";
        roomId: string;
        leaseId: string | null;
        unitLabel: string;
        createdByName: string | null;
        overnight: boolean;
        visitorName: string;
        validFrom: string;
        validTo: string;
        byTenant: boolean;
        usedAt: string | null;
        leftAt: string | null;
    }[];
    accessRequests: {
        status: "approved" | "declined" | "open";
        id: string;
        kind: "overnight" | "delivery" | "gate_entry";
        reason: string | null;
        leaseId: string;
        toDate: string | null;
        requestedAt: string;
        visitorName: string | null;
        forDate: string | null;
    }[];
    visitorLog: {
        id: string;
        roomId: string | null;
        leaseId: string | null;
        unitLabel: string | null;
        place: string | null;
        visitorName: string;
        visitorPhone: string | null;
        admittedHow: string | null;
        recordedBy: string | null;
        arrivalAt: string | null;
        departureAt: string | null;
    }[];
    clauses: {
        code: string;
        note: string;
        title: string;
        needsReview: boolean;
    }[];
    notifications: {
        id: string;
        title: string;
        createdAt: string;
        body: string | null;
        category: string;
        readAt: string | null;
    }[];
}>;
export type ResidenceView = z.infer<typeof ResidenceView>;
/** What every residence command answers: the record it wrote, by id and (where it has one) its human reference. */
export declare const ResidenceWriteResult: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodNullable<z.ZodString>;
    /** A gate code, when the command issued one. */
    code: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string | null;
    id: string;
    reference: string | null;
}, {
    code: string | null;
    id: string;
    reference: string | null;
}>;
export type ResidenceWriteResult = z.infer<typeof ResidenceWriteResult>;
/**
 * Raise a repair. `unit` is a unit label ("B-07"), or a block code ("B") for a common area, which
 * only management may raise. A resident names their own unit; any other is a 404.
 */
export declare const RaiseResidenceRepairRequest: z.ZodObject<{
    unit: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>;
    /** May staff let themselves in when nobody is home? Null for a common area. */
    staffMayEnter: z.ZodNullable<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    unit: string;
    title: string;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration";
    staffMayEnter: boolean | null;
    description?: string | undefined;
}, {
    unit: string;
    title: string;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration";
    staffMayEnter: boolean | null;
    description?: string | undefined;
}>;
export type RaiseResidenceRepairRequest = z.infer<typeof RaiseResidenceRepairRequest>;
/** Move a repair on the board. The board names where it goes; the API refuses a move its machine does not allow. */
export declare const MoveResidenceRepairRequest: z.ZodObject<{
    to: z.ZodEnum<["assigned", "in_progress", "resolved"]>;
}, "strip", z.ZodTypeAny, {
    to: "resolved" | "assigned" | "in_progress";
}, {
    to: "resolved" | "assigned" | "in_progress";
}>;
export type MoveResidenceRepairRequest = z.infer<typeof MoveResidenceRepairRequest>;
/** A reply to the resident (into the ticket's conversation) or an internal note (staff only). */
export declare const ResidenceRepairMessageRequest: z.ZodObject<{
    text: z.ZodString;
    internal: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    text: string;
    internal: boolean;
}, {
    text: string;
    internal: boolean;
}>;
export type ResidenceRepairMessageRequest = z.infer<typeof ResidenceRepairMessageRequest>;
/** Issue a gate code. The window is Kigali time; the server mints the code. */
export declare const IssueVisitorPassRequest: z.ZodEffects<z.ZodObject<{
    unit: z.ZodString;
    visitorName: z.ZodString;
    validFrom: z.ZodString;
    validTo: z.ZodString;
    overnight: z.ZodBoolean;
    kind: z.ZodDefault<z.ZodEnum<["guest", "contractor"]>>;
}, "strip", z.ZodTypeAny, {
    kind: "guest" | "contractor";
    unit: string;
    overnight: boolean;
    visitorName: string;
    validFrom: string;
    validTo: string;
}, {
    unit: string;
    overnight: boolean;
    visitorName: string;
    validFrom: string;
    validTo: string;
    kind?: "guest" | "contractor" | undefined;
}>, {
    kind: "guest" | "contractor";
    unit: string;
    overnight: boolean;
    visitorName: string;
    validFrom: string;
    validTo: string;
}, {
    unit: string;
    overnight: boolean;
    visitorName: string;
    validFrom: string;
    validTo: string;
    kind?: "guest" | "contractor" | undefined;
}>;
export type IssueVisitorPassRequest = z.infer<typeof IssueVisitorPassRequest>;
/**
 * Record a rent payment received outside the app (a bank slip, cash at the office). It is saved as
 * PENDING and is not counted as collected until Payments matches it to the bank statement or the
 * provider's report; it goes to the oldest open charge of the lease. Takes an `Idempotency-Key`.
 */
export declare const RecordRentPaymentRequest: z.ZodObject<{
    unit: z.ZodString;
    amountRwf: z.ZodNumber;
    method: z.ZodEnum<["mtn_momo", "airtel_money", "bank_transfer", "cash"]>;
    providerRef: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    unit: string;
    method: "mtn_momo" | "airtel_money" | "cash" | "bank_transfer";
    providerRef: string;
}, {
    amountRwf: number;
    unit: string;
    method: "mtn_momo" | "airtel_money" | "cash" | "bank_transfer";
    providerRef: string;
}>;
export type RecordRentPaymentRequest = z.infer<typeof RecordRentPaymentRequest>;
/** Remind residents of rent they owe: an in-app notice to each tenant with an account, logged per lease. */
export declare const SendRentRemindersRequest: z.ZodObject<{
    units: z.ZodArray<z.ZodString, "many">;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    units: string[];
}, {
    message: string;
    units: string[];
}>;
export type SendRentRemindersRequest = z.infer<typeof SendRentRemindersRequest>;
/**
 * A move-out notice. The resident gives it in the app (`/me`); management records one that came by
 * letter, email or in person (`/ops`). Notice shorter than the lease's period is refused.
 */
export declare const GiveNoticeRequest: z.ZodObject<{
    moveOutDate: z.ZodString;
    reason: z.ZodEnum<["kigali", "leaving", "own-home", "terms", "other"]>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason: "other" | "terms" | "kigali" | "leaving" | "own-home";
    moveOutDate: string;
    message?: string | undefined;
}, {
    reason: "other" | "terms" | "kigali" | "leaving" | "own-home";
    moveOutDate: string;
    message?: string | undefined;
}>;
export type GiveNoticeRequest = z.infer<typeof GiveNoticeRequest>;
export declare const RecordNoticeRequest: z.ZodObject<{
    unit: z.ZodString;
    receivedOn: z.ZodString;
    moveOutDate: z.ZodString;
    channel: z.ZodEnum<["app", "letter", "email", "in_person"]>;
}, "strip", z.ZodTypeAny, {
    unit: string;
    channel: "email" | "app" | "letter" | "in_person";
    moveOutDate: string;
    receivedOn: string;
}, {
    unit: string;
    channel: "email" | "app" | "letter" | "in_person";
    moveOutDate: string;
    receivedOn: string;
}>;
export type RecordNoticeRequest = z.infer<typeof RecordNoticeRequest>;
/** The resident's answer to a renewal offer. */
export declare const AnswerRenewalRequest: z.ZodObject<{
    answer: z.ZodEnum<["accepted", "declined"]>;
}, "strip", z.ZodTypeAny, {
    answer: "declined" | "accepted";
}, {
    answer: "declined" | "accepted";
}>;
export type AnswerRenewalRequest = z.infer<typeof AnswerRenewalRequest>;
/** Management's decision on a gate or overnight request. */
export declare const DecideAccessRequest: z.ZodObject<{
    decision: z.ZodEnum<["approved", "declined"]>;
}, "strip", z.ZodTypeAny, {
    decision: "approved" | "declined";
}, {
    decision: "approved" | "declined";
}>;
export type DecideAccessRequest = z.infer<typeof DecideAccessRequest>;
/** The manual screening checks recorded so far, as a set. */
export declare const RecordScreeningRequest: z.ZodObject<{
    done: z.ZodArray<z.ZodEnum<["identity", "income", "employment", "reference", "balance", "rules"]>, "many">;
}, "strip", z.ZodTypeAny, {
    done: ("reference" | "identity" | "rules" | "income" | "employment" | "balance")[];
}, {
    done: ("reference" | "identity" | "rules" | "income" | "employment" | "balance")[];
}>;
export type RecordScreeningRequest = z.infer<typeof RecordScreeningRequest>;
/** Decline an application, with the reason the applicant is told. */
export declare const DeclineApplicationRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type DeclineApplicationRequest = z.infer<typeof DeclineApplicationRequest>;
/**
 * Turn a ready application into a lease DRAFT. Nothing is signed: the draft holds the unit while it
 * is out for signature, and a lease goes active only through `/ops/leases/:id/advance` once both
 * sides have signed.
 */
export declare const ConvertApplicationRequest: z.ZodObject<{
    startDate: z.ZodString;
    termMonths: z.ZodNumber;
    monthlyRentRwf: z.ZodNumber;
    cautionRwf: z.ZodNumber;
    noticePeriodDays: z.ZodNumber;
    rentDueDay: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    monthlyRentRwf: number;
    cautionRwf: number;
    startDate: string;
    rentDueDay: number;
    noticePeriodDays: number;
    termMonths: number;
}, {
    monthlyRentRwf: number;
    cautionRwf: number;
    startDate: string;
    rentDueDay: number;
    noticePeriodDays: number;
    termMonths: number;
}>;
export type ConvertApplicationRequest = z.infer<typeof ConvertApplicationRequest>;
//# sourceMappingURL=interface-residence.d.ts.map