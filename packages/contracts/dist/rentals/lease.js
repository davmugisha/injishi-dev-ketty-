"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancelLeaseRequest = exports.EditLeaseRequest = exports.CreateLeaseRequest = exports.LeaseTermsInput = exports.TenantInput = exports.NoticeDays = exports.GraceDays = exports.RentDueDay = exports.MAX_OCCUPANTS = exports.DEFAULT_NOTICE_DAYS = exports.MAX_GRACE_DAYS = exports.DEFAULT_GRACE_DAYS = exports.LEASE_TAB_LABEL = exports.LeaseTab = exports.LEASE_ENDING_WINDOW_DAYS = exports.LIVE_LEASE_STATUSES = exports.FINAL_LEASE_STATUSES = exports.LEASE_TRANSITIONS = exports.LeaseAction = void 0;
exports.nextLeaseStatus = nextLeaseStatus;
exports.leaseActionsFrom = leaseActionsFrom;
exports.canTransition = canTransition;
exports.canEditLease = canEditLease;
exports.editVoidsLandlordSignature = editVoidsLandlordSignature;
exports.isFinalLease = isFinalLease;
exports.isLiveLease = isLiveLease;
exports.endDateIsNear = endDateIsNear;
exports.scheduledLeaseAction = scheduledLeaseAction;
exports.leaseTab = leaseTab;
exports.leaseStatusesForTab = leaseStatusesForTab;
exports.dueDayFromStart = dueDayFromStart;
const zod_1 = require("zod");
const phone_1 = require("../phone");
const primitives_1 = require("../primitives");
const registration_1 = require("../registration");
const dates_1 = require("./dates");
const identity_1 = require("./identity");
const vocab_1 = require("./vocab");
// ===========================================================================
// A lease's life: the moves between statuses, the tab it shows under, and the
// shapes that draft and edit it
// ===========================================================================
/**
 * What can happen to a lease. Each action moves a lease from one status to
 * another; `LEASE_TRANSITIONS` says which actions each status allows.
 */
exports.LeaseAction = zod_1.z.enum([
    /** The landlord signs the draft; the invitation goes to the tenant. */
    "landlord_sign",
    /** The terms or the tenant's details change. On a lease out for signature this voids the landlord's signature. */
    "edit_terms",
    /** The tenant signs. */
    "tenant_sign",
    /** The landlord presses Start, or the job starts it on its start date. */
    "start",
    /** The landlord cancels a lease that never started. */
    "cancel",
    /** The landlord acknowledges a move out notice. */
    "acknowledge_notice",
    /** The end date is within `LEASE_ENDING_WINDOW_DAYS`. */
    "near_end",
    /** The notice is withdrawn: the lease runs on. */
    "withdraw_notice",
    /** The landlord records the day the tenant moved out. */
    "record_move_out",
]);
/**
 * The lease state machine (blueprint 1.3). The API is the only enforcer; a
 * client reads it to offer only the moves that will succeed.
 *
 * - draft → pending_signature when the landlord signs; editing keeps it a draft.
 * - pending_signature → signed when the tenant signs; back to draft when the
 *   terms are edited (the landlord's signature is voided and a new contract
 *   version is made).
 * - signed → active when the tenancy starts.
 * - draft, pending_signature and signed can be cancelled.
 * - active → ending when a notice is acknowledged or the end date is near.
 * - ending → ended when the move out is recorded, or back to active when the
 *   notice is withdrawn.
 * - ended and cancelled are final.
 */
exports.LEASE_TRANSITIONS = {
    draft: { landlord_sign: "pending_signature", edit_terms: "draft", cancel: "cancelled" },
    pending_signature: { tenant_sign: "signed", edit_terms: "draft", cancel: "cancelled" },
    signed: { start: "active", cancel: "cancelled" },
    active: { acknowledge_notice: "ending", near_end: "ending" },
    ending: { record_move_out: "ended", withdraw_notice: "active" },
    ended: {},
    cancelled: {},
};
/** The status `action` takes a lease in `from` to, or null when the action is not allowed. */
function nextLeaseStatus(from, action) {
    return exports.LEASE_TRANSITIONS[from][action] ?? null;
}
/** The actions a lease in `status` allows. */
function leaseActionsFrom(status) {
    return exports.LeaseAction.options.filter((a) => exports.LEASE_TRANSITIONS[status][a] !== undefined);
}
/** May a lease move from `from` to a different status `to`? */
function canTransition(from, to) {
    if (from === to)
        return false;
    return Object.values(exports.LEASE_TRANSITIONS[from]).includes(to);
}
/** Can the terms or the tenant still be changed? Only before the tenant signs. */
function canEditLease(status) {
    return nextLeaseStatus(status, "edit_terms") !== null;
}
/** Does editing a lease in `status` void the landlord's signature? */
function editVoidsLandlordSignature(status) {
    return status === "pending_signature";
}
/** The final statuses: nothing moves a lease out of them. */
exports.FINAL_LEASE_STATUSES = ["ended", "cancelled"];
/** The statuses that hold the unit: two of these can never overlap in time on one unit. */
exports.LIVE_LEASE_STATUSES = ["pending_signature", "signed", "active", "ending"];
function isFinalLease(status) {
    return exports.FINAL_LEASE_STATUSES.includes(status);
}
function isLiveLease(status) {
    return exports.LIVE_LEASE_STATUSES.includes(status);
}
/** How close the end date comes before an active lease shows as ending. */
exports.LEASE_ENDING_WINDOW_DAYS = 30;
/** Is an active lease's end date near enough that it should move to `ending`? */
function endDateIsNear(endDate, today = (0, dates_1.kigaliToday)()) {
    return endDate <= (0, dates_1.addDays)(today, exports.LEASE_ENDING_WINDOW_DAYS);
}
/**
 * The move the daily job makes on a lease today, or null: start a signed
 * lease on its start date (when the landlord lets Injishi start leases), and
 * move an active lease whose end is near to `ending`.
 */
function scheduledLeaseAction(lease, opts = {}) {
    const today = opts.today ?? (0, dates_1.kigaliToday)();
    if (lease.status === "signed" && (opts.autoStart ?? true) && lease.startDate <= today)
        return "start";
    if (lease.status === "active" && endDateIsNear(lease.endDate, today))
        return "near_end";
    return null;
}
// --- Tabs ------------------------------------------------------------------------
/** The tabs of the landlord's lease list. One per status, in the order a lease lives them. */
exports.LeaseTab = zod_1.z.enum(["to_sign", "waiting_for_tenant", "ready_to_start", "active", "ending", "ended", "cancelled"]);
exports.LEASE_TAB_LABEL = {
    to_sign: "To sign",
    waiting_for_tenant: "Waiting for tenant",
    ready_to_start: "Ready to start",
    active: "Active",
    ending: "Ending",
    ended: "Ended",
    cancelled: "Cancelled",
};
const TAB_OF = {
    draft: "to_sign",
    pending_signature: "waiting_for_tenant",
    signed: "ready_to_start",
    active: "active",
    ending: "ending",
    ended: "ended",
    cancelled: "cancelled",
};
/** The tab a lease shows under. Worked out from its status, never stored. */
function leaseTab(status) {
    return TAB_OF[status];
}
/** The statuses a tab lists (for the API's `?tab=` filter). */
function leaseStatusesForTab(tab) {
    return vocab_1.LeaseStatus.options.filter((s) => TAB_OF[s] === tab);
}
// --- Drafting a lease ---------------------------------------------------------------
/** The grace days a lease gets when the landlord does not pick: rent is late 5 days after it is due. */
exports.DEFAULT_GRACE_DAYS = 5;
exports.MAX_GRACE_DAYS = 31;
/** The notice a lease asks for when the landlord does not pick. */
exports.DEFAULT_NOTICE_DAYS = dates_1.LEASE_NOTICE_MIN_DAYS;
/** The most people one lease names as living in the home with the tenant. */
exports.MAX_OCCUPANTS = 12;
/** The day of the month rent falls due: 1 to 28, so it exists in every month. */
exports.RentDueDay = zod_1.z
    .number({ required_error: "Pick a day from 1 to 28.", invalid_type_error: "Pick a day from 1 to 28." })
    .int("Pick a day from 1 to 28.")
    .min(1, "Pick a day from 1 to 28.")
    .max(28, "Pick a day from 1 to 28.");
/**
 * The due day to suggest for a lease starting on `startDate`: the day the
 * tenant moves in, or the 28th for a start on the 29th to 31st.
 */
function dueDayFromStart(startDate) {
    const day = Number(startDate.slice(8, 10));
    return Number.isInteger(day) && day >= 1 ? Math.min(day, 28) : 1;
}
exports.GraceDays = zod_1.z
    .number({ invalid_type_error: "Pick from 0 to 31 days." })
    .int("Pick from 0 to 31 days.")
    .min(0, "Pick from 0 to 31 days.")
    .max(exports.MAX_GRACE_DAYS, "Pick from 0 to 31 days.");
exports.NoticeDays = zod_1.z
    .number({ invalid_type_error: `Pick at least ${dates_1.LEASE_NOTICE_MIN_DAYS} days.` })
    .int(`Pick at least ${dates_1.LEASE_NOTICE_MIN_DAYS} days.`)
    .min(dates_1.LEASE_NOTICE_MIN_DAYS, `Notice is at least ${dates_1.LEASE_NOTICE_MIN_DAYS} days.`)
    .max(dates_1.LEASE_NOTICE_MAX_DAYS, `Notice is at most ${dates_1.LEASE_NOTICE_MAX_DAYS} days.`);
const OtherTerms = zod_1.z.string().trim().max(2000, "Keep other terms under 2000 characters.");
const Occupants = zod_1.z
    .array(identity_1.PersonName)
    .max(exports.MAX_OCCUPANTS, `Name at most ${exports.MAX_OCCUPANTS} people.`)
    .refine((names) => new Set(names.map((n) => n.toLowerCase())).size === names.length, "Each person once.");
/** The tenant, as a lease draft names them. */
const TenantShape = {
    fullName: identity_1.PersonName,
    email: identity_1.PersonEmail,
    /** A Rwandan mobile number, stored as `+2507xxxxxxxx`. */
    phone: phone_1.RwPhoneNumber,
    idKind: vocab_1.IdKind,
    /** Stored without spaces or dashes, letters upper case. */
    idNumber: zod_1.z
        .string({ required_error: "Enter the ID or passport number." })
        .trim()
        .min(1, "Enter the ID or passport number.")
        .max(40, "That number is too long.")
        .transform(identity_1.normaliseIdNumber),
    /** ISO country code (`RW` for a Rwandan). Required, so a partial edit never resets it. */
    nationality: registration_1.CountryCode,
};
exports.TenantInput = zod_1.z.object(TenantShape).superRefine((t, ctx) => checkTenantId(t, ctx, []));
function checkTenantId(t, ctx, path) {
    if (t.idKind === undefined || t.idNumber === undefined)
        return;
    const problem = (0, identity_1.idNumberProblem)(t.idKind, t.idNumber);
    if (problem)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: problem, path: [...path, "idNumber"] });
}
/** The terms of a lease, without defaults, so a partial edit never resets one. */
const TermsShape = {
    startDate: dates_1.CalendarDay,
    endDate: dates_1.CalendarDay,
    /**
     * For a tenancy that began before it came onto Injishi: the day rent starts
     * being charged here. Absent: from the start date.
     */
    billingStartsOn: dates_1.CalendarDay.nullable(),
    monthlyRentRwf: vocab_1.PositiveRwf,
    depositRwf: vocab_1.Rwf,
    rentDueDay: exports.RentDueDay,
    graceDays: exports.GraceDays,
    noticeDays: exports.NoticeDays,
    /** The people who will live in the home with the tenant. */
    occupants: Occupants,
    otherTerms: OtherTerms.nullable(),
};
exports.LeaseTermsInput = zod_1.z.object({
    ...TermsShape,
    billingStartsOn: TermsShape.billingStartsOn.optional(),
    graceDays: exports.GraceDays.default(exports.DEFAULT_GRACE_DAYS),
    noticeDays: exports.NoticeDays.default(exports.DEFAULT_NOTICE_DAYS),
    occupants: Occupants.default([]),
    otherTerms: TermsShape.otherTerms.optional(),
});
/**
 * Draft a lease on one unit (`POST /ops/rentals/leases`).
 *
 * The tenant is an existing tenant record (`tenantId`) or a new one
 * (`tenant`), never both. The tenant's email is where the invitation to read
 * and sign goes, so a likely typo is refused unless `confirmEmail` says it is
 * right. The dates are checked against Kigali today when the request is read.
 */
exports.CreateLeaseRequest = zod_1.z
    .object({
    unitId: primitives_1.Uuid,
    tenantId: primitives_1.Uuid.optional(),
    tenant: zod_1.z.object(TenantShape).optional(),
    terms: exports.LeaseTermsInput,
    /** The broker who brought this tenant, when one did. */
    brokerId: primitives_1.Uuid.optional(),
    /** The tenant's email is right as typed, though it looks like a typo. */
    confirmEmail: zod_1.z.boolean().optional(),
})
    .superRefine((v, ctx) => {
    if ((v.tenantId === undefined) === (v.tenant === undefined)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Pick a tenant or add a new one.", path: ["tenant"] });
    }
    if (v.tenant) {
        checkTenantId(v.tenant, ctx, ["tenant"]);
        (0, identity_1.checkEmailTypo)(v.tenant.email, v.confirmEmail, ctx, ["tenant", "email"]);
    }
    const dates = (0, dates_1.leaseDatesProblem)(v.terms, (0, dates_1.kigaliToday)());
    if (dates)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: dates.message, path: ["terms", dates.path] });
});
/**
 * Change a lease before the tenant signs (`PATCH /ops/rentals/leases/:id`).
 * Only what is sent changes. The API merges it with the lease and checks the
 * merged dates with `leaseDatesProblem`; an edit of a lease out for signature
 * voids the landlord's signature and returns it to draft.
 */
exports.EditLeaseRequest = zod_1.z
    .object({
    unitId: primitives_1.Uuid.optional(),
    tenant: zod_1.z.object(TenantShape).partial().optional(),
    terms: zod_1.z.object(TermsShape).partial().optional(),
    confirmEmail: zod_1.z.boolean().optional(),
})
    .superRefine((v, ctx) => {
    const changes = (v.unitId !== undefined ? 1 : 0) +
        Object.values(v.tenant ?? {}).filter((x) => x !== undefined).length +
        Object.values(v.terms ?? {}).filter((x) => x !== undefined).length;
    if (changes === 0)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Change at least one thing.", path: [] });
    if (v.tenant) {
        checkTenantId(v.tenant, ctx, ["tenant"]);
        (0, identity_1.checkEmailTypo)(v.tenant.email, v.confirmEmail, ctx, ["tenant", "email"]);
    }
    const t = v.terms;
    if (t?.startDate && t.endDate && t.endDate <= t.startDate) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "The lease has to end after it starts.", path: ["terms", "endDate"] });
    }
});
/** Cancel a lease that has not started (`POST /ops/rentals/leases/:id/cancel`). */
exports.CancelLeaseRequest = zod_1.z.object({
    reason: zod_1.z.string().trim().min(3, "Say why the lease is cancelled.").max(500, "Keep the reason under 500 characters."),
});
//# sourceMappingURL=lease.js.map