import { z } from "zod";
import { LeaseStatus } from "./vocab";
/**
 * What can happen to a lease. Each action moves a lease from one status to
 * another; `LEASE_TRANSITIONS` says which actions each status allows.
 */
export declare const LeaseAction: z.ZodEnum<["landlord_sign", "edit_terms", "tenant_sign", "start", "cancel", "acknowledge_notice", "near_end", "withdraw_notice", "record_move_out"]>;
export type LeaseAction = z.infer<typeof LeaseAction>;
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
export declare const LEASE_TRANSITIONS: Readonly<Record<LeaseStatus, Readonly<Partial<Record<LeaseAction, LeaseStatus>>>>>;
/** The status `action` takes a lease in `from` to, or null when the action is not allowed. */
export declare function nextLeaseStatus(from: LeaseStatus, action: LeaseAction): LeaseStatus | null;
/** The actions a lease in `status` allows. */
export declare function leaseActionsFrom(status: LeaseStatus): LeaseAction[];
/** May a lease move from `from` to a different status `to`? */
export declare function canTransition(from: LeaseStatus, to: LeaseStatus): boolean;
/** Can the terms or the tenant still be changed? Only before the tenant signs. */
export declare function canEditLease(status: LeaseStatus): boolean;
/** Does editing a lease in `status` void the landlord's signature? */
export declare function editVoidsLandlordSignature(status: LeaseStatus): boolean;
/** The final statuses: nothing moves a lease out of them. */
export declare const FINAL_LEASE_STATUSES: readonly LeaseStatus[];
/** The statuses that hold the unit: two of these can never overlap in time on one unit. */
export declare const LIVE_LEASE_STATUSES: readonly LeaseStatus[];
export declare function isFinalLease(status: LeaseStatus): boolean;
export declare function isLiveLease(status: LeaseStatus): boolean;
/** How close the end date comes before an active lease shows as ending. */
export declare const LEASE_ENDING_WINDOW_DAYS = 30;
/** Is an active lease's end date near enough that it should move to `ending`? */
export declare function endDateIsNear(endDate: string, today?: string): boolean;
/**
 * The move the daily job makes on a lease today, or null: start a signed
 * lease on its start date (when the landlord lets Injishi start leases), and
 * move an active lease whose end is near to `ending`.
 */
export declare function scheduledLeaseAction(lease: {
    status: LeaseStatus;
    startDate: string;
    endDate: string;
}, opts?: {
    today?: string;
    autoStart?: boolean;
}): LeaseAction | null;
/** The tabs of the landlord's lease list. One per status, in the order a lease lives them. */
export declare const LeaseTab: z.ZodEnum<["to_sign", "waiting_for_tenant", "ready_to_start", "active", "ending", "ended", "cancelled"]>;
export type LeaseTab = z.infer<typeof LeaseTab>;
export declare const LEASE_TAB_LABEL: Readonly<Record<LeaseTab, string>>;
/** The tab a lease shows under. Worked out from its status, never stored. */
export declare function leaseTab(status: LeaseStatus): LeaseTab;
/** The statuses a tab lists (for the API's `?tab=` filter). */
export declare function leaseStatusesForTab(tab: LeaseTab): LeaseStatus[];
/** The grace days a lease gets when the landlord does not pick: rent is late 5 days after it is due. */
export declare const DEFAULT_GRACE_DAYS = 5;
export declare const MAX_GRACE_DAYS = 31;
/** The notice a lease asks for when the landlord does not pick. */
export declare const DEFAULT_NOTICE_DAYS = 15;
/** The most people one lease names as living in the home with the tenant. */
export declare const MAX_OCCUPANTS = 12;
/** The day of the month rent falls due: 1 to 28, so it exists in every month. */
export declare const RentDueDay: z.ZodNumber;
/**
 * The due day to suggest for a lease starting on `startDate`: the day the
 * tenant moves in, or the 28th for a start on the 29th to 31st.
 */
export declare function dueDayFromStart(startDate: string): number;
export declare const GraceDays: z.ZodNumber;
export declare const NoticeDays: z.ZodNumber;
export declare const TenantInput: z.ZodEffects<z.ZodObject<{
    fullName: z.ZodString;
    email: z.ZodString;
    /** A Rwandan mobile number, stored as `+2507xxxxxxxx`. */
    phone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
    idKind: z.ZodEnum<["national_id", "passport"]>;
    /** Stored without spaces or dashes, letters upper case. */
    idNumber: z.ZodEffects<z.ZodString, string, string>;
    /** ISO country code (`RW` for a Rwandan). Required, so a partial edit never resets it. */
    nationality: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    email: string;
    phone: string;
    idNumber: string;
    idKind: "national_id" | "passport";
    nationality: string;
}, {
    fullName: string;
    email: string;
    phone: string;
    idNumber: string;
    idKind: "national_id" | "passport";
    nationality: string;
}>, {
    fullName: string;
    email: string;
    phone: string;
    idNumber: string;
    idKind: "national_id" | "passport";
    nationality: string;
}, {
    fullName: string;
    email: string;
    phone: string;
    idNumber: string;
    idKind: "national_id" | "passport";
    nationality: string;
}>;
export type TenantInput = z.infer<typeof TenantInput>;
export declare const LeaseTermsInput: z.ZodObject<{
    billingStartsOn: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
    graceDays: z.ZodDefault<z.ZodNumber>;
    noticeDays: z.ZodDefault<z.ZodNumber>;
    occupants: z.ZodDefault<z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>>;
    otherTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startDate: z.ZodEffects<z.ZodString, string, string>;
    endDate: z.ZodEffects<z.ZodString, string, string>;
    monthlyRentRwf: z.ZodNumber;
    depositRwf: z.ZodNumber;
    rentDueDay: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    noticeDays: number;
    rentDueDay: number;
    graceDays: number;
    occupants: string[];
    depositRwf: number;
    otherTerms?: string | null | undefined;
    billingStartsOn?: string | null | undefined;
}, {
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    rentDueDay: number;
    depositRwf: number;
    noticeDays?: number | undefined;
    graceDays?: number | undefined;
    occupants?: string[] | undefined;
    otherTerms?: string | null | undefined;
    billingStartsOn?: string | null | undefined;
}>;
export type LeaseTermsInput = z.infer<typeof LeaseTermsInput>;
/**
 * Draft a lease on one unit (`POST /ops/rentals/leases`).
 *
 * The tenant is an existing tenant record (`tenantId`) or a new one
 * (`tenant`), never both. The tenant's email is where the invitation to read
 * and sign goes, so a likely typo is refused unless `confirmEmail` says it is
 * right. The dates are checked against Kigali today when the request is read.
 */
export declare const CreateLeaseRequest: z.ZodEffects<z.ZodObject<{
    unitId: z.ZodString;
    tenantId: z.ZodOptional<z.ZodString>;
    tenant: z.ZodOptional<z.ZodObject<{
        fullName: z.ZodString;
        email: z.ZodString;
        /** A Rwandan mobile number, stored as `+2507xxxxxxxx`. */
        phone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
        idKind: z.ZodEnum<["national_id", "passport"]>;
        /** Stored without spaces or dashes, letters upper case. */
        idNumber: z.ZodEffects<z.ZodString, string, string>;
        /** ISO country code (`RW` for a Rwandan). Required, so a partial edit never resets it. */
        nationality: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        fullName: string;
        email: string;
        phone: string;
        idNumber: string;
        idKind: "national_id" | "passport";
        nationality: string;
    }, {
        fullName: string;
        email: string;
        phone: string;
        idNumber: string;
        idKind: "national_id" | "passport";
        nationality: string;
    }>>;
    terms: z.ZodObject<{
        billingStartsOn: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
        graceDays: z.ZodDefault<z.ZodNumber>;
        noticeDays: z.ZodDefault<z.ZodNumber>;
        occupants: z.ZodDefault<z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>>;
        otherTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        startDate: z.ZodEffects<z.ZodString, string, string>;
        endDate: z.ZodEffects<z.ZodString, string, string>;
        monthlyRentRwf: z.ZodNumber;
        depositRwf: z.ZodNumber;
        rentDueDay: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        noticeDays: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        depositRwf: number;
        otherTerms?: string | null | undefined;
        billingStartsOn?: string | null | undefined;
    }, {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        rentDueDay: number;
        depositRwf: number;
        noticeDays?: number | undefined;
        graceDays?: number | undefined;
        occupants?: string[] | undefined;
        otherTerms?: string | null | undefined;
        billingStartsOn?: string | null | undefined;
    }>;
    /** The broker who brought this tenant, when one did. */
    brokerId: z.ZodOptional<z.ZodString>;
    /** The tenant's email is right as typed, though it looks like a typo. */
    confirmEmail: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    terms: {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        noticeDays: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        depositRwf: number;
        otherTerms?: string | null | undefined;
        billingStartsOn?: string | null | undefined;
    };
    unitId: string;
    brokerId?: string | undefined;
    tenant?: {
        fullName: string;
        email: string;
        phone: string;
        idNumber: string;
        idKind: "national_id" | "passport";
        nationality: string;
    } | undefined;
    tenantId?: string | undefined;
    confirmEmail?: boolean | undefined;
}, {
    terms: {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        rentDueDay: number;
        depositRwf: number;
        noticeDays?: number | undefined;
        graceDays?: number | undefined;
        occupants?: string[] | undefined;
        otherTerms?: string | null | undefined;
        billingStartsOn?: string | null | undefined;
    };
    unitId: string;
    brokerId?: string | undefined;
    tenant?: {
        fullName: string;
        email: string;
        phone: string;
        idNumber: string;
        idKind: "national_id" | "passport";
        nationality: string;
    } | undefined;
    tenantId?: string | undefined;
    confirmEmail?: boolean | undefined;
}>, {
    terms: {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        noticeDays: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        depositRwf: number;
        otherTerms?: string | null | undefined;
        billingStartsOn?: string | null | undefined;
    };
    unitId: string;
    brokerId?: string | undefined;
    tenant?: {
        fullName: string;
        email: string;
        phone: string;
        idNumber: string;
        idKind: "national_id" | "passport";
        nationality: string;
    } | undefined;
    tenantId?: string | undefined;
    confirmEmail?: boolean | undefined;
}, {
    terms: {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        rentDueDay: number;
        depositRwf: number;
        noticeDays?: number | undefined;
        graceDays?: number | undefined;
        occupants?: string[] | undefined;
        otherTerms?: string | null | undefined;
        billingStartsOn?: string | null | undefined;
    };
    unitId: string;
    brokerId?: string | undefined;
    tenant?: {
        fullName: string;
        email: string;
        phone: string;
        idNumber: string;
        idKind: "national_id" | "passport";
        nationality: string;
    } | undefined;
    tenantId?: string | undefined;
    confirmEmail?: boolean | undefined;
}>;
export type CreateLeaseRequest = z.infer<typeof CreateLeaseRequest>;
/**
 * Change a lease before the tenant signs (`PATCH /ops/rentals/leases/:id`).
 * Only what is sent changes. The API merges it with the lease and checks the
 * merged dates with `leaseDatesProblem`; an edit of a lease out for signature
 * voids the landlord's signature and returns it to draft.
 */
export declare const EditLeaseRequest: z.ZodEffects<z.ZodObject<{
    unitId: z.ZodOptional<z.ZodString>;
    tenant: z.ZodOptional<z.ZodObject<{
        fullName: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>>;
        idKind: z.ZodOptional<z.ZodEnum<["national_id", "passport"]>>;
        idNumber: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        nationality: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    }, "strip", z.ZodTypeAny, {
        fullName?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        idKind?: "national_id" | "passport" | undefined;
        nationality?: string | undefined;
    }, {
        fullName?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        idKind?: "national_id" | "passport" | undefined;
        nationality?: string | undefined;
    }>>;
    terms: z.ZodOptional<z.ZodObject<{
        startDate: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        endDate: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        billingStartsOn: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
        monthlyRentRwf: z.ZodOptional<z.ZodNumber>;
        depositRwf: z.ZodOptional<z.ZodNumber>;
        rentDueDay: z.ZodOptional<z.ZodNumber>;
        graceDays: z.ZodOptional<z.ZodNumber>;
        noticeDays: z.ZodOptional<z.ZodNumber>;
        occupants: z.ZodOptional<z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>>;
        otherTerms: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        monthlyRentRwf?: number | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        noticeDays?: number | undefined;
        rentDueDay?: number | undefined;
        graceDays?: number | undefined;
        occupants?: string[] | undefined;
        otherTerms?: string | null | undefined;
        depositRwf?: number | undefined;
        billingStartsOn?: string | null | undefined;
    }, {
        monthlyRentRwf?: number | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        noticeDays?: number | undefined;
        rentDueDay?: number | undefined;
        graceDays?: number | undefined;
        occupants?: string[] | undefined;
        otherTerms?: string | null | undefined;
        depositRwf?: number | undefined;
        billingStartsOn?: string | null | undefined;
    }>>;
    confirmEmail: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    terms?: {
        monthlyRentRwf?: number | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        noticeDays?: number | undefined;
        rentDueDay?: number | undefined;
        graceDays?: number | undefined;
        occupants?: string[] | undefined;
        otherTerms?: string | null | undefined;
        depositRwf?: number | undefined;
        billingStartsOn?: string | null | undefined;
    } | undefined;
    tenant?: {
        fullName?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        idKind?: "national_id" | "passport" | undefined;
        nationality?: string | undefined;
    } | undefined;
    unitId?: string | undefined;
    confirmEmail?: boolean | undefined;
}, {
    terms?: {
        monthlyRentRwf?: number | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        noticeDays?: number | undefined;
        rentDueDay?: number | undefined;
        graceDays?: number | undefined;
        occupants?: string[] | undefined;
        otherTerms?: string | null | undefined;
        depositRwf?: number | undefined;
        billingStartsOn?: string | null | undefined;
    } | undefined;
    tenant?: {
        fullName?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        idKind?: "national_id" | "passport" | undefined;
        nationality?: string | undefined;
    } | undefined;
    unitId?: string | undefined;
    confirmEmail?: boolean | undefined;
}>, {
    terms?: {
        monthlyRentRwf?: number | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        noticeDays?: number | undefined;
        rentDueDay?: number | undefined;
        graceDays?: number | undefined;
        occupants?: string[] | undefined;
        otherTerms?: string | null | undefined;
        depositRwf?: number | undefined;
        billingStartsOn?: string | null | undefined;
    } | undefined;
    tenant?: {
        fullName?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        idKind?: "national_id" | "passport" | undefined;
        nationality?: string | undefined;
    } | undefined;
    unitId?: string | undefined;
    confirmEmail?: boolean | undefined;
}, {
    terms?: {
        monthlyRentRwf?: number | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        noticeDays?: number | undefined;
        rentDueDay?: number | undefined;
        graceDays?: number | undefined;
        occupants?: string[] | undefined;
        otherTerms?: string | null | undefined;
        depositRwf?: number | undefined;
        billingStartsOn?: string | null | undefined;
    } | undefined;
    tenant?: {
        fullName?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        idNumber?: string | undefined;
        idKind?: "national_id" | "passport" | undefined;
        nationality?: string | undefined;
    } | undefined;
    unitId?: string | undefined;
    confirmEmail?: boolean | undefined;
}>;
export type EditLeaseRequest = z.infer<typeof EditLeaseRequest>;
/** Cancel a lease that has not started (`POST /ops/rentals/leases/:id/cancel`). */
export declare const CancelLeaseRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type CancelLeaseRequest = z.infer<typeof CancelLeaseRequest>;
//# sourceMappingURL=lease.d.ts.map