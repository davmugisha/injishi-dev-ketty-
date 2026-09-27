import { z } from "zod";
import { AdminOrgPsf } from "./psf";
import {
    AdapterMode,
    Domain,
    GlobalRole,
    OrgRegistrationStatus,
    OrgRole,
    OversightRole,
    OversightScopeLevel,
    StaffRole,
    Uuid,
} from "./primitives";
import {
    EacStarGrade,
    RdbEntityGroup,
    ResidenceClass,
    StoredAccommodationClass,
} from "./rdb";
/**
 * The Injishi admin console wire contracts — all 14 sections of
 * `GET /api/v1/admin/**`.
 *
 * One definition, parsed on both ends: the API validates what it is about to
 * send and the console parses what it received. That is the whole reason this
 * lives here rather than as a `type` in the admin app — a console that declares
 * its own response shape drifts from the server silently, and the first symptom
 * is a blank panel nobody can explain.
 *
 * Four rules run through every schema below, worth stating once rather than
 * repeating on seventy fields:
 *
 * - **Domain shapes only.** Nothing here says how a value LOOKS. No colour, no
 *   label variation, no pre-formatted money, no pre-formatted date. The API
 *   sends the fact; `apps/admin/src/lib/present/` decides the rendering. The
 *   one apparent exception is `AdminWorkQueueItem.href`, which is navigation —
 *   the server knows which route answers a queue, the browser does not.
 * - **Money** is an integer number of Rwandan francs plus its currency tag,
 *   mirroring the `amount()` / `currency()` columns. Never a formatted string,
 *   because "RWF 45,000" cannot be summed, sorted or compared.
 * - **Time** is an ISO 8601 UTC string, so it survives JSON without a reviver.
 * - **Absence is `null`**, never `""` and never a missing key. The console has
 *   to tell "this business has no TIN" from "this response did not carry the
 *   TIN", and an omitted key cannot say which.
 *
 * Enums are REUSED wherever the platform already defines one. The imports at
 * the top of this file are not convenience; a second copy of `OrgRole` here
 * would be a second answer to a question the database already answers.
 */
// ---------------------------------------------------------------------------
// Enums the database owns and this package had not yet mirrored
// ---------------------------------------------------------------------------
/**
 * Every enum below is copied value-for-value from a `pgEnum` in
 * `server/api/src/database/drizzle/enums.ts`. They live here rather than in
 * `primitives.ts` because so far only the admin console reads them — promote
 * one the moment a second surface needs it, rather than pre-emptively.
 */
/** `adapter_name`. The six outbound integrations the platform can be down on. */
export const AdminAdapterName = z.enum([
    "payment",
    "ebm_vsdc",
    "rra_tin",
    "filing",
    "mailer",
    "maps",
]);
export type AdminAdapterName = z.infer<typeof AdminAdapterName>;
/** `adapter_status`. `degraded` is a real third state, not a shade of `down`. */
export const AdminAdapterStatus = z.enum(["up", "degraded", "down"]);
export type AdminAdapterStatus = z.infer<typeof AdminAdapterStatus>;
/**
 * `audit_subject_type`. Must list exactly what the Postgres enum holds.
 *
 * `broker` and `guest_stay` arrived with migration 0029, for the admin writes
 * that act on them. This list is parsed against every audit row the console
 * reads, so a value the database can hold and this cannot is not a narrower
 * view — it is an audit screen that fails to render the moment one such row
 * exists. The API's typecheck is what caught the gap: the query's row type
 * gained the two values and this contract had not.
 */
export const AdminAuditSubjectType = z.enum([
    "user",
    "org",
    "lease",
    "booking",
    "payment",
    "config",
    "property",
    "broker",
    "guest_stay",
    // `training_certificate` arrived with migration 0035 (ADR-049), and the
    // same typecheck described above caught it the same way, which is worth
    // recording as evidence that the mechanism actually works. Issuing and
    // withdrawing a certificate are audited, and they are filed under a subject
    // type of their own rather than under `user` with the holder's id, so
    // "every audit row about this certificate" stays a query rather than a
    // search through payloads.
    "training_certificate",
]);
export type AdminAuditSubjectType = z.infer<typeof AdminAuditSubjectType>;
/**
 * `record_data_class`. What class of another person's data a staff member read.
 * This is the vocabulary of the PII trail, so it must not be widened casually.
 */
export const AdminRecordDataClass = z.enum([
    "national_id",
    "id_photo",
    "contract",
    "stay_identity",
    "contact",
]);
export type AdminRecordDataClass = z.infer<typeof AdminRecordDataClass>;
/** `broker_status`. */
export const AdminBrokerStatus = z.enum(["active", "suspended"]);
export type AdminBrokerStatus = z.infer<typeof AdminBrokerStatus>;
/**
 * `placement_status` (`tenant_placements.status`) — how a broker's introduction
 * ended. `unavailable` is distinct from `abandoned`: the listing went away, the
 * broker did not give up.
 */
export const AdminPlacementStatus = z.enum([
    "initiated",
    "converted",
    "abandoned",
    "unavailable",
]);
export type AdminPlacementStatus = z.infer<typeof AdminPlacementStatus>;
/** `obo_claim_status`. An on-behalf-of registration before and after the claim. */
export const AdminOboClaimStatus = z.enum([
    "registrant_held",
    "owner_claimed",
    "expired",
]);
export type AdminOboClaimStatus = z.infer<typeof AdminOboClaimStatus>;
/** `registration_review_decision`. One human gate, one outcome. */
export const AdminRegistrationReviewDecision = z.enum(["passed", "rejected"]);
export type AdminRegistrationReviewDecision = z.infer<
    typeof AdminRegistrationReviewDecision
>;
/**
 * `registration_rejection_reason`. Coded rather than prose because F-S03 §6
 * promises a resumable rejection — the registrant is sent back to the step that
 * was wrong, and a paragraph typed by an officer cannot drive a form.
 */
export const AdminRegistrationRejectionReason = z.enum([
    "tin_not_found",
    "tin_mismatch",
    "premises_not_found",
    "documents_invalid",
    "documents_expired",
    "not_operating",
    "ownership_unclear",
    "duplicate_business",
    "other",
]);
export type AdminRegistrationRejectionReason = z.infer<
    typeof AdminRegistrationRejectionReason
>;
/** `registration_business_type`. The three paths the fee catalog prices. */
export const AdminRegistrationBusinessType = z.enum([
    "hospitality",
    "residence",
    "broker",
]);
export type AdminRegistrationBusinessType = z.infer<
    typeof AdminRegistrationBusinessType
>;
/** `subscription_status`. */
export const AdminSubscriptionStatus = z.enum([
    "trialing",
    "active",
    "past_due",
    "canceled",
    "suspended",
]);
export type AdminSubscriptionStatus = z.infer<typeof AdminSubscriptionStatus>;
/** `subscription_invoice_status`. */
export const AdminInvoiceStatus = z.enum(["pending", "paid", "failed"]);
export type AdminInvoiceStatus = z.infer<typeof AdminInvoiceStatus>;
/**
 * `invoice_kind`. Despite the table being named `subscription_invoices` it is
 * the org's whole invoice ledger, so a row has to say which of the two it is.
 */
export const AdminInvoiceKind = z.enum(["registration_fee", "subscription"]);
export type AdminInvoiceKind = z.infer<typeof AdminInvoiceKind>;
/** `payout_status`. */
export const AdminPayoutStatus = z.enum(["scheduled", "queued", "paid", "held"]);
export type AdminPayoutStatus = z.infer<typeof AdminPayoutStatus>;
/** `plan_billing_period`. One value today; an enum so a second is a migration. */
export const AdminPlanBillingPeriod = z.enum(["monthly"]);
export type AdminPlanBillingPeriod = z.infer<typeof AdminPlanBillingPeriod>;
/** `ledger_txn_kind`. What moved the money, not which account it landed in. */
export const AdminLedgerTxnKind = z.enum([
    "capture",
    "refund",
    "forfeiture",
    "payout",
    "rent_settle",
    "caution_settle",
    "placement_disburse",
    "subscription_charge",
    "override",
    "chargeback",
    "folio_post",
    "folio_settle",
]);
export type AdminLedgerTxnKind = z.infer<typeof AdminLedgerTxnKind>;
/** `flag_scope`. A flag is global or it names one district. */
export const AdminFlagScope = z.enum(["global", "district"]);
export type AdminFlagScope = z.infer<typeof AdminFlagScope>;
/** `compliance_artifact_type`. The four documents the NCSA posture is made of. */
export const AdminComplianceArtifactType = z.enum([
    "ncsa_registration",
    "dpo_of_record",
    "dpia",
    "processor_inventory_entry",
]);
export type AdminComplianceArtifactType = z.infer<
    typeof AdminComplianceArtifactType
>;
/** `dsr_request_type`. */
export const AdminDsrRequestType = z.enum(["access", "correction", "deletion"]);
export type AdminDsrRequestType = z.infer<typeof AdminDsrRequestType>;
/** `dsr_state`. */
export const AdminDsrState = z.enum(["received", "fulfilled"]);
export type AdminDsrState = z.infer<typeof AdminDsrState>;
/** `support_ticket_state`. `reopened` is kept distinct from `open` on purpose. */
export const AdminSupportTicketState = z.enum([
    "open",
    "resolved",
    "reopened",
    "closed",
]);
export type AdminSupportTicketState = z.infer<typeof AdminSupportTicketState>;
/** `escalation_subject_type`. */
export const AdminEscalationSubjectType = z.enum([
    "user",
    "org",
    "lease",
    "booking",
    "listing",
    "review",
    "message",
    "payment",
]);
export type AdminEscalationSubjectType = z.infer<
    typeof AdminEscalationSubjectType
>;
/** `escalation_type`. */
export const AdminEscalationType = z.enum([
    "dispute",
    "policy_violation",
    "off_platform_leakage",
    "listing_non_compliance",
    "review_abuse",
]);
export type AdminEscalationType = z.infer<typeof AdminEscalationType>;
/** `escalation_state`. */
export const AdminEscalationState = z.enum(["open", "resolved"]);
export type AdminEscalationState = z.infer<typeof AdminEscalationState>;
/** `announcement_state`. */
export const AdminAnnouncementState = z.enum(["draft", "published"]);
export type AdminAnnouncementState = z.infer<typeof AdminAnnouncementState>;
/** `translation_status`. `needs_review` is the "stale" bucket coverage counts. */
export const AdminTranslationStatus = z.enum([
    "translated",
    "missing",
    "needs_review",
]);
export type AdminTranslationStatus = z.infer<typeof AdminTranslationStatus>;
/**
 * The KYC state as the console lists it, which is deliberately NOT `KycStatus`.
 *
 * The identity layer stores four values (`unverified | pending | verified |
 * rejected`); a staff member scanning a user list is answering one question —
 * has this person proved who they are — and `unverified` and `rejected` answer
 * it the same way. Projecting both to `none` keeps a filter with three buttons
 * rather than four, two of which would mean the same thing in the list. The
 * full state is read on the identity screen, where the difference matters.
 */
export const AdminKycState = z.enum(["none", "pending", "verified"]);
export type AdminKycState = z.infer<typeof AdminKycState>;
// ---------------------------------------------------------------------------
// Paging
// ---------------------------------------------------------------------------
/**
 * What every list route sends alongside its page.
 *
 * `page` is 1-based because it is shown to a human. `total` is the count BEFORE
 * paging, so the console can say "1-25 of 380" without a second request, and it
 * is the field that makes an empty result honest: `{ total: 0 }` is a true
 * statement about a fresh platform, not a failure to load.
 */
export const AdminListMeta = z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive().max(100),
});
export type AdminListMeta = z.infer<typeof AdminListMeta>;
/**
 * The one list-response factory. Every `{ items, meta }` schema below is built
 * from it, so no route can invent a second spelling of a paged answer and none
 * can forget to accept an empty page.
 */
const listOf = <T extends z.ZodTypeAny>(item: T) =>
    z.object({ items: z.array(item), meta: AdminListMeta });
/**
 * Paging query params, spread into every list query schema.
 *
 * Coerced because they arrive as strings on a query string; capped at 100
 * because an uncapped `pageSize` is a denial of service handed to anyone with a
 * staff session. Optional, with the route applying 1 and 25.
 */
const pageQuery = {
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
};
// ===========================================================================
// 1. Overview  —  admin/overview
// ===========================================================================
/**
 * One headline number.
 *
 * `previousValue` rides along rather than being computed in the browser: the
 * comparison window is a server decision (previous 30 days, previous month,
 * same month last year) and a console that picks its own window will disagree
 * with the one analytics reports. `value` is nullable because a metric with no
 * data yet is not the same as a metric that is zero.
 */
export const AdminKpi = z.object({
    key: z.string(),
    label: z.string(),
    value: z.number().nullable(),
    unit: z.enum(["count", "rwf", "percent"]),
    previousValue: z.number().nullable(),
});
export type AdminKpi = z.infer<typeof AdminKpi>;
/** One revenue line in the period, with the same period-over-period pairing. */
export const AdminRevenueLine = z.object({
    line: z.string(),
    amountRwf: z.number(),
    currency: z.string(),
    previousAmountRwf: z.number().nullable(),
});
export type AdminRevenueLine = z.infer<typeof AdminRevenueLine>;
/**
 * Businesses per district. `districtId` is an integer smart code, not a uuid —
 * geography is the one part of the schema that does not use uuids.
 */
export const AdminDistrictDensity = z.object({
    districtId: z.number().int().positive(),
    districtName: z.string(),
    orgCount: z.number().int().nonnegative(),
    previousOrgCount: z.number().int().nonnegative().nullable(),
});
export type AdminDistrictDensity = z.infer<typeof AdminDistrictDensity>;
/**
 * One "there are N things waiting for you" row.
 *
 * `href` is the single navigation field in this file and it is deliberate: the
 * server knows which route answers a queue, and a browser-side map from `key`
 * to route is a second copy of the routing table that goes stale the first time
 * a section moves.
 */
export const AdminWorkQueueItem = z.object({
    key: z.string(),
    count: z.number().int().nonnegative(),
    title: z.string(),
    detail: z.string(),
    href: z.string(),
});
export type AdminWorkQueueItem = z.infer<typeof AdminWorkQueueItem>;
/**
 * The newest `adapter_health_snapshots` row per adapter.
 *
 * `errorRate` and `latencyMs` are nullable because their columns are: a
 * snapshot can record that an adapter is up without having measured either, and
 * a 0 would assert a perfect adapter that was never timed.
 */
export const AdminAdapterHealth = z.object({
    adapter: AdminAdapterName,
    mode: AdapterMode,
    status: AdminAdapterStatus,
    errorRate: z.number().nullable(),
    latencyMs: z.number().int().nonnegative().nullable(),
    observedAt: z.string(),
});
export type AdminAdapterHealth = z.infer<typeof AdminAdapterHealth>;
/**
 * The newest `queue_health_snapshots` row per queue.
 *
 * `queue` is a free string rather than an enum because BullMQ queue names are
 * declared in code, not in a `pgEnum`; promoting them here would mean a
 * migration every time a processor is added. The four counters are not
 * nullable: the columns are, but a snapshot that measured nothing is not a
 * snapshot, and the writer fills all four or writes no row.
 */
export const AdminQueueHealth = z.object({
    queue: z.string(),
    depth: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    deadLetter: z.number().int().nonnegative(),
    throughput: z.number(),
    observedAt: z.string(),
});
export type AdminQueueHealth = z.infer<typeof AdminQueueHealth>;
/** `GET /api/v1/admin/overview` — the whole landing screen in one round trip. */
export const AdminOverview = z.object({
    kpis: z.array(AdminKpi),
    revenue: z.array(AdminRevenueLine),
    density: z.array(AdminDistrictDensity),
    workQueue: z.array(AdminWorkQueueItem),
    adapters: z.array(AdminAdapterHealth),
    queues: z.array(AdminQueueHealth),
});
export type AdminOverview = z.infer<typeof AdminOverview>;
// ===========================================================================
// 2. Businesses  —  admin/orgs
// ===========================================================================
/**
 * One business as the console lists it.
 *
 * Almost every classification field is nullable, and that is the schema being
 * honest rather than the contract being loose: `orgs_domain_shape` requires an
 * accommodation class for a hospitality org and a residence class for a
 * residence org, so exactly one of the two is always null. Same for `tin` and
 * `upi` under `orgs_identifier_shape` — a residential landlord has a UPI and no
 * TIN, and the old NOT NULL on `tin` forced them to invent one.
 *
 * `isObo` is derived (an `obo_registrations` row exists), not a column. It is on
 * the list row because an on-behalf-of registration is held by someone who is
 * not the owner, and that changes how staff read every other field beside it.
 */
export const AdminOrgRow = z.object({
    id: Uuid,
    legalName: z.string(),
    domain: Domain,
    rdbEntityGroup: RdbEntityGroup.nullable(),
    accommodationClass: StoredAccommodationClass.nullable(),
    residenceClass: ResidenceClass.nullable(),
    tourismLicenseNumber: z.string().nullable(),
    chamberOfTourismMember: z.boolean(),
    psfMember: z.boolean(),
    eacStarGrade: EacStarGrade.nullable(),
    tin: z.string().nullable(),
    upi: z.string().nullable(),
    registrationStatus: OrgRegistrationStatus,
    districtId: z.number().int().positive().nullable(),
    districtName: z.string().nullable(),
    isObo: z.boolean(),
    subscriptionStatus: AdminSubscriptionStatus.nullable(),
    subscriptionPlanName: z.string().nullable(),
    createdAt: z.string(),
});
export type AdminOrgRow = z.infer<typeof AdminOrgRow>;
/** Query params for `GET /api/v1/admin/orgs`. */
export const AdminOrgListQuery = z.object({
    /** Free text over legal name, TIN and UPI. */
    q: z.string().optional(),
    districtId: z.coerce.number().int().positive().optional(),
    domain: Domain.optional(),
    registrationStatus: OrgRegistrationStatus.optional(),
    ...pageQuery,
});
export type AdminOrgListQuery = z.infer<typeof AdminOrgListQuery>;
export const AdminOrgListResponse = listOf(AdminOrgRow);
export type AdminOrgListResponse = z.infer<typeof AdminOrgListResponse>;
/**
 * Is anyone appointed to take this business's current stage? (ADR-053, AC-G9)
 *
 * Three states, because only two of the four statuses in the review queue wait
 * on an officer. `tin_verified` waits on a `business_field_verifier` and
 * `field_verified` on a `business_approver`: each is `covered` when a live
 * assignment for that function reaches the business's district and `uncovered`
 * when none does. `submitted` waits on the RRA check and `approved` on the
 * owner's claim, so both are `not_applicable`; reporting them uncovered would
 * send a staffer hunting for an officer nobody needs.
 *
 * Computed when the queue is read, from `oversight_assignments`. Revoking the
 * last covering grant flips a business to `uncovered` with no job run.
 */
export const ReviewCoverage = z.enum(["covered", "uncovered", "not_applicable"]);
export type ReviewCoverage = z.infer<typeof ReviewCoverage>;
/**
 * One business waiting at a registration gate.
 *
 * `lastDecision` is the newest `org_registration_reviews` row, nullable because
 * a business nobody has reviewed yet is the normal case in this queue. The body
 * and title on that table are COPIES taken at decision time and never re-read
 * from the assignment, so a revoked posting cannot rewrite who decided what;
 * this contract inherits that by carrying the decision rather than the grant.
 */
export const AdminOrgReviewItem = z.object({
    orgId: Uuid,
    legalName: z.string(),
    districtName: z.string().nullable(),
    domain: Domain,
    registrationStatus: OrgRegistrationStatus,
    submittedAt: z.string().nullable(),
    lastDecision: z
        .object({
            decision: AdminRegistrationReviewDecision,
            reasonCode: AdminRegistrationRejectionReason.nullable(),
            decidedAt: z.string(),
            oversightRole: OversightRole.nullable(),
        })
        .nullable(),
    /** True once a `tin_verifications` row for this org came back `verified`. */
    tinVerified: z.boolean(),
    /**
     * When the business entered the stage it is in NOW (ADR-053, AC-R7).
     *
     * The newest `org_registration_events` row whose `to_status` is the current
     * status. Null for a business that reached its status before the event log
     * existed, which is a real answer ("we did not record it") rather than a
     * guess; the console shows no wait rather than an invented one.
     */
    stageEnteredAt: z.string().nullable(),
    /**
     * Held at `submitted` on an RRA check that never answered, with every
     * automatic retry used (ADR-053, AC-R5).
     *
     * Computed when the queue is read, not stored. A stored flag would have to be
     * cleared by a later success, a resubmit and an admin recheck, and one missed
     * clear would leave a healthy business flagged forever.
     */
    stalled: z.boolean(),
    /**
     * Whether an officer can take this business's CURRENT stage (ADR-053, AC-G9).
     * See `ReviewCoverage`.
     */
    coverage: ReviewCoverage,
});
export type AdminOrgReviewItem = z.infer<typeof AdminOrgReviewItem>;
export const AdminOrgReviewQueueResponse = listOf(AdminOrgReviewItem);
export type AdminOrgReviewQueueResponse = z.infer<
    typeof AdminOrgReviewQueueResponse
>;
/**
 * An on-behalf-of registration: a business somebody registered FOR its owner.
 *
 * The intended owner's national ID is on the table and is deliberately NOT on
 * this row. The console lists people; it does not export their documents, and
 * an unmasked government number in a list response is the kind of disclosure no
 * amount of route guarding undoes. `intendedOwnerEmail` stays because it is the
 * address the claim invitation goes to, which is the point of the row.
 *
 * `payoutLocked` starts true and stays true until the real owner claims: money
 * must not leave for a business whose owner has not yet identified themselves.
 */
export const AdminOboRow = z.object({
    id: Uuid,
    orgId: Uuid,
    orgName: z.string(),
    districtName: z.string().nullable(),
    registrantUserId: Uuid,
    registrantName: z.string().nullable(),
    intendedOwnerName: z.string(),
    intendedOwnerEmail: z.string().nullable(),
    claimStatus: AdminOboClaimStatus,
    payoutLocked: z.boolean(),
    claimedAt: z.string().nullable(),
});
export type AdminOboRow = z.infer<typeof AdminOboRow>;
export const AdminOboListResponse = listOf(AdminOboRow);
export type AdminOboListResponse = z.infer<typeof AdminOboListResponse>;
/**
 * One business in full. The list row plus what only a detail read pays for: the
 * address, the geography below district, and three counts that would each cost
 * a join nobody wants on a 25-row page.
 */
export const AdminOrgDetail = AdminOrgRow.extend({
    /**
     * When the business entered its current stage, for EVERY stage (ADR-053,
     * AC-R7), `pending_payment` and `suspended` included, neither of which the
     * review queue lists. Null before the event log existed.
     */
    stageEnteredAt: z.string().nullable(),
    addressText: z.string().nullable(),
    sectorId: z.number().int().positive().nullable(),
    villageId: z.number().int().positive().nullable(),
    memberCount: z.number().int().nonnegative(),
    propertyCount: z.number().int().nonnegative(),
    certificateCount: z.number().int().nonnegative(),
    /**
     * PSF membership (ADR-056 AC-20). Null for a residence, which cannot hold
     * one. Defaults to null so an older API still parses.
     */
    psf: AdminOrgPsf.nullable().default(null),
});
export type AdminOrgDetail = z.infer<typeof AdminOrgDetail>;
/**
 * One person inside a business.
 *
 * `status` is the enum the database now enforces. It used to be `z.string()`,
 * correctly, while `org_memberships.status` was free `text`; ADR-053 made the
 * column `org_membership_status` (AC-R10), so the contract promises exactly what
 * Postgres refuses to store otherwise, no more and no less.
 */
export const AdminOrgMember = z.object({
    userId: Uuid,
    name: z.string().nullable(),
    email: z.string(),
    orgRole: OrgRole,
    status: z.enum(["active", "removed"]),
    joinedAt: z.string(),
    removedAt: z.string().nullable(),
});
export type AdminOrgMember = z.infer<typeof AdminOrgMember>;
export const AdminOrgPeopleResponse = listOf(AdminOrgMember);
export type AdminOrgPeopleResponse = z.infer<typeof AdminOrgPeopleResponse>;
/**
 * One property of a business.
 *
 * `domain` comes from the owning org, not the property: `properties` has no
 * domain column, and the org's branch is what decides whether a property is a
 * hotel or a rental building. `published` is derived from the property's single
 * `listings` row reaching `published`, which is what makes it visible to the
 * public marketplace.
 */
export const AdminOrgProperty = z.object({
    id: Uuid,
    name: z.string(),
    domain: Domain,
    districtName: z.string().nullable(),
    roomTypeCount: z.number().int().nonnegative(),
    roomCount: z.number().int().nonnegative(),
    listingCount: z.number().int().nonnegative(),
    published: z.boolean(),
    /** ADR-054 AC-R4: which branch is the head office. */
    isHeadOffice: z.boolean(),
    rraBranchId: z.string().nullable(),
    archivedAt: z.string().nullable(),
});
export type AdminOrgProperty = z.infer<typeof AdminOrgProperty>;
export const AdminOrgPropertiesResponse = listOf(AdminOrgProperty);
export type AdminOrgPropertiesResponse = z.infer<
    typeof AdminOrgPropertiesResponse
>;
/**
 * One row of `subscription_invoices` — which, despite the table's name, is the
 * org's whole invoice ledger. `invoiceKind` is the discriminator, and the
 * table's own CHECK guarantees the shape that follows from it: a registration
 * fee names no subscription and covers no period, so `periodStart` and
 * `periodEnd` are null on exactly those rows.
 */
export const AdminInvoice = z.object({
    id: Uuid,
    invoiceKind: AdminInvoiceKind,
    amountRwf: z.number(),
    currency: z.string(),
    status: AdminInvoiceStatus,
    periodStart: z.string().nullable(),
    periodEnd: z.string().nullable(),
    createdAt: z.string(),
});
export type AdminInvoice = z.infer<typeof AdminInvoice>;
/**
 * `GET /api/v1/admin/orgs/:orgId/subscription`.
 *
 * `subscription` is nullable because an org in the registration pipeline has
 * paid a registration fee and holds no subscription yet — and the invoice array
 * is populated in exactly that state, which is why the two are sibling fields
 * rather than invoices nested under the subscription.
 */
export const AdminOrgSubscription = z.object({
    subscription: z
        .object({
            id: Uuid,
            planName: z.string().nullable(),
            status: AdminSubscriptionStatus,
            currentPeriodStart: z.string().nullable(),
            currentPeriodEnd: z.string().nullable(),
            canceledAt: z.string().nullable(),
        })
        .nullable(),
    invoices: z.array(AdminInvoice),
});
export type AdminOrgSubscription = z.infer<typeof AdminOrgSubscription>;
/**
 * One payout. `workspaceId` is nullable here although the column is not, so a
 * row read through a join that could not resolve its workspace still parses:
 * the console shows the payout rather than dropping money off the screen.
 */
export const AdminPayout = z.object({
    id: Uuid,
    workspaceId: Uuid.nullable(),
    amountRwf: z.number(),
    currency: z.string(),
    status: AdminPayoutStatus,
    failureReason: z.string().nullable(),
    createdAt: z.string(),
    settledAt: z.string().nullable(),
});
export type AdminPayout = z.infer<typeof AdminPayout>;
/**
 * One side of one double-entry posting.
 *
 * `direction` is derived, not stored: `ledger_entries` carries a signed
 * `amount_rwf` and the account it hit, and the console should not be the place
 * that decides what a negative amount means. `accountCode` is the human-facing
 * code from `ledger_accounts` rather than the account uuid, because the code is
 * what a finance staffer actually reconciles against.
 */
export const AdminLedgerRow = z.object({
    id: Uuid,
    transactionId: Uuid,
    kind: AdminLedgerTxnKind,
    adapterMode: AdapterMode,
    memo: z.string().nullable(),
    accountCode: z.string(),
    direction: z.enum(["debit", "credit"]),
    amountRwf: z.number(),
    currency: z.string(),
    occurredAt: z.string(),
});
export type AdminLedgerRow = z.infer<typeof AdminLedgerRow>;
/**
 * `GET /api/v1/admin/orgs/:orgId/money` — every money fact about one business
 * on one screen. The registration fee is lifted out of `invoices` rather than
 * left inside it because it is the one charge that happens once per org ever,
 * and staff look for it by name when a registration sticks at
 * `pending_payment`.
 */
export const AdminOrgMoney = z.object({
    registrationFee: AdminInvoice.nullable(),
    invoices: z.array(AdminInvoice),
    payouts: z.array(AdminPayout),
    ledger: z.array(AdminLedgerRow),
});
export type AdminOrgMoney = z.infer<typeof AdminOrgMoney>;
/**
 * One `audit_events` row as a timeline entry.
 *
 * `eventType` is a free string rather than an enum: the column is `text` and
 * every module writes its own event names. `actorUserId` is nullable because
 * the platform itself acts — an expiry sweep has no actor, and attributing one
 * to it would be a lie in the one table that exists not to tell them.
 */
export const AdminTimelineEvent = z.object({
    id: Uuid,
    eventType: z.string(),
    subjectType: AdminAuditSubjectType.nullable(),
    actorUserId: Uuid.nullable(),
    actorName: z.string().nullable(),
    reason: z.string().nullable(),
    occurredAt: z.string(),
});
export type AdminTimelineEvent = z.infer<typeof AdminTimelineEvent>;
export const AdminOrgTimelineResponse = listOf(AdminTimelineEvent);
export type AdminOrgTimelineResponse = z.infer<typeof AdminOrgTimelineResponse>;
// ===========================================================================
// 8. Audit  —  admin/audit
//
// Defined ahead of §3 because §2's OBO audit route composes both of these.
// ===========================================================================
/** One `audit_events` row in the full log, where the subject is not fixed. */
export const AdminAuditRow = z.object({
    id: Uuid,
    actorUserId: Uuid.nullable(),
    actorName: z.string().nullable(),
    /**
     * Set when the actor was working through an impersonation session. Carried
     * apart from `actorUserId` on purpose: "staff X did this" and "staff X did
     * this AS user Y" are different facts, and collapsing them loses the one
     * the audit trail exists to record.
     */
    impersonatedUserId: Uuid.nullable(),
    subjectType: AdminAuditSubjectType.nullable(),
    subjectId: Uuid.nullable(),
    eventType: z.string(),
    reason: z.string().nullable(),
    districtId: z.number().int().positive().nullable(),
    occurredAt: z.string(),
});
export type AdminAuditRow = z.infer<typeof AdminAuditRow>;
/** Query params for `GET /api/v1/admin/audit`. */
export const AdminAuditQuery = z.object({
    /** Free text over the event type and the reason. */
    q: z.string().optional(),
    subjectType: AdminAuditSubjectType.optional(),
    actorUserId: Uuid.optional(),
    ...pageQuery,
});
export type AdminAuditQuery = z.infer<typeof AdminAuditQuery>;
export const AdminAuditResponse = listOf(AdminAuditRow);
export type AdminAuditResponse = z.infer<typeof AdminAuditResponse>;
/**
 * One `record_access_logs` row: a staff member read someone else's record.
 *
 * `reason` is NOT NULL on the table and not nullable here, because a read of
 * another person's data without a stated reason is the thing this table exists
 * to make impossible. The routes that return identity data take that reason as
 * a required query param and write this row before they answer.
 */
export const AdminAccessLogRow = z.object({
    id: Uuid,
    actorUserId: Uuid,
    actorName: z.string().nullable(),
    subjectUserId: Uuid.nullable(),
    subjectRef: Uuid.nullable(),
    dataClass: AdminRecordDataClass,
    reason: z.string(),
    occurredAt: z.string(),
});
export type AdminAccessLogRow = z.infer<typeof AdminAccessLogRow>;
export const AdminAccessLogResponse = listOf(AdminAccessLogRow);
export type AdminAccessLogResponse = z.infer<typeof AdminAccessLogResponse>;
/**
 * `GET /api/v1/admin/orgs/:orgId/obo-audit` — the two trails for one
 * on-behalf-of registration, side by side and deliberately NOT paged.
 *
 * The question is "show me everything that happened to this OBO registration",
 * and an answer split across two independent paginations cannot be read as one
 * story. An OBO registration's history is bounded; a full log's is not, which
 * is why the sibling audit routes above are paged and this one is not.
 */
export const AdminOboAuditResponse = z.object({
    events: z.array(AdminTimelineEvent),
    accessLogs: z.array(AdminAccessLogRow),
});
export type AdminOboAuditResponse = z.infer<typeof AdminOboAuditResponse>;
// ===========================================================================
// 3. Users  —  admin/users
// ===========================================================================
/** One business a user belongs to, as it appears on their user row. */
export const AdminUserMembership = z.object({
    orgId: Uuid,
    orgName: z.string(),
    domain: Domain,
    orgRole: OrgRole,
    /**
     * A property of this person's relationship to this business, not of the
     * business: an OBO registrant holds the owner role with payouts locked
     * until the real owner claims, so the lock belongs on the membership.
     */
    payoutLocked: z.boolean(),
});
export type AdminUserMembership = z.infer<typeof AdminUserMembership>;
/**
 * A government console seat.
 *
 * `governmentTitle` is the government's own words for the job ("Business
 * Registration Officer") and is separate from `oversightRole`, which is the
 * function the registration pipeline branches on. Three layers coexist — the
 * enum is the database's name, the console renders a label, and this is what
 * the officer's employer calls them — and conflating them loses the only one a
 * citizen would recognise. `scopeLabel` is the resolved province or district
 * name, null for a country-level grant, which names no region at all.
 */
export const AdminOversightGrant = z.object({
    /**
     * The assignment row. Added by ADR-053, because a grant that can be revoked
     * has to be nameable: `DELETE /admin/users/:userId/oversight/:assignmentId`
     * addresses this, and a revoke keyed on role plus scope would be guessing
     * which of two grants was meant.
     */
    id: Uuid,
    oversightRole: OversightRole,
    governmentBodyCode: z.string(),
    /** `government_bodies.name_en`, joined on the code. The words a citizen knows. */
    governmentBodyName: z.string().nullable(),
    governmentTitle: z.string().nullable(),
    scopeLevel: OversightScopeLevel,
    scopeLabel: z.string().nullable(),
});
export type AdminOversightGrant = z.infer<typeof AdminOversightGrant>;
/**
 * Appoint a government officer (ADR-053, AC-G1).
 *
 * Four things are named and none is derivable from another: the FUNCTION the
 * pipeline branches on, the BODY that appointed them, that body's OWN job title
 * for the post, and the REGION. Three layers of name coexist here on purpose —
 * the enum is the database's, the console renders a label, and
 * `governmentTitle` is what the officer's employer calls them — and collapsing
 * them loses the only one a citizen would recognise.
 *
 * The scope shape is checked here as well as by the table's CHECK constraint, so
 * a mismatched pair is a 422 naming the field rather than a 500 from Postgres.
 */
export const CreateOversightGrantRequest = z
    .object({
        oversightRole: OversightRole,
        governmentBodyCode: z.string().trim().min(1, "Name the government body."),
        governmentTitle: z
            .string()
            .trim()
            .min(2, "Give the officer the title their institution uses.")
            .max(200, "That title is too long for our records."),
        scopeLevel: OversightScopeLevel,
        provinceId: z.number().int().positive().nullable().optional(),
        districtId: z.number().int().positive().nullable().optional(),
    })
    .superRefine((value, ctx) => {
        // Mirrors `oversight_assignments_scope_shape`. A country grant names no
        // region at all; the other two name exactly their own level.
        if (value.scopeLevel === "country") {
            if (value.provinceId != null || value.districtId != null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["scopeLevel"],
                    message: "A country scope names no province or district.",
                });
            }
            return;
        }
        if (value.scopeLevel === "province") {
            if (value.provinceId == null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["provinceId"],
                    message: "Choose the province this officer covers.",
                });
            }
            if (value.districtId != null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["districtId"],
                    message: "A province scope names no district.",
                });
            }
            return;
        }
        if (value.districtId == null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["districtId"],
                message: "Choose the district this officer covers.",
            });
        }
    });
export type CreateOversightGrantRequest = z.infer<typeof CreateOversightGrantRequest>;
/**
 * One person, with every authority they hold gathered in one place.
 *
 * The four authority fields stay separate because they are four different
 * systems: `globalRoles` is identity, `memberships` is business membership,
 * `staffRoles` is platform staff, and `oversight` is a government seat. A
 * single flattened "roles" list would make it impossible to tell the owner of a
 * hotel from an employee of the platform, which is precisely the distinction a
 * staff member opens this screen to make.
 *
 * `phoneMasked` and `nationalIdMasked` are MASKED, exactly as
 * `/api/v1/me/profile` masks them. The raw values never reach this console:
 * staff need to confirm a number they were told, not to read one they were not.
 */
export const AdminUserRow = z.object({
    id: Uuid,
    name: z.string().nullable(),
    email: z.string(),
    emailVerified: z.boolean(),
    kyc: AdminKycState,
    phoneMasked: z.string().nullable(),
    nationalIdMasked: z.string().nullable(),
    globalRoles: z.array(GlobalRole),
    memberships: z.array(AdminUserMembership),
    staffRoles: z.array(StaffRole),
    oversight: AdminOversightGrant.nullable(),
    twoFactorEnrolled: z.boolean(),
    createdAt: z.string(),
});
export type AdminUserRow = z.infer<typeof AdminUserRow>;
/** Query params for `GET /api/v1/admin/users`. */
export const AdminUserListQuery = z.object({
    /** Free text over name and email. */
    q: z.string().optional(),
    globalRole: GlobalRole.optional(),
    kyc: AdminKycState.optional(),
    ...pageQuery,
});
export type AdminUserListQuery = z.infer<typeof AdminUserListQuery>;
export const AdminUserListResponse = listOf(AdminUserRow);
export type AdminUserListResponse = z.infer<typeof AdminUserListResponse>;
/**
 * A stay that ended without anyone claiming it.
 *
 * These matter because a `guest_stays` row can exist with no account behind it
 * at all — a walk-in has no booking and no `users` row, which is why
 * `guestName` lives on the stay. An unclaimed stay is a guest record with no
 * owner, which is both a support case and a retention question.
 *
 * `reference` resolves to the booking reference where the stay came from a
 * booking and to the stay's claim code where it did not; a walk-in has no
 * booking reference to show and staff still need something to read out on the
 * phone. `identityState` reports whether a `stay_identities` capture exists and
 * whether it was verified — a different question from `claim_status`, which is
 * about who owns the stay rather than who was in the room.
 */
export const AdminUnclaimedStay = z.object({
    stayId: Uuid,
    reference: z.string(),
    propertyName: z.string().nullable(),
    guestName: z.string().nullable(),
    checkOutAt: z.string().nullable(),
    identityState: z.enum(["none", "captured", "verified"]),
});
export type AdminUnclaimedStay = z.infer<typeof AdminUnclaimedStay>;
export const AdminUnclaimedStaysResponse = listOf(AdminUnclaimedStay);
export type AdminUnclaimedStaysResponse = z.infer<
    typeof AdminUnclaimedStaysResponse
>;
// ===========================================================================
// 4. Brokers  —  admin/brokers
// ===========================================================================
/**
 * One broker.
 *
 * `revealCreditBalance` is `sum(delta)` over `broker_reveal_credits`, not a
 * stored counter — that table is a ledger precisely so a balance can always be
 * explained by the rows that produced it. Sending the derived sum is right;
 * sending a column that something decremented would not be.
 *
 * `nationalId` is on the table and is NOT on this row: a broker's government
 * number is not needed to administer a broker.
 */
export const AdminBrokerRow = z.object({
    id: Uuid,
    userId: Uuid,
    name: z.string().nullable(),
    email: z.string().nullable(),
    phoneMasked: z.string().nullable(),
    status: AdminBrokerStatus,
    /** Signed: a ledger with more spends than grants is a real, visible state. */
    revealCreditBalance: z.number().int(),
    revealCount: z.number().int().nonnegative(),
    placementCount: z.number().int().nonnegative(),
    placementFeesRwf: z.number(),
    currency: z.string(),
    createdAt: z.string(),
});
export type AdminBrokerRow = z.infer<typeof AdminBrokerRow>;
export const AdminBrokerListResponse = listOf(AdminBrokerRow);
export type AdminBrokerListResponse = z.infer<typeof AdminBrokerListResponse>;
/**
 * One contact reveal: a broker spent a credit to see a landlord's number.
 *
 * The revealed phone and email are on the table and are NOT on this row. The
 * point of the audit is that a reveal HAPPENED, by whom and against which
 * listing — replaying the contact details into an admin list would hand every
 * staff member the directory the credit system exists to meter.
 */
export const AdminRevealEvent = z.object({
    id: Uuid,
    brokerId: Uuid,
    brokerName: z.string().nullable(),
    listingId: Uuid.nullable(),
    landlordOrgId: Uuid.nullable(),
    landlordOrgName: z.string().nullable(),
    districtName: z.string().nullable(),
    revealedAt: z.string(),
});
export type AdminRevealEvent = z.infer<typeof AdminRevealEvent>;
export const AdminRevealListResponse = listOf(AdminRevealEvent);
export type AdminRevealListResponse = z.infer<typeof AdminRevealListResponse>;
// ===========================================================================
// 5. Finance  —  admin/finance
// ===========================================================================
export const AdminLedgerResponse = listOf(AdminLedgerRow);
export type AdminLedgerResponse = z.infer<typeof AdminLedgerResponse>;
/** Query params for `GET /api/v1/admin/finance/payouts`. */
export const AdminPayoutQuery = z.object({
    status: AdminPayoutStatus.optional(),
    ...pageQuery,
});
export type AdminPayoutQuery = z.infer<typeof AdminPayoutQuery>;
export const AdminPayoutResponse = listOf(AdminPayout);
export type AdminPayoutResponse = z.infer<typeof AdminPayoutResponse>;
/**
 * A `subscription_invoices` row that came back `failed`.
 *
 * Its own schema rather than a filtered `AdminInvoice[]` because the question
 * differs: a failed charge is answered by contacting a business, so the org's
 * identity travels with the row, whereas `AdminInvoice` is only ever read with
 * an org already on screen.
 */
export const AdminFailedCharge = z.object({
    invoiceId: Uuid,
    orgId: Uuid,
    orgName: z.string(),
    invoiceKind: AdminInvoiceKind,
    amountRwf: z.number(),
    currency: z.string(),
    status: AdminInvoiceStatus,
    createdAt: z.string(),
});
export type AdminFailedCharge = z.infer<typeof AdminFailedCharge>;
export const AdminFailedChargeResponse = listOf(AdminFailedCharge);
export type AdminFailedChargeResponse = z.infer<
    typeof AdminFailedChargeResponse
>;
/**
 * One reconciliation run.
 *
 * The window and the three counts are read out of the run's `report` jsonb;
 * `reconciliation_runs` itself stores only status, report, adapter mode and
 * `ran_at`. They are flattened onto the wire rather than passed through as
 * opaque JSON because a console that reaches into an untyped blob to render a
 * number breaks silently the day the report's shape changes.
 */
export const AdminReconRun = z.object({
    id: Uuid,
    windowStart: z.string().nullable(),
    windowEnd: z.string().nullable(),
    entryCount: z.number().int().nonnegative(),
    matchedCount: z.number().int().nonnegative(),
    discrepancyCount: z.number().int().nonnegative(),
    ranAt: z.string(),
});
export type AdminReconRun = z.infer<typeof AdminReconRun>;
export const AdminReconRunResponse = listOf(AdminReconRun);
export type AdminReconRunResponse = z.infer<typeof AdminReconRunResponse>;
// ===========================================================================
// 6. Configuration  —  admin/configuration
// ===========================================================================
/**
 * One versioned platform setting.
 *
 * `value` is `unknown` because the column is `jsonb` and its shape differs per
 * `configType`; the console renders an editor rather than pretending to know.
 * `lockedOnUse` and `reversible` are the two facts that decide whether an edit
 * is even offered — a setting a live booking already priced against cannot be
 * changed retroactively, only superseded by a new effective-dated row.
 */
export const AdminConfigEntry = z.object({
    id: Uuid,
    configType: z.string(),
    value: z.unknown(),
    version: z.number().int().positive(),
    effectiveFrom: z.string(),
    effectiveTo: z.string().nullable(),
    lockedOnUse: z.boolean(),
    reversible: z.boolean(),
    lastActorUserId: Uuid.nullable(),
});
export type AdminConfigEntry = z.infer<typeof AdminConfigEntry>;
/**
 * One feature flag. `districtId` is non-null exactly when `scope` is
 * `district`, which is what lets the registration pipeline's oversight gates be
 * blocking in one district and advisory in another with no schema change.
 */
export const AdminFeatureFlag = z.object({
    id: Uuid,
    key: z.string(),
    value: z.unknown(),
    scope: AdminFlagScope,
    districtId: z.number().int().positive().nullable(),
    districtName: z.string().nullable(),
    effectiveFrom: z.string(),
    version: z.number().int().positive(),
});
export type AdminFeatureFlag = z.infer<typeof AdminFeatureFlag>;
export const AdminConfiguration = z.object({
    entries: z.array(AdminConfigEntry),
    flags: z.array(AdminFeatureFlag),
});
export type AdminConfiguration = z.infer<typeof AdminConfiguration>;
/**
 * One row of the one-time registration fee catalog.
 *
 * Effective-dated and never destructive: changing a fee INSERTS a row, and the
 * charged amount is locked onto the invoice at charge time, so a price change
 * can never rewrite what somebody already paid. That is why `effectiveFrom` is
 * NOT NULL here while the two config tables above allow it to be absent.
 */
export const AdminRegistrationFee = z.object({
    id: Uuid,
    businessType: AdminRegistrationBusinessType,
    amountRwf: z.number(),
    currency: z.string(),
    effectiveFrom: z.string(),
    active: z.boolean(),
});
export type AdminRegistrationFee = z.infer<typeof AdminRegistrationFee>;
/**
 * One subscription plan. `roomCountLimit` is null for an unlimited plan, which
 * is a different statement from a limit of zero. `featureSet` is deliberately
 * absent: it is `jsonb` the billing code reads, not something a staff member
 * administers from a catalog list.
 */
export const AdminSubscriptionPlan = z.object({
    id: Uuid,
    code: z.string(),
    name: z.string(),
    tier: z.number().int().nullable(),
    priceRwf: z.number(),
    currency: z.string(),
    billingPeriod: AdminPlanBillingPeriod,
    roomCountLimit: z.number().int().nonnegative().nullable(),
    effectiveFrom: z.string().nullable(),
    active: z.boolean(),
});
export type AdminSubscriptionPlan = z.infer<typeof AdminSubscriptionPlan>;
/**
 * `GET /api/v1/admin/configuration/fees`.
 *
 * Placement fees appear as a SUMMARY rather than a list because they are a
 * broker fact, not a catalog fact — this screen prices the platform, and the
 * individual fees belong to the broker section. The counts and totals are here
 * so a finance staffer can see what the current placement rate is producing
 * without leaving the page they are editing rates on.
 */
export const AdminFeeSchedule = z.object({
    registrationFees: z.array(AdminRegistrationFee),
    subscriptionPlans: z.array(AdminSubscriptionPlan),
    placementFeeSummary: z.object({
        pendingCount: z.number().int().nonnegative(),
        pendingRwf: z.number(),
        paidCount: z.number().int().nonnegative(),
        paidRwf: z.number(),
        currency: z.string(),
    }),
});
export type AdminFeeSchedule = z.infer<typeof AdminFeeSchedule>;
// ===========================================================================
// 7. Compliance  —  admin/compliance
// ===========================================================================
/**
 * One compliance artifact. The `details` jsonb is deliberately absent: it holds
 * the document itself, and this screen answers "does the artifact exist and is
 * its review overdue", which `reviewDueAt` answers on its own.
 */
export const AdminComplianceArtifact = z.object({
    id: Uuid,
    artifactType: AdminComplianceArtifactType,
    processorName: z.string().nullable(),
    reviewDueAt: z.string().nullable(),
    createdAt: z.string(),
});
export type AdminComplianceArtifact = z.infer<typeof AdminComplianceArtifact>;
/**
 * One data subject request.
 *
 * `dualAuthorized` is on the row because a deletion is not completable by one
 * person, and a queue that hides whether the second signature has arrived is a
 * queue staff will work in the wrong order. `retentionExceptionApplied` records
 * that something was KEPT despite the request — a legal hold outranks a
 * deletion, and the fact that one did has to be visible rather than inferred
 * from the request still sitting open.
 */
export const AdminDsrRow = z.object({
    id: Uuid,
    subjectUserId: Uuid.nullable(),
    requestType: AdminDsrRequestType,
    state: AdminDsrState,
    retentionExceptionApplied: z.boolean(),
    dualAuthorized: z.boolean(),
    createdAt: z.string(),
});
export type AdminDsrRow = z.infer<typeof AdminDsrRow>;
export const AdminCompliance = z.object({
    artifacts: z.array(AdminComplianceArtifact),
    requests: z.array(AdminDsrRow),
    stats: z.object({
        openRequests: z.number().int().nonnegative(),
        overdueReviews: z.number().int().nonnegative(),
        artifactCount: z.number().int().nonnegative(),
    }),
});
export type AdminCompliance = z.infer<typeof AdminCompliance>;
// ===========================================================================
// 9. System health  —  admin/system-health
// ===========================================================================
/**
 * `GET /api/v1/admin/system-health`.
 *
 * `database.reachable` is answered by actually asking the database, not by
 * whether the process booted: a pool that has lost its connection still holds a
 * configuration that looks fine. `migrationsApplied` is nullable because it is
 * unanswerable when the database is unreachable, and a 0 there would read as
 * "no migration has ever run", which is a far worse thing to say.
 */
export const AdminSystemHealth = z.object({
    adapters: z.array(AdminAdapterHealth),
    queues: z.array(AdminQueueHealth),
    database: z.object({
        reachable: z.boolean(),
        migrationsApplied: z.number().int().nonnegative().nullable(),
        latencyMs: z.number().nonnegative().nullable(),
    }),
    process: z.object({
        nodeVersion: z.string(),
        uptimeSeconds: z.number().nonnegative(),
        environment: z.string(),
    }),
});
export type AdminSystemHealth = z.infer<typeof AdminSystemHealth>;
// ===========================================================================
// 10. Environments  —  admin/environments
// ===========================================================================
/**
 * `GET /api/v1/admin/environments`.
 *
 * The adapter modes are READ FROM THE SAME CONFIG THE MODULES READ. This screen
 * must never become a second source of truth for which adapter is live: a
 * console reporting "payments: live" while the payment module holds a mock
 * client is worse than a console that says nothing, because somebody will
 * believe it and take real money.
 *
 * These four names are CONFIG KEYS, not `adapter_name` values — `storage` and
 * `sms` have no `adapter_health_snapshots` counterpart, which is why the health
 * array beside them is keyed differently and is not a parallel record.
 */
export const AdminEnvironments = z.object({
    current: z.object({
        name: z.string(),
        nodeEnv: z.string(),
        adapterModes: z.object({
            payments: AdapterMode,
            storage: AdapterMode,
            sms: AdapterMode,
            ebm: AdapterMode,
        }),
    }),
    adapters: z.array(AdminAdapterHealth),
});
export type AdminEnvironments = z.infer<typeof AdminEnvironments>;
// ===========================================================================
// 11. Moderation  —  admin/moderation
// ===========================================================================
/**
 * One review a moderator may act on.
 *
 * `state` is a plain string because `reviews.moderation_state` is a `text`
 * column defaulting to `visible`, not a `pgEnum` — the same reasoning as
 * `AdminOrgMember.status`. `rating` carries `overall_rating` and is nullable
 * because a host-to-guest review has no star rating at all.
 */
export const AdminModeratedReview = z.object({
    id: Uuid,
    propertyName: z.string().nullable(),
    authorName: z.string().nullable(),
    rating: z.number().int().nullable(),
    body: z.string().nullable(),
    state: z.string(),
    createdAt: z.string(),
});
export type AdminModeratedReview = z.infer<typeof AdminModeratedReview>;
/**
 * One support ticket. `firstResponseAt` and `resolvedAt` are the two timestamps
 * every response-time metric is computed from, sent raw so the console never
 * has to agree with the server about how a duration is measured. `csat` is null
 * until the requester scores it, which is not the same as scoring it zero.
 */
export const AdminSupportTicket = z.object({
    id: Uuid,
    requesterUserId: Uuid.nullable(),
    category: z.string().nullable(),
    state: AdminSupportTicketState,
    domain: Domain.nullable(),
    districtId: z.number().int().positive().nullable(),
    firstResponseAt: z.string().nullable(),
    resolvedAt: z.string().nullable(),
    csat: z.number().int().nullable(),
    createdAt: z.string(),
});
export type AdminSupportTicket = z.infer<typeof AdminSupportTicket>;
/**
 * `GET /api/v1/admin/moderation/tickets/:ticketId?reason=` — one ticket with
 * what the person WROTE and how to answer them. Kept off `AdminSupportTicket`
 * on purpose: the list is a backlog anybody on the desk can scan, while the
 * message and the contact details are somebody's words and address, so they
 * cross only on this read, which states a reason and writes a
 * `record_access_logs` row naming the ticket before it answers.
 */
export const AdminSupportTicketDetail = AdminSupportTicket.extend({
    message: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactName: z.string().nullable(),
    contactPhone: z.string().nullable(),
});
export type AdminSupportTicketDetail = z.infer<typeof AdminSupportTicketDetail>;
/**
 * One escalation. The subject is a (type, id) pair rather than a set of
 * nullable foreign keys, because an escalation can point at any of eight
 * different things and eight mostly-null columns would be the worse row.
 */
export const AdminEscalation = z.object({
    id: Uuid,
    subjectType: AdminEscalationSubjectType.nullable(),
    subjectId: Uuid.nullable(),
    type: AdminEscalationType,
    state: AdminEscalationState,
    ownerUserId: Uuid.nullable(),
    resolutionNote: z.string().nullable(),
    districtId: z.number().int().positive().nullable(),
    createdAt: z.string(),
});
export type AdminEscalation = z.infer<typeof AdminEscalation>;
export const AdminModeration = z.object({
    reviews: z.array(AdminModeratedReview),
    tickets: z.array(AdminSupportTicket),
    escalations: z.array(AdminEscalation),
});
export type AdminModeration = z.infer<typeof AdminModeration>;
// ===========================================================================
// 12. Announcements  —  admin/announcements
// ===========================================================================
/**
 * One announcement.
 *
 * `audience` is `unknown` because the column is `jsonb` holding a targeting
 * expression whose vocabulary is not settled; the console shows it and does not
 * interpret it. Both bodies are nullable and BOTH are carried: an announcement
 * with only the English written is a real draft state, and collapsing the pair
 * into one `body` would hide which half is missing.
 */
export const AdminAnnouncement = z.object({
    id: Uuid,
    audience: z.unknown(),
    bodyEn: z.string().nullable(),
    bodyRw: z.string().nullable(),
    publishAt: z.string().nullable(),
    state: AdminAnnouncementState,
    createdAt: z.string(),
});
export type AdminAnnouncement = z.infer<typeof AdminAnnouncement>;
export const AdminAnnouncementResponse = listOf(AdminAnnouncement);
export type AdminAnnouncementResponse = z.infer<
    typeof AdminAnnouncementResponse
>;
// ===========================================================================
// 13. Analytics  —  admin/analytics
// ===========================================================================
/**
 * One named series, aggregated from `analytics_events`.
 *
 * The points are `{ at, value }` pairs rather than two parallel arrays, so a
 * value can never drift out of alignment with its timestamp. Bucket width is a
 * server decision carried implicitly by the spacing: the console plots what it
 * is given and never re-buckets, because two different bucketings of the same
 * events are two different answers to the same question.
 */
export const AdminAnalyticsSeries = z.object({
    key: z.string(),
    label: z.string(),
    points: z.array(
        z.object({
            at: z.string(),
            value: z.number(),
        }),
    ),
});
export type AdminAnalyticsSeries = z.infer<typeof AdminAnalyticsSeries>;
/**
 * A saved dashboard scope — one staff member's stored filter.
 *
 * `metricSet` and `dateRange` are `unknown` for the same reason as
 * `AdminConfigEntry.value`: they are `jsonb` the console wrote and the console
 * reads back, and giving them a shape here would freeze a format the server
 * never inspects.
 */
export const AdminSavedScope = z.object({
    id: Uuid,
    ownerUserId: Uuid.nullable(),
    metricSet: z.unknown(),
    districtId: z.number().int().positive().nullable(),
    districtName: z.string().nullable(),
    dateRange: z.unknown(),
    createdAt: z.string(),
});
export type AdminSavedScope = z.infer<typeof AdminSavedScope>;
export const AdminAnalytics = z.object({
    totals: z.array(AdminKpi),
    series: z.array(AdminAnalyticsSeries),
    savedScopes: z.array(AdminSavedScope),
});
export type AdminAnalytics = z.infer<typeof AdminAnalytics>;
// ===========================================================================
// 14. Localization  —  admin/localization
// ===========================================================================
/**
 * One translation string. Both languages ride on one row because the question
 * is always comparative — what is missing in Kinyarwanda that exists in English
 * — and two separate rows cannot answer it without a join the console would
 * have to perform on itself.
 */
export const AdminTranslationEntry = z.object({
    id: Uuid,
    key: z.string(),
    valueEn: z.string().nullable(),
    valueRw: z.string().nullable(),
    status: AdminTranslationStatus,
    version: z.number().int().positive(),
});
export type AdminTranslationEntry = z.infer<typeof AdminTranslationEntry>;
/**
 * One email template. `isTransactional` is carried because it decides whether a
 * recipient may opt out: a booking confirmation is not marketing, and a console
 * that cannot see the difference will let somebody unsubscribe from their own
 * receipts. The bodies are not sent in a list; the subjects identify a row.
 */
export const AdminEmailTemplate = z.object({
    id: Uuid,
    templateKey: z.string(),
    subjectEn: z.string().nullable(),
    subjectRw: z.string().nullable(),
    version: z.number().int().positive(),
    isTransactional: z.boolean(),
});
export type AdminEmailTemplate = z.infer<typeof AdminEmailTemplate>;
/**
 * `GET /api/v1/admin/localization`.
 *
 * `coverage.stale` counts `translation_status = 'needs_review'` — the string
 * has a Kinyarwanda value but the English one moved under it. It is counted
 * apart from `missing` because the two need different work: one needs a
 * translator, the other needs a reviewer.
 */
export const AdminLocalization = z.object({
    entries: z.array(AdminTranslationEntry),
    templates: z.array(AdminEmailTemplate),
    coverage: z.object({
        total: z.number().int().nonnegative(),
        translated: z.number().int().nonnegative(),
        missing: z.number().int().nonnegative(),
        stale: z.number().int().nonnegative(),
    }),
});
export type AdminLocalization = z.infer<typeof AdminLocalization>;
/**
 * The `reason` a staff member must give before reading someone else's record.
 *
 * A property of the ROUTE rather than of a section's filters: the same param
 * rides on `GET /admin/users`, `GET /admin/orgs/obo` and
 * `GET /admin/orgs/:orgId/people`, which live in two different API areas and
 * are called by one console.
 *
 * IT LIVES HERE BECAUSE IT WAS BUILT TWICE AND THE TWO DISAGREED. One area
 * declared a local schema flooring it at four characters; the other checked
 * only that the trimmed string was non-empty. So `reason=x` was accepted on the
 * user directory and refused on the OBO register, from the same browser, for
 * the same person. A rule that varies by which door you came through is not a
 * rule.
 *
 * Four characters is the floor because `record_access_logs` exists so that a
 * read of another person's data can be explained afterwards, and a
 * one-character explanation cannot explain anything. Five hundred is the
 * ceiling because the column is text and a reason is a sentence, not a file.
 */
export const AdminReasonQuery = z.object({
    reason: z.string().trim().min(4).max(500),
});
export type AdminReasonQuery = z.infer<typeof AdminReasonQuery>;
/** A PII list route: a stated reason plus the usual paging. */
export const AdminPagedReasonQuery = AdminReasonQuery.extend({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type AdminPagedReasonQuery = z.infer<typeof AdminPagedReasonQuery>;
// ---------------------------------------------------------------------------
// Writes — the six single-signer admin actions
// ---------------------------------------------------------------------------
/**
 * The body of every admin write: why this staffer is doing it.
 *
 * The rule is the READ rule, taken from `AdminReasonQuery` rather than
 * written out again. A suspension, a revoked session or a rotated claim code
 * is the act the audit trail exists to explain afterwards, and a floor that
 * differed between the read door and the write door would be the same bug
 * `AdminReasonQuery` was promoted here to end — `reason=x` accepted at one and
 * refused at the other.
 *
 * Only single-signer actions take this body. Role grants and money overrides
 * need a second `super_admin` (ADR-012, `TWO_PERSON_STAFF_PERMISSIONS`), so
 * they are not a reason plus a POST and must never be shaped like one.
 */
export const AdminActionRequest = z.object({
    reason: AdminReasonQuery.shape.reason,
});
export type AdminActionRequest = z.infer<typeof AdminActionRequest>;
/**
 * Append a registration fee (ADR-053, AC-R9).
 *
 * APPEND, never edit: a new row with its own `effectiveFrom`. `currentFee` reads
 * the newest row whose moment has passed, and a registration already created
 * keeps the amount locked on its invoice, so a price change never moves money
 * that was already quoted.
 *
 * `effectiveFrom` is a moment, because the column is `timestamptz`. A moment in
 * the PAST is refused (422, by the route, against the server clock): a
 * retroactive price would make an invoice already issued disagree with the
 * catalogue that produced it. Omitting it means "from now".
 *
 * Built on `AdminActionRequest`, so the `reason` follows the one rule every admin
 * write shares, and it is what the `audit_events` row records (AC-G10).
 */
export const AppendRegistrationFeeRequest = AdminActionRequest.extend({
    businessType: AdminRegistrationBusinessType,
    amountRwf: z
        .number()
        .int("A fee is whole francs.")
        .nonnegative("A fee cannot be negative.")
        .max(100_000_000, "That fee is outside what we can record."),
    effectiveFrom: z.string().datetime({ offset: true }).optional(),
});
export type AppendRegistrationFeeRequest = z.infer<typeof AppendRegistrationFeeRequest>;
/**
 * A government body in the catalogue (D24, ADR-053 AC-G4).
 *
 * A catalogue rather than an enum, because the legally defined set is open:
 * adding RDB or RURA is a row, not a deployment. `code` is the primary key and is
 * never edited, since every grant and every recorded decision points at it.
 * Nothing is deleted: a soft retired body (`active: false`) is no longer offered
 * for a new grant, and every existing grant and decision keeps naming it.
 */
export const GovernmentBody = z.object({
    code: z.string(),
    nameEn: z.string(),
    nameRw: z.string(),
    abbreviation: z.string().nullable(),
    active: z.boolean(),
});
export type GovernmentBody = z.infer<typeof GovernmentBody>;
/** `POST /api/v1/admin/government-bodies`. The code is fixed for good once written. */
export const CreateGovernmentBodyRequest = AdminActionRequest.extend({
    code: z
        .string()
        .trim()
        .regex(/^[A-Z][A-Z0-9_]{1,15}$/, "A body code is 2 to 16 capital letters, digits or underscores, starting with a letter."),
    nameEn: z.string().trim().min(2).max(200),
    nameRw: z.string().trim().min(2).max(200),
    abbreviation: z.string().trim().min(1).max(20).optional(),
});
export type CreateGovernmentBodyRequest = z.infer<typeof CreateGovernmentBodyRequest>;
/**
 * `PATCH /api/v1/admin/government-bodies/:code`: rename, or retire and restore.
 * The code is not here, because it is not editable.
 */
export const UpdateGovernmentBodyRequest = AdminActionRequest.extend({
    nameEn: z.string().trim().min(2).max(200).optional(),
    nameRw: z.string().trim().min(2).max(200).optional(),
    abbreviation: z.string().trim().min(1).max(20).nullable().optional(),
    active: z.boolean().optional(),
}).refine(
    (v) => v.nameEn !== undefined || v.nameRw !== undefined || v.abbreviation !== undefined || v.active !== undefined,
    { message: "Change at least one of the names, the abbreviation or whether the body is active." },
);
export type UpdateGovernmentBodyRequest = z.infer<typeof UpdateGovernmentBodyRequest>;
/**
 * `tin_verification_result`. `pending` is RRA being unreachable, never a
 * rejection — the org holds at `submitted` and can be retried.
 */
export const AdminTinCheckResult = z.enum(["pending", "verified", "failed"]);
export type AdminTinCheckResult = z.infer<typeof AdminTinCheckResult>;
/**
 * A walk-in's claim code as printed on the check-in slip: four letters, a
 * dash, four digits. `apps/web`'s claim form tests the same shape.
 */
export const AdminClaimCode = z.string().regex(/^[A-Z]{4}-\d{4}$/);
export type AdminClaimCode = z.infer<typeof AdminClaimCode>;
/**
 * Every write answers with the id of the `audit_events` row it wrote.
 *
 * Not decoration. The row and the change commit together, so the id is the
 * receipt that the change is on the record — a console that can show it has
 * proof the action was attributed, rather than a success message it wrote
 * itself.
 */
const AuditReceipt = { auditEventId: Uuid };
/**
 * `POST /api/v1/admin/orgs/:orgId/suspend` and `.../reinstate`.
 *
 * `from` is carried beside the new status so the console can word what
 * actually moved, rather than assuming the business was where the page it
 * rendered last said it was.
 */
export const AdminOrgStatusChange = z.object({
    orgId: Uuid,
    from: OrgRegistrationStatus,
    registrationStatus: OrgRegistrationStatus,
    ...AuditReceipt,
});
export type AdminOrgStatusChange = z.infer<typeof AdminOrgStatusChange>;
/**
 * `POST /api/v1/admin/orgs/:orgId/tin-recheck`.
 *
 * `adapterMode` rides on the answer for the reason it rides on every
 * `tin_verifications` row: a verdict from the mock must never be read as one
 * from RRA. `registrationStatus` is where the org stands AFTER the check —
 * `tin_verified` on a pass, `rejected` on a fail, still `submitted` when RRA
 * did not answer.
 */
export const AdminTinRecheckResult = z.object({
    orgId: Uuid,
    result: AdminTinCheckResult,
    adapterMode: AdapterMode,
    registrationStatus: OrgRegistrationStatus,
    ...AuditReceipt,
});
export type AdminTinRecheckResult = z.infer<typeof AdminTinRecheckResult>;
/** `POST /api/v1/admin/brokers/:brokerId/suspend`. */
export const AdminBrokerStatusChange = z.object({
    brokerId: Uuid,
    from: AdminBrokerStatus,
    status: AdminBrokerStatus,
    ...AuditReceipt,
});
export type AdminBrokerStatusChange = z.infer<typeof AdminBrokerStatusChange>;
/**
 * `POST /api/v1/admin/users/:userId/revoke-sessions`.
 *
 * `revokedCount` may be zero, and that is a success rather than a refusal: a
 * staffer ending every session of a compromised account has done their job
 * whether the attacker was signed in at that moment or not, and the audit row
 * records that they checked.
 */
export const AdminSessionsRevoked = z.object({
    userId: Uuid,
    revokedCount: z.number().int().nonnegative(),
    ...AuditReceipt,
});
export type AdminSessionsRevoked = z.infer<typeof AdminSessionsRevoked>;
/**
 * `POST /api/v1/admin/users/stays/:stayId/reissue-claim`.
 *
 * The new code is returned because the point of reissuing it is that a
 * staffer reads it to the guest. It is NOT written to the audit row: a claim
 * code is a bearer credential for somebody's stay, and a trail that stored it
 * would let everyone who may read the audit log claim the stay.
 */
export const AdminClaimCodeReissued = z.object({
    stayId: Uuid,
    claimCode: AdminClaimCode,
    ...AuditReceipt,
});
export type AdminClaimCodeReissued = z.infer<typeof AdminClaimCodeReissued>;
