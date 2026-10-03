import { z } from "zod";
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
/**
 * Every enum below is copied value-for-value from a `pgEnum` in
 * `server/api/src/database/drizzle/enums.ts`. They live here rather than in
 * `primitives.ts` because so far only the admin console reads them — promote
 * one the moment a second surface needs it, rather than pre-emptively.
 */
/** `adapter_name`. The six outbound integrations the platform can be down on. */
export declare const AdminAdapterName: z.ZodEnum<["payment", "ebm_vsdc", "rra_tin", "filing", "mailer", "maps"]>;
export type AdminAdapterName = z.infer<typeof AdminAdapterName>;
/** `adapter_status`. `degraded` is a real third state, not a shade of `down`. */
export declare const AdminAdapterStatus: z.ZodEnum<["up", "degraded", "down"]>;
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
export declare const AdminAuditSubjectType: z.ZodEnum<["user", "org", "lease", "booking", "payment", "config", "property", "broker", "guest_stay", "training_certificate", "employee", "pay_run"]>;
export type AdminAuditSubjectType = z.infer<typeof AdminAuditSubjectType>;
/**
 * `record_data_class`. What class of another person's data a staff member read.
 * This is the vocabulary of the PII trail, so it must not be widened casually.
 */
export declare const AdminRecordDataClass: z.ZodEnum<["national_id", "id_photo", "contract", "stay_identity", "contact"]>;
export type AdminRecordDataClass = z.infer<typeof AdminRecordDataClass>;
/** `broker_status`. */
export declare const AdminBrokerStatus: z.ZodEnum<["active", "suspended"]>;
export type AdminBrokerStatus = z.infer<typeof AdminBrokerStatus>;
/**
 * `placement_status` (`tenant_placements.status`) — how a broker's introduction
 * ended. `unavailable` is distinct from `abandoned`: the listing went away, the
 * broker did not give up.
 */
export declare const AdminPlacementStatus: z.ZodEnum<["initiated", "converted", "abandoned", "unavailable"]>;
export type AdminPlacementStatus = z.infer<typeof AdminPlacementStatus>;
/** `obo_claim_status`. An on-behalf-of registration before and after the claim. */
export declare const AdminOboClaimStatus: z.ZodEnum<["registrant_held", "owner_claimed", "expired"]>;
export type AdminOboClaimStatus = z.infer<typeof AdminOboClaimStatus>;
/** `registration_review_decision`. One human gate, one outcome. */
export declare const AdminRegistrationReviewDecision: z.ZodEnum<["passed", "rejected"]>;
export type AdminRegistrationReviewDecision = z.infer<typeof AdminRegistrationReviewDecision>;
/**
 * `registration_rejection_reason`. Coded rather than prose because F-S03 §6
 * promises a resumable rejection — the registrant is sent back to the step that
 * was wrong, and a paragraph typed by an officer cannot drive a form.
 */
export declare const AdminRegistrationRejectionReason: z.ZodEnum<["tin_not_found", "tin_mismatch", "premises_not_found", "documents_invalid", "documents_expired", "not_operating", "ownership_unclear", "duplicate_business", "other"]>;
export type AdminRegistrationRejectionReason = z.infer<typeof AdminRegistrationRejectionReason>;
/** `registration_business_type`. The three paths the fee catalog prices. */
export declare const AdminRegistrationBusinessType: z.ZodEnum<["hospitality", "residence", "broker"]>;
export type AdminRegistrationBusinessType = z.infer<typeof AdminRegistrationBusinessType>;
/** `subscription_status`. */
export declare const AdminSubscriptionStatus: z.ZodEnum<["trialing", "active", "past_due", "canceled", "suspended"]>;
export type AdminSubscriptionStatus = z.infer<typeof AdminSubscriptionStatus>;
/** `subscription_invoice_status`. */
export declare const AdminInvoiceStatus: z.ZodEnum<["pending", "paid", "failed"]>;
export type AdminInvoiceStatus = z.infer<typeof AdminInvoiceStatus>;
/**
 * `invoice_kind`. Despite the table being named `subscription_invoices` it is
 * the org's whole invoice ledger, so a row has to say which of the two it is.
 */
export declare const AdminInvoiceKind: z.ZodEnum<["registration_fee", "subscription"]>;
export type AdminInvoiceKind = z.infer<typeof AdminInvoiceKind>;
/** `payout_status`. */
export declare const AdminPayoutStatus: z.ZodEnum<["scheduled", "queued", "paid", "held"]>;
export type AdminPayoutStatus = z.infer<typeof AdminPayoutStatus>;
/** `plan_billing_period`. One value today; an enum so a second is a migration. */
export declare const AdminPlanBillingPeriod: z.ZodEnum<["monthly"]>;
export type AdminPlanBillingPeriod = z.infer<typeof AdminPlanBillingPeriod>;
/** `ledger_txn_kind`. What moved the money, not which account it landed in. */
export declare const AdminLedgerTxnKind: z.ZodEnum<["capture", "refund", "forfeiture", "payout", "rent_settle", "caution_settle", "placement_disburse", "subscription_charge", "override", "chargeback", "folio_post", "folio_settle"]>;
export type AdminLedgerTxnKind = z.infer<typeof AdminLedgerTxnKind>;
/** `flag_scope`. A flag is global or it names one district. */
export declare const AdminFlagScope: z.ZodEnum<["global", "district"]>;
export type AdminFlagScope = z.infer<typeof AdminFlagScope>;
/** `compliance_artifact_type`. The four documents the NCSA posture is made of. */
export declare const AdminComplianceArtifactType: z.ZodEnum<["ncsa_registration", "dpo_of_record", "dpia", "processor_inventory_entry"]>;
export type AdminComplianceArtifactType = z.infer<typeof AdminComplianceArtifactType>;
/** `dsr_request_type`. */
export declare const AdminDsrRequestType: z.ZodEnum<["access", "correction", "deletion"]>;
export type AdminDsrRequestType = z.infer<typeof AdminDsrRequestType>;
/** `dsr_state`. */
export declare const AdminDsrState: z.ZodEnum<["received", "fulfilled"]>;
export type AdminDsrState = z.infer<typeof AdminDsrState>;
/** `support_ticket_state`. `reopened` is kept distinct from `open` on purpose. */
export declare const AdminSupportTicketState: z.ZodEnum<["open", "resolved", "reopened", "closed"]>;
export type AdminSupportTicketState = z.infer<typeof AdminSupportTicketState>;
/** `escalation_subject_type`. */
export declare const AdminEscalationSubjectType: z.ZodEnum<["user", "org", "lease", "booking", "listing", "review", "message", "payment"]>;
export type AdminEscalationSubjectType = z.infer<typeof AdminEscalationSubjectType>;
/** `escalation_type`. */
export declare const AdminEscalationType: z.ZodEnum<["dispute", "policy_violation", "off_platform_leakage", "listing_non_compliance", "review_abuse"]>;
export type AdminEscalationType = z.infer<typeof AdminEscalationType>;
/** `escalation_state`. */
export declare const AdminEscalationState: z.ZodEnum<["open", "resolved"]>;
export type AdminEscalationState = z.infer<typeof AdminEscalationState>;
/** `announcement_state`. */
export declare const AdminAnnouncementState: z.ZodEnum<["draft", "published"]>;
export type AdminAnnouncementState = z.infer<typeof AdminAnnouncementState>;
/** `translation_status`. `needs_review` is the "stale" bucket coverage counts. */
export declare const AdminTranslationStatus: z.ZodEnum<["translated", "missing", "needs_review"]>;
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
export declare const AdminKycState: z.ZodEnum<["none", "pending", "verified"]>;
export type AdminKycState = z.infer<typeof AdminKycState>;
/**
 * What every list route sends alongside its page.
 *
 * `page` is 1-based because it is shown to a human. `total` is the count BEFORE
 * paging, so the console can say "1-25 of 380" without a second request, and it
 * is the field that makes an empty result honest: `{ total: 0 }` is a true
 * statement about a fresh platform, not a failure to load.
 */
export declare const AdminListMeta: z.ZodObject<{
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total: number;
    page: number;
    pageSize: number;
}, {
    total: number;
    page: number;
    pageSize: number;
}>;
export type AdminListMeta = z.infer<typeof AdminListMeta>;
/**
 * One headline number.
 *
 * `previousValue` rides along rather than being computed in the browser: the
 * comparison window is a server decision (previous 30 days, previous month,
 * same month last year) and a console that picks its own window will disagree
 * with the one analytics reports. `value` is nullable because a metric with no
 * data yet is not the same as a metric that is zero.
 */
export declare const AdminKpi: z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    value: z.ZodNullable<z.ZodNumber>;
    unit: z.ZodEnum<["count", "rwf", "percent"]>;
    previousValue: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    value: number | null;
    key: string;
    label: string;
    unit: "count" | "rwf" | "percent";
    previousValue: number | null;
}, {
    value: number | null;
    key: string;
    label: string;
    unit: "count" | "rwf" | "percent";
    previousValue: number | null;
}>;
export type AdminKpi = z.infer<typeof AdminKpi>;
/** One revenue line in the period, with the same period-over-period pairing. */
export declare const AdminRevenueLine: z.ZodObject<{
    line: z.ZodString;
    amountRwf: z.ZodNumber;
    currency: z.ZodString;
    previousAmountRwf: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    currency: string;
    line: string;
    previousAmountRwf: number | null;
}, {
    amountRwf: number;
    currency: string;
    line: string;
    previousAmountRwf: number | null;
}>;
export type AdminRevenueLine = z.infer<typeof AdminRevenueLine>;
/**
 * Businesses per district. `districtId` is an integer smart code, not a uuid —
 * geography is the one part of the schema that does not use uuids.
 */
export declare const AdminDistrictDensity: z.ZodObject<{
    districtId: z.ZodNumber;
    districtName: z.ZodString;
    orgCount: z.ZodNumber;
    previousOrgCount: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    districtId: number;
    districtName: string;
    orgCount: number;
    previousOrgCount: number | null;
}, {
    districtId: number;
    districtName: string;
    orgCount: number;
    previousOrgCount: number | null;
}>;
export type AdminDistrictDensity = z.infer<typeof AdminDistrictDensity>;
/**
 * One "there are N things waiting for you" row.
 *
 * `href` is the single navigation field in this file and it is deliberate: the
 * server knows which route answers a queue, and a browser-side map from `key`
 * to route is a second copy of the routing table that goes stale the first time
 * a section moves.
 */
export declare const AdminWorkQueueItem: z.ZodObject<{
    key: z.ZodString;
    count: z.ZodNumber;
    title: z.ZodString;
    detail: z.ZodString;
    href: z.ZodString;
}, "strip", z.ZodTypeAny, {
    key: string;
    count: number;
    title: string;
    detail: string;
    href: string;
}, {
    key: string;
    count: number;
    title: string;
    detail: string;
    href: string;
}>;
export type AdminWorkQueueItem = z.infer<typeof AdminWorkQueueItem>;
/**
 * The newest `adapter_health_snapshots` row per adapter.
 *
 * `errorRate` and `latencyMs` are nullable because their columns are: a
 * snapshot can record that an adapter is up without having measured either, and
 * a 0 would assert a perfect adapter that was never timed.
 */
export declare const AdminAdapterHealth: z.ZodObject<{
    adapter: z.ZodEnum<["payment", "ebm_vsdc", "rra_tin", "filing", "mailer", "maps"]>;
    mode: z.ZodEnum<["mock", "live"]>;
    status: z.ZodEnum<["up", "degraded", "down"]>;
    errorRate: z.ZodNullable<z.ZodNumber>;
    latencyMs: z.ZodNullable<z.ZodNumber>;
    observedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "up" | "degraded" | "down";
    adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
    mode: "mock" | "live";
    errorRate: number | null;
    latencyMs: number | null;
    observedAt: string;
}, {
    status: "up" | "degraded" | "down";
    adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
    mode: "mock" | "live";
    errorRate: number | null;
    latencyMs: number | null;
    observedAt: string;
}>;
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
export declare const AdminQueueHealth: z.ZodObject<{
    queue: z.ZodString;
    depth: z.ZodNumber;
    failed: z.ZodNumber;
    deadLetter: z.ZodNumber;
    throughput: z.ZodNumber;
    observedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    failed: number;
    observedAt: string;
    queue: string;
    depth: number;
    deadLetter: number;
    throughput: number;
}, {
    failed: number;
    observedAt: string;
    queue: string;
    depth: number;
    deadLetter: number;
    throughput: number;
}>;
export type AdminQueueHealth = z.infer<typeof AdminQueueHealth>;
/** `GET /api/v1/admin/overview` — the whole landing screen in one round trip. */
export declare const AdminOverview: z.ZodObject<{
    kpis: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        value: z.ZodNullable<z.ZodNumber>;
        unit: z.ZodEnum<["count", "rwf", "percent"]>;
        previousValue: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        value: number | null;
        key: string;
        label: string;
        unit: "count" | "rwf" | "percent";
        previousValue: number | null;
    }, {
        value: number | null;
        key: string;
        label: string;
        unit: "count" | "rwf" | "percent";
        previousValue: number | null;
    }>, "many">;
    revenue: z.ZodArray<z.ZodObject<{
        line: z.ZodString;
        amountRwf: z.ZodNumber;
        currency: z.ZodString;
        previousAmountRwf: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number;
        currency: string;
        line: string;
        previousAmountRwf: number | null;
    }, {
        amountRwf: number;
        currency: string;
        line: string;
        previousAmountRwf: number | null;
    }>, "many">;
    density: z.ZodArray<z.ZodObject<{
        districtId: z.ZodNumber;
        districtName: z.ZodString;
        orgCount: z.ZodNumber;
        previousOrgCount: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        districtId: number;
        districtName: string;
        orgCount: number;
        previousOrgCount: number | null;
    }, {
        districtId: number;
        districtName: string;
        orgCount: number;
        previousOrgCount: number | null;
    }>, "many">;
    workQueue: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        count: z.ZodNumber;
        title: z.ZodString;
        detail: z.ZodString;
        href: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        count: number;
        title: string;
        detail: string;
        href: string;
    }, {
        key: string;
        count: number;
        title: string;
        detail: string;
        href: string;
    }>, "many">;
    adapters: z.ZodArray<z.ZodObject<{
        adapter: z.ZodEnum<["payment", "ebm_vsdc", "rra_tin", "filing", "mailer", "maps"]>;
        mode: z.ZodEnum<["mock", "live"]>;
        status: z.ZodEnum<["up", "degraded", "down"]>;
        errorRate: z.ZodNullable<z.ZodNumber>;
        latencyMs: z.ZodNullable<z.ZodNumber>;
        observedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "up" | "degraded" | "down";
        adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
        mode: "mock" | "live";
        errorRate: number | null;
        latencyMs: number | null;
        observedAt: string;
    }, {
        status: "up" | "degraded" | "down";
        adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
        mode: "mock" | "live";
        errorRate: number | null;
        latencyMs: number | null;
        observedAt: string;
    }>, "many">;
    queues: z.ZodArray<z.ZodObject<{
        queue: z.ZodString;
        depth: z.ZodNumber;
        failed: z.ZodNumber;
        deadLetter: z.ZodNumber;
        throughput: z.ZodNumber;
        observedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        failed: number;
        observedAt: string;
        queue: string;
        depth: number;
        deadLetter: number;
        throughput: number;
    }, {
        failed: number;
        observedAt: string;
        queue: string;
        depth: number;
        deadLetter: number;
        throughput: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    kpis: {
        value: number | null;
        key: string;
        label: string;
        unit: "count" | "rwf" | "percent";
        previousValue: number | null;
    }[];
    revenue: {
        amountRwf: number;
        currency: string;
        line: string;
        previousAmountRwf: number | null;
    }[];
    density: {
        districtId: number;
        districtName: string;
        orgCount: number;
        previousOrgCount: number | null;
    }[];
    workQueue: {
        key: string;
        count: number;
        title: string;
        detail: string;
        href: string;
    }[];
    adapters: {
        status: "up" | "degraded" | "down";
        adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
        mode: "mock" | "live";
        errorRate: number | null;
        latencyMs: number | null;
        observedAt: string;
    }[];
    queues: {
        failed: number;
        observedAt: string;
        queue: string;
        depth: number;
        deadLetter: number;
        throughput: number;
    }[];
}, {
    kpis: {
        value: number | null;
        key: string;
        label: string;
        unit: "count" | "rwf" | "percent";
        previousValue: number | null;
    }[];
    revenue: {
        amountRwf: number;
        currency: string;
        line: string;
        previousAmountRwf: number | null;
    }[];
    density: {
        districtId: number;
        districtName: string;
        orgCount: number;
        previousOrgCount: number | null;
    }[];
    workQueue: {
        key: string;
        count: number;
        title: string;
        detail: string;
        href: string;
    }[];
    adapters: {
        status: "up" | "degraded" | "down";
        adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
        mode: "mock" | "live";
        errorRate: number | null;
        latencyMs: number | null;
        observedAt: string;
    }[];
    queues: {
        failed: number;
        observedAt: string;
        queue: string;
        depth: number;
        deadLetter: number;
        throughput: number;
    }[];
}>;
export type AdminOverview = z.infer<typeof AdminOverview>;
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
export declare const AdminOrgRow: z.ZodObject<{
    id: z.ZodString;
    legalName: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence"]>;
    rdbEntityGroup: z.ZodNullable<z.ZodEnum<["accommodation", "restaurant_bar_nightclub", "travel_services", "tourism_information_center", "cultural_tourism"]>>;
    accommodationClass: z.ZodNullable<z.ZodUnion<[z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>, z.ZodEnum<["town_hotel", "vacation_hotel_resort", "serviced_apartment", "cottage"]>]>>;
    residenceClass: z.ZodNullable<z.ZodEnum<["residential_landlord", "residential_property_manager"]>>;
    tourismLicenseNumber: z.ZodNullable<z.ZodString>;
    chamberOfTourismMember: z.ZodBoolean;
    psfMember: z.ZodBoolean;
    eacStarGrade: z.ZodNullable<z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>, z.ZodLiteral<5>]>>;
    tin: z.ZodNullable<z.ZodString>;
    upi: z.ZodNullable<z.ZodString>;
    registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
    districtId: z.ZodNullable<z.ZodNumber>;
    districtName: z.ZodNullable<z.ZodString>;
    isObo: z.ZodBoolean;
    subscriptionStatus: z.ZodNullable<z.ZodEnum<["trialing", "active", "past_due", "canceled", "suspended"]>>;
    subscriptionPlanName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    districtId: number | null;
    legalName: string;
    domain: "hospitality" | "residence";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
    tin: string | null;
    upi: string | null;
    tourismLicenseNumber: string | null;
    chamberOfTourismMember: boolean;
    psfMember: boolean;
    eacStarGrade: 2 | 1 | 3 | 4 | 5 | null;
    residenceClass: "residential_landlord" | "residential_property_manager" | null;
    districtName: string | null;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    id: string;
    rdbEntityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | null;
    isObo: boolean;
    subscriptionStatus: "active" | "suspended" | "trialing" | "past_due" | "canceled" | null;
    subscriptionPlanName: string | null;
    createdAt: string;
}, {
    districtId: number | null;
    legalName: string;
    domain: "hospitality" | "residence";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
    tin: string | null;
    upi: string | null;
    tourismLicenseNumber: string | null;
    chamberOfTourismMember: boolean;
    psfMember: boolean;
    eacStarGrade: 2 | 1 | 3 | 4 | 5 | null;
    residenceClass: "residential_landlord" | "residential_property_manager" | null;
    districtName: string | null;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    id: string;
    rdbEntityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | null;
    isObo: boolean;
    subscriptionStatus: "active" | "suspended" | "trialing" | "past_due" | "canceled" | null;
    subscriptionPlanName: string | null;
    createdAt: string;
}>;
export type AdminOrgRow = z.infer<typeof AdminOrgRow>;
/** Query params for `GET /api/v1/admin/orgs`. */
export declare const AdminOrgListQuery: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
    /** Free text over legal name, TIN and UPI. */
    q: z.ZodOptional<z.ZodString>;
    districtId: z.ZodOptional<z.ZodNumber>;
    domain: z.ZodOptional<z.ZodEnum<["hospitality", "residence"]>>;
    registrationStatus: z.ZodOptional<z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>>;
}, "strip", z.ZodTypeAny, {
    districtId?: number | undefined;
    domain?: "hospitality" | "residence" | undefined;
    registrationStatus?: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    q?: string | undefined;
}, {
    districtId?: number | undefined;
    domain?: "hospitality" | "residence" | undefined;
    registrationStatus?: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    q?: string | undefined;
}>;
export type AdminOrgListQuery = z.infer<typeof AdminOrgListQuery>;
export declare const AdminOrgListResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        legalName: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence"]>;
        rdbEntityGroup: z.ZodNullable<z.ZodEnum<["accommodation", "restaurant_bar_nightclub", "travel_services", "tourism_information_center", "cultural_tourism"]>>;
        accommodationClass: z.ZodNullable<z.ZodUnion<[z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>, z.ZodEnum<["town_hotel", "vacation_hotel_resort", "serviced_apartment", "cottage"]>]>>;
        residenceClass: z.ZodNullable<z.ZodEnum<["residential_landlord", "residential_property_manager"]>>;
        tourismLicenseNumber: z.ZodNullable<z.ZodString>;
        chamberOfTourismMember: z.ZodBoolean;
        psfMember: z.ZodBoolean;
        eacStarGrade: z.ZodNullable<z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>, z.ZodLiteral<5>]>>;
        tin: z.ZodNullable<z.ZodString>;
        upi: z.ZodNullable<z.ZodString>;
        registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
        districtId: z.ZodNullable<z.ZodNumber>;
        districtName: z.ZodNullable<z.ZodString>;
        isObo: z.ZodBoolean;
        subscriptionStatus: z.ZodNullable<z.ZodEnum<["trialing", "active", "past_due", "canceled", "suspended"]>>;
        subscriptionPlanName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        districtId: number | null;
        legalName: string;
        domain: "hospitality" | "residence";
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
        tin: string | null;
        upi: string | null;
        tourismLicenseNumber: string | null;
        chamberOfTourismMember: boolean;
        psfMember: boolean;
        eacStarGrade: 2 | 1 | 3 | 4 | 5 | null;
        residenceClass: "residential_landlord" | "residential_property_manager" | null;
        districtName: string | null;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        id: string;
        rdbEntityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | null;
        isObo: boolean;
        subscriptionStatus: "active" | "suspended" | "trialing" | "past_due" | "canceled" | null;
        subscriptionPlanName: string | null;
        createdAt: string;
    }, {
        districtId: number | null;
        legalName: string;
        domain: "hospitality" | "residence";
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
        tin: string | null;
        upi: string | null;
        tourismLicenseNumber: string | null;
        chamberOfTourismMember: boolean;
        psfMember: boolean;
        eacStarGrade: 2 | 1 | 3 | 4 | 5 | null;
        residenceClass: "residential_landlord" | "residential_property_manager" | null;
        districtName: string | null;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        id: string;
        rdbEntityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | null;
        isObo: boolean;
        subscriptionStatus: "active" | "suspended" | "trialing" | "past_due" | "canceled" | null;
        subscriptionPlanName: string | null;
        createdAt: string;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        districtId: number | null;
        legalName: string;
        domain: "hospitality" | "residence";
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
        tin: string | null;
        upi: string | null;
        tourismLicenseNumber: string | null;
        chamberOfTourismMember: boolean;
        psfMember: boolean;
        eacStarGrade: 2 | 1 | 3 | 4 | 5 | null;
        residenceClass: "residential_landlord" | "residential_property_manager" | null;
        districtName: string | null;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        id: string;
        rdbEntityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | null;
        isObo: boolean;
        subscriptionStatus: "active" | "suspended" | "trialing" | "past_due" | "canceled" | null;
        subscriptionPlanName: string | null;
        createdAt: string;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        districtId: number | null;
        legalName: string;
        domain: "hospitality" | "residence";
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
        tin: string | null;
        upi: string | null;
        tourismLicenseNumber: string | null;
        chamberOfTourismMember: boolean;
        psfMember: boolean;
        eacStarGrade: 2 | 1 | 3 | 4 | 5 | null;
        residenceClass: "residential_landlord" | "residential_property_manager" | null;
        districtName: string | null;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        id: string;
        rdbEntityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | null;
        isObo: boolean;
        subscriptionStatus: "active" | "suspended" | "trialing" | "past_due" | "canceled" | null;
        subscriptionPlanName: string | null;
        createdAt: string;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
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
export declare const ReviewCoverage: z.ZodEnum<["covered", "uncovered", "not_applicable"]>;
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
export declare const AdminOrgReviewItem: z.ZodObject<{
    orgId: z.ZodString;
    legalName: z.ZodString;
    districtName: z.ZodNullable<z.ZodString>;
    domain: z.ZodEnum<["hospitality", "residence"]>;
    registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
    submittedAt: z.ZodNullable<z.ZodString>;
    lastDecision: z.ZodNullable<z.ZodObject<{
        decision: z.ZodEnum<["passed", "rejected"]>;
        reasonCode: z.ZodNullable<z.ZodEnum<["tin_not_found", "tin_mismatch", "premises_not_found", "documents_invalid", "documents_expired", "not_operating", "ownership_unclear", "duplicate_business", "other"]>>;
        decidedAt: z.ZodString;
        oversightRole: z.ZodNullable<z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer"]>>;
    }, "strip", z.ZodTypeAny, {
        decision: "rejected" | "passed";
        oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | null;
        reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        decidedAt: string;
    }, {
        decision: "rejected" | "passed";
        oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | null;
        reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        decidedAt: string;
    }>>;
    /** True once a `tin_verifications` row for this org came back `verified`. */
    tinVerified: z.ZodBoolean;
    /**
     * When the business entered the stage it is in NOW (ADR-053, AC-R7).
     *
     * The newest `org_registration_events` row whose `to_status` is the current
     * status. Null for a business that reached its status before the event log
     * existed, which is a real answer ("we did not record it") rather than a
     * guess; the console shows no wait rather than an invented one.
     */
    stageEnteredAt: z.ZodNullable<z.ZodString>;
    /**
     * Held at `submitted` on an RRA check that never answered, with every
     * automatic retry used (ADR-053, AC-R5).
     *
     * Computed when the queue is read, not stored. A stored flag would have to be
     * cleared by a later success, a resubmit and an admin recheck, and one missed
     * clear would leave a healthy business flagged forever.
     */
    stalled: z.ZodBoolean;
    /**
     * Whether an officer can take this business's CURRENT stage (ADR-053, AC-G9).
     * See `ReviewCoverage`.
     */
    coverage: z.ZodEnum<["covered", "uncovered", "not_applicable"]>;
}, "strip", z.ZodTypeAny, {
    legalName: string;
    domain: "hospitality" | "residence";
    orgId: string;
    districtName: string | null;
    submittedAt: string | null;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    lastDecision: {
        decision: "rejected" | "passed";
        oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | null;
        reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        decidedAt: string;
    } | null;
    tinVerified: boolean;
    stageEnteredAt: string | null;
    stalled: boolean;
    coverage: "covered" | "uncovered" | "not_applicable";
}, {
    legalName: string;
    domain: "hospitality" | "residence";
    orgId: string;
    districtName: string | null;
    submittedAt: string | null;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    lastDecision: {
        decision: "rejected" | "passed";
        oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | null;
        reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        decidedAt: string;
    } | null;
    tinVerified: boolean;
    stageEnteredAt: string | null;
    stalled: boolean;
    coverage: "covered" | "uncovered" | "not_applicable";
}>;
export type AdminOrgReviewItem = z.infer<typeof AdminOrgReviewItem>;
export declare const AdminOrgReviewQueueResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        orgId: z.ZodString;
        legalName: z.ZodString;
        districtName: z.ZodNullable<z.ZodString>;
        domain: z.ZodEnum<["hospitality", "residence"]>;
        registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
        submittedAt: z.ZodNullable<z.ZodString>;
        lastDecision: z.ZodNullable<z.ZodObject<{
            decision: z.ZodEnum<["passed", "rejected"]>;
            reasonCode: z.ZodNullable<z.ZodEnum<["tin_not_found", "tin_mismatch", "premises_not_found", "documents_invalid", "documents_expired", "not_operating", "ownership_unclear", "duplicate_business", "other"]>>;
            decidedAt: z.ZodString;
            oversightRole: z.ZodNullable<z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer"]>>;
        }, "strip", z.ZodTypeAny, {
            decision: "rejected" | "passed";
            oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | null;
            reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
            decidedAt: string;
        }, {
            decision: "rejected" | "passed";
            oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | null;
            reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
            decidedAt: string;
        }>>;
        /** True once a `tin_verifications` row for this org came back `verified`. */
        tinVerified: z.ZodBoolean;
        /**
         * When the business entered the stage it is in NOW (ADR-053, AC-R7).
         *
         * The newest `org_registration_events` row whose `to_status` is the current
         * status. Null for a business that reached its status before the event log
         * existed, which is a real answer ("we did not record it") rather than a
         * guess; the console shows no wait rather than an invented one.
         */
        stageEnteredAt: z.ZodNullable<z.ZodString>;
        /**
         * Held at `submitted` on an RRA check that never answered, with every
         * automatic retry used (ADR-053, AC-R5).
         *
         * Computed when the queue is read, not stored. A stored flag would have to be
         * cleared by a later success, a resubmit and an admin recheck, and one missed
         * clear would leave a healthy business flagged forever.
         */
        stalled: z.ZodBoolean;
        /**
         * Whether an officer can take this business's CURRENT stage (ADR-053, AC-G9).
         * See `ReviewCoverage`.
         */
        coverage: z.ZodEnum<["covered", "uncovered", "not_applicable"]>;
    }, "strip", z.ZodTypeAny, {
        legalName: string;
        domain: "hospitality" | "residence";
        orgId: string;
        districtName: string | null;
        submittedAt: string | null;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        lastDecision: {
            decision: "rejected" | "passed";
            oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | null;
            reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
            decidedAt: string;
        } | null;
        tinVerified: boolean;
        stageEnteredAt: string | null;
        stalled: boolean;
        coverage: "covered" | "uncovered" | "not_applicable";
    }, {
        legalName: string;
        domain: "hospitality" | "residence";
        orgId: string;
        districtName: string | null;
        submittedAt: string | null;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        lastDecision: {
            decision: "rejected" | "passed";
            oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | null;
            reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
            decidedAt: string;
        } | null;
        tinVerified: boolean;
        stageEnteredAt: string | null;
        stalled: boolean;
        coverage: "covered" | "uncovered" | "not_applicable";
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        legalName: string;
        domain: "hospitality" | "residence";
        orgId: string;
        districtName: string | null;
        submittedAt: string | null;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        lastDecision: {
            decision: "rejected" | "passed";
            oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | null;
            reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
            decidedAt: string;
        } | null;
        tinVerified: boolean;
        stageEnteredAt: string | null;
        stalled: boolean;
        coverage: "covered" | "uncovered" | "not_applicable";
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        legalName: string;
        domain: "hospitality" | "residence";
        orgId: string;
        districtName: string | null;
        submittedAt: string | null;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        lastDecision: {
            decision: "rejected" | "passed";
            oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | null;
            reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
            decidedAt: string;
        } | null;
        tinVerified: boolean;
        stageEnteredAt: string | null;
        stalled: boolean;
        coverage: "covered" | "uncovered" | "not_applicable";
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminOrgReviewQueueResponse = z.infer<typeof AdminOrgReviewQueueResponse>;
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
export declare const AdminOboRow: z.ZodObject<{
    id: z.ZodString;
    orgId: z.ZodString;
    orgName: z.ZodString;
    districtName: z.ZodNullable<z.ZodString>;
    registrantUserId: z.ZodString;
    registrantName: z.ZodNullable<z.ZodString>;
    intendedOwnerName: z.ZodString;
    intendedOwnerEmail: z.ZodNullable<z.ZodString>;
    claimStatus: z.ZodEnum<["registrant_held", "owner_claimed", "expired"]>;
    payoutLocked: z.ZodBoolean;
    claimedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    districtName: string | null;
    registrantName: string | null;
    intendedOwnerName: string;
    payoutLocked: boolean;
    claimStatus: "registrant_held" | "owner_claimed" | "expired";
    id: string;
    orgName: string;
    registrantUserId: string;
    intendedOwnerEmail: string | null;
    claimedAt: string | null;
}, {
    orgId: string;
    districtName: string | null;
    registrantName: string | null;
    intendedOwnerName: string;
    payoutLocked: boolean;
    claimStatus: "registrant_held" | "owner_claimed" | "expired";
    id: string;
    orgName: string;
    registrantUserId: string;
    intendedOwnerEmail: string | null;
    claimedAt: string | null;
}>;
export type AdminOboRow = z.infer<typeof AdminOboRow>;
export declare const AdminOboListResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        orgId: z.ZodString;
        orgName: z.ZodString;
        districtName: z.ZodNullable<z.ZodString>;
        registrantUserId: z.ZodString;
        registrantName: z.ZodNullable<z.ZodString>;
        intendedOwnerName: z.ZodString;
        intendedOwnerEmail: z.ZodNullable<z.ZodString>;
        claimStatus: z.ZodEnum<["registrant_held", "owner_claimed", "expired"]>;
        payoutLocked: z.ZodBoolean;
        claimedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        orgId: string;
        districtName: string | null;
        registrantName: string | null;
        intendedOwnerName: string;
        payoutLocked: boolean;
        claimStatus: "registrant_held" | "owner_claimed" | "expired";
        id: string;
        orgName: string;
        registrantUserId: string;
        intendedOwnerEmail: string | null;
        claimedAt: string | null;
    }, {
        orgId: string;
        districtName: string | null;
        registrantName: string | null;
        intendedOwnerName: string;
        payoutLocked: boolean;
        claimStatus: "registrant_held" | "owner_claimed" | "expired";
        id: string;
        orgName: string;
        registrantUserId: string;
        intendedOwnerEmail: string | null;
        claimedAt: string | null;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        orgId: string;
        districtName: string | null;
        registrantName: string | null;
        intendedOwnerName: string;
        payoutLocked: boolean;
        claimStatus: "registrant_held" | "owner_claimed" | "expired";
        id: string;
        orgName: string;
        registrantUserId: string;
        intendedOwnerEmail: string | null;
        claimedAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        orgId: string;
        districtName: string | null;
        registrantName: string | null;
        intendedOwnerName: string;
        payoutLocked: boolean;
        claimStatus: "registrant_held" | "owner_claimed" | "expired";
        id: string;
        orgName: string;
        registrantUserId: string;
        intendedOwnerEmail: string | null;
        claimedAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminOboListResponse = z.infer<typeof AdminOboListResponse>;
/**
 * One business in full. The list row plus what only a detail read pays for: the
 * address, the geography below district, and three counts that would each cost
 * a join nobody wants on a 25-row page.
 */
export declare const AdminOrgDetail: z.ZodObject<{
    id: z.ZodString;
    legalName: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence"]>;
    rdbEntityGroup: z.ZodNullable<z.ZodEnum<["accommodation", "restaurant_bar_nightclub", "travel_services", "tourism_information_center", "cultural_tourism"]>>;
    accommodationClass: z.ZodNullable<z.ZodUnion<[z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>, z.ZodEnum<["town_hotel", "vacation_hotel_resort", "serviced_apartment", "cottage"]>]>>;
    residenceClass: z.ZodNullable<z.ZodEnum<["residential_landlord", "residential_property_manager"]>>;
    tourismLicenseNumber: z.ZodNullable<z.ZodString>;
    chamberOfTourismMember: z.ZodBoolean;
    psfMember: z.ZodBoolean;
    eacStarGrade: z.ZodNullable<z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>, z.ZodLiteral<5>]>>;
    tin: z.ZodNullable<z.ZodString>;
    upi: z.ZodNullable<z.ZodString>;
    registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
    districtId: z.ZodNullable<z.ZodNumber>;
    districtName: z.ZodNullable<z.ZodString>;
    isObo: z.ZodBoolean;
    subscriptionStatus: z.ZodNullable<z.ZodEnum<["trialing", "active", "past_due", "canceled", "suspended"]>>;
    subscriptionPlanName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
} & {
    /**
     * When the business entered its current stage, for EVERY stage (ADR-053,
     * AC-R7), `pending_payment` and `suspended` included, neither of which the
     * review queue lists. Null before the event log existed.
     */
    stageEnteredAt: z.ZodNullable<z.ZodString>;
    addressText: z.ZodNullable<z.ZodString>;
    sectorId: z.ZodNullable<z.ZodNumber>;
    villageId: z.ZodNullable<z.ZodNumber>;
    memberCount: z.ZodNumber;
    propertyCount: z.ZodNumber;
    certificateCount: z.ZodNumber;
    /**
     * PSF membership (ADR-056 AC-20). Null for a residence, which cannot hold
     * one. Defaults to null so an older API still parses.
     */
    psf: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        membership: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            source: z.ZodEnum<["psf_confirmed", "self_declared"]>;
            tierCode: z.ZodNullable<z.ZodString>;
            tierName: z.ZodNullable<z.ZodString>;
            membershipNumber: z.ZodString;
            annualFeeRwf: z.ZodNullable<z.ZodNumber>;
            startsOn: z.ZodNullable<z.ZodString>;
            expiresOn: z.ZodNullable<z.ZodString>;
            endedAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            expiresOn: string | null;
            annualFeeRwf: number | null;
            id: string;
            source: "psf_confirmed" | "self_declared";
            tierCode: string | null;
            tierName: string | null;
            membershipNumber: string;
            startsOn: string | null;
            endedAt: string | null;
        }, {
            expiresOn: string | null;
            annualFeeRwf: number | null;
            id: string;
            source: "psf_confirmed" | "self_declared";
            tierCode: string | null;
            tierName: string | null;
            membershipNumber: string;
            startsOn: string | null;
            endedAt: string | null;
        }>>;
        applications: z.ZodArray<z.ZodObject<Omit<{
            id: z.ZodString;
            status: z.ZodEnum<["submitted", "member", "declined", "withdrawn"]>;
            requestedTierCode: z.ZodString;
            requestedTierName: z.ZodString;
            quotedPriceKind: z.ZodEnum<["fixed", "range", "set_by_psf"]>;
            quotedFeeRwf: z.ZodNullable<z.ZodNumber>;
            quotedFeeMinRwf: z.ZodNullable<z.ZodNumber>;
            quotedFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
            submittedAt: z.ZodString;
            submittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
            submittedByName: z.ZodNullable<z.ZodString>;
            queuedAt: z.ZodNullable<z.ZodString>;
            decidedAt: z.ZodNullable<z.ZodString>;
            declineReason: z.ZodNullable<z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>>;
            decisionNote: z.ZodNullable<z.ZodString>;
            withdrawnAt: z.ZodNullable<z.ZodString>;
            form: z.ZodObject<{
                companyName: z.ZodString;
                registrationType: z.ZodString;
                registrationNumber: z.ZodString;
                website: z.ZodNullable<z.ZodString>;
                streetAddress: z.ZodString;
                companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
                ownership: z.ZodEnum<["foreign_100", "rwandan_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
                ownershipOther: z.ZodNullable<z.ZodString>;
                businessActivity: z.ZodString;
                tradeDirection: z.ZodEnum<["none", "export", "import", "both"]>;
                tradeGoods: z.ZodNullable<z.ZodString>;
                tradeCountries: z.ZodArray<z.ZodString, "many">;
                contactRole: z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>;
                firstName: z.ZodString;
                lastName: z.ZodString;
                gender: z.ZodEnum<["male", "female"]>;
                phoneE164: z.ZodString;
                email: z.ZodString;
                idDocumentType: z.ZodEnum<["national_id", "passport"]>;
                idDocumentNumber: z.ZodString;
                dateOfBirth: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                gender: "female" | "male";
                dateOfBirth: string;
                phoneE164: string;
                companyName: string;
                streetAddress: string;
                website: string | null;
                companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
                ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
                ownershipOther: string | null;
                businessActivity: string;
                tradeDirection: "none" | "export" | "import" | "both";
                tradeGoods: string | null;
                tradeCountries: string[];
                contactRole: "owner" | "managing_director" | "ceo" | "chairman";
                firstName: string;
                lastName: string;
                email: string;
                registrationType: string;
                registrationNumber: string;
                idDocumentType: "national_id" | "passport";
                idDocumentNumber: string;
            }, {
                gender: "female" | "male";
                dateOfBirth: string;
                phoneE164: string;
                companyName: string;
                streetAddress: string;
                website: string | null;
                companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
                ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
                ownershipOther: string | null;
                businessActivity: string;
                tradeDirection: "none" | "export" | "import" | "both";
                tradeGoods: string | null;
                tradeCountries: string[];
                contactRole: "owner" | "managing_director" | "ceo" | "chairman";
                firstName: string;
                lastName: string;
                email: string;
                registrationType: string;
                registrationNumber: string;
                idDocumentType: "national_id" | "passport";
                idDocumentNumber: string;
            }>;
        }, "form">, "strip", z.ZodTypeAny, {
            status: "submitted" | "member" | "declined" | "withdrawn";
            requestedTierCode: string;
            decidedAt: string | null;
            submittedAt: string;
            id: string;
            requestedTierName: string;
            quotedPriceKind: "fixed" | "range" | "set_by_psf";
            quotedFeeRwf: number | null;
            quotedFeeMinRwf: number | null;
            quotedFeeMaxRwf: number | null;
            submittedCapacity: "owner" | "on_behalf_of";
            submittedByName: string | null;
            queuedAt: string | null;
            declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
            decisionNote: string | null;
            withdrawnAt: string | null;
        }, {
            status: "submitted" | "member" | "declined" | "withdrawn";
            requestedTierCode: string;
            decidedAt: string | null;
            submittedAt: string;
            id: string;
            requestedTierName: string;
            quotedPriceKind: "fixed" | "range" | "set_by_psf";
            quotedFeeRwf: number | null;
            quotedFeeMinRwf: number | null;
            quotedFeeMaxRwf: number | null;
            submittedCapacity: "owner" | "on_behalf_of";
            submittedByName: string | null;
            queuedAt: string | null;
            declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
            decisionNote: string | null;
            withdrawnAt: string | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        membership: {
            expiresOn: string | null;
            annualFeeRwf: number | null;
            id: string;
            source: "psf_confirmed" | "self_declared";
            tierCode: string | null;
            tierName: string | null;
            membershipNumber: string;
            startsOn: string | null;
            endedAt: string | null;
        } | null;
        applications: {
            status: "submitted" | "member" | "declined" | "withdrawn";
            requestedTierCode: string;
            decidedAt: string | null;
            submittedAt: string;
            id: string;
            requestedTierName: string;
            quotedPriceKind: "fixed" | "range" | "set_by_psf";
            quotedFeeRwf: number | null;
            quotedFeeMinRwf: number | null;
            quotedFeeMaxRwf: number | null;
            submittedCapacity: "owner" | "on_behalf_of";
            submittedByName: string | null;
            queuedAt: string | null;
            declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
            decisionNote: string | null;
            withdrawnAt: string | null;
        }[];
    }, {
        membership: {
            expiresOn: string | null;
            annualFeeRwf: number | null;
            id: string;
            source: "psf_confirmed" | "self_declared";
            tierCode: string | null;
            tierName: string | null;
            membershipNumber: string;
            startsOn: string | null;
            endedAt: string | null;
        } | null;
        applications: {
            status: "submitted" | "member" | "declined" | "withdrawn";
            requestedTierCode: string;
            decidedAt: string | null;
            submittedAt: string;
            id: string;
            requestedTierName: string;
            quotedPriceKind: "fixed" | "range" | "set_by_psf";
            quotedFeeRwf: number | null;
            quotedFeeMinRwf: number | null;
            quotedFeeMaxRwf: number | null;
            submittedCapacity: "owner" | "on_behalf_of";
            submittedByName: string | null;
            queuedAt: string | null;
            declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
            decisionNote: string | null;
            withdrawnAt: string | null;
        }[];
    }>>>;
}, "strip", z.ZodTypeAny, {
    districtId: number | null;
    sectorId: number | null;
    villageId: number | null;
    addressText: string | null;
    legalName: string;
    domain: "hospitality" | "residence";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
    tin: string | null;
    upi: string | null;
    tourismLicenseNumber: string | null;
    chamberOfTourismMember: boolean;
    psfMember: boolean;
    eacStarGrade: 2 | 1 | 3 | 4 | 5 | null;
    residenceClass: "residential_landlord" | "residential_property_manager" | null;
    districtName: string | null;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    id: string;
    rdbEntityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | null;
    isObo: boolean;
    subscriptionStatus: "active" | "suspended" | "trialing" | "past_due" | "canceled" | null;
    subscriptionPlanName: string | null;
    createdAt: string;
    stageEnteredAt: string | null;
    memberCount: number;
    propertyCount: number;
    certificateCount: number;
    psf: {
        membership: {
            expiresOn: string | null;
            annualFeeRwf: number | null;
            id: string;
            source: "psf_confirmed" | "self_declared";
            tierCode: string | null;
            tierName: string | null;
            membershipNumber: string;
            startsOn: string | null;
            endedAt: string | null;
        } | null;
        applications: {
            status: "submitted" | "member" | "declined" | "withdrawn";
            requestedTierCode: string;
            decidedAt: string | null;
            submittedAt: string;
            id: string;
            requestedTierName: string;
            quotedPriceKind: "fixed" | "range" | "set_by_psf";
            quotedFeeRwf: number | null;
            quotedFeeMinRwf: number | null;
            quotedFeeMaxRwf: number | null;
            submittedCapacity: "owner" | "on_behalf_of";
            submittedByName: string | null;
            queuedAt: string | null;
            declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
            decisionNote: string | null;
            withdrawnAt: string | null;
        }[];
    } | null;
}, {
    districtId: number | null;
    sectorId: number | null;
    villageId: number | null;
    addressText: string | null;
    legalName: string;
    domain: "hospitality" | "residence";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
    tin: string | null;
    upi: string | null;
    tourismLicenseNumber: string | null;
    chamberOfTourismMember: boolean;
    psfMember: boolean;
    eacStarGrade: 2 | 1 | 3 | 4 | 5 | null;
    residenceClass: "residential_landlord" | "residential_property_manager" | null;
    districtName: string | null;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    id: string;
    rdbEntityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | null;
    isObo: boolean;
    subscriptionStatus: "active" | "suspended" | "trialing" | "past_due" | "canceled" | null;
    subscriptionPlanName: string | null;
    createdAt: string;
    stageEnteredAt: string | null;
    memberCount: number;
    propertyCount: number;
    certificateCount: number;
    psf?: {
        membership: {
            expiresOn: string | null;
            annualFeeRwf: number | null;
            id: string;
            source: "psf_confirmed" | "self_declared";
            tierCode: string | null;
            tierName: string | null;
            membershipNumber: string;
            startsOn: string | null;
            endedAt: string | null;
        } | null;
        applications: {
            status: "submitted" | "member" | "declined" | "withdrawn";
            requestedTierCode: string;
            decidedAt: string | null;
            submittedAt: string;
            id: string;
            requestedTierName: string;
            quotedPriceKind: "fixed" | "range" | "set_by_psf";
            quotedFeeRwf: number | null;
            quotedFeeMinRwf: number | null;
            quotedFeeMaxRwf: number | null;
            submittedCapacity: "owner" | "on_behalf_of";
            submittedByName: string | null;
            queuedAt: string | null;
            declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
            decisionNote: string | null;
            withdrawnAt: string | null;
        }[];
    } | null | undefined;
}>;
export type AdminOrgDetail = z.infer<typeof AdminOrgDetail>;
/**
 * One person inside a business.
 *
 * `status` is the enum the database now enforces. It used to be `z.string()`,
 * correctly, while `org_memberships.status` was free `text`; ADR-053 made the
 * column `org_membership_status` (AC-R10), so the contract promises exactly what
 * Postgres refuses to store otherwise, no more and no less.
 */
export declare const AdminOrgMember: z.ZodObject<{
    userId: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    email: z.ZodString;
    orgRole: z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>;
    status: z.ZodEnum<["active", "removed"]>;
    joinedAt: z.ZodString;
    removedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "removed";
    name: string | null;
    email: string;
    userId: string;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
    joinedAt: string;
    removedAt: string | null;
}, {
    status: "active" | "removed";
    name: string | null;
    email: string;
    userId: string;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
    joinedAt: string;
    removedAt: string | null;
}>;
export type AdminOrgMember = z.infer<typeof AdminOrgMember>;
export declare const AdminOrgPeopleResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        userId: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        email: z.ZodString;
        orgRole: z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>;
        status: z.ZodEnum<["active", "removed"]>;
        joinedAt: z.ZodString;
        removedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "removed";
        name: string | null;
        email: string;
        userId: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        joinedAt: string;
        removedAt: string | null;
    }, {
        status: "active" | "removed";
        name: string | null;
        email: string;
        userId: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        joinedAt: string;
        removedAt: string | null;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "active" | "removed";
        name: string | null;
        email: string;
        userId: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        joinedAt: string;
        removedAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        status: "active" | "removed";
        name: string | null;
        email: string;
        userId: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        joinedAt: string;
        removedAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
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
export declare const AdminOrgProperty: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence"]>;
    districtName: z.ZodNullable<z.ZodString>;
    roomTypeCount: z.ZodNumber;
    roomCount: z.ZodNumber;
    listingCount: z.ZodNumber;
    published: z.ZodBoolean;
    /** ADR-054 AC-R4: which branch is the head office. */
    isHeadOffice: z.ZodBoolean;
    rraBranchId: z.ZodNullable<z.ZodString>;
    archivedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    domain: "hospitality" | "residence";
    districtName: string | null;
    isHeadOffice: boolean;
    id: string;
    published: boolean;
    roomTypeCount: number;
    roomCount: number;
    listingCount: number;
    rraBranchId: string | null;
    archivedAt: string | null;
}, {
    name: string;
    domain: "hospitality" | "residence";
    districtName: string | null;
    isHeadOffice: boolean;
    id: string;
    published: boolean;
    roomTypeCount: number;
    roomCount: number;
    listingCount: number;
    rraBranchId: string | null;
    archivedAt: string | null;
}>;
export type AdminOrgProperty = z.infer<typeof AdminOrgProperty>;
export declare const AdminOrgPropertiesResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence"]>;
        districtName: z.ZodNullable<z.ZodString>;
        roomTypeCount: z.ZodNumber;
        roomCount: z.ZodNumber;
        listingCount: z.ZodNumber;
        published: z.ZodBoolean;
        /** ADR-054 AC-R4: which branch is the head office. */
        isHeadOffice: z.ZodBoolean;
        rraBranchId: z.ZodNullable<z.ZodString>;
        archivedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        domain: "hospitality" | "residence";
        districtName: string | null;
        isHeadOffice: boolean;
        id: string;
        published: boolean;
        roomTypeCount: number;
        roomCount: number;
        listingCount: number;
        rraBranchId: string | null;
        archivedAt: string | null;
    }, {
        name: string;
        domain: "hospitality" | "residence";
        districtName: string | null;
        isHeadOffice: boolean;
        id: string;
        published: boolean;
        roomTypeCount: number;
        roomCount: number;
        listingCount: number;
        rraBranchId: string | null;
        archivedAt: string | null;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        name: string;
        domain: "hospitality" | "residence";
        districtName: string | null;
        isHeadOffice: boolean;
        id: string;
        published: boolean;
        roomTypeCount: number;
        roomCount: number;
        listingCount: number;
        rraBranchId: string | null;
        archivedAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        name: string;
        domain: "hospitality" | "residence";
        districtName: string | null;
        isHeadOffice: boolean;
        id: string;
        published: boolean;
        roomTypeCount: number;
        roomCount: number;
        listingCount: number;
        rraBranchId: string | null;
        archivedAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminOrgPropertiesResponse = z.infer<typeof AdminOrgPropertiesResponse>;
/**
 * One row of `subscription_invoices` — which, despite the table's name, is the
 * org's whole invoice ledger. `invoiceKind` is the discriminator, and the
 * table's own CHECK guarantees the shape that follows from it: a registration
 * fee names no subscription and covers no period, so `periodStart` and
 * `periodEnd` are null on exactly those rows.
 */
export declare const AdminInvoice: z.ZodObject<{
    id: z.ZodString;
    invoiceKind: z.ZodEnum<["registration_fee", "subscription"]>;
    amountRwf: z.ZodNumber;
    currency: z.ZodString;
    status: z.ZodEnum<["pending", "paid", "failed"]>;
    periodStart: z.ZodNullable<z.ZodString>;
    periodEnd: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "failed" | "paid";
    amountRwf: number;
    currency: string;
    id: string;
    createdAt: string;
    invoiceKind: "registration_fee" | "subscription";
    periodStart: string | null;
    periodEnd: string | null;
}, {
    status: "pending" | "failed" | "paid";
    amountRwf: number;
    currency: string;
    id: string;
    createdAt: string;
    invoiceKind: "registration_fee" | "subscription";
    periodStart: string | null;
    periodEnd: string | null;
}>;
export type AdminInvoice = z.infer<typeof AdminInvoice>;
/**
 * `GET /api/v1/admin/orgs/:orgId/subscription`.
 *
 * `subscription` is nullable because an org in the registration pipeline has
 * paid a registration fee and holds no subscription yet — and the invoice array
 * is populated in exactly that state, which is why the two are sibling fields
 * rather than invoices nested under the subscription.
 */
export declare const AdminOrgSubscription: z.ZodObject<{
    subscription: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        planName: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["trialing", "active", "past_due", "canceled", "suspended"]>;
        currentPeriodStart: z.ZodNullable<z.ZodString>;
        currentPeriodEnd: z.ZodNullable<z.ZodString>;
        canceledAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "suspended" | "trialing" | "past_due" | "canceled";
        id: string;
        planName: string | null;
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        canceledAt: string | null;
    }, {
        status: "active" | "suspended" | "trialing" | "past_due" | "canceled";
        id: string;
        planName: string | null;
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        canceledAt: string | null;
    }>>;
    invoices: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        invoiceKind: z.ZodEnum<["registration_fee", "subscription"]>;
        amountRwf: z.ZodNumber;
        currency: z.ZodString;
        status: z.ZodEnum<["pending", "paid", "failed"]>;
        periodStart: z.ZodNullable<z.ZodString>;
        periodEnd: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "failed" | "paid";
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        invoiceKind: "registration_fee" | "subscription";
        periodStart: string | null;
        periodEnd: string | null;
    }, {
        status: "pending" | "failed" | "paid";
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        invoiceKind: "registration_fee" | "subscription";
        periodStart: string | null;
        periodEnd: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    subscription: {
        status: "active" | "suspended" | "trialing" | "past_due" | "canceled";
        id: string;
        planName: string | null;
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        canceledAt: string | null;
    } | null;
    invoices: {
        status: "pending" | "failed" | "paid";
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        invoiceKind: "registration_fee" | "subscription";
        periodStart: string | null;
        periodEnd: string | null;
    }[];
}, {
    subscription: {
        status: "active" | "suspended" | "trialing" | "past_due" | "canceled";
        id: string;
        planName: string | null;
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        canceledAt: string | null;
    } | null;
    invoices: {
        status: "pending" | "failed" | "paid";
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        invoiceKind: "registration_fee" | "subscription";
        periodStart: string | null;
        periodEnd: string | null;
    }[];
}>;
export type AdminOrgSubscription = z.infer<typeof AdminOrgSubscription>;
/**
 * One payout. `workspaceId` is nullable here although the column is not, so a
 * row read through a join that could not resolve its workspace still parses:
 * the console shows the payout rather than dropping money off the screen.
 */
export declare const AdminPayout: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodNullable<z.ZodString>;
    amountRwf: z.ZodNumber;
    currency: z.ZodString;
    status: z.ZodEnum<["scheduled", "queued", "paid", "held"]>;
    failureReason: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    settledAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "paid" | "scheduled" | "queued" | "held";
    workspaceId: string | null;
    amountRwf: number;
    currency: string;
    id: string;
    createdAt: string;
    failureReason: string | null;
    settledAt: string | null;
}, {
    status: "paid" | "scheduled" | "queued" | "held";
    workspaceId: string | null;
    amountRwf: number;
    currency: string;
    id: string;
    createdAt: string;
    failureReason: string | null;
    settledAt: string | null;
}>;
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
export declare const AdminLedgerRow: z.ZodObject<{
    id: z.ZodString;
    transactionId: z.ZodString;
    kind: z.ZodEnum<["capture", "refund", "forfeiture", "payout", "rent_settle", "caution_settle", "placement_disburse", "subscription_charge", "override", "chargeback", "folio_post", "folio_settle"]>;
    adapterMode: z.ZodEnum<["mock", "live"]>;
    memo: z.ZodNullable<z.ZodString>;
    accountCode: z.ZodString;
    direction: z.ZodEnum<["debit", "credit"]>;
    amountRwf: z.ZodNumber;
    currency: z.ZodString;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "capture" | "refund" | "forfeiture" | "payout" | "rent_settle" | "caution_settle" | "placement_disburse" | "subscription_charge" | "override" | "chargeback" | "folio_post" | "folio_settle";
    adapterMode: "mock" | "live";
    amountRwf: number;
    currency: string;
    id: string;
    transactionId: string;
    memo: string | null;
    accountCode: string;
    direction: "debit" | "credit";
    occurredAt: string;
}, {
    kind: "capture" | "refund" | "forfeiture" | "payout" | "rent_settle" | "caution_settle" | "placement_disburse" | "subscription_charge" | "override" | "chargeback" | "folio_post" | "folio_settle";
    adapterMode: "mock" | "live";
    amountRwf: number;
    currency: string;
    id: string;
    transactionId: string;
    memo: string | null;
    accountCode: string;
    direction: "debit" | "credit";
    occurredAt: string;
}>;
export type AdminLedgerRow = z.infer<typeof AdminLedgerRow>;
/**
 * `GET /api/v1/admin/orgs/:orgId/money` — every money fact about one business
 * on one screen. The registration fee is lifted out of `invoices` rather than
 * left inside it because it is the one charge that happens once per org ever,
 * and staff look for it by name when a registration sticks at
 * `pending_payment`.
 */
export declare const AdminOrgMoney: z.ZodObject<{
    registrationFee: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        invoiceKind: z.ZodEnum<["registration_fee", "subscription"]>;
        amountRwf: z.ZodNumber;
        currency: z.ZodString;
        status: z.ZodEnum<["pending", "paid", "failed"]>;
        periodStart: z.ZodNullable<z.ZodString>;
        periodEnd: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "failed" | "paid";
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        invoiceKind: "registration_fee" | "subscription";
        periodStart: string | null;
        periodEnd: string | null;
    }, {
        status: "pending" | "failed" | "paid";
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        invoiceKind: "registration_fee" | "subscription";
        periodStart: string | null;
        periodEnd: string | null;
    }>>;
    invoices: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        invoiceKind: z.ZodEnum<["registration_fee", "subscription"]>;
        amountRwf: z.ZodNumber;
        currency: z.ZodString;
        status: z.ZodEnum<["pending", "paid", "failed"]>;
        periodStart: z.ZodNullable<z.ZodString>;
        periodEnd: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "failed" | "paid";
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        invoiceKind: "registration_fee" | "subscription";
        periodStart: string | null;
        periodEnd: string | null;
    }, {
        status: "pending" | "failed" | "paid";
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        invoiceKind: "registration_fee" | "subscription";
        periodStart: string | null;
        periodEnd: string | null;
    }>, "many">;
    payouts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodNullable<z.ZodString>;
        amountRwf: z.ZodNumber;
        currency: z.ZodString;
        status: z.ZodEnum<["scheduled", "queued", "paid", "held"]>;
        failureReason: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        settledAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "paid" | "scheduled" | "queued" | "held";
        workspaceId: string | null;
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        failureReason: string | null;
        settledAt: string | null;
    }, {
        status: "paid" | "scheduled" | "queued" | "held";
        workspaceId: string | null;
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        failureReason: string | null;
        settledAt: string | null;
    }>, "many">;
    ledger: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        transactionId: z.ZodString;
        kind: z.ZodEnum<["capture", "refund", "forfeiture", "payout", "rent_settle", "caution_settle", "placement_disburse", "subscription_charge", "override", "chargeback", "folio_post", "folio_settle"]>;
        adapterMode: z.ZodEnum<["mock", "live"]>;
        memo: z.ZodNullable<z.ZodString>;
        accountCode: z.ZodString;
        direction: z.ZodEnum<["debit", "credit"]>;
        amountRwf: z.ZodNumber;
        currency: z.ZodString;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "capture" | "refund" | "forfeiture" | "payout" | "rent_settle" | "caution_settle" | "placement_disburse" | "subscription_charge" | "override" | "chargeback" | "folio_post" | "folio_settle";
        adapterMode: "mock" | "live";
        amountRwf: number;
        currency: string;
        id: string;
        transactionId: string;
        memo: string | null;
        accountCode: string;
        direction: "debit" | "credit";
        occurredAt: string;
    }, {
        kind: "capture" | "refund" | "forfeiture" | "payout" | "rent_settle" | "caution_settle" | "placement_disburse" | "subscription_charge" | "override" | "chargeback" | "folio_post" | "folio_settle";
        adapterMode: "mock" | "live";
        amountRwf: number;
        currency: string;
        id: string;
        transactionId: string;
        memo: string | null;
        accountCode: string;
        direction: "debit" | "credit";
        occurredAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    invoices: {
        status: "pending" | "failed" | "paid";
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        invoiceKind: "registration_fee" | "subscription";
        periodStart: string | null;
        periodEnd: string | null;
    }[];
    registrationFee: {
        status: "pending" | "failed" | "paid";
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        invoiceKind: "registration_fee" | "subscription";
        periodStart: string | null;
        periodEnd: string | null;
    } | null;
    payouts: {
        status: "paid" | "scheduled" | "queued" | "held";
        workspaceId: string | null;
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        failureReason: string | null;
        settledAt: string | null;
    }[];
    ledger: {
        kind: "capture" | "refund" | "forfeiture" | "payout" | "rent_settle" | "caution_settle" | "placement_disburse" | "subscription_charge" | "override" | "chargeback" | "folio_post" | "folio_settle";
        adapterMode: "mock" | "live";
        amountRwf: number;
        currency: string;
        id: string;
        transactionId: string;
        memo: string | null;
        accountCode: string;
        direction: "debit" | "credit";
        occurredAt: string;
    }[];
}, {
    invoices: {
        status: "pending" | "failed" | "paid";
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        invoiceKind: "registration_fee" | "subscription";
        periodStart: string | null;
        periodEnd: string | null;
    }[];
    registrationFee: {
        status: "pending" | "failed" | "paid";
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        invoiceKind: "registration_fee" | "subscription";
        periodStart: string | null;
        periodEnd: string | null;
    } | null;
    payouts: {
        status: "paid" | "scheduled" | "queued" | "held";
        workspaceId: string | null;
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        failureReason: string | null;
        settledAt: string | null;
    }[];
    ledger: {
        kind: "capture" | "refund" | "forfeiture" | "payout" | "rent_settle" | "caution_settle" | "placement_disburse" | "subscription_charge" | "override" | "chargeback" | "folio_post" | "folio_settle";
        adapterMode: "mock" | "live";
        amountRwf: number;
        currency: string;
        id: string;
        transactionId: string;
        memo: string | null;
        accountCode: string;
        direction: "debit" | "credit";
        occurredAt: string;
    }[];
}>;
export type AdminOrgMoney = z.infer<typeof AdminOrgMoney>;
/**
 * One `audit_events` row as a timeline entry.
 *
 * `eventType` is a free string rather than an enum: the column is `text` and
 * every module writes its own event names. `actorUserId` is nullable because
 * the platform itself acts — an expiry sweep has no actor, and attributing one
 * to it would be a lie in the one table that exists not to tell them.
 */
export declare const AdminTimelineEvent: z.ZodObject<{
    id: z.ZodString;
    eventType: z.ZodString;
    subjectType: z.ZodNullable<z.ZodEnum<["user", "org", "lease", "booking", "payment", "config", "property", "broker", "guest_stay", "training_certificate", "employee", "pay_run"]>>;
    actorUserId: z.ZodNullable<z.ZodString>;
    actorName: z.ZodNullable<z.ZodString>;
    reason: z.ZodNullable<z.ZodString>;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string | null;
    id: string;
    occurredAt: string;
    eventType: string;
    subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
    actorUserId: string | null;
    actorName: string | null;
}, {
    reason: string | null;
    id: string;
    occurredAt: string;
    eventType: string;
    subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
    actorUserId: string | null;
    actorName: string | null;
}>;
export type AdminTimelineEvent = z.infer<typeof AdminTimelineEvent>;
export declare const AdminOrgTimelineResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        eventType: z.ZodString;
        subjectType: z.ZodNullable<z.ZodEnum<["user", "org", "lease", "booking", "payment", "config", "property", "broker", "guest_stay", "training_certificate", "employee", "pay_run"]>>;
        actorUserId: z.ZodNullable<z.ZodString>;
        actorName: z.ZodNullable<z.ZodString>;
        reason: z.ZodNullable<z.ZodString>;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        reason: string | null;
        id: string;
        occurredAt: string;
        eventType: string;
        subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
        actorUserId: string | null;
        actorName: string | null;
    }, {
        reason: string | null;
        id: string;
        occurredAt: string;
        eventType: string;
        subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
        actorUserId: string | null;
        actorName: string | null;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        reason: string | null;
        id: string;
        occurredAt: string;
        eventType: string;
        subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
        actorUserId: string | null;
        actorName: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        reason: string | null;
        id: string;
        occurredAt: string;
        eventType: string;
        subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
        actorUserId: string | null;
        actorName: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminOrgTimelineResponse = z.infer<typeof AdminOrgTimelineResponse>;
/** One `audit_events` row in the full log, where the subject is not fixed. */
export declare const AdminAuditRow: z.ZodObject<{
    id: z.ZodString;
    actorUserId: z.ZodNullable<z.ZodString>;
    actorName: z.ZodNullable<z.ZodString>;
    /**
     * Set when the actor was working through an impersonation session. Carried
     * apart from `actorUserId` on purpose: "staff X did this" and "staff X did
     * this AS user Y" are different facts, and collapsing them loses the one
     * the audit trail exists to record.
     */
    impersonatedUserId: z.ZodNullable<z.ZodString>;
    subjectType: z.ZodNullable<z.ZodEnum<["user", "org", "lease", "booking", "payment", "config", "property", "broker", "guest_stay", "training_certificate", "employee", "pay_run"]>>;
    subjectId: z.ZodNullable<z.ZodString>;
    eventType: z.ZodString;
    reason: z.ZodNullable<z.ZodString>;
    districtId: z.ZodNullable<z.ZodNumber>;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    districtId: number | null;
    reason: string | null;
    id: string;
    occurredAt: string;
    eventType: string;
    subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
    actorUserId: string | null;
    actorName: string | null;
    impersonatedUserId: string | null;
    subjectId: string | null;
}, {
    districtId: number | null;
    reason: string | null;
    id: string;
    occurredAt: string;
    eventType: string;
    subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
    actorUserId: string | null;
    actorName: string | null;
    impersonatedUserId: string | null;
    subjectId: string | null;
}>;
export type AdminAuditRow = z.infer<typeof AdminAuditRow>;
/** Query params for `GET /api/v1/admin/audit`. */
export declare const AdminAuditQuery: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
    /** Free text over the event type and the reason. */
    q: z.ZodOptional<z.ZodString>;
    subjectType: z.ZodOptional<z.ZodEnum<["user", "org", "lease", "booking", "payment", "config", "property", "broker", "guest_stay", "training_certificate", "employee", "pay_run"]>>;
    actorUserId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    pageSize?: number | undefined;
    q?: string | undefined;
    subjectType?: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | undefined;
    actorUserId?: string | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    q?: string | undefined;
    subjectType?: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | undefined;
    actorUserId?: string | undefined;
}>;
export type AdminAuditQuery = z.infer<typeof AdminAuditQuery>;
export declare const AdminAuditResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        actorUserId: z.ZodNullable<z.ZodString>;
        actorName: z.ZodNullable<z.ZodString>;
        /**
         * Set when the actor was working through an impersonation session. Carried
         * apart from `actorUserId` on purpose: "staff X did this" and "staff X did
         * this AS user Y" are different facts, and collapsing them loses the one
         * the audit trail exists to record.
         */
        impersonatedUserId: z.ZodNullable<z.ZodString>;
        subjectType: z.ZodNullable<z.ZodEnum<["user", "org", "lease", "booking", "payment", "config", "property", "broker", "guest_stay", "training_certificate", "employee", "pay_run"]>>;
        subjectId: z.ZodNullable<z.ZodString>;
        eventType: z.ZodString;
        reason: z.ZodNullable<z.ZodString>;
        districtId: z.ZodNullable<z.ZodNumber>;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        districtId: number | null;
        reason: string | null;
        id: string;
        occurredAt: string;
        eventType: string;
        subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
        actorUserId: string | null;
        actorName: string | null;
        impersonatedUserId: string | null;
        subjectId: string | null;
    }, {
        districtId: number | null;
        reason: string | null;
        id: string;
        occurredAt: string;
        eventType: string;
        subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
        actorUserId: string | null;
        actorName: string | null;
        impersonatedUserId: string | null;
        subjectId: string | null;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        districtId: number | null;
        reason: string | null;
        id: string;
        occurredAt: string;
        eventType: string;
        subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
        actorUserId: string | null;
        actorName: string | null;
        impersonatedUserId: string | null;
        subjectId: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        districtId: number | null;
        reason: string | null;
        id: string;
        occurredAt: string;
        eventType: string;
        subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
        actorUserId: string | null;
        actorName: string | null;
        impersonatedUserId: string | null;
        subjectId: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminAuditResponse = z.infer<typeof AdminAuditResponse>;
/**
 * One `record_access_logs` row: a staff member read someone else's record.
 *
 * `reason` is NOT NULL on the table and not nullable here, because a read of
 * another person's data without a stated reason is the thing this table exists
 * to make impossible. The routes that return identity data take that reason as
 * a required query param and write this row before they answer.
 */
export declare const AdminAccessLogRow: z.ZodObject<{
    id: z.ZodString;
    actorUserId: z.ZodString;
    actorName: z.ZodNullable<z.ZodString>;
    subjectUserId: z.ZodNullable<z.ZodString>;
    subjectRef: z.ZodNullable<z.ZodString>;
    dataClass: z.ZodEnum<["national_id", "id_photo", "contract", "stay_identity", "contact"]>;
    reason: z.ZodString;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    id: string;
    occurredAt: string;
    actorUserId: string;
    actorName: string | null;
    subjectUserId: string | null;
    subjectRef: string | null;
    dataClass: "national_id" | "id_photo" | "contract" | "stay_identity" | "contact";
}, {
    reason: string;
    id: string;
    occurredAt: string;
    actorUserId: string;
    actorName: string | null;
    subjectUserId: string | null;
    subjectRef: string | null;
    dataClass: "national_id" | "id_photo" | "contract" | "stay_identity" | "contact";
}>;
export type AdminAccessLogRow = z.infer<typeof AdminAccessLogRow>;
export declare const AdminAccessLogResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        actorUserId: z.ZodString;
        actorName: z.ZodNullable<z.ZodString>;
        subjectUserId: z.ZodNullable<z.ZodString>;
        subjectRef: z.ZodNullable<z.ZodString>;
        dataClass: z.ZodEnum<["national_id", "id_photo", "contract", "stay_identity", "contact"]>;
        reason: z.ZodString;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        reason: string;
        id: string;
        occurredAt: string;
        actorUserId: string;
        actorName: string | null;
        subjectUserId: string | null;
        subjectRef: string | null;
        dataClass: "national_id" | "id_photo" | "contract" | "stay_identity" | "contact";
    }, {
        reason: string;
        id: string;
        occurredAt: string;
        actorUserId: string;
        actorName: string | null;
        subjectUserId: string | null;
        subjectRef: string | null;
        dataClass: "national_id" | "id_photo" | "contract" | "stay_identity" | "contact";
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        reason: string;
        id: string;
        occurredAt: string;
        actorUserId: string;
        actorName: string | null;
        subjectUserId: string | null;
        subjectRef: string | null;
        dataClass: "national_id" | "id_photo" | "contract" | "stay_identity" | "contact";
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        reason: string;
        id: string;
        occurredAt: string;
        actorUserId: string;
        actorName: string | null;
        subjectUserId: string | null;
        subjectRef: string | null;
        dataClass: "national_id" | "id_photo" | "contract" | "stay_identity" | "contact";
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
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
export declare const AdminOboAuditResponse: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        eventType: z.ZodString;
        subjectType: z.ZodNullable<z.ZodEnum<["user", "org", "lease", "booking", "payment", "config", "property", "broker", "guest_stay", "training_certificate", "employee", "pay_run"]>>;
        actorUserId: z.ZodNullable<z.ZodString>;
        actorName: z.ZodNullable<z.ZodString>;
        reason: z.ZodNullable<z.ZodString>;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        reason: string | null;
        id: string;
        occurredAt: string;
        eventType: string;
        subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
        actorUserId: string | null;
        actorName: string | null;
    }, {
        reason: string | null;
        id: string;
        occurredAt: string;
        eventType: string;
        subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
        actorUserId: string | null;
        actorName: string | null;
    }>, "many">;
    accessLogs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        actorUserId: z.ZodString;
        actorName: z.ZodNullable<z.ZodString>;
        subjectUserId: z.ZodNullable<z.ZodString>;
        subjectRef: z.ZodNullable<z.ZodString>;
        dataClass: z.ZodEnum<["national_id", "id_photo", "contract", "stay_identity", "contact"]>;
        reason: z.ZodString;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        reason: string;
        id: string;
        occurredAt: string;
        actorUserId: string;
        actorName: string | null;
        subjectUserId: string | null;
        subjectRef: string | null;
        dataClass: "national_id" | "id_photo" | "contract" | "stay_identity" | "contact";
    }, {
        reason: string;
        id: string;
        occurredAt: string;
        actorUserId: string;
        actorName: string | null;
        subjectUserId: string | null;
        subjectRef: string | null;
        dataClass: "national_id" | "id_photo" | "contract" | "stay_identity" | "contact";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    events: {
        reason: string | null;
        id: string;
        occurredAt: string;
        eventType: string;
        subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
        actorUserId: string | null;
        actorName: string | null;
    }[];
    accessLogs: {
        reason: string;
        id: string;
        occurredAt: string;
        actorUserId: string;
        actorName: string | null;
        subjectUserId: string | null;
        subjectRef: string | null;
        dataClass: "national_id" | "id_photo" | "contract" | "stay_identity" | "contact";
    }[];
}, {
    events: {
        reason: string | null;
        id: string;
        occurredAt: string;
        eventType: string;
        subjectType: "broker" | "payment" | "user" | "org" | "lease" | "booking" | "config" | "property" | "guest_stay" | "training_certificate" | "employee" | "pay_run" | null;
        actorUserId: string | null;
        actorName: string | null;
    }[];
    accessLogs: {
        reason: string;
        id: string;
        occurredAt: string;
        actorUserId: string;
        actorName: string | null;
        subjectUserId: string | null;
        subjectRef: string | null;
        dataClass: "national_id" | "id_photo" | "contract" | "stay_identity" | "contact";
    }[];
}>;
export type AdminOboAuditResponse = z.infer<typeof AdminOboAuditResponse>;
/** One business a user belongs to, as it appears on their user row. */
export declare const AdminUserMembership: z.ZodObject<{
    orgId: z.ZodString;
    orgName: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence"]>;
    orgRole: z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>;
    /**
     * A property of this person's relationship to this business, not of the
     * business: an OBO registrant holds the owner role with payouts locked
     * until the real owner claims, so the lock belongs on the membership.
     */
    payoutLocked: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    domain: "hospitality" | "residence";
    orgId: string;
    payoutLocked: boolean;
    orgName: string;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
}, {
    domain: "hospitality" | "residence";
    orgId: string;
    payoutLocked: boolean;
    orgName: string;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
}>;
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
export declare const AdminOversightGrant: z.ZodObject<{
    /**
     * The assignment row. Added by ADR-053, because a grant that can be revoked
     * has to be nameable: `DELETE /admin/users/:userId/oversight/:assignmentId`
     * addresses this, and a revoke keyed on role plus scope would be guessing
     * which of two grants was meant.
     */
    id: z.ZodString;
    oversightRole: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer"]>;
    governmentBodyCode: z.ZodString;
    /** `government_bodies.name_en`, joined on the code. The words a citizen knows. */
    governmentBodyName: z.ZodNullable<z.ZodString>;
    governmentTitle: z.ZodNullable<z.ZodString>;
    scopeLevel: z.ZodEnum<["country", "province", "district"]>;
    scopeLabel: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
    governmentBodyCode: string;
    governmentTitle: string | null;
    id: string;
    governmentBodyName: string | null;
    scopeLevel: "country" | "province" | "district";
    scopeLabel: string | null;
}, {
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
    governmentBodyCode: string;
    governmentTitle: string | null;
    id: string;
    governmentBodyName: string | null;
    scopeLevel: "country" | "province" | "district";
    scopeLabel: string | null;
}>;
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
export declare const CreateOversightGrantRequest: z.ZodEffects<z.ZodObject<{
    oversightRole: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer"]>;
    governmentBodyCode: z.ZodString;
    governmentTitle: z.ZodString;
    scopeLevel: z.ZodEnum<["country", "province", "district"]>;
    provinceId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    districtId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
    governmentBodyCode: string;
    governmentTitle: string;
    scopeLevel: "country" | "province" | "district";
    provinceId?: number | null | undefined;
    districtId?: number | null | undefined;
}, {
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
    governmentBodyCode: string;
    governmentTitle: string;
    scopeLevel: "country" | "province" | "district";
    provinceId?: number | null | undefined;
    districtId?: number | null | undefined;
}>, {
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
    governmentBodyCode: string;
    governmentTitle: string;
    scopeLevel: "country" | "province" | "district";
    provinceId?: number | null | undefined;
    districtId?: number | null | undefined;
}, {
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
    governmentBodyCode: string;
    governmentTitle: string;
    scopeLevel: "country" | "province" | "district";
    provinceId?: number | null | undefined;
    districtId?: number | null | undefined;
}>;
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
export declare const AdminUserRow: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    email: z.ZodString;
    emailVerified: z.ZodBoolean;
    kyc: z.ZodEnum<["none", "pending", "verified"]>;
    phoneMasked: z.ZodNullable<z.ZodString>;
    nationalIdMasked: z.ZodNullable<z.ZodString>;
    globalRoles: z.ZodArray<z.ZodEnum<["admin", "guest", "broker", "gov_oversight"]>, "many">;
    memberships: z.ZodArray<z.ZodObject<{
        orgId: z.ZodString;
        orgName: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence"]>;
        orgRole: z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>;
        /**
         * A property of this person's relationship to this business, not of the
         * business: an OBO registrant holds the owner role with payouts locked
         * until the real owner claims, so the lock belongs on the membership.
         */
        payoutLocked: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        domain: "hospitality" | "residence";
        orgId: string;
        payoutLocked: boolean;
        orgName: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
    }, {
        domain: "hospitality" | "residence";
        orgId: string;
        payoutLocked: boolean;
        orgName: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
    }>, "many">;
    staffRoles: z.ZodArray<z.ZodEnum<["super_admin", "ops", "compliance", "finance", "trainer"]>, "many">;
    oversight: z.ZodNullable<z.ZodObject<{
        /**
         * The assignment row. Added by ADR-053, because a grant that can be revoked
         * has to be nameable: `DELETE /admin/users/:userId/oversight/:assignmentId`
         * addresses this, and a revoke keyed on role plus scope would be guessing
         * which of two grants was meant.
         */
        id: z.ZodString;
        oversightRole: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer"]>;
        governmentBodyCode: z.ZodString;
        /** `government_bodies.name_en`, joined on the code. The words a citizen knows. */
        governmentBodyName: z.ZodNullable<z.ZodString>;
        governmentTitle: z.ZodNullable<z.ZodString>;
        scopeLevel: z.ZodEnum<["country", "province", "district"]>;
        scopeLabel: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
        governmentBodyCode: string;
        governmentTitle: string | null;
        id: string;
        governmentBodyName: string | null;
        scopeLevel: "country" | "province" | "district";
        scopeLabel: string | null;
    }, {
        oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
        governmentBodyCode: string;
        governmentTitle: string | null;
        id: string;
        governmentBodyName: string | null;
        scopeLevel: "country" | "province" | "district";
        scopeLabel: string | null;
    }>>;
    twoFactorEnrolled: z.ZodBoolean;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string | null;
    email: string;
    id: string;
    createdAt: string;
    emailVerified: boolean;
    kyc: "pending" | "verified" | "none";
    phoneMasked: string | null;
    nationalIdMasked: string | null;
    globalRoles: ("broker" | "admin" | "guest" | "gov_oversight")[];
    memberships: {
        domain: "hospitality" | "residence";
        orgId: string;
        payoutLocked: boolean;
        orgName: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
    }[];
    staffRoles: ("super_admin" | "ops" | "compliance" | "finance" | "trainer")[];
    oversight: {
        oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
        governmentBodyCode: string;
        governmentTitle: string | null;
        id: string;
        governmentBodyName: string | null;
        scopeLevel: "country" | "province" | "district";
        scopeLabel: string | null;
    } | null;
    twoFactorEnrolled: boolean;
}, {
    name: string | null;
    email: string;
    id: string;
    createdAt: string;
    emailVerified: boolean;
    kyc: "pending" | "verified" | "none";
    phoneMasked: string | null;
    nationalIdMasked: string | null;
    globalRoles: ("broker" | "admin" | "guest" | "gov_oversight")[];
    memberships: {
        domain: "hospitality" | "residence";
        orgId: string;
        payoutLocked: boolean;
        orgName: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
    }[];
    staffRoles: ("super_admin" | "ops" | "compliance" | "finance" | "trainer")[];
    oversight: {
        oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
        governmentBodyCode: string;
        governmentTitle: string | null;
        id: string;
        governmentBodyName: string | null;
        scopeLevel: "country" | "province" | "district";
        scopeLabel: string | null;
    } | null;
    twoFactorEnrolled: boolean;
}>;
export type AdminUserRow = z.infer<typeof AdminUserRow>;
/** Query params for `GET /api/v1/admin/users`. */
export declare const AdminUserListQuery: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
    /** Free text over name and email. */
    q: z.ZodOptional<z.ZodString>;
    globalRole: z.ZodOptional<z.ZodEnum<["admin", "guest", "broker", "gov_oversight"]>>;
    kyc: z.ZodOptional<z.ZodEnum<["none", "pending", "verified"]>>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    pageSize?: number | undefined;
    q?: string | undefined;
    kyc?: "pending" | "verified" | "none" | undefined;
    globalRole?: "broker" | "admin" | "guest" | "gov_oversight" | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    q?: string | undefined;
    kyc?: "pending" | "verified" | "none" | undefined;
    globalRole?: "broker" | "admin" | "guest" | "gov_oversight" | undefined;
}>;
export type AdminUserListQuery = z.infer<typeof AdminUserListQuery>;
export declare const AdminUserListResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        email: z.ZodString;
        emailVerified: z.ZodBoolean;
        kyc: z.ZodEnum<["none", "pending", "verified"]>;
        phoneMasked: z.ZodNullable<z.ZodString>;
        nationalIdMasked: z.ZodNullable<z.ZodString>;
        globalRoles: z.ZodArray<z.ZodEnum<["admin", "guest", "broker", "gov_oversight"]>, "many">;
        memberships: z.ZodArray<z.ZodObject<{
            orgId: z.ZodString;
            orgName: z.ZodString;
            domain: z.ZodEnum<["hospitality", "residence"]>;
            orgRole: z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>;
            /**
             * A property of this person's relationship to this business, not of the
             * business: an OBO registrant holds the owner role with payouts locked
             * until the real owner claims, so the lock belongs on the membership.
             */
            payoutLocked: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            domain: "hospitality" | "residence";
            orgId: string;
            payoutLocked: boolean;
            orgName: string;
            orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        }, {
            domain: "hospitality" | "residence";
            orgId: string;
            payoutLocked: boolean;
            orgName: string;
            orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        }>, "many">;
        staffRoles: z.ZodArray<z.ZodEnum<["super_admin", "ops", "compliance", "finance", "trainer"]>, "many">;
        oversight: z.ZodNullable<z.ZodObject<{
            /**
             * The assignment row. Added by ADR-053, because a grant that can be revoked
             * has to be nameable: `DELETE /admin/users/:userId/oversight/:assignmentId`
             * addresses this, and a revoke keyed on role plus scope would be guessing
             * which of two grants was meant.
             */
            id: z.ZodString;
            oversightRole: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer"]>;
            governmentBodyCode: z.ZodString;
            /** `government_bodies.name_en`, joined on the code. The words a citizen knows. */
            governmentBodyName: z.ZodNullable<z.ZodString>;
            governmentTitle: z.ZodNullable<z.ZodString>;
            scopeLevel: z.ZodEnum<["country", "province", "district"]>;
            scopeLabel: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
            governmentBodyCode: string;
            governmentTitle: string | null;
            id: string;
            governmentBodyName: string | null;
            scopeLevel: "country" | "province" | "district";
            scopeLabel: string | null;
        }, {
            oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
            governmentBodyCode: string;
            governmentTitle: string | null;
            id: string;
            governmentBodyName: string | null;
            scopeLevel: "country" | "province" | "district";
            scopeLabel: string | null;
        }>>;
        twoFactorEnrolled: z.ZodBoolean;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        email: string;
        id: string;
        createdAt: string;
        emailVerified: boolean;
        kyc: "pending" | "verified" | "none";
        phoneMasked: string | null;
        nationalIdMasked: string | null;
        globalRoles: ("broker" | "admin" | "guest" | "gov_oversight")[];
        memberships: {
            domain: "hospitality" | "residence";
            orgId: string;
            payoutLocked: boolean;
            orgName: string;
            orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        }[];
        staffRoles: ("super_admin" | "ops" | "compliance" | "finance" | "trainer")[];
        oversight: {
            oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
            governmentBodyCode: string;
            governmentTitle: string | null;
            id: string;
            governmentBodyName: string | null;
            scopeLevel: "country" | "province" | "district";
            scopeLabel: string | null;
        } | null;
        twoFactorEnrolled: boolean;
    }, {
        name: string | null;
        email: string;
        id: string;
        createdAt: string;
        emailVerified: boolean;
        kyc: "pending" | "verified" | "none";
        phoneMasked: string | null;
        nationalIdMasked: string | null;
        globalRoles: ("broker" | "admin" | "guest" | "gov_oversight")[];
        memberships: {
            domain: "hospitality" | "residence";
            orgId: string;
            payoutLocked: boolean;
            orgName: string;
            orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        }[];
        staffRoles: ("super_admin" | "ops" | "compliance" | "finance" | "trainer")[];
        oversight: {
            oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
            governmentBodyCode: string;
            governmentTitle: string | null;
            id: string;
            governmentBodyName: string | null;
            scopeLevel: "country" | "province" | "district";
            scopeLabel: string | null;
        } | null;
        twoFactorEnrolled: boolean;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        name: string | null;
        email: string;
        id: string;
        createdAt: string;
        emailVerified: boolean;
        kyc: "pending" | "verified" | "none";
        phoneMasked: string | null;
        nationalIdMasked: string | null;
        globalRoles: ("broker" | "admin" | "guest" | "gov_oversight")[];
        memberships: {
            domain: "hospitality" | "residence";
            orgId: string;
            payoutLocked: boolean;
            orgName: string;
            orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        }[];
        staffRoles: ("super_admin" | "ops" | "compliance" | "finance" | "trainer")[];
        oversight: {
            oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
            governmentBodyCode: string;
            governmentTitle: string | null;
            id: string;
            governmentBodyName: string | null;
            scopeLevel: "country" | "province" | "district";
            scopeLabel: string | null;
        } | null;
        twoFactorEnrolled: boolean;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        name: string | null;
        email: string;
        id: string;
        createdAt: string;
        emailVerified: boolean;
        kyc: "pending" | "verified" | "none";
        phoneMasked: string | null;
        nationalIdMasked: string | null;
        globalRoles: ("broker" | "admin" | "guest" | "gov_oversight")[];
        memberships: {
            domain: "hospitality" | "residence";
            orgId: string;
            payoutLocked: boolean;
            orgName: string;
            orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        }[];
        staffRoles: ("super_admin" | "ops" | "compliance" | "finance" | "trainer")[];
        oversight: {
            oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
            governmentBodyCode: string;
            governmentTitle: string | null;
            id: string;
            governmentBodyName: string | null;
            scopeLevel: "country" | "province" | "district";
            scopeLabel: string | null;
        } | null;
        twoFactorEnrolled: boolean;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
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
export declare const AdminUnclaimedStay: z.ZodObject<{
    stayId: z.ZodString;
    reference: z.ZodString;
    propertyName: z.ZodNullable<z.ZodString>;
    guestName: z.ZodNullable<z.ZodString>;
    checkOutAt: z.ZodNullable<z.ZodString>;
    identityState: z.ZodEnum<["none", "captured", "verified"]>;
}, "strip", z.ZodTypeAny, {
    stayId: string;
    reference: string;
    propertyName: string | null;
    guestName: string | null;
    checkOutAt: string | null;
    identityState: "verified" | "none" | "captured";
}, {
    stayId: string;
    reference: string;
    propertyName: string | null;
    guestName: string | null;
    checkOutAt: string | null;
    identityState: "verified" | "none" | "captured";
}>;
export type AdminUnclaimedStay = z.infer<typeof AdminUnclaimedStay>;
export declare const AdminUnclaimedStaysResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        stayId: z.ZodString;
        reference: z.ZodString;
        propertyName: z.ZodNullable<z.ZodString>;
        guestName: z.ZodNullable<z.ZodString>;
        checkOutAt: z.ZodNullable<z.ZodString>;
        identityState: z.ZodEnum<["none", "captured", "verified"]>;
    }, "strip", z.ZodTypeAny, {
        stayId: string;
        reference: string;
        propertyName: string | null;
        guestName: string | null;
        checkOutAt: string | null;
        identityState: "verified" | "none" | "captured";
    }, {
        stayId: string;
        reference: string;
        propertyName: string | null;
        guestName: string | null;
        checkOutAt: string | null;
        identityState: "verified" | "none" | "captured";
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        stayId: string;
        reference: string;
        propertyName: string | null;
        guestName: string | null;
        checkOutAt: string | null;
        identityState: "verified" | "none" | "captured";
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        stayId: string;
        reference: string;
        propertyName: string | null;
        guestName: string | null;
        checkOutAt: string | null;
        identityState: "verified" | "none" | "captured";
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminUnclaimedStaysResponse = z.infer<typeof AdminUnclaimedStaysResponse>;
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
export declare const AdminBrokerRow: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    phoneMasked: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["active", "suspended"]>;
    /** Signed: a ledger with more spends than grants is a real, visible state. */
    revealCreditBalance: z.ZodNumber;
    revealCount: z.ZodNumber;
    placementCount: z.ZodNumber;
    placementFeesRwf: z.ZodNumber;
    currency: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "active" | "suspended";
    name: string | null;
    email: string | null;
    currency: string;
    id: string;
    createdAt: string;
    userId: string;
    phoneMasked: string | null;
    revealCreditBalance: number;
    revealCount: number;
    placementCount: number;
    placementFeesRwf: number;
}, {
    status: "active" | "suspended";
    name: string | null;
    email: string | null;
    currency: string;
    id: string;
    createdAt: string;
    userId: string;
    phoneMasked: string | null;
    revealCreditBalance: number;
    revealCount: number;
    placementCount: number;
    placementFeesRwf: number;
}>;
export type AdminBrokerRow = z.infer<typeof AdminBrokerRow>;
export declare const AdminBrokerListResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
        phoneMasked: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["active", "suspended"]>;
        /** Signed: a ledger with more spends than grants is a real, visible state. */
        revealCreditBalance: z.ZodNumber;
        revealCount: z.ZodNumber;
        placementCount: z.ZodNumber;
        placementFeesRwf: z.ZodNumber;
        currency: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "suspended";
        name: string | null;
        email: string | null;
        currency: string;
        id: string;
        createdAt: string;
        userId: string;
        phoneMasked: string | null;
        revealCreditBalance: number;
        revealCount: number;
        placementCount: number;
        placementFeesRwf: number;
    }, {
        status: "active" | "suspended";
        name: string | null;
        email: string | null;
        currency: string;
        id: string;
        createdAt: string;
        userId: string;
        phoneMasked: string | null;
        revealCreditBalance: number;
        revealCount: number;
        placementCount: number;
        placementFeesRwf: number;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "active" | "suspended";
        name: string | null;
        email: string | null;
        currency: string;
        id: string;
        createdAt: string;
        userId: string;
        phoneMasked: string | null;
        revealCreditBalance: number;
        revealCount: number;
        placementCount: number;
        placementFeesRwf: number;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        status: "active" | "suspended";
        name: string | null;
        email: string | null;
        currency: string;
        id: string;
        createdAt: string;
        userId: string;
        phoneMasked: string | null;
        revealCreditBalance: number;
        revealCount: number;
        placementCount: number;
        placementFeesRwf: number;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminBrokerListResponse = z.infer<typeof AdminBrokerListResponse>;
/**
 * One contact reveal: a broker spent a credit to see a landlord's number.
 *
 * The revealed phone and email are on the table and are NOT on this row. The
 * point of the audit is that a reveal HAPPENED, by whom and against which
 * listing — replaying the contact details into an admin list would hand every
 * staff member the directory the credit system exists to meter.
 */
export declare const AdminRevealEvent: z.ZodObject<{
    id: z.ZodString;
    brokerId: z.ZodString;
    brokerName: z.ZodNullable<z.ZodString>;
    listingId: z.ZodNullable<z.ZodString>;
    landlordOrgId: z.ZodNullable<z.ZodString>;
    landlordOrgName: z.ZodNullable<z.ZodString>;
    districtName: z.ZodNullable<z.ZodString>;
    revealedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    districtName: string | null;
    brokerId: string;
    id: string;
    brokerName: string | null;
    listingId: string | null;
    landlordOrgId: string | null;
    landlordOrgName: string | null;
    revealedAt: string;
}, {
    districtName: string | null;
    brokerId: string;
    id: string;
    brokerName: string | null;
    listingId: string | null;
    landlordOrgId: string | null;
    landlordOrgName: string | null;
    revealedAt: string;
}>;
export type AdminRevealEvent = z.infer<typeof AdminRevealEvent>;
export declare const AdminRevealListResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        brokerId: z.ZodString;
        brokerName: z.ZodNullable<z.ZodString>;
        listingId: z.ZodNullable<z.ZodString>;
        landlordOrgId: z.ZodNullable<z.ZodString>;
        landlordOrgName: z.ZodNullable<z.ZodString>;
        districtName: z.ZodNullable<z.ZodString>;
        revealedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        districtName: string | null;
        brokerId: string;
        id: string;
        brokerName: string | null;
        listingId: string | null;
        landlordOrgId: string | null;
        landlordOrgName: string | null;
        revealedAt: string;
    }, {
        districtName: string | null;
        brokerId: string;
        id: string;
        brokerName: string | null;
        listingId: string | null;
        landlordOrgId: string | null;
        landlordOrgName: string | null;
        revealedAt: string;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        districtName: string | null;
        brokerId: string;
        id: string;
        brokerName: string | null;
        listingId: string | null;
        landlordOrgId: string | null;
        landlordOrgName: string | null;
        revealedAt: string;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        districtName: string | null;
        brokerId: string;
        id: string;
        brokerName: string | null;
        listingId: string | null;
        landlordOrgId: string | null;
        landlordOrgName: string | null;
        revealedAt: string;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminRevealListResponse = z.infer<typeof AdminRevealListResponse>;
export declare const AdminLedgerResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        transactionId: z.ZodString;
        kind: z.ZodEnum<["capture", "refund", "forfeiture", "payout", "rent_settle", "caution_settle", "placement_disburse", "subscription_charge", "override", "chargeback", "folio_post", "folio_settle"]>;
        adapterMode: z.ZodEnum<["mock", "live"]>;
        memo: z.ZodNullable<z.ZodString>;
        accountCode: z.ZodString;
        direction: z.ZodEnum<["debit", "credit"]>;
        amountRwf: z.ZodNumber;
        currency: z.ZodString;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "capture" | "refund" | "forfeiture" | "payout" | "rent_settle" | "caution_settle" | "placement_disburse" | "subscription_charge" | "override" | "chargeback" | "folio_post" | "folio_settle";
        adapterMode: "mock" | "live";
        amountRwf: number;
        currency: string;
        id: string;
        transactionId: string;
        memo: string | null;
        accountCode: string;
        direction: "debit" | "credit";
        occurredAt: string;
    }, {
        kind: "capture" | "refund" | "forfeiture" | "payout" | "rent_settle" | "caution_settle" | "placement_disburse" | "subscription_charge" | "override" | "chargeback" | "folio_post" | "folio_settle";
        adapterMode: "mock" | "live";
        amountRwf: number;
        currency: string;
        id: string;
        transactionId: string;
        memo: string | null;
        accountCode: string;
        direction: "debit" | "credit";
        occurredAt: string;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        kind: "capture" | "refund" | "forfeiture" | "payout" | "rent_settle" | "caution_settle" | "placement_disburse" | "subscription_charge" | "override" | "chargeback" | "folio_post" | "folio_settle";
        adapterMode: "mock" | "live";
        amountRwf: number;
        currency: string;
        id: string;
        transactionId: string;
        memo: string | null;
        accountCode: string;
        direction: "debit" | "credit";
        occurredAt: string;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        kind: "capture" | "refund" | "forfeiture" | "payout" | "rent_settle" | "caution_settle" | "placement_disburse" | "subscription_charge" | "override" | "chargeback" | "folio_post" | "folio_settle";
        adapterMode: "mock" | "live";
        amountRwf: number;
        currency: string;
        id: string;
        transactionId: string;
        memo: string | null;
        accountCode: string;
        direction: "debit" | "credit";
        occurredAt: string;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminLedgerResponse = z.infer<typeof AdminLedgerResponse>;
/** Query params for `GET /api/v1/admin/finance/payouts`. */
export declare const AdminPayoutQuery: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["scheduled", "queued", "paid", "held"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "paid" | "scheduled" | "queued" | "held" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}, {
    status?: "paid" | "scheduled" | "queued" | "held" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type AdminPayoutQuery = z.infer<typeof AdminPayoutQuery>;
export declare const AdminPayoutResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodNullable<z.ZodString>;
        amountRwf: z.ZodNumber;
        currency: z.ZodString;
        status: z.ZodEnum<["scheduled", "queued", "paid", "held"]>;
        failureReason: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        settledAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "paid" | "scheduled" | "queued" | "held";
        workspaceId: string | null;
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        failureReason: string | null;
        settledAt: string | null;
    }, {
        status: "paid" | "scheduled" | "queued" | "held";
        workspaceId: string | null;
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        failureReason: string | null;
        settledAt: string | null;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "paid" | "scheduled" | "queued" | "held";
        workspaceId: string | null;
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        failureReason: string | null;
        settledAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        status: "paid" | "scheduled" | "queued" | "held";
        workspaceId: string | null;
        amountRwf: number;
        currency: string;
        id: string;
        createdAt: string;
        failureReason: string | null;
        settledAt: string | null;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminPayoutResponse = z.infer<typeof AdminPayoutResponse>;
/**
 * A `subscription_invoices` row that came back `failed`.
 *
 * Its own schema rather than a filtered `AdminInvoice[]` because the question
 * differs: a failed charge is answered by contacting a business, so the org's
 * identity travels with the row, whereas `AdminInvoice` is only ever read with
 * an org already on screen.
 */
export declare const AdminFailedCharge: z.ZodObject<{
    invoiceId: z.ZodString;
    orgId: z.ZodString;
    orgName: z.ZodString;
    invoiceKind: z.ZodEnum<["registration_fee", "subscription"]>;
    amountRwf: z.ZodNumber;
    currency: z.ZodString;
    status: z.ZodEnum<["pending", "paid", "failed"]>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "failed" | "paid";
    orgId: string;
    invoiceId: string;
    amountRwf: number;
    currency: string;
    createdAt: string;
    orgName: string;
    invoiceKind: "registration_fee" | "subscription";
}, {
    status: "pending" | "failed" | "paid";
    orgId: string;
    invoiceId: string;
    amountRwf: number;
    currency: string;
    createdAt: string;
    orgName: string;
    invoiceKind: "registration_fee" | "subscription";
}>;
export type AdminFailedCharge = z.infer<typeof AdminFailedCharge>;
export declare const AdminFailedChargeResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        invoiceId: z.ZodString;
        orgId: z.ZodString;
        orgName: z.ZodString;
        invoiceKind: z.ZodEnum<["registration_fee", "subscription"]>;
        amountRwf: z.ZodNumber;
        currency: z.ZodString;
        status: z.ZodEnum<["pending", "paid", "failed"]>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "failed" | "paid";
        orgId: string;
        invoiceId: string;
        amountRwf: number;
        currency: string;
        createdAt: string;
        orgName: string;
        invoiceKind: "registration_fee" | "subscription";
    }, {
        status: "pending" | "failed" | "paid";
        orgId: string;
        invoiceId: string;
        amountRwf: number;
        currency: string;
        createdAt: string;
        orgName: string;
        invoiceKind: "registration_fee" | "subscription";
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "pending" | "failed" | "paid";
        orgId: string;
        invoiceId: string;
        amountRwf: number;
        currency: string;
        createdAt: string;
        orgName: string;
        invoiceKind: "registration_fee" | "subscription";
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        status: "pending" | "failed" | "paid";
        orgId: string;
        invoiceId: string;
        amountRwf: number;
        currency: string;
        createdAt: string;
        orgName: string;
        invoiceKind: "registration_fee" | "subscription";
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminFailedChargeResponse = z.infer<typeof AdminFailedChargeResponse>;
/**
 * One reconciliation run.
 *
 * The window and the three counts are read out of the run's `report` jsonb;
 * `reconciliation_runs` itself stores only status, report, adapter mode and
 * `ran_at`. They are flattened onto the wire rather than passed through as
 * opaque JSON because a console that reaches into an untyped blob to render a
 * number breaks silently the day the report's shape changes.
 */
export declare const AdminReconRun: z.ZodObject<{
    id: z.ZodString;
    windowStart: z.ZodNullable<z.ZodString>;
    windowEnd: z.ZodNullable<z.ZodString>;
    entryCount: z.ZodNumber;
    matchedCount: z.ZodNumber;
    discrepancyCount: z.ZodNumber;
    ranAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    windowStart: string | null;
    windowEnd: string | null;
    entryCount: number;
    matchedCount: number;
    discrepancyCount: number;
    ranAt: string;
}, {
    id: string;
    windowStart: string | null;
    windowEnd: string | null;
    entryCount: number;
    matchedCount: number;
    discrepancyCount: number;
    ranAt: string;
}>;
export type AdminReconRun = z.infer<typeof AdminReconRun>;
export declare const AdminReconRunResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        windowStart: z.ZodNullable<z.ZodString>;
        windowEnd: z.ZodNullable<z.ZodString>;
        entryCount: z.ZodNumber;
        matchedCount: z.ZodNumber;
        discrepancyCount: z.ZodNumber;
        ranAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        windowStart: string | null;
        windowEnd: string | null;
        entryCount: number;
        matchedCount: number;
        discrepancyCount: number;
        ranAt: string;
    }, {
        id: string;
        windowStart: string | null;
        windowEnd: string | null;
        entryCount: number;
        matchedCount: number;
        discrepancyCount: number;
        ranAt: string;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        windowStart: string | null;
        windowEnd: string | null;
        entryCount: number;
        matchedCount: number;
        discrepancyCount: number;
        ranAt: string;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        id: string;
        windowStart: string | null;
        windowEnd: string | null;
        entryCount: number;
        matchedCount: number;
        discrepancyCount: number;
        ranAt: string;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminReconRunResponse = z.infer<typeof AdminReconRunResponse>;
/**
 * One versioned platform setting.
 *
 * `value` is `unknown` because the column is `jsonb` and its shape differs per
 * `configType`; the console renders an editor rather than pretending to know.
 * `lockedOnUse` and `reversible` are the two facts that decide whether an edit
 * is even offered — a setting a live booking already priced against cannot be
 * changed retroactively, only superseded by a new effective-dated row.
 */
export declare const AdminConfigEntry: z.ZodObject<{
    id: z.ZodString;
    configType: z.ZodString;
    value: z.ZodUnknown;
    version: z.ZodNumber;
    effectiveFrom: z.ZodString;
    effectiveTo: z.ZodNullable<z.ZodString>;
    lockedOnUse: z.ZodBoolean;
    reversible: z.ZodBoolean;
    lastActorUserId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    configType: string;
    version: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    lockedOnUse: boolean;
    reversible: boolean;
    lastActorUserId: string | null;
    value?: unknown;
}, {
    id: string;
    configType: string;
    version: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    lockedOnUse: boolean;
    reversible: boolean;
    lastActorUserId: string | null;
    value?: unknown;
}>;
export type AdminConfigEntry = z.infer<typeof AdminConfigEntry>;
/**
 * One feature flag. `districtId` is non-null exactly when `scope` is
 * `district`, which is what lets the registration pipeline's oversight gates be
 * blocking in one district and advisory in another with no schema change.
 */
export declare const AdminFeatureFlag: z.ZodObject<{
    id: z.ZodString;
    key: z.ZodString;
    value: z.ZodUnknown;
    scope: z.ZodEnum<["global", "district"]>;
    districtId: z.ZodNullable<z.ZodNumber>;
    districtName: z.ZodNullable<z.ZodString>;
    effectiveFrom: z.ZodString;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    districtId: number | null;
    districtName: string | null;
    id: string;
    key: string;
    version: number;
    effectiveFrom: string;
    scope: "district" | "global";
    value?: unknown;
}, {
    districtId: number | null;
    districtName: string | null;
    id: string;
    key: string;
    version: number;
    effectiveFrom: string;
    scope: "district" | "global";
    value?: unknown;
}>;
export type AdminFeatureFlag = z.infer<typeof AdminFeatureFlag>;
export declare const AdminConfiguration: z.ZodObject<{
    entries: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        configType: z.ZodString;
        value: z.ZodUnknown;
        version: z.ZodNumber;
        effectiveFrom: z.ZodString;
        effectiveTo: z.ZodNullable<z.ZodString>;
        lockedOnUse: z.ZodBoolean;
        reversible: z.ZodBoolean;
        lastActorUserId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        configType: string;
        version: number;
        effectiveFrom: string;
        effectiveTo: string | null;
        lockedOnUse: boolean;
        reversible: boolean;
        lastActorUserId: string | null;
        value?: unknown;
    }, {
        id: string;
        configType: string;
        version: number;
        effectiveFrom: string;
        effectiveTo: string | null;
        lockedOnUse: boolean;
        reversible: boolean;
        lastActorUserId: string | null;
        value?: unknown;
    }>, "many">;
    flags: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        value: z.ZodUnknown;
        scope: z.ZodEnum<["global", "district"]>;
        districtId: z.ZodNullable<z.ZodNumber>;
        districtName: z.ZodNullable<z.ZodString>;
        effectiveFrom: z.ZodString;
        version: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        districtId: number | null;
        districtName: string | null;
        id: string;
        key: string;
        version: number;
        effectiveFrom: string;
        scope: "district" | "global";
        value?: unknown;
    }, {
        districtId: number | null;
        districtName: string | null;
        id: string;
        key: string;
        version: number;
        effectiveFrom: string;
        scope: "district" | "global";
        value?: unknown;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    entries: {
        id: string;
        configType: string;
        version: number;
        effectiveFrom: string;
        effectiveTo: string | null;
        lockedOnUse: boolean;
        reversible: boolean;
        lastActorUserId: string | null;
        value?: unknown;
    }[];
    flags: {
        districtId: number | null;
        districtName: string | null;
        id: string;
        key: string;
        version: number;
        effectiveFrom: string;
        scope: "district" | "global";
        value?: unknown;
    }[];
}, {
    entries: {
        id: string;
        configType: string;
        version: number;
        effectiveFrom: string;
        effectiveTo: string | null;
        lockedOnUse: boolean;
        reversible: boolean;
        lastActorUserId: string | null;
        value?: unknown;
    }[];
    flags: {
        districtId: number | null;
        districtName: string | null;
        id: string;
        key: string;
        version: number;
        effectiveFrom: string;
        scope: "district" | "global";
        value?: unknown;
    }[];
}>;
export type AdminConfiguration = z.infer<typeof AdminConfiguration>;
/**
 * One row of the one-time registration fee catalog.
 *
 * Effective-dated and never destructive: changing a fee INSERTS a row, and the
 * charged amount is locked onto the invoice at charge time, so a price change
 * can never rewrite what somebody already paid. That is why `effectiveFrom` is
 * NOT NULL here while the two config tables above allow it to be absent.
 */
export declare const AdminRegistrationFee: z.ZodObject<{
    id: z.ZodString;
    businessType: z.ZodEnum<["hospitality", "residence", "broker"]>;
    amountRwf: z.ZodNumber;
    currency: z.ZodString;
    effectiveFrom: z.ZodString;
    active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    active: boolean;
    businessType: "hospitality" | "residence" | "broker";
    amountRwf: number;
    currency: string;
    id: string;
    effectiveFrom: string;
}, {
    active: boolean;
    businessType: "hospitality" | "residence" | "broker";
    amountRwf: number;
    currency: string;
    id: string;
    effectiveFrom: string;
}>;
export type AdminRegistrationFee = z.infer<typeof AdminRegistrationFee>;
/**
 * One subscription plan. `roomCountLimit` is null for an unlimited plan, which
 * is a different statement from a limit of zero. `featureSet` is deliberately
 * absent: it is `jsonb` the billing code reads, not something a staff member
 * administers from a catalog list.
 */
export declare const AdminSubscriptionPlan: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    name: z.ZodString;
    tier: z.ZodNullable<z.ZodNumber>;
    priceRwf: z.ZodNumber;
    currency: z.ZodString;
    billingPeriod: z.ZodEnum<["monthly"]>;
    roomCountLimit: z.ZodNullable<z.ZodNumber>;
    effectiveFrom: z.ZodNullable<z.ZodString>;
    active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    code: string;
    active: boolean;
    name: string;
    currency: string;
    id: string;
    effectiveFrom: string | null;
    tier: number | null;
    priceRwf: number;
    billingPeriod: "monthly";
    roomCountLimit: number | null;
}, {
    code: string;
    active: boolean;
    name: string;
    currency: string;
    id: string;
    effectiveFrom: string | null;
    tier: number | null;
    priceRwf: number;
    billingPeriod: "monthly";
    roomCountLimit: number | null;
}>;
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
export declare const AdminFeeSchedule: z.ZodObject<{
    registrationFees: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        businessType: z.ZodEnum<["hospitality", "residence", "broker"]>;
        amountRwf: z.ZodNumber;
        currency: z.ZodString;
        effectiveFrom: z.ZodString;
        active: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        active: boolean;
        businessType: "hospitality" | "residence" | "broker";
        amountRwf: number;
        currency: string;
        id: string;
        effectiveFrom: string;
    }, {
        active: boolean;
        businessType: "hospitality" | "residence" | "broker";
        amountRwf: number;
        currency: string;
        id: string;
        effectiveFrom: string;
    }>, "many">;
    subscriptionPlans: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        code: z.ZodString;
        name: z.ZodString;
        tier: z.ZodNullable<z.ZodNumber>;
        priceRwf: z.ZodNumber;
        currency: z.ZodString;
        billingPeriod: z.ZodEnum<["monthly"]>;
        roomCountLimit: z.ZodNullable<z.ZodNumber>;
        effectiveFrom: z.ZodNullable<z.ZodString>;
        active: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        code: string;
        active: boolean;
        name: string;
        currency: string;
        id: string;
        effectiveFrom: string | null;
        tier: number | null;
        priceRwf: number;
        billingPeriod: "monthly";
        roomCountLimit: number | null;
    }, {
        code: string;
        active: boolean;
        name: string;
        currency: string;
        id: string;
        effectiveFrom: string | null;
        tier: number | null;
        priceRwf: number;
        billingPeriod: "monthly";
        roomCountLimit: number | null;
    }>, "many">;
    placementFeeSummary: z.ZodObject<{
        pendingCount: z.ZodNumber;
        pendingRwf: z.ZodNumber;
        paidCount: z.ZodNumber;
        paidRwf: z.ZodNumber;
        currency: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        currency: string;
        pendingCount: number;
        pendingRwf: number;
        paidCount: number;
        paidRwf: number;
    }, {
        currency: string;
        pendingCount: number;
        pendingRwf: number;
        paidCount: number;
        paidRwf: number;
    }>;
}, "strip", z.ZodTypeAny, {
    registrationFees: {
        active: boolean;
        businessType: "hospitality" | "residence" | "broker";
        amountRwf: number;
        currency: string;
        id: string;
        effectiveFrom: string;
    }[];
    subscriptionPlans: {
        code: string;
        active: boolean;
        name: string;
        currency: string;
        id: string;
        effectiveFrom: string | null;
        tier: number | null;
        priceRwf: number;
        billingPeriod: "monthly";
        roomCountLimit: number | null;
    }[];
    placementFeeSummary: {
        currency: string;
        pendingCount: number;
        pendingRwf: number;
        paidCount: number;
        paidRwf: number;
    };
}, {
    registrationFees: {
        active: boolean;
        businessType: "hospitality" | "residence" | "broker";
        amountRwf: number;
        currency: string;
        id: string;
        effectiveFrom: string;
    }[];
    subscriptionPlans: {
        code: string;
        active: boolean;
        name: string;
        currency: string;
        id: string;
        effectiveFrom: string | null;
        tier: number | null;
        priceRwf: number;
        billingPeriod: "monthly";
        roomCountLimit: number | null;
    }[];
    placementFeeSummary: {
        currency: string;
        pendingCount: number;
        pendingRwf: number;
        paidCount: number;
        paidRwf: number;
    };
}>;
export type AdminFeeSchedule = z.infer<typeof AdminFeeSchedule>;
/**
 * One compliance artifact. The `details` jsonb is deliberately absent: it holds
 * the document itself, and this screen answers "does the artifact exist and is
 * its review overdue", which `reviewDueAt` answers on its own.
 */
export declare const AdminComplianceArtifact: z.ZodObject<{
    id: z.ZodString;
    artifactType: z.ZodEnum<["ncsa_registration", "dpo_of_record", "dpia", "processor_inventory_entry"]>;
    processorName: z.ZodNullable<z.ZodString>;
    reviewDueAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    artifactType: "ncsa_registration" | "dpo_of_record" | "dpia" | "processor_inventory_entry";
    processorName: string | null;
    reviewDueAt: string | null;
}, {
    id: string;
    createdAt: string;
    artifactType: "ncsa_registration" | "dpo_of_record" | "dpia" | "processor_inventory_entry";
    processorName: string | null;
    reviewDueAt: string | null;
}>;
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
export declare const AdminDsrRow: z.ZodObject<{
    id: z.ZodString;
    subjectUserId: z.ZodNullable<z.ZodString>;
    requestType: z.ZodEnum<["access", "correction", "deletion"]>;
    state: z.ZodEnum<["received", "fulfilled"]>;
    retentionExceptionApplied: z.ZodBoolean;
    dualAuthorized: z.ZodBoolean;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    subjectUserId: string | null;
    requestType: "access" | "correction" | "deletion";
    state: "received" | "fulfilled";
    retentionExceptionApplied: boolean;
    dualAuthorized: boolean;
}, {
    id: string;
    createdAt: string;
    subjectUserId: string | null;
    requestType: "access" | "correction" | "deletion";
    state: "received" | "fulfilled";
    retentionExceptionApplied: boolean;
    dualAuthorized: boolean;
}>;
export type AdminDsrRow = z.infer<typeof AdminDsrRow>;
export declare const AdminCompliance: z.ZodObject<{
    artifacts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        artifactType: z.ZodEnum<["ncsa_registration", "dpo_of_record", "dpia", "processor_inventory_entry"]>;
        processorName: z.ZodNullable<z.ZodString>;
        reviewDueAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        artifactType: "ncsa_registration" | "dpo_of_record" | "dpia" | "processor_inventory_entry";
        processorName: string | null;
        reviewDueAt: string | null;
    }, {
        id: string;
        createdAt: string;
        artifactType: "ncsa_registration" | "dpo_of_record" | "dpia" | "processor_inventory_entry";
        processorName: string | null;
        reviewDueAt: string | null;
    }>, "many">;
    requests: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        subjectUserId: z.ZodNullable<z.ZodString>;
        requestType: z.ZodEnum<["access", "correction", "deletion"]>;
        state: z.ZodEnum<["received", "fulfilled"]>;
        retentionExceptionApplied: z.ZodBoolean;
        dualAuthorized: z.ZodBoolean;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        subjectUserId: string | null;
        requestType: "access" | "correction" | "deletion";
        state: "received" | "fulfilled";
        retentionExceptionApplied: boolean;
        dualAuthorized: boolean;
    }, {
        id: string;
        createdAt: string;
        subjectUserId: string | null;
        requestType: "access" | "correction" | "deletion";
        state: "received" | "fulfilled";
        retentionExceptionApplied: boolean;
        dualAuthorized: boolean;
    }>, "many">;
    stats: z.ZodObject<{
        openRequests: z.ZodNumber;
        overdueReviews: z.ZodNumber;
        artifactCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        openRequests: number;
        overdueReviews: number;
        artifactCount: number;
    }, {
        openRequests: number;
        overdueReviews: number;
        artifactCount: number;
    }>;
}, "strip", z.ZodTypeAny, {
    artifacts: {
        id: string;
        createdAt: string;
        artifactType: "ncsa_registration" | "dpo_of_record" | "dpia" | "processor_inventory_entry";
        processorName: string | null;
        reviewDueAt: string | null;
    }[];
    requests: {
        id: string;
        createdAt: string;
        subjectUserId: string | null;
        requestType: "access" | "correction" | "deletion";
        state: "received" | "fulfilled";
        retentionExceptionApplied: boolean;
        dualAuthorized: boolean;
    }[];
    stats: {
        openRequests: number;
        overdueReviews: number;
        artifactCount: number;
    };
}, {
    artifacts: {
        id: string;
        createdAt: string;
        artifactType: "ncsa_registration" | "dpo_of_record" | "dpia" | "processor_inventory_entry";
        processorName: string | null;
        reviewDueAt: string | null;
    }[];
    requests: {
        id: string;
        createdAt: string;
        subjectUserId: string | null;
        requestType: "access" | "correction" | "deletion";
        state: "received" | "fulfilled";
        retentionExceptionApplied: boolean;
        dualAuthorized: boolean;
    }[];
    stats: {
        openRequests: number;
        overdueReviews: number;
        artifactCount: number;
    };
}>;
export type AdminCompliance = z.infer<typeof AdminCompliance>;
/**
 * `GET /api/v1/admin/system-health`.
 *
 * `database.reachable` is answered by actually asking the database, not by
 * whether the process booted: a pool that has lost its connection still holds a
 * configuration that looks fine. `migrationsApplied` is nullable because it is
 * unanswerable when the database is unreachable, and a 0 there would read as
 * "no migration has ever run", which is a far worse thing to say.
 */
export declare const AdminSystemHealth: z.ZodObject<{
    adapters: z.ZodArray<z.ZodObject<{
        adapter: z.ZodEnum<["payment", "ebm_vsdc", "rra_tin", "filing", "mailer", "maps"]>;
        mode: z.ZodEnum<["mock", "live"]>;
        status: z.ZodEnum<["up", "degraded", "down"]>;
        errorRate: z.ZodNullable<z.ZodNumber>;
        latencyMs: z.ZodNullable<z.ZodNumber>;
        observedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "up" | "degraded" | "down";
        adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
        mode: "mock" | "live";
        errorRate: number | null;
        latencyMs: number | null;
        observedAt: string;
    }, {
        status: "up" | "degraded" | "down";
        adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
        mode: "mock" | "live";
        errorRate: number | null;
        latencyMs: number | null;
        observedAt: string;
    }>, "many">;
    queues: z.ZodArray<z.ZodObject<{
        queue: z.ZodString;
        depth: z.ZodNumber;
        failed: z.ZodNumber;
        deadLetter: z.ZodNumber;
        throughput: z.ZodNumber;
        observedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        failed: number;
        observedAt: string;
        queue: string;
        depth: number;
        deadLetter: number;
        throughput: number;
    }, {
        failed: number;
        observedAt: string;
        queue: string;
        depth: number;
        deadLetter: number;
        throughput: number;
    }>, "many">;
    database: z.ZodObject<{
        reachable: z.ZodBoolean;
        migrationsApplied: z.ZodNullable<z.ZodNumber>;
        latencyMs: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        latencyMs: number | null;
        reachable: boolean;
        migrationsApplied: number | null;
    }, {
        latencyMs: number | null;
        reachable: boolean;
        migrationsApplied: number | null;
    }>;
    process: z.ZodObject<{
        nodeVersion: z.ZodString;
        uptimeSeconds: z.ZodNumber;
        environment: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        nodeVersion: string;
        uptimeSeconds: number;
        environment: string;
    }, {
        nodeVersion: string;
        uptimeSeconds: number;
        environment: string;
    }>;
}, "strip", z.ZodTypeAny, {
    adapters: {
        status: "up" | "degraded" | "down";
        adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
        mode: "mock" | "live";
        errorRate: number | null;
        latencyMs: number | null;
        observedAt: string;
    }[];
    queues: {
        failed: number;
        observedAt: string;
        queue: string;
        depth: number;
        deadLetter: number;
        throughput: number;
    }[];
    database: {
        latencyMs: number | null;
        reachable: boolean;
        migrationsApplied: number | null;
    };
    process: {
        nodeVersion: string;
        uptimeSeconds: number;
        environment: string;
    };
}, {
    adapters: {
        status: "up" | "degraded" | "down";
        adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
        mode: "mock" | "live";
        errorRate: number | null;
        latencyMs: number | null;
        observedAt: string;
    }[];
    queues: {
        failed: number;
        observedAt: string;
        queue: string;
        depth: number;
        deadLetter: number;
        throughput: number;
    }[];
    database: {
        latencyMs: number | null;
        reachable: boolean;
        migrationsApplied: number | null;
    };
    process: {
        nodeVersion: string;
        uptimeSeconds: number;
        environment: string;
    };
}>;
export type AdminSystemHealth = z.infer<typeof AdminSystemHealth>;
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
export declare const AdminEnvironments: z.ZodObject<{
    current: z.ZodObject<{
        name: z.ZodString;
        nodeEnv: z.ZodString;
        adapterModes: z.ZodObject<{
            payments: z.ZodEnum<["mock", "live"]>;
            storage: z.ZodEnum<["mock", "live"]>;
            sms: z.ZodEnum<["mock", "live"]>;
            ebm: z.ZodEnum<["mock", "live"]>;
        }, "strip", z.ZodTypeAny, {
            payments: "mock" | "live";
            storage: "mock" | "live";
            sms: "mock" | "live";
            ebm: "mock" | "live";
        }, {
            payments: "mock" | "live";
            storage: "mock" | "live";
            sms: "mock" | "live";
            ebm: "mock" | "live";
        }>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        nodeEnv: string;
        adapterModes: {
            payments: "mock" | "live";
            storage: "mock" | "live";
            sms: "mock" | "live";
            ebm: "mock" | "live";
        };
    }, {
        name: string;
        nodeEnv: string;
        adapterModes: {
            payments: "mock" | "live";
            storage: "mock" | "live";
            sms: "mock" | "live";
            ebm: "mock" | "live";
        };
    }>;
    adapters: z.ZodArray<z.ZodObject<{
        adapter: z.ZodEnum<["payment", "ebm_vsdc", "rra_tin", "filing", "mailer", "maps"]>;
        mode: z.ZodEnum<["mock", "live"]>;
        status: z.ZodEnum<["up", "degraded", "down"]>;
        errorRate: z.ZodNullable<z.ZodNumber>;
        latencyMs: z.ZodNullable<z.ZodNumber>;
        observedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "up" | "degraded" | "down";
        adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
        mode: "mock" | "live";
        errorRate: number | null;
        latencyMs: number | null;
        observedAt: string;
    }, {
        status: "up" | "degraded" | "down";
        adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
        mode: "mock" | "live";
        errorRate: number | null;
        latencyMs: number | null;
        observedAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    current: {
        name: string;
        nodeEnv: string;
        adapterModes: {
            payments: "mock" | "live";
            storage: "mock" | "live";
            sms: "mock" | "live";
            ebm: "mock" | "live";
        };
    };
    adapters: {
        status: "up" | "degraded" | "down";
        adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
        mode: "mock" | "live";
        errorRate: number | null;
        latencyMs: number | null;
        observedAt: string;
    }[];
}, {
    current: {
        name: string;
        nodeEnv: string;
        adapterModes: {
            payments: "mock" | "live";
            storage: "mock" | "live";
            sms: "mock" | "live";
            ebm: "mock" | "live";
        };
    };
    adapters: {
        status: "up" | "degraded" | "down";
        adapter: "payment" | "ebm_vsdc" | "rra_tin" | "filing" | "mailer" | "maps";
        mode: "mock" | "live";
        errorRate: number | null;
        latencyMs: number | null;
        observedAt: string;
    }[];
}>;
export type AdminEnvironments = z.infer<typeof AdminEnvironments>;
/**
 * One review a moderator may act on.
 *
 * `state` is a plain string because `reviews.moderation_state` is a `text`
 * column defaulting to `visible`, not a `pgEnum` — the same reasoning as
 * `AdminOrgMember.status`. `rating` carries `overall_rating` and is nullable
 * because a host-to-guest review has no star rating at all.
 */
export declare const AdminModeratedReview: z.ZodObject<{
    id: z.ZodString;
    propertyName: z.ZodNullable<z.ZodString>;
    authorName: z.ZodNullable<z.ZodString>;
    rating: z.ZodNullable<z.ZodNumber>;
    body: z.ZodNullable<z.ZodString>;
    state: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    propertyName: string | null;
    state: string;
    authorName: string | null;
    rating: number | null;
    body: string | null;
}, {
    id: string;
    createdAt: string;
    propertyName: string | null;
    state: string;
    authorName: string | null;
    rating: number | null;
    body: string | null;
}>;
export type AdminModeratedReview = z.infer<typeof AdminModeratedReview>;
/**
 * One support ticket. `firstResponseAt` and `resolvedAt` are the two timestamps
 * every response-time metric is computed from, sent raw so the console never
 * has to agree with the server about how a duration is measured. `csat` is null
 * until the requester scores it, which is not the same as scoring it zero.
 */
export declare const AdminSupportTicket: z.ZodObject<{
    id: z.ZodString;
    requesterUserId: z.ZodNullable<z.ZodString>;
    category: z.ZodNullable<z.ZodString>;
    state: z.ZodEnum<["open", "resolved", "reopened", "closed"]>;
    domain: z.ZodNullable<z.ZodEnum<["hospitality", "residence"]>>;
    districtId: z.ZodNullable<z.ZodNumber>;
    firstResponseAt: z.ZodNullable<z.ZodString>;
    resolvedAt: z.ZodNullable<z.ZodString>;
    csat: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    districtId: number | null;
    domain: "hospitality" | "residence" | null;
    id: string;
    createdAt: string;
    state: "open" | "resolved" | "reopened" | "closed";
    requesterUserId: string | null;
    category: string | null;
    firstResponseAt: string | null;
    resolvedAt: string | null;
    csat: number | null;
}, {
    districtId: number | null;
    domain: "hospitality" | "residence" | null;
    id: string;
    createdAt: string;
    state: "open" | "resolved" | "reopened" | "closed";
    requesterUserId: string | null;
    category: string | null;
    firstResponseAt: string | null;
    resolvedAt: string | null;
    csat: number | null;
}>;
export type AdminSupportTicket = z.infer<typeof AdminSupportTicket>;
/**
 * `GET /api/v1/admin/moderation/tickets/:ticketId?reason=` — one ticket with
 * what the person WROTE and how to answer them. Kept off `AdminSupportTicket`
 * on purpose: the list is a backlog anybody on the desk can scan, while the
 * message and the contact details are somebody's words and address, so they
 * cross only on this read, which states a reason and writes a
 * `record_access_logs` row naming the ticket before it answers.
 */
export declare const AdminSupportTicketDetail: z.ZodObject<{
    id: z.ZodString;
    requesterUserId: z.ZodNullable<z.ZodString>;
    category: z.ZodNullable<z.ZodString>;
    state: z.ZodEnum<["open", "resolved", "reopened", "closed"]>;
    domain: z.ZodNullable<z.ZodEnum<["hospitality", "residence"]>>;
    districtId: z.ZodNullable<z.ZodNumber>;
    firstResponseAt: z.ZodNullable<z.ZodString>;
    resolvedAt: z.ZodNullable<z.ZodString>;
    csat: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodString;
} & {
    message: z.ZodNullable<z.ZodString>;
    contactEmail: z.ZodNullable<z.ZodString>;
    contactName: z.ZodNullable<z.ZodString>;
    contactPhone: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string | null;
    districtId: number | null;
    domain: "hospitality" | "residence" | null;
    id: string;
    createdAt: string;
    state: "open" | "resolved" | "reopened" | "closed";
    requesterUserId: string | null;
    category: string | null;
    firstResponseAt: string | null;
    resolvedAt: string | null;
    csat: number | null;
    contactEmail: string | null;
    contactName: string | null;
    contactPhone: string | null;
}, {
    message: string | null;
    districtId: number | null;
    domain: "hospitality" | "residence" | null;
    id: string;
    createdAt: string;
    state: "open" | "resolved" | "reopened" | "closed";
    requesterUserId: string | null;
    category: string | null;
    firstResponseAt: string | null;
    resolvedAt: string | null;
    csat: number | null;
    contactEmail: string | null;
    contactName: string | null;
    contactPhone: string | null;
}>;
export type AdminSupportTicketDetail = z.infer<typeof AdminSupportTicketDetail>;
/**
 * One escalation. The subject is a (type, id) pair rather than a set of
 * nullable foreign keys, because an escalation can point at any of eight
 * different things and eight mostly-null columns would be the worse row.
 */
export declare const AdminEscalation: z.ZodObject<{
    id: z.ZodString;
    subjectType: z.ZodNullable<z.ZodEnum<["user", "org", "lease", "booking", "listing", "review", "message", "payment"]>>;
    subjectId: z.ZodNullable<z.ZodString>;
    type: z.ZodEnum<["dispute", "policy_violation", "off_platform_leakage", "listing_non_compliance", "review_abuse"]>;
    state: z.ZodEnum<["open", "resolved"]>;
    ownerUserId: z.ZodNullable<z.ZodString>;
    resolutionNote: z.ZodNullable<z.ZodString>;
    districtId: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "dispute" | "policy_violation" | "off_platform_leakage" | "listing_non_compliance" | "review_abuse";
    districtId: number | null;
    id: string;
    createdAt: string;
    subjectType: "message" | "payment" | "user" | "org" | "lease" | "booking" | "listing" | "review" | null;
    subjectId: string | null;
    state: "open" | "resolved";
    ownerUserId: string | null;
    resolutionNote: string | null;
}, {
    type: "dispute" | "policy_violation" | "off_platform_leakage" | "listing_non_compliance" | "review_abuse";
    districtId: number | null;
    id: string;
    createdAt: string;
    subjectType: "message" | "payment" | "user" | "org" | "lease" | "booking" | "listing" | "review" | null;
    subjectId: string | null;
    state: "open" | "resolved";
    ownerUserId: string | null;
    resolutionNote: string | null;
}>;
export type AdminEscalation = z.infer<typeof AdminEscalation>;
export declare const AdminModeration: z.ZodObject<{
    reviews: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        propertyName: z.ZodNullable<z.ZodString>;
        authorName: z.ZodNullable<z.ZodString>;
        rating: z.ZodNullable<z.ZodNumber>;
        body: z.ZodNullable<z.ZodString>;
        state: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        propertyName: string | null;
        state: string;
        authorName: string | null;
        rating: number | null;
        body: string | null;
    }, {
        id: string;
        createdAt: string;
        propertyName: string | null;
        state: string;
        authorName: string | null;
        rating: number | null;
        body: string | null;
    }>, "many">;
    tickets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        requesterUserId: z.ZodNullable<z.ZodString>;
        category: z.ZodNullable<z.ZodString>;
        state: z.ZodEnum<["open", "resolved", "reopened", "closed"]>;
        domain: z.ZodNullable<z.ZodEnum<["hospitality", "residence"]>>;
        districtId: z.ZodNullable<z.ZodNumber>;
        firstResponseAt: z.ZodNullable<z.ZodString>;
        resolvedAt: z.ZodNullable<z.ZodString>;
        csat: z.ZodNullable<z.ZodNumber>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        districtId: number | null;
        domain: "hospitality" | "residence" | null;
        id: string;
        createdAt: string;
        state: "open" | "resolved" | "reopened" | "closed";
        requesterUserId: string | null;
        category: string | null;
        firstResponseAt: string | null;
        resolvedAt: string | null;
        csat: number | null;
    }, {
        districtId: number | null;
        domain: "hospitality" | "residence" | null;
        id: string;
        createdAt: string;
        state: "open" | "resolved" | "reopened" | "closed";
        requesterUserId: string | null;
        category: string | null;
        firstResponseAt: string | null;
        resolvedAt: string | null;
        csat: number | null;
    }>, "many">;
    escalations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        subjectType: z.ZodNullable<z.ZodEnum<["user", "org", "lease", "booking", "listing", "review", "message", "payment"]>>;
        subjectId: z.ZodNullable<z.ZodString>;
        type: z.ZodEnum<["dispute", "policy_violation", "off_platform_leakage", "listing_non_compliance", "review_abuse"]>;
        state: z.ZodEnum<["open", "resolved"]>;
        ownerUserId: z.ZodNullable<z.ZodString>;
        resolutionNote: z.ZodNullable<z.ZodString>;
        districtId: z.ZodNullable<z.ZodNumber>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "dispute" | "policy_violation" | "off_platform_leakage" | "listing_non_compliance" | "review_abuse";
        districtId: number | null;
        id: string;
        createdAt: string;
        subjectType: "message" | "payment" | "user" | "org" | "lease" | "booking" | "listing" | "review" | null;
        subjectId: string | null;
        state: "open" | "resolved";
        ownerUserId: string | null;
        resolutionNote: string | null;
    }, {
        type: "dispute" | "policy_violation" | "off_platform_leakage" | "listing_non_compliance" | "review_abuse";
        districtId: number | null;
        id: string;
        createdAt: string;
        subjectType: "message" | "payment" | "user" | "org" | "lease" | "booking" | "listing" | "review" | null;
        subjectId: string | null;
        state: "open" | "resolved";
        ownerUserId: string | null;
        resolutionNote: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    reviews: {
        id: string;
        createdAt: string;
        propertyName: string | null;
        state: string;
        authorName: string | null;
        rating: number | null;
        body: string | null;
    }[];
    tickets: {
        districtId: number | null;
        domain: "hospitality" | "residence" | null;
        id: string;
        createdAt: string;
        state: "open" | "resolved" | "reopened" | "closed";
        requesterUserId: string | null;
        category: string | null;
        firstResponseAt: string | null;
        resolvedAt: string | null;
        csat: number | null;
    }[];
    escalations: {
        type: "dispute" | "policy_violation" | "off_platform_leakage" | "listing_non_compliance" | "review_abuse";
        districtId: number | null;
        id: string;
        createdAt: string;
        subjectType: "message" | "payment" | "user" | "org" | "lease" | "booking" | "listing" | "review" | null;
        subjectId: string | null;
        state: "open" | "resolved";
        ownerUserId: string | null;
        resolutionNote: string | null;
    }[];
}, {
    reviews: {
        id: string;
        createdAt: string;
        propertyName: string | null;
        state: string;
        authorName: string | null;
        rating: number | null;
        body: string | null;
    }[];
    tickets: {
        districtId: number | null;
        domain: "hospitality" | "residence" | null;
        id: string;
        createdAt: string;
        state: "open" | "resolved" | "reopened" | "closed";
        requesterUserId: string | null;
        category: string | null;
        firstResponseAt: string | null;
        resolvedAt: string | null;
        csat: number | null;
    }[];
    escalations: {
        type: "dispute" | "policy_violation" | "off_platform_leakage" | "listing_non_compliance" | "review_abuse";
        districtId: number | null;
        id: string;
        createdAt: string;
        subjectType: "message" | "payment" | "user" | "org" | "lease" | "booking" | "listing" | "review" | null;
        subjectId: string | null;
        state: "open" | "resolved";
        ownerUserId: string | null;
        resolutionNote: string | null;
    }[];
}>;
export type AdminModeration = z.infer<typeof AdminModeration>;
/**
 * One announcement.
 *
 * `audience` is `unknown` because the column is `jsonb` holding a targeting
 * expression whose vocabulary is not settled; the console shows it and does not
 * interpret it. Both bodies are nullable and BOTH are carried: an announcement
 * with only the English written is a real draft state, and collapsing the pair
 * into one `body` would hide which half is missing.
 */
export declare const AdminAnnouncement: z.ZodObject<{
    id: z.ZodString;
    audience: z.ZodUnknown;
    bodyEn: z.ZodNullable<z.ZodString>;
    bodyRw: z.ZodNullable<z.ZodString>;
    publishAt: z.ZodNullable<z.ZodString>;
    state: z.ZodEnum<["draft", "published"]>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    state: "draft" | "published";
    bodyEn: string | null;
    bodyRw: string | null;
    publishAt: string | null;
    audience?: unknown;
}, {
    id: string;
    createdAt: string;
    state: "draft" | "published";
    bodyEn: string | null;
    bodyRw: string | null;
    publishAt: string | null;
    audience?: unknown;
}>;
export type AdminAnnouncement = z.infer<typeof AdminAnnouncement>;
export declare const AdminAnnouncementResponse: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        audience: z.ZodUnknown;
        bodyEn: z.ZodNullable<z.ZodString>;
        bodyRw: z.ZodNullable<z.ZodString>;
        publishAt: z.ZodNullable<z.ZodString>;
        state: z.ZodEnum<["draft", "published"]>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        state: "draft" | "published";
        bodyEn: string | null;
        bodyRw: string | null;
        publishAt: string | null;
        audience?: unknown;
    }, {
        id: string;
        createdAt: string;
        state: "draft" | "published";
        bodyEn: string | null;
        bodyRw: string | null;
        publishAt: string | null;
        audience?: unknown;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        createdAt: string;
        state: "draft" | "published";
        bodyEn: string | null;
        bodyRw: string | null;
        publishAt: string | null;
        audience?: unknown;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        id: string;
        createdAt: string;
        state: "draft" | "published";
        bodyEn: string | null;
        bodyRw: string | null;
        publishAt: string | null;
        audience?: unknown;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminAnnouncementResponse = z.infer<typeof AdminAnnouncementResponse>;
/**
 * One named series, aggregated from `analytics_events`.
 *
 * The points are `{ at, value }` pairs rather than two parallel arrays, so a
 * value can never drift out of alignment with its timestamp. Bucket width is a
 * server decision carried implicitly by the spacing: the console plots what it
 * is given and never re-buckets, because two different bucketings of the same
 * events are two different answers to the same question.
 */
export declare const AdminAnalyticsSeries: z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    points: z.ZodArray<z.ZodObject<{
        at: z.ZodString;
        value: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: number;
        at: string;
    }, {
        value: number;
        at: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    key: string;
    label: string;
    points: {
        value: number;
        at: string;
    }[];
}, {
    key: string;
    label: string;
    points: {
        value: number;
        at: string;
    }[];
}>;
export type AdminAnalyticsSeries = z.infer<typeof AdminAnalyticsSeries>;
/**
 * A saved dashboard scope — one staff member's stored filter.
 *
 * `metricSet` and `dateRange` are `unknown` for the same reason as
 * `AdminConfigEntry.value`: they are `jsonb` the console wrote and the console
 * reads back, and giving them a shape here would freeze a format the server
 * never inspects.
 */
export declare const AdminSavedScope: z.ZodObject<{
    id: z.ZodString;
    ownerUserId: z.ZodNullable<z.ZodString>;
    metricSet: z.ZodUnknown;
    districtId: z.ZodNullable<z.ZodNumber>;
    districtName: z.ZodNullable<z.ZodString>;
    dateRange: z.ZodUnknown;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    districtId: number | null;
    districtName: string | null;
    id: string;
    createdAt: string;
    ownerUserId: string | null;
    metricSet?: unknown;
    dateRange?: unknown;
}, {
    districtId: number | null;
    districtName: string | null;
    id: string;
    createdAt: string;
    ownerUserId: string | null;
    metricSet?: unknown;
    dateRange?: unknown;
}>;
export type AdminSavedScope = z.infer<typeof AdminSavedScope>;
export declare const AdminAnalytics: z.ZodObject<{
    totals: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        value: z.ZodNullable<z.ZodNumber>;
        unit: z.ZodEnum<["count", "rwf", "percent"]>;
        previousValue: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        value: number | null;
        key: string;
        label: string;
        unit: "count" | "rwf" | "percent";
        previousValue: number | null;
    }, {
        value: number | null;
        key: string;
        label: string;
        unit: "count" | "rwf" | "percent";
        previousValue: number | null;
    }>, "many">;
    series: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        points: z.ZodArray<z.ZodObject<{
            at: z.ZodString;
            value: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            at: string;
        }, {
            value: number;
            at: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        key: string;
        label: string;
        points: {
            value: number;
            at: string;
        }[];
    }, {
        key: string;
        label: string;
        points: {
            value: number;
            at: string;
        }[];
    }>, "many">;
    savedScopes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ownerUserId: z.ZodNullable<z.ZodString>;
        metricSet: z.ZodUnknown;
        districtId: z.ZodNullable<z.ZodNumber>;
        districtName: z.ZodNullable<z.ZodString>;
        dateRange: z.ZodUnknown;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        districtId: number | null;
        districtName: string | null;
        id: string;
        createdAt: string;
        ownerUserId: string | null;
        metricSet?: unknown;
        dateRange?: unknown;
    }, {
        districtId: number | null;
        districtName: string | null;
        id: string;
        createdAt: string;
        ownerUserId: string | null;
        metricSet?: unknown;
        dateRange?: unknown;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    totals: {
        value: number | null;
        key: string;
        label: string;
        unit: "count" | "rwf" | "percent";
        previousValue: number | null;
    }[];
    series: {
        key: string;
        label: string;
        points: {
            value: number;
            at: string;
        }[];
    }[];
    savedScopes: {
        districtId: number | null;
        districtName: string | null;
        id: string;
        createdAt: string;
        ownerUserId: string | null;
        metricSet?: unknown;
        dateRange?: unknown;
    }[];
}, {
    totals: {
        value: number | null;
        key: string;
        label: string;
        unit: "count" | "rwf" | "percent";
        previousValue: number | null;
    }[];
    series: {
        key: string;
        label: string;
        points: {
            value: number;
            at: string;
        }[];
    }[];
    savedScopes: {
        districtId: number | null;
        districtName: string | null;
        id: string;
        createdAt: string;
        ownerUserId: string | null;
        metricSet?: unknown;
        dateRange?: unknown;
    }[];
}>;
export type AdminAnalytics = z.infer<typeof AdminAnalytics>;
/**
 * One translation string. Both languages ride on one row because the question
 * is always comparative — what is missing in Kinyarwanda that exists in English
 * — and two separate rows cannot answer it without a join the console would
 * have to perform on itself.
 */
export declare const AdminTranslationEntry: z.ZodObject<{
    id: z.ZodString;
    key: z.ZodString;
    valueEn: z.ZodNullable<z.ZodString>;
    valueRw: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["translated", "missing", "needs_review"]>;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "translated" | "missing" | "needs_review";
    id: string;
    key: string;
    version: number;
    valueEn: string | null;
    valueRw: string | null;
}, {
    status: "translated" | "missing" | "needs_review";
    id: string;
    key: string;
    version: number;
    valueEn: string | null;
    valueRw: string | null;
}>;
export type AdminTranslationEntry = z.infer<typeof AdminTranslationEntry>;
/**
 * One email template. `isTransactional` is carried because it decides whether a
 * recipient may opt out: a booking confirmation is not marketing, and a console
 * that cannot see the difference will let somebody unsubscribe from their own
 * receipts. The bodies are not sent in a list; the subjects identify a row.
 */
export declare const AdminEmailTemplate: z.ZodObject<{
    id: z.ZodString;
    templateKey: z.ZodString;
    subjectEn: z.ZodNullable<z.ZodString>;
    subjectRw: z.ZodNullable<z.ZodString>;
    version: z.ZodNumber;
    isTransactional: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    version: number;
    templateKey: string;
    subjectEn: string | null;
    subjectRw: string | null;
    isTransactional: boolean;
}, {
    id: string;
    version: number;
    templateKey: string;
    subjectEn: string | null;
    subjectRw: string | null;
    isTransactional: boolean;
}>;
export type AdminEmailTemplate = z.infer<typeof AdminEmailTemplate>;
/**
 * `GET /api/v1/admin/localization`.
 *
 * `coverage.stale` counts `translation_status = 'needs_review'` — the string
 * has a Kinyarwanda value but the English one moved under it. It is counted
 * apart from `missing` because the two need different work: one needs a
 * translator, the other needs a reviewer.
 */
export declare const AdminLocalization: z.ZodObject<{
    entries: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        valueEn: z.ZodNullable<z.ZodString>;
        valueRw: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["translated", "missing", "needs_review"]>;
        version: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "translated" | "missing" | "needs_review";
        id: string;
        key: string;
        version: number;
        valueEn: string | null;
        valueRw: string | null;
    }, {
        status: "translated" | "missing" | "needs_review";
        id: string;
        key: string;
        version: number;
        valueEn: string | null;
        valueRw: string | null;
    }>, "many">;
    templates: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        templateKey: z.ZodString;
        subjectEn: z.ZodNullable<z.ZodString>;
        subjectRw: z.ZodNullable<z.ZodString>;
        version: z.ZodNumber;
        isTransactional: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        version: number;
        templateKey: string;
        subjectEn: string | null;
        subjectRw: string | null;
        isTransactional: boolean;
    }, {
        id: string;
        version: number;
        templateKey: string;
        subjectEn: string | null;
        subjectRw: string | null;
        isTransactional: boolean;
    }>, "many">;
    coverage: z.ZodObject<{
        total: z.ZodNumber;
        translated: z.ZodNumber;
        missing: z.ZodNumber;
        stale: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        translated: number;
        missing: number;
        total: number;
        stale: number;
    }, {
        translated: number;
        missing: number;
        total: number;
        stale: number;
    }>;
}, "strip", z.ZodTypeAny, {
    entries: {
        status: "translated" | "missing" | "needs_review";
        id: string;
        key: string;
        version: number;
        valueEn: string | null;
        valueRw: string | null;
    }[];
    coverage: {
        translated: number;
        missing: number;
        total: number;
        stale: number;
    };
    templates: {
        id: string;
        version: number;
        templateKey: string;
        subjectEn: string | null;
        subjectRw: string | null;
        isTransactional: boolean;
    }[];
}, {
    entries: {
        status: "translated" | "missing" | "needs_review";
        id: string;
        key: string;
        version: number;
        valueEn: string | null;
        valueRw: string | null;
    }[];
    coverage: {
        translated: number;
        missing: number;
        total: number;
        stale: number;
    };
    templates: {
        id: string;
        version: number;
        templateKey: string;
        subjectEn: string | null;
        subjectRw: string | null;
        isTransactional: boolean;
    }[];
}>;
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
export declare const AdminReasonQuery: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type AdminReasonQuery = z.infer<typeof AdminReasonQuery>;
/** A PII list route: a stated reason plus the usual paging. */
export declare const AdminPagedReasonQuery: z.ZodObject<{
    reason: z.ZodString;
} & {
    page: z.ZodOptional<z.ZodNumber>;
    pageSize: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    reason: string;
    page?: number | undefined;
    pageSize?: number | undefined;
}, {
    reason: string;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type AdminPagedReasonQuery = z.infer<typeof AdminPagedReasonQuery>;
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
export declare const AdminActionRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
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
export declare const AppendRegistrationFeeRequest: z.ZodObject<{
    reason: z.ZodString;
} & {
    businessType: z.ZodEnum<["hospitality", "residence", "broker"]>;
    amountRwf: z.ZodNumber;
    effectiveFrom: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    businessType: "hospitality" | "residence" | "broker";
    amountRwf: number;
    reason: string;
    effectiveFrom?: string | undefined;
}, {
    businessType: "hospitality" | "residence" | "broker";
    amountRwf: number;
    reason: string;
    effectiveFrom?: string | undefined;
}>;
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
export declare const GovernmentBody: z.ZodObject<{
    code: z.ZodString;
    nameEn: z.ZodString;
    nameRw: z.ZodString;
    abbreviation: z.ZodNullable<z.ZodString>;
    active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    code: string;
    active: boolean;
    nameEn: string;
    nameRw: string;
    abbreviation: string | null;
}, {
    code: string;
    active: boolean;
    nameEn: string;
    nameRw: string;
    abbreviation: string | null;
}>;
export type GovernmentBody = z.infer<typeof GovernmentBody>;
/** `POST /api/v1/admin/government-bodies`. The code is fixed for good once written. */
export declare const CreateGovernmentBodyRequest: z.ZodObject<{
    reason: z.ZodString;
} & {
    code: z.ZodString;
    nameEn: z.ZodString;
    nameRw: z.ZodString;
    abbreviation: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    nameEn: string;
    nameRw: string;
    reason: string;
    abbreviation?: string | undefined;
}, {
    code: string;
    nameEn: string;
    nameRw: string;
    reason: string;
    abbreviation?: string | undefined;
}>;
export type CreateGovernmentBodyRequest = z.infer<typeof CreateGovernmentBodyRequest>;
/**
 * `PATCH /api/v1/admin/government-bodies/:code`: rename, or retire and restore.
 * The code is not here, because it is not editable.
 */
export declare const UpdateGovernmentBodyRequest: z.ZodEffects<z.ZodObject<{
    reason: z.ZodString;
} & {
    nameEn: z.ZodOptional<z.ZodString>;
    nameRw: z.ZodOptional<z.ZodString>;
    abbreviation: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    reason: string;
    active?: boolean | undefined;
    nameEn?: string | undefined;
    nameRw?: string | undefined;
    abbreviation?: string | null | undefined;
}, {
    reason: string;
    active?: boolean | undefined;
    nameEn?: string | undefined;
    nameRw?: string | undefined;
    abbreviation?: string | null | undefined;
}>, {
    reason: string;
    active?: boolean | undefined;
    nameEn?: string | undefined;
    nameRw?: string | undefined;
    abbreviation?: string | null | undefined;
}, {
    reason: string;
    active?: boolean | undefined;
    nameEn?: string | undefined;
    nameRw?: string | undefined;
    abbreviation?: string | null | undefined;
}>;
export type UpdateGovernmentBodyRequest = z.infer<typeof UpdateGovernmentBodyRequest>;
/**
 * `tin_verification_result`. `pending` is RRA being unreachable, never a
 * rejection — the org holds at `submitted` and can be retried.
 */
export declare const AdminTinCheckResult: z.ZodEnum<["pending", "verified", "failed"]>;
export type AdminTinCheckResult = z.infer<typeof AdminTinCheckResult>;
/**
 * A walk-in's claim code as printed on the check-in slip: four letters, a
 * dash, four digits. `apps/web`'s claim form tests the same shape.
 */
export declare const AdminClaimCode: z.ZodString;
export type AdminClaimCode = z.infer<typeof AdminClaimCode>;
/**
 * `POST /api/v1/admin/orgs/:orgId/suspend` and `.../reinstate`.
 *
 * `from` is carried beside the new status so the console can word what
 * actually moved, rather than assuming the business was where the page it
 * rendered last said it was.
 */
export declare const AdminOrgStatusChange: z.ZodObject<{
    auditEventId: z.ZodString;
    orgId: z.ZodString;
    from: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
    registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    from: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    auditEventId: string;
}, {
    orgId: string;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    from: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    auditEventId: string;
}>;
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
export declare const AdminTinRecheckResult: z.ZodObject<{
    auditEventId: z.ZodString;
    orgId: z.ZodString;
    result: z.ZodEnum<["pending", "verified", "failed"]>;
    adapterMode: z.ZodEnum<["mock", "live"]>;
    registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    result: "pending" | "verified" | "failed";
    adapterMode: "mock" | "live";
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    auditEventId: string;
}, {
    orgId: string;
    result: "pending" | "verified" | "failed";
    adapterMode: "mock" | "live";
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    auditEventId: string;
}>;
export type AdminTinRecheckResult = z.infer<typeof AdminTinRecheckResult>;
/** `POST /api/v1/admin/brokers/:brokerId/suspend`. */
export declare const AdminBrokerStatusChange: z.ZodObject<{
    auditEventId: z.ZodString;
    brokerId: z.ZodString;
    from: z.ZodEnum<["active", "suspended"]>;
    status: z.ZodEnum<["active", "suspended"]>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "suspended";
    brokerId: string;
    from: "active" | "suspended";
    auditEventId: string;
}, {
    status: "active" | "suspended";
    brokerId: string;
    from: "active" | "suspended";
    auditEventId: string;
}>;
export type AdminBrokerStatusChange = z.infer<typeof AdminBrokerStatusChange>;
/**
 * `POST /api/v1/admin/users/:userId/revoke-sessions`.
 *
 * `revokedCount` may be zero, and that is a success rather than a refusal: a
 * staffer ending every session of a compromised account has done their job
 * whether the attacker was signed in at that moment or not, and the audit row
 * records that they checked.
 */
export declare const AdminSessionsRevoked: z.ZodObject<{
    auditEventId: z.ZodString;
    userId: z.ZodString;
    revokedCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    userId: string;
    auditEventId: string;
    revokedCount: number;
}, {
    userId: string;
    auditEventId: string;
    revokedCount: number;
}>;
export type AdminSessionsRevoked = z.infer<typeof AdminSessionsRevoked>;
/**
 * `POST /api/v1/admin/users/stays/:stayId/reissue-claim`.
 *
 * The new code is returned because the point of reissuing it is that a
 * staffer reads it to the guest. It is NOT written to the audit row: a claim
 * code is a bearer credential for somebody's stay, and a trail that stored it
 * would let everyone who may read the audit log claim the stay.
 */
export declare const AdminClaimCodeReissued: z.ZodObject<{
    auditEventId: z.ZodString;
    stayId: z.ZodString;
    claimCode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    stayId: string;
    auditEventId: string;
    claimCode: string;
}, {
    stayId: string;
    auditEventId: string;
    claimCode: string;
}>;
export type AdminClaimCodeReissued = z.infer<typeof AdminClaimCodeReissued>;
//# sourceMappingURL=admin.d.ts.map