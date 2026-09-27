"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminOrgSubscription = exports.AdminInvoice = exports.AdminOrgPropertiesResponse = exports.AdminOrgProperty = exports.AdminOrgPeopleResponse = exports.AdminOrgMember = exports.AdminOrgDetail = exports.AdminOboListResponse = exports.AdminOboRow = exports.AdminOrgReviewQueueResponse = exports.AdminOrgReviewItem = exports.ReviewCoverage = exports.AdminOrgListResponse = exports.AdminOrgListQuery = exports.AdminOrgRow = exports.AdminOverview = exports.AdminQueueHealth = exports.AdminAdapterHealth = exports.AdminWorkQueueItem = exports.AdminDistrictDensity = exports.AdminRevenueLine = exports.AdminKpi = exports.AdminListMeta = exports.AdminKycState = exports.AdminTranslationStatus = exports.AdminAnnouncementState = exports.AdminEscalationState = exports.AdminEscalationType = exports.AdminEscalationSubjectType = exports.AdminSupportTicketState = exports.AdminDsrState = exports.AdminDsrRequestType = exports.AdminComplianceArtifactType = exports.AdminFlagScope = exports.AdminLedgerTxnKind = exports.AdminPlanBillingPeriod = exports.AdminPayoutStatus = exports.AdminInvoiceKind = exports.AdminInvoiceStatus = exports.AdminSubscriptionStatus = exports.AdminRegistrationBusinessType = exports.AdminRegistrationRejectionReason = exports.AdminRegistrationReviewDecision = exports.AdminOboClaimStatus = exports.AdminPlacementStatus = exports.AdminBrokerStatus = exports.AdminRecordDataClass = exports.AdminAuditSubjectType = exports.AdminAdapterStatus = exports.AdminAdapterName = void 0;
exports.AdminSavedScope = exports.AdminAnalyticsSeries = exports.AdminAnnouncementResponse = exports.AdminAnnouncement = exports.AdminModeration = exports.AdminEscalation = exports.AdminSupportTicketDetail = exports.AdminSupportTicket = exports.AdminModeratedReview = exports.AdminEnvironments = exports.AdminSystemHealth = exports.AdminCompliance = exports.AdminDsrRow = exports.AdminComplianceArtifact = exports.AdminFeeSchedule = exports.AdminSubscriptionPlan = exports.AdminRegistrationFee = exports.AdminConfiguration = exports.AdminFeatureFlag = exports.AdminConfigEntry = exports.AdminReconRunResponse = exports.AdminReconRun = exports.AdminFailedChargeResponse = exports.AdminFailedCharge = exports.AdminPayoutResponse = exports.AdminPayoutQuery = exports.AdminLedgerResponse = exports.AdminRevealListResponse = exports.AdminRevealEvent = exports.AdminBrokerListResponse = exports.AdminBrokerRow = exports.AdminUnclaimedStaysResponse = exports.AdminUnclaimedStay = exports.AdminUserListResponse = exports.AdminUserListQuery = exports.AdminUserRow = exports.CreateOversightGrantRequest = exports.AdminOversightGrant = exports.AdminUserMembership = exports.AdminOboAuditResponse = exports.AdminAccessLogResponse = exports.AdminAccessLogRow = exports.AdminAuditResponse = exports.AdminAuditQuery = exports.AdminAuditRow = exports.AdminOrgTimelineResponse = exports.AdminTimelineEvent = exports.AdminOrgMoney = exports.AdminLedgerRow = exports.AdminPayout = void 0;
exports.AdminClaimCodeReissued = exports.AdminSessionsRevoked = exports.AdminBrokerStatusChange = exports.AdminTinRecheckResult = exports.AdminOrgStatusChange = exports.AdminClaimCode = exports.AdminTinCheckResult = exports.UpdateGovernmentBodyRequest = exports.CreateGovernmentBodyRequest = exports.GovernmentBody = exports.AppendRegistrationFeeRequest = exports.AdminActionRequest = exports.AdminPagedReasonQuery = exports.AdminReasonQuery = exports.AdminLocalization = exports.AdminEmailTemplate = exports.AdminTranslationEntry = exports.AdminAnalytics = void 0;
const zod_1 = require("zod");
const psf_1 = require("./psf");
const primitives_1 = require("./primitives");
const rdb_1 = require("./rdb");
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
exports.AdminAdapterName = zod_1.z.enum([
    "payment",
    "ebm_vsdc",
    "rra_tin",
    "filing",
    "mailer",
    "maps",
]);
/** `adapter_status`. `degraded` is a real third state, not a shade of `down`. */
exports.AdminAdapterStatus = zod_1.z.enum(["up", "degraded", "down"]);
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
exports.AdminAuditSubjectType = zod_1.z.enum([
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
/**
 * `record_data_class`. What class of another person's data a staff member read.
 * This is the vocabulary of the PII trail, so it must not be widened casually.
 */
exports.AdminRecordDataClass = zod_1.z.enum([
    "national_id",
    "id_photo",
    "contract",
    "stay_identity",
    "contact",
]);
/** `broker_status`. */
exports.AdminBrokerStatus = zod_1.z.enum(["active", "suspended"]);
/**
 * `placement_status` (`tenant_placements.status`) — how a broker's introduction
 * ended. `unavailable` is distinct from `abandoned`: the listing went away, the
 * broker did not give up.
 */
exports.AdminPlacementStatus = zod_1.z.enum([
    "initiated",
    "converted",
    "abandoned",
    "unavailable",
]);
/** `obo_claim_status`. An on-behalf-of registration before and after the claim. */
exports.AdminOboClaimStatus = zod_1.z.enum([
    "registrant_held",
    "owner_claimed",
    "expired",
]);
/** `registration_review_decision`. One human gate, one outcome. */
exports.AdminRegistrationReviewDecision = zod_1.z.enum(["passed", "rejected"]);
/**
 * `registration_rejection_reason`. Coded rather than prose because F-S03 §6
 * promises a resumable rejection — the registrant is sent back to the step that
 * was wrong, and a paragraph typed by an officer cannot drive a form.
 */
exports.AdminRegistrationRejectionReason = zod_1.z.enum([
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
/** `registration_business_type`. The three paths the fee catalog prices. */
exports.AdminRegistrationBusinessType = zod_1.z.enum([
    "hospitality",
    "residence",
    "broker",
]);
/** `subscription_status`. */
exports.AdminSubscriptionStatus = zod_1.z.enum([
    "trialing",
    "active",
    "past_due",
    "canceled",
    "suspended",
]);
/** `subscription_invoice_status`. */
exports.AdminInvoiceStatus = zod_1.z.enum(["pending", "paid", "failed"]);
/**
 * `invoice_kind`. Despite the table being named `subscription_invoices` it is
 * the org's whole invoice ledger, so a row has to say which of the two it is.
 */
exports.AdminInvoiceKind = zod_1.z.enum(["registration_fee", "subscription"]);
/** `payout_status`. */
exports.AdminPayoutStatus = zod_1.z.enum(["scheduled", "queued", "paid", "held"]);
/** `plan_billing_period`. One value today; an enum so a second is a migration. */
exports.AdminPlanBillingPeriod = zod_1.z.enum(["monthly"]);
/** `ledger_txn_kind`. What moved the money, not which account it landed in. */
exports.AdminLedgerTxnKind = zod_1.z.enum([
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
/** `flag_scope`. A flag is global or it names one district. */
exports.AdminFlagScope = zod_1.z.enum(["global", "district"]);
/** `compliance_artifact_type`. The four documents the NCSA posture is made of. */
exports.AdminComplianceArtifactType = zod_1.z.enum([
    "ncsa_registration",
    "dpo_of_record",
    "dpia",
    "processor_inventory_entry",
]);
/** `dsr_request_type`. */
exports.AdminDsrRequestType = zod_1.z.enum(["access", "correction", "deletion"]);
/** `dsr_state`. */
exports.AdminDsrState = zod_1.z.enum(["received", "fulfilled"]);
/** `support_ticket_state`. `reopened` is kept distinct from `open` on purpose. */
exports.AdminSupportTicketState = zod_1.z.enum([
    "open",
    "resolved",
    "reopened",
    "closed",
]);
/** `escalation_subject_type`. */
exports.AdminEscalationSubjectType = zod_1.z.enum([
    "user",
    "org",
    "lease",
    "booking",
    "listing",
    "review",
    "message",
    "payment",
]);
/** `escalation_type`. */
exports.AdminEscalationType = zod_1.z.enum([
    "dispute",
    "policy_violation",
    "off_platform_leakage",
    "listing_non_compliance",
    "review_abuse",
]);
/** `escalation_state`. */
exports.AdminEscalationState = zod_1.z.enum(["open", "resolved"]);
/** `announcement_state`. */
exports.AdminAnnouncementState = zod_1.z.enum(["draft", "published"]);
/** `translation_status`. `needs_review` is the "stale" bucket coverage counts. */
exports.AdminTranslationStatus = zod_1.z.enum([
    "translated",
    "missing",
    "needs_review",
]);
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
exports.AdminKycState = zod_1.z.enum(["none", "pending", "verified"]);
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
exports.AdminListMeta = zod_1.z.object({
    total: zod_1.z.number().int().nonnegative(),
    page: zod_1.z.number().int().positive(),
    pageSize: zod_1.z.number().int().positive().max(100),
});
/**
 * The one list-response factory. Every `{ items, meta }` schema below is built
 * from it, so no route can invent a second spelling of a paged answer and none
 * can forget to accept an empty page.
 */
const listOf = (item) => zod_1.z.object({ items: zod_1.z.array(item), meta: exports.AdminListMeta });
/**
 * Paging query params, spread into every list query schema.
 *
 * Coerced because they arrive as strings on a query string; capped at 100
 * because an uncapped `pageSize` is a denial of service handed to anyone with a
 * staff session. Optional, with the route applying 1 and 25.
 */
const pageQuery = {
    page: zod_1.z.coerce.number().int().positive().optional(),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).optional(),
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
exports.AdminKpi = zod_1.z.object({
    key: zod_1.z.string(),
    label: zod_1.z.string(),
    value: zod_1.z.number().nullable(),
    unit: zod_1.z.enum(["count", "rwf", "percent"]),
    previousValue: zod_1.z.number().nullable(),
});
/** One revenue line in the period, with the same period-over-period pairing. */
exports.AdminRevenueLine = zod_1.z.object({
    line: zod_1.z.string(),
    amountRwf: zod_1.z.number(),
    currency: zod_1.z.string(),
    previousAmountRwf: zod_1.z.number().nullable(),
});
/**
 * Businesses per district. `districtId` is an integer smart code, not a uuid —
 * geography is the one part of the schema that does not use uuids.
 */
exports.AdminDistrictDensity = zod_1.z.object({
    districtId: zod_1.z.number().int().positive(),
    districtName: zod_1.z.string(),
    orgCount: zod_1.z.number().int().nonnegative(),
    previousOrgCount: zod_1.z.number().int().nonnegative().nullable(),
});
/**
 * One "there are N things waiting for you" row.
 *
 * `href` is the single navigation field in this file and it is deliberate: the
 * server knows which route answers a queue, and a browser-side map from `key`
 * to route is a second copy of the routing table that goes stale the first time
 * a section moves.
 */
exports.AdminWorkQueueItem = zod_1.z.object({
    key: zod_1.z.string(),
    count: zod_1.z.number().int().nonnegative(),
    title: zod_1.z.string(),
    detail: zod_1.z.string(),
    href: zod_1.z.string(),
});
/**
 * The newest `adapter_health_snapshots` row per adapter.
 *
 * `errorRate` and `latencyMs` are nullable because their columns are: a
 * snapshot can record that an adapter is up without having measured either, and
 * a 0 would assert a perfect adapter that was never timed.
 */
exports.AdminAdapterHealth = zod_1.z.object({
    adapter: exports.AdminAdapterName,
    mode: primitives_1.AdapterMode,
    status: exports.AdminAdapterStatus,
    errorRate: zod_1.z.number().nullable(),
    latencyMs: zod_1.z.number().int().nonnegative().nullable(),
    observedAt: zod_1.z.string(),
});
/**
 * The newest `queue_health_snapshots` row per queue.
 *
 * `queue` is a free string rather than an enum because BullMQ queue names are
 * declared in code, not in a `pgEnum`; promoting them here would mean a
 * migration every time a processor is added. The four counters are not
 * nullable: the columns are, but a snapshot that measured nothing is not a
 * snapshot, and the writer fills all four or writes no row.
 */
exports.AdminQueueHealth = zod_1.z.object({
    queue: zod_1.z.string(),
    depth: zod_1.z.number().int().nonnegative(),
    failed: zod_1.z.number().int().nonnegative(),
    deadLetter: zod_1.z.number().int().nonnegative(),
    throughput: zod_1.z.number(),
    observedAt: zod_1.z.string(),
});
/** `GET /api/v1/admin/overview` — the whole landing screen in one round trip. */
exports.AdminOverview = zod_1.z.object({
    kpis: zod_1.z.array(exports.AdminKpi),
    revenue: zod_1.z.array(exports.AdminRevenueLine),
    density: zod_1.z.array(exports.AdminDistrictDensity),
    workQueue: zod_1.z.array(exports.AdminWorkQueueItem),
    adapters: zod_1.z.array(exports.AdminAdapterHealth),
    queues: zod_1.z.array(exports.AdminQueueHealth),
});
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
exports.AdminOrgRow = zod_1.z.object({
    id: primitives_1.Uuid,
    legalName: zod_1.z.string(),
    domain: primitives_1.Domain,
    rdbEntityGroup: rdb_1.RdbEntityGroup.nullable(),
    accommodationClass: rdb_1.StoredAccommodationClass.nullable(),
    residenceClass: rdb_1.ResidenceClass.nullable(),
    tourismLicenseNumber: zod_1.z.string().nullable(),
    chamberOfTourismMember: zod_1.z.boolean(),
    psfMember: zod_1.z.boolean(),
    eacStarGrade: rdb_1.EacStarGrade.nullable(),
    tin: zod_1.z.string().nullable(),
    upi: zod_1.z.string().nullable(),
    registrationStatus: primitives_1.OrgRegistrationStatus,
    districtId: zod_1.z.number().int().positive().nullable(),
    districtName: zod_1.z.string().nullable(),
    isObo: zod_1.z.boolean(),
    subscriptionStatus: exports.AdminSubscriptionStatus.nullable(),
    subscriptionPlanName: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
/** Query params for `GET /api/v1/admin/orgs`. */
exports.AdminOrgListQuery = zod_1.z.object({
    /** Free text over legal name, TIN and UPI. */
    q: zod_1.z.string().optional(),
    districtId: zod_1.z.coerce.number().int().positive().optional(),
    domain: primitives_1.Domain.optional(),
    registrationStatus: primitives_1.OrgRegistrationStatus.optional(),
    ...pageQuery,
});
exports.AdminOrgListResponse = listOf(exports.AdminOrgRow);
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
exports.ReviewCoverage = zod_1.z.enum(["covered", "uncovered", "not_applicable"]);
/**
 * One business waiting at a registration gate.
 *
 * `lastDecision` is the newest `org_registration_reviews` row, nullable because
 * a business nobody has reviewed yet is the normal case in this queue. The body
 * and title on that table are COPIES taken at decision time and never re-read
 * from the assignment, so a revoked posting cannot rewrite who decided what;
 * this contract inherits that by carrying the decision rather than the grant.
 */
exports.AdminOrgReviewItem = zod_1.z.object({
    orgId: primitives_1.Uuid,
    legalName: zod_1.z.string(),
    districtName: zod_1.z.string().nullable(),
    domain: primitives_1.Domain,
    registrationStatus: primitives_1.OrgRegistrationStatus,
    submittedAt: zod_1.z.string().nullable(),
    lastDecision: zod_1.z
        .object({
        decision: exports.AdminRegistrationReviewDecision,
        reasonCode: exports.AdminRegistrationRejectionReason.nullable(),
        decidedAt: zod_1.z.string(),
        oversightRole: primitives_1.OversightRole.nullable(),
    })
        .nullable(),
    /** True once a `tin_verifications` row for this org came back `verified`. */
    tinVerified: zod_1.z.boolean(),
    /**
     * When the business entered the stage it is in NOW (ADR-053, AC-R7).
     *
     * The newest `org_registration_events` row whose `to_status` is the current
     * status. Null for a business that reached its status before the event log
     * existed, which is a real answer ("we did not record it") rather than a
     * guess; the console shows no wait rather than an invented one.
     */
    stageEnteredAt: zod_1.z.string().nullable(),
    /**
     * Held at `submitted` on an RRA check that never answered, with every
     * automatic retry used (ADR-053, AC-R5).
     *
     * Computed when the queue is read, not stored. A stored flag would have to be
     * cleared by a later success, a resubmit and an admin recheck, and one missed
     * clear would leave a healthy business flagged forever.
     */
    stalled: zod_1.z.boolean(),
    /**
     * Whether an officer can take this business's CURRENT stage (ADR-053, AC-G9).
     * See `ReviewCoverage`.
     */
    coverage: exports.ReviewCoverage,
});
exports.AdminOrgReviewQueueResponse = listOf(exports.AdminOrgReviewItem);
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
exports.AdminOboRow = zod_1.z.object({
    id: primitives_1.Uuid,
    orgId: primitives_1.Uuid,
    orgName: zod_1.z.string(),
    districtName: zod_1.z.string().nullable(),
    registrantUserId: primitives_1.Uuid,
    registrantName: zod_1.z.string().nullable(),
    intendedOwnerName: zod_1.z.string(),
    intendedOwnerEmail: zod_1.z.string().nullable(),
    claimStatus: exports.AdminOboClaimStatus,
    payoutLocked: zod_1.z.boolean(),
    claimedAt: zod_1.z.string().nullable(),
});
exports.AdminOboListResponse = listOf(exports.AdminOboRow);
/**
 * One business in full. The list row plus what only a detail read pays for: the
 * address, the geography below district, and three counts that would each cost
 * a join nobody wants on a 25-row page.
 */
exports.AdminOrgDetail = exports.AdminOrgRow.extend({
    /**
     * When the business entered its current stage, for EVERY stage (ADR-053,
     * AC-R7), `pending_payment` and `suspended` included, neither of which the
     * review queue lists. Null before the event log existed.
     */
    stageEnteredAt: zod_1.z.string().nullable(),
    addressText: zod_1.z.string().nullable(),
    sectorId: zod_1.z.number().int().positive().nullable(),
    villageId: zod_1.z.number().int().positive().nullable(),
    memberCount: zod_1.z.number().int().nonnegative(),
    propertyCount: zod_1.z.number().int().nonnegative(),
    certificateCount: zod_1.z.number().int().nonnegative(),
    /**
     * PSF membership (ADR-056 AC-20). Null for a residence, which cannot hold
     * one. Defaults to null so an older API still parses.
     */
    psf: psf_1.AdminOrgPsf.nullable().default(null),
});
/**
 * One person inside a business.
 *
 * `status` is the enum the database now enforces. It used to be `z.string()`,
 * correctly, while `org_memberships.status` was free `text`; ADR-053 made the
 * column `org_membership_status` (AC-R10), so the contract promises exactly what
 * Postgres refuses to store otherwise, no more and no less.
 */
exports.AdminOrgMember = zod_1.z.object({
    userId: primitives_1.Uuid,
    name: zod_1.z.string().nullable(),
    email: zod_1.z.string(),
    orgRole: primitives_1.OrgRole,
    status: zod_1.z.enum(["active", "removed"]),
    joinedAt: zod_1.z.string(),
    removedAt: zod_1.z.string().nullable(),
});
exports.AdminOrgPeopleResponse = listOf(exports.AdminOrgMember);
/**
 * One property of a business.
 *
 * `domain` comes from the owning org, not the property: `properties` has no
 * domain column, and the org's branch is what decides whether a property is a
 * hotel or a rental building. `published` is derived from the property's single
 * `listings` row reaching `published`, which is what makes it visible to the
 * public marketplace.
 */
exports.AdminOrgProperty = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    domain: primitives_1.Domain,
    districtName: zod_1.z.string().nullable(),
    roomTypeCount: zod_1.z.number().int().nonnegative(),
    roomCount: zod_1.z.number().int().nonnegative(),
    listingCount: zod_1.z.number().int().nonnegative(),
    published: zod_1.z.boolean(),
    /** ADR-054 AC-R4: which branch is the head office. */
    isHeadOffice: zod_1.z.boolean(),
    rraBranchId: zod_1.z.string().nullable(),
    archivedAt: zod_1.z.string().nullable(),
});
exports.AdminOrgPropertiesResponse = listOf(exports.AdminOrgProperty);
/**
 * One row of `subscription_invoices` — which, despite the table's name, is the
 * org's whole invoice ledger. `invoiceKind` is the discriminator, and the
 * table's own CHECK guarantees the shape that follows from it: a registration
 * fee names no subscription and covers no period, so `periodStart` and
 * `periodEnd` are null on exactly those rows.
 */
exports.AdminInvoice = zod_1.z.object({
    id: primitives_1.Uuid,
    invoiceKind: exports.AdminInvoiceKind,
    amountRwf: zod_1.z.number(),
    currency: zod_1.z.string(),
    status: exports.AdminInvoiceStatus,
    periodStart: zod_1.z.string().nullable(),
    periodEnd: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
/**
 * `GET /api/v1/admin/orgs/:orgId/subscription`.
 *
 * `subscription` is nullable because an org in the registration pipeline has
 * paid a registration fee and holds no subscription yet — and the invoice array
 * is populated in exactly that state, which is why the two are sibling fields
 * rather than invoices nested under the subscription.
 */
exports.AdminOrgSubscription = zod_1.z.object({
    subscription: zod_1.z
        .object({
        id: primitives_1.Uuid,
        planName: zod_1.z.string().nullable(),
        status: exports.AdminSubscriptionStatus,
        currentPeriodStart: zod_1.z.string().nullable(),
        currentPeriodEnd: zod_1.z.string().nullable(),
        canceledAt: zod_1.z.string().nullable(),
    })
        .nullable(),
    invoices: zod_1.z.array(exports.AdminInvoice),
});
/**
 * One payout. `workspaceId` is nullable here although the column is not, so a
 * row read through a join that could not resolve its workspace still parses:
 * the console shows the payout rather than dropping money off the screen.
 */
exports.AdminPayout = zod_1.z.object({
    id: primitives_1.Uuid,
    workspaceId: primitives_1.Uuid.nullable(),
    amountRwf: zod_1.z.number(),
    currency: zod_1.z.string(),
    status: exports.AdminPayoutStatus,
    failureReason: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    settledAt: zod_1.z.string().nullable(),
});
/**
 * One side of one double-entry posting.
 *
 * `direction` is derived, not stored: `ledger_entries` carries a signed
 * `amount_rwf` and the account it hit, and the console should not be the place
 * that decides what a negative amount means. `accountCode` is the human-facing
 * code from `ledger_accounts` rather than the account uuid, because the code is
 * what a finance staffer actually reconciles against.
 */
exports.AdminLedgerRow = zod_1.z.object({
    id: primitives_1.Uuid,
    transactionId: primitives_1.Uuid,
    kind: exports.AdminLedgerTxnKind,
    adapterMode: primitives_1.AdapterMode,
    memo: zod_1.z.string().nullable(),
    accountCode: zod_1.z.string(),
    direction: zod_1.z.enum(["debit", "credit"]),
    amountRwf: zod_1.z.number(),
    currency: zod_1.z.string(),
    occurredAt: zod_1.z.string(),
});
/**
 * `GET /api/v1/admin/orgs/:orgId/money` — every money fact about one business
 * on one screen. The registration fee is lifted out of `invoices` rather than
 * left inside it because it is the one charge that happens once per org ever,
 * and staff look for it by name when a registration sticks at
 * `pending_payment`.
 */
exports.AdminOrgMoney = zod_1.z.object({
    registrationFee: exports.AdminInvoice.nullable(),
    invoices: zod_1.z.array(exports.AdminInvoice),
    payouts: zod_1.z.array(exports.AdminPayout),
    ledger: zod_1.z.array(exports.AdminLedgerRow),
});
/**
 * One `audit_events` row as a timeline entry.
 *
 * `eventType` is a free string rather than an enum: the column is `text` and
 * every module writes its own event names. `actorUserId` is nullable because
 * the platform itself acts — an expiry sweep has no actor, and attributing one
 * to it would be a lie in the one table that exists not to tell them.
 */
exports.AdminTimelineEvent = zod_1.z.object({
    id: primitives_1.Uuid,
    eventType: zod_1.z.string(),
    subjectType: exports.AdminAuditSubjectType.nullable(),
    actorUserId: primitives_1.Uuid.nullable(),
    actorName: zod_1.z.string().nullable(),
    reason: zod_1.z.string().nullable(),
    occurredAt: zod_1.z.string(),
});
exports.AdminOrgTimelineResponse = listOf(exports.AdminTimelineEvent);
// ===========================================================================
// 8. Audit  —  admin/audit
//
// Defined ahead of §3 because §2's OBO audit route composes both of these.
// ===========================================================================
/** One `audit_events` row in the full log, where the subject is not fixed. */
exports.AdminAuditRow = zod_1.z.object({
    id: primitives_1.Uuid,
    actorUserId: primitives_1.Uuid.nullable(),
    actorName: zod_1.z.string().nullable(),
    /**
     * Set when the actor was working through an impersonation session. Carried
     * apart from `actorUserId` on purpose: "staff X did this" and "staff X did
     * this AS user Y" are different facts, and collapsing them loses the one
     * the audit trail exists to record.
     */
    impersonatedUserId: primitives_1.Uuid.nullable(),
    subjectType: exports.AdminAuditSubjectType.nullable(),
    subjectId: primitives_1.Uuid.nullable(),
    eventType: zod_1.z.string(),
    reason: zod_1.z.string().nullable(),
    districtId: zod_1.z.number().int().positive().nullable(),
    occurredAt: zod_1.z.string(),
});
/** Query params for `GET /api/v1/admin/audit`. */
exports.AdminAuditQuery = zod_1.z.object({
    /** Free text over the event type and the reason. */
    q: zod_1.z.string().optional(),
    subjectType: exports.AdminAuditSubjectType.optional(),
    actorUserId: primitives_1.Uuid.optional(),
    ...pageQuery,
});
exports.AdminAuditResponse = listOf(exports.AdminAuditRow);
/**
 * One `record_access_logs` row: a staff member read someone else's record.
 *
 * `reason` is NOT NULL on the table and not nullable here, because a read of
 * another person's data without a stated reason is the thing this table exists
 * to make impossible. The routes that return identity data take that reason as
 * a required query param and write this row before they answer.
 */
exports.AdminAccessLogRow = zod_1.z.object({
    id: primitives_1.Uuid,
    actorUserId: primitives_1.Uuid,
    actorName: zod_1.z.string().nullable(),
    subjectUserId: primitives_1.Uuid.nullable(),
    subjectRef: primitives_1.Uuid.nullable(),
    dataClass: exports.AdminRecordDataClass,
    reason: zod_1.z.string(),
    occurredAt: zod_1.z.string(),
});
exports.AdminAccessLogResponse = listOf(exports.AdminAccessLogRow);
/**
 * `GET /api/v1/admin/orgs/:orgId/obo-audit` — the two trails for one
 * on-behalf-of registration, side by side and deliberately NOT paged.
 *
 * The question is "show me everything that happened to this OBO registration",
 * and an answer split across two independent paginations cannot be read as one
 * story. An OBO registration's history is bounded; a full log's is not, which
 * is why the sibling audit routes above are paged and this one is not.
 */
exports.AdminOboAuditResponse = zod_1.z.object({
    events: zod_1.z.array(exports.AdminTimelineEvent),
    accessLogs: zod_1.z.array(exports.AdminAccessLogRow),
});
// ===========================================================================
// 3. Users  —  admin/users
// ===========================================================================
/** One business a user belongs to, as it appears on their user row. */
exports.AdminUserMembership = zod_1.z.object({
    orgId: primitives_1.Uuid,
    orgName: zod_1.z.string(),
    domain: primitives_1.Domain,
    orgRole: primitives_1.OrgRole,
    /**
     * A property of this person's relationship to this business, not of the
     * business: an OBO registrant holds the owner role with payouts locked
     * until the real owner claims, so the lock belongs on the membership.
     */
    payoutLocked: zod_1.z.boolean(),
});
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
exports.AdminOversightGrant = zod_1.z.object({
    /**
     * The assignment row. Added by ADR-053, because a grant that can be revoked
     * has to be nameable: `DELETE /admin/users/:userId/oversight/:assignmentId`
     * addresses this, and a revoke keyed on role plus scope would be guessing
     * which of two grants was meant.
     */
    id: primitives_1.Uuid,
    oversightRole: primitives_1.OversightRole,
    governmentBodyCode: zod_1.z.string(),
    /** `government_bodies.name_en`, joined on the code. The words a citizen knows. */
    governmentBodyName: zod_1.z.string().nullable(),
    governmentTitle: zod_1.z.string().nullable(),
    scopeLevel: primitives_1.OversightScopeLevel,
    scopeLabel: zod_1.z.string().nullable(),
});
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
exports.CreateOversightGrantRequest = zod_1.z
    .object({
    oversightRole: primitives_1.OversightRole,
    governmentBodyCode: zod_1.z.string().trim().min(1, "Name the government body."),
    governmentTitle: zod_1.z
        .string()
        .trim()
        .min(2, "Give the officer the title their institution uses.")
        .max(200, "That title is too long for our records."),
    scopeLevel: primitives_1.OversightScopeLevel,
    provinceId: zod_1.z.number().int().positive().nullable().optional(),
    districtId: zod_1.z.number().int().positive().nullable().optional(),
})
    .superRefine((value, ctx) => {
    // Mirrors `oversight_assignments_scope_shape`. A country grant names no
    // region at all; the other two name exactly their own level.
    if (value.scopeLevel === "country") {
        if (value.provinceId != null || value.districtId != null) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["scopeLevel"],
                message: "A country scope names no province or district.",
            });
        }
        return;
    }
    if (value.scopeLevel === "province") {
        if (value.provinceId == null) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["provinceId"],
                message: "Choose the province this officer covers.",
            });
        }
        if (value.districtId != null) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["districtId"],
                message: "A province scope names no district.",
            });
        }
        return;
    }
    if (value.districtId == null) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["districtId"],
            message: "Choose the district this officer covers.",
        });
    }
});
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
exports.AdminUserRow = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string().nullable(),
    email: zod_1.z.string(),
    emailVerified: zod_1.z.boolean(),
    kyc: exports.AdminKycState,
    phoneMasked: zod_1.z.string().nullable(),
    nationalIdMasked: zod_1.z.string().nullable(),
    globalRoles: zod_1.z.array(primitives_1.GlobalRole),
    memberships: zod_1.z.array(exports.AdminUserMembership),
    staffRoles: zod_1.z.array(primitives_1.StaffRole),
    oversight: exports.AdminOversightGrant.nullable(),
    twoFactorEnrolled: zod_1.z.boolean(),
    createdAt: zod_1.z.string(),
});
/** Query params for `GET /api/v1/admin/users`. */
exports.AdminUserListQuery = zod_1.z.object({
    /** Free text over name and email. */
    q: zod_1.z.string().optional(),
    globalRole: primitives_1.GlobalRole.optional(),
    kyc: exports.AdminKycState.optional(),
    ...pageQuery,
});
exports.AdminUserListResponse = listOf(exports.AdminUserRow);
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
exports.AdminUnclaimedStay = zod_1.z.object({
    stayId: primitives_1.Uuid,
    reference: zod_1.z.string(),
    propertyName: zod_1.z.string().nullable(),
    guestName: zod_1.z.string().nullable(),
    checkOutAt: zod_1.z.string().nullable(),
    identityState: zod_1.z.enum(["none", "captured", "verified"]),
});
exports.AdminUnclaimedStaysResponse = listOf(exports.AdminUnclaimedStay);
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
exports.AdminBrokerRow = zod_1.z.object({
    id: primitives_1.Uuid,
    userId: primitives_1.Uuid,
    name: zod_1.z.string().nullable(),
    email: zod_1.z.string().nullable(),
    phoneMasked: zod_1.z.string().nullable(),
    status: exports.AdminBrokerStatus,
    /** Signed: a ledger with more spends than grants is a real, visible state. */
    revealCreditBalance: zod_1.z.number().int(),
    revealCount: zod_1.z.number().int().nonnegative(),
    placementCount: zod_1.z.number().int().nonnegative(),
    placementFeesRwf: zod_1.z.number(),
    currency: zod_1.z.string(),
    createdAt: zod_1.z.string(),
});
exports.AdminBrokerListResponse = listOf(exports.AdminBrokerRow);
/**
 * One contact reveal: a broker spent a credit to see a landlord's number.
 *
 * The revealed phone and email are on the table and are NOT on this row. The
 * point of the audit is that a reveal HAPPENED, by whom and against which
 * listing — replaying the contact details into an admin list would hand every
 * staff member the directory the credit system exists to meter.
 */
exports.AdminRevealEvent = zod_1.z.object({
    id: primitives_1.Uuid,
    brokerId: primitives_1.Uuid,
    brokerName: zod_1.z.string().nullable(),
    listingId: primitives_1.Uuid.nullable(),
    landlordOrgId: primitives_1.Uuid.nullable(),
    landlordOrgName: zod_1.z.string().nullable(),
    districtName: zod_1.z.string().nullable(),
    revealedAt: zod_1.z.string(),
});
exports.AdminRevealListResponse = listOf(exports.AdminRevealEvent);
// ===========================================================================
// 5. Finance  —  admin/finance
// ===========================================================================
exports.AdminLedgerResponse = listOf(exports.AdminLedgerRow);
/** Query params for `GET /api/v1/admin/finance/payouts`. */
exports.AdminPayoutQuery = zod_1.z.object({
    status: exports.AdminPayoutStatus.optional(),
    ...pageQuery,
});
exports.AdminPayoutResponse = listOf(exports.AdminPayout);
/**
 * A `subscription_invoices` row that came back `failed`.
 *
 * Its own schema rather than a filtered `AdminInvoice[]` because the question
 * differs: a failed charge is answered by contacting a business, so the org's
 * identity travels with the row, whereas `AdminInvoice` is only ever read with
 * an org already on screen.
 */
exports.AdminFailedCharge = zod_1.z.object({
    invoiceId: primitives_1.Uuid,
    orgId: primitives_1.Uuid,
    orgName: zod_1.z.string(),
    invoiceKind: exports.AdminInvoiceKind,
    amountRwf: zod_1.z.number(),
    currency: zod_1.z.string(),
    status: exports.AdminInvoiceStatus,
    createdAt: zod_1.z.string(),
});
exports.AdminFailedChargeResponse = listOf(exports.AdminFailedCharge);
/**
 * One reconciliation run.
 *
 * The window and the three counts are read out of the run's `report` jsonb;
 * `reconciliation_runs` itself stores only status, report, adapter mode and
 * `ran_at`. They are flattened onto the wire rather than passed through as
 * opaque JSON because a console that reaches into an untyped blob to render a
 * number breaks silently the day the report's shape changes.
 */
exports.AdminReconRun = zod_1.z.object({
    id: primitives_1.Uuid,
    windowStart: zod_1.z.string().nullable(),
    windowEnd: zod_1.z.string().nullable(),
    entryCount: zod_1.z.number().int().nonnegative(),
    matchedCount: zod_1.z.number().int().nonnegative(),
    discrepancyCount: zod_1.z.number().int().nonnegative(),
    ranAt: zod_1.z.string(),
});
exports.AdminReconRunResponse = listOf(exports.AdminReconRun);
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
exports.AdminConfigEntry = zod_1.z.object({
    id: primitives_1.Uuid,
    configType: zod_1.z.string(),
    value: zod_1.z.unknown(),
    version: zod_1.z.number().int().positive(),
    effectiveFrom: zod_1.z.string(),
    effectiveTo: zod_1.z.string().nullable(),
    lockedOnUse: zod_1.z.boolean(),
    reversible: zod_1.z.boolean(),
    lastActorUserId: primitives_1.Uuid.nullable(),
});
/**
 * One feature flag. `districtId` is non-null exactly when `scope` is
 * `district`, which is what lets the registration pipeline's oversight gates be
 * blocking in one district and advisory in another with no schema change.
 */
exports.AdminFeatureFlag = zod_1.z.object({
    id: primitives_1.Uuid,
    key: zod_1.z.string(),
    value: zod_1.z.unknown(),
    scope: exports.AdminFlagScope,
    districtId: zod_1.z.number().int().positive().nullable(),
    districtName: zod_1.z.string().nullable(),
    effectiveFrom: zod_1.z.string(),
    version: zod_1.z.number().int().positive(),
});
exports.AdminConfiguration = zod_1.z.object({
    entries: zod_1.z.array(exports.AdminConfigEntry),
    flags: zod_1.z.array(exports.AdminFeatureFlag),
});
/**
 * One row of the one-time registration fee catalog.
 *
 * Effective-dated and never destructive: changing a fee INSERTS a row, and the
 * charged amount is locked onto the invoice at charge time, so a price change
 * can never rewrite what somebody already paid. That is why `effectiveFrom` is
 * NOT NULL here while the two config tables above allow it to be absent.
 */
exports.AdminRegistrationFee = zod_1.z.object({
    id: primitives_1.Uuid,
    businessType: exports.AdminRegistrationBusinessType,
    amountRwf: zod_1.z.number(),
    currency: zod_1.z.string(),
    effectiveFrom: zod_1.z.string(),
    active: zod_1.z.boolean(),
});
/**
 * One subscription plan. `roomCountLimit` is null for an unlimited plan, which
 * is a different statement from a limit of zero. `featureSet` is deliberately
 * absent: it is `jsonb` the billing code reads, not something a staff member
 * administers from a catalog list.
 */
exports.AdminSubscriptionPlan = zod_1.z.object({
    id: primitives_1.Uuid,
    code: zod_1.z.string(),
    name: zod_1.z.string(),
    tier: zod_1.z.number().int().nullable(),
    priceRwf: zod_1.z.number(),
    currency: zod_1.z.string(),
    billingPeriod: exports.AdminPlanBillingPeriod,
    roomCountLimit: zod_1.z.number().int().nonnegative().nullable(),
    effectiveFrom: zod_1.z.string().nullable(),
    active: zod_1.z.boolean(),
});
/**
 * `GET /api/v1/admin/configuration/fees`.
 *
 * Placement fees appear as a SUMMARY rather than a list because they are a
 * broker fact, not a catalog fact — this screen prices the platform, and the
 * individual fees belong to the broker section. The counts and totals are here
 * so a finance staffer can see what the current placement rate is producing
 * without leaving the page they are editing rates on.
 */
exports.AdminFeeSchedule = zod_1.z.object({
    registrationFees: zod_1.z.array(exports.AdminRegistrationFee),
    subscriptionPlans: zod_1.z.array(exports.AdminSubscriptionPlan),
    placementFeeSummary: zod_1.z.object({
        pendingCount: zod_1.z.number().int().nonnegative(),
        pendingRwf: zod_1.z.number(),
        paidCount: zod_1.z.number().int().nonnegative(),
        paidRwf: zod_1.z.number(),
        currency: zod_1.z.string(),
    }),
});
// ===========================================================================
// 7. Compliance  —  admin/compliance
// ===========================================================================
/**
 * One compliance artifact. The `details` jsonb is deliberately absent: it holds
 * the document itself, and this screen answers "does the artifact exist and is
 * its review overdue", which `reviewDueAt` answers on its own.
 */
exports.AdminComplianceArtifact = zod_1.z.object({
    id: primitives_1.Uuid,
    artifactType: exports.AdminComplianceArtifactType,
    processorName: zod_1.z.string().nullable(),
    reviewDueAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
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
exports.AdminDsrRow = zod_1.z.object({
    id: primitives_1.Uuid,
    subjectUserId: primitives_1.Uuid.nullable(),
    requestType: exports.AdminDsrRequestType,
    state: exports.AdminDsrState,
    retentionExceptionApplied: zod_1.z.boolean(),
    dualAuthorized: zod_1.z.boolean(),
    createdAt: zod_1.z.string(),
});
exports.AdminCompliance = zod_1.z.object({
    artifacts: zod_1.z.array(exports.AdminComplianceArtifact),
    requests: zod_1.z.array(exports.AdminDsrRow),
    stats: zod_1.z.object({
        openRequests: zod_1.z.number().int().nonnegative(),
        overdueReviews: zod_1.z.number().int().nonnegative(),
        artifactCount: zod_1.z.number().int().nonnegative(),
    }),
});
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
exports.AdminSystemHealth = zod_1.z.object({
    adapters: zod_1.z.array(exports.AdminAdapterHealth),
    queues: zod_1.z.array(exports.AdminQueueHealth),
    database: zod_1.z.object({
        reachable: zod_1.z.boolean(),
        migrationsApplied: zod_1.z.number().int().nonnegative().nullable(),
        latencyMs: zod_1.z.number().nonnegative().nullable(),
    }),
    process: zod_1.z.object({
        nodeVersion: zod_1.z.string(),
        uptimeSeconds: zod_1.z.number().nonnegative(),
        environment: zod_1.z.string(),
    }),
});
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
exports.AdminEnvironments = zod_1.z.object({
    current: zod_1.z.object({
        name: zod_1.z.string(),
        nodeEnv: zod_1.z.string(),
        adapterModes: zod_1.z.object({
            payments: primitives_1.AdapterMode,
            storage: primitives_1.AdapterMode,
            sms: primitives_1.AdapterMode,
            ebm: primitives_1.AdapterMode,
        }),
    }),
    adapters: zod_1.z.array(exports.AdminAdapterHealth),
});
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
exports.AdminModeratedReview = zod_1.z.object({
    id: primitives_1.Uuid,
    propertyName: zod_1.z.string().nullable(),
    authorName: zod_1.z.string().nullable(),
    rating: zod_1.z.number().int().nullable(),
    body: zod_1.z.string().nullable(),
    state: zod_1.z.string(),
    createdAt: zod_1.z.string(),
});
/**
 * One support ticket. `firstResponseAt` and `resolvedAt` are the two timestamps
 * every response-time metric is computed from, sent raw so the console never
 * has to agree with the server about how a duration is measured. `csat` is null
 * until the requester scores it, which is not the same as scoring it zero.
 */
exports.AdminSupportTicket = zod_1.z.object({
    id: primitives_1.Uuid,
    requesterUserId: primitives_1.Uuid.nullable(),
    category: zod_1.z.string().nullable(),
    state: exports.AdminSupportTicketState,
    domain: primitives_1.Domain.nullable(),
    districtId: zod_1.z.number().int().positive().nullable(),
    firstResponseAt: zod_1.z.string().nullable(),
    resolvedAt: zod_1.z.string().nullable(),
    csat: zod_1.z.number().int().nullable(),
    createdAt: zod_1.z.string(),
});
/**
 * `GET /api/v1/admin/moderation/tickets/:ticketId?reason=` — one ticket with
 * what the person WROTE and how to answer them. Kept off `AdminSupportTicket`
 * on purpose: the list is a backlog anybody on the desk can scan, while the
 * message and the contact details are somebody's words and address, so they
 * cross only on this read, which states a reason and writes a
 * `record_access_logs` row naming the ticket before it answers.
 */
exports.AdminSupportTicketDetail = exports.AdminSupportTicket.extend({
    message: zod_1.z.string().nullable(),
    contactEmail: zod_1.z.string().nullable(),
    contactName: zod_1.z.string().nullable(),
    contactPhone: zod_1.z.string().nullable(),
});
/**
 * One escalation. The subject is a (type, id) pair rather than a set of
 * nullable foreign keys, because an escalation can point at any of eight
 * different things and eight mostly-null columns would be the worse row.
 */
exports.AdminEscalation = zod_1.z.object({
    id: primitives_1.Uuid,
    subjectType: exports.AdminEscalationSubjectType.nullable(),
    subjectId: primitives_1.Uuid.nullable(),
    type: exports.AdminEscalationType,
    state: exports.AdminEscalationState,
    ownerUserId: primitives_1.Uuid.nullable(),
    resolutionNote: zod_1.z.string().nullable(),
    districtId: zod_1.z.number().int().positive().nullable(),
    createdAt: zod_1.z.string(),
});
exports.AdminModeration = zod_1.z.object({
    reviews: zod_1.z.array(exports.AdminModeratedReview),
    tickets: zod_1.z.array(exports.AdminSupportTicket),
    escalations: zod_1.z.array(exports.AdminEscalation),
});
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
exports.AdminAnnouncement = zod_1.z.object({
    id: primitives_1.Uuid,
    audience: zod_1.z.unknown(),
    bodyEn: zod_1.z.string().nullable(),
    bodyRw: zod_1.z.string().nullable(),
    publishAt: zod_1.z.string().nullable(),
    state: exports.AdminAnnouncementState,
    createdAt: zod_1.z.string(),
});
exports.AdminAnnouncementResponse = listOf(exports.AdminAnnouncement);
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
exports.AdminAnalyticsSeries = zod_1.z.object({
    key: zod_1.z.string(),
    label: zod_1.z.string(),
    points: zod_1.z.array(zod_1.z.object({
        at: zod_1.z.string(),
        value: zod_1.z.number(),
    })),
});
/**
 * A saved dashboard scope — one staff member's stored filter.
 *
 * `metricSet` and `dateRange` are `unknown` for the same reason as
 * `AdminConfigEntry.value`: they are `jsonb` the console wrote and the console
 * reads back, and giving them a shape here would freeze a format the server
 * never inspects.
 */
exports.AdminSavedScope = zod_1.z.object({
    id: primitives_1.Uuid,
    ownerUserId: primitives_1.Uuid.nullable(),
    metricSet: zod_1.z.unknown(),
    districtId: zod_1.z.number().int().positive().nullable(),
    districtName: zod_1.z.string().nullable(),
    dateRange: zod_1.z.unknown(),
    createdAt: zod_1.z.string(),
});
exports.AdminAnalytics = zod_1.z.object({
    totals: zod_1.z.array(exports.AdminKpi),
    series: zod_1.z.array(exports.AdminAnalyticsSeries),
    savedScopes: zod_1.z.array(exports.AdminSavedScope),
});
// ===========================================================================
// 14. Localization  —  admin/localization
// ===========================================================================
/**
 * One translation string. Both languages ride on one row because the question
 * is always comparative — what is missing in Kinyarwanda that exists in English
 * — and two separate rows cannot answer it without a join the console would
 * have to perform on itself.
 */
exports.AdminTranslationEntry = zod_1.z.object({
    id: primitives_1.Uuid,
    key: zod_1.z.string(),
    valueEn: zod_1.z.string().nullable(),
    valueRw: zod_1.z.string().nullable(),
    status: exports.AdminTranslationStatus,
    version: zod_1.z.number().int().positive(),
});
/**
 * One email template. `isTransactional` is carried because it decides whether a
 * recipient may opt out: a booking confirmation is not marketing, and a console
 * that cannot see the difference will let somebody unsubscribe from their own
 * receipts. The bodies are not sent in a list; the subjects identify a row.
 */
exports.AdminEmailTemplate = zod_1.z.object({
    id: primitives_1.Uuid,
    templateKey: zod_1.z.string(),
    subjectEn: zod_1.z.string().nullable(),
    subjectRw: zod_1.z.string().nullable(),
    version: zod_1.z.number().int().positive(),
    isTransactional: zod_1.z.boolean(),
});
/**
 * `GET /api/v1/admin/localization`.
 *
 * `coverage.stale` counts `translation_status = 'needs_review'` — the string
 * has a Kinyarwanda value but the English one moved under it. It is counted
 * apart from `missing` because the two need different work: one needs a
 * translator, the other needs a reviewer.
 */
exports.AdminLocalization = zod_1.z.object({
    entries: zod_1.z.array(exports.AdminTranslationEntry),
    templates: zod_1.z.array(exports.AdminEmailTemplate),
    coverage: zod_1.z.object({
        total: zod_1.z.number().int().nonnegative(),
        translated: zod_1.z.number().int().nonnegative(),
        missing: zod_1.z.number().int().nonnegative(),
        stale: zod_1.z.number().int().nonnegative(),
    }),
});
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
exports.AdminReasonQuery = zod_1.z.object({
    reason: zod_1.z.string().trim().min(4).max(500),
});
/** A PII list route: a stated reason plus the usual paging. */
exports.AdminPagedReasonQuery = exports.AdminReasonQuery.extend({
    page: zod_1.z.coerce.number().int().positive().optional(),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).optional(),
});
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
exports.AdminActionRequest = zod_1.z.object({
    reason: exports.AdminReasonQuery.shape.reason,
});
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
exports.AppendRegistrationFeeRequest = exports.AdminActionRequest.extend({
    businessType: exports.AdminRegistrationBusinessType,
    amountRwf: zod_1.z
        .number()
        .int("A fee is whole francs.")
        .nonnegative("A fee cannot be negative.")
        .max(100000000, "That fee is outside what we can record."),
    effectiveFrom: zod_1.z.string().datetime({ offset: true }).optional(),
});
/**
 * A government body in the catalogue (D24, ADR-053 AC-G4).
 *
 * A catalogue rather than an enum, because the legally defined set is open:
 * adding RDB or RURA is a row, not a deployment. `code` is the primary key and is
 * never edited, since every grant and every recorded decision points at it.
 * Nothing is deleted: a soft retired body (`active: false`) is no longer offered
 * for a new grant, and every existing grant and decision keeps naming it.
 */
exports.GovernmentBody = zod_1.z.object({
    code: zod_1.z.string(),
    nameEn: zod_1.z.string(),
    nameRw: zod_1.z.string(),
    abbreviation: zod_1.z.string().nullable(),
    active: zod_1.z.boolean(),
});
/** `POST /api/v1/admin/government-bodies`. The code is fixed for good once written. */
exports.CreateGovernmentBodyRequest = exports.AdminActionRequest.extend({
    code: zod_1.z
        .string()
        .trim()
        .regex(/^[A-Z][A-Z0-9_]{1,15}$/, "A body code is 2 to 16 capital letters, digits or underscores, starting with a letter."),
    nameEn: zod_1.z.string().trim().min(2).max(200),
    nameRw: zod_1.z.string().trim().min(2).max(200),
    abbreviation: zod_1.z.string().trim().min(1).max(20).optional(),
});
/**
 * `PATCH /api/v1/admin/government-bodies/:code`: rename, or retire and restore.
 * The code is not here, because it is not editable.
 */
exports.UpdateGovernmentBodyRequest = exports.AdminActionRequest.extend({
    nameEn: zod_1.z.string().trim().min(2).max(200).optional(),
    nameRw: zod_1.z.string().trim().min(2).max(200).optional(),
    abbreviation: zod_1.z.string().trim().min(1).max(20).nullable().optional(),
    active: zod_1.z.boolean().optional(),
}).refine((v) => v.nameEn !== undefined || v.nameRw !== undefined || v.abbreviation !== undefined || v.active !== undefined, { message: "Change at least one of the names, the abbreviation or whether the body is active." });
/**
 * `tin_verification_result`. `pending` is RRA being unreachable, never a
 * rejection — the org holds at `submitted` and can be retried.
 */
exports.AdminTinCheckResult = zod_1.z.enum(["pending", "verified", "failed"]);
/**
 * A walk-in's claim code as printed on the check-in slip: four letters, a
 * dash, four digits. `apps/web`'s claim form tests the same shape.
 */
exports.AdminClaimCode = zod_1.z.string().regex(/^[A-Z]{4}-\d{4}$/);
/**
 * Every write answers with the id of the `audit_events` row it wrote.
 *
 * Not decoration. The row and the change commit together, so the id is the
 * receipt that the change is on the record — a console that can show it has
 * proof the action was attributed, rather than a success message it wrote
 * itself.
 */
const AuditReceipt = { auditEventId: primitives_1.Uuid };
/**
 * `POST /api/v1/admin/orgs/:orgId/suspend` and `.../reinstate`.
 *
 * `from` is carried beside the new status so the console can word what
 * actually moved, rather than assuming the business was where the page it
 * rendered last said it was.
 */
exports.AdminOrgStatusChange = zod_1.z.object({
    orgId: primitives_1.Uuid,
    from: primitives_1.OrgRegistrationStatus,
    registrationStatus: primitives_1.OrgRegistrationStatus,
    ...AuditReceipt,
});
/**
 * `POST /api/v1/admin/orgs/:orgId/tin-recheck`.
 *
 * `adapterMode` rides on the answer for the reason it rides on every
 * `tin_verifications` row: a verdict from the mock must never be read as one
 * from RRA. `registrationStatus` is where the org stands AFTER the check —
 * `tin_verified` on a pass, `rejected` on a fail, still `submitted` when RRA
 * did not answer.
 */
exports.AdminTinRecheckResult = zod_1.z.object({
    orgId: primitives_1.Uuid,
    result: exports.AdminTinCheckResult,
    adapterMode: primitives_1.AdapterMode,
    registrationStatus: primitives_1.OrgRegistrationStatus,
    ...AuditReceipt,
});
/** `POST /api/v1/admin/brokers/:brokerId/suspend`. */
exports.AdminBrokerStatusChange = zod_1.z.object({
    brokerId: primitives_1.Uuid,
    from: exports.AdminBrokerStatus,
    status: exports.AdminBrokerStatus,
    ...AuditReceipt,
});
/**
 * `POST /api/v1/admin/users/:userId/revoke-sessions`.
 *
 * `revokedCount` may be zero, and that is a success rather than a refusal: a
 * staffer ending every session of a compromised account has done their job
 * whether the attacker was signed in at that moment or not, and the audit row
 * records that they checked.
 */
exports.AdminSessionsRevoked = zod_1.z.object({
    userId: primitives_1.Uuid,
    revokedCount: zod_1.z.number().int().nonnegative(),
    ...AuditReceipt,
});
/**
 * `POST /api/v1/admin/users/stays/:stayId/reissue-claim`.
 *
 * The new code is returned because the point of reissuing it is that a
 * staffer reads it to the guest. It is NOT written to the audit row: a claim
 * code is a bearer credential for somebody's stay, and a trail that stored it
 * would let everyone who may read the audit log claim the stay.
 */
exports.AdminClaimCodeReissued = zod_1.z.object({
    stayId: primitives_1.Uuid,
    claimCode: exports.AdminClaimCode,
    ...AuditReceipt,
});
//# sourceMappingURL=admin.js.map