import { z } from "zod";
import { CancellationTier } from "./booking";
/**
 * THE GUEST'S OWN STAY — `/api/v1/me/stays*` and the desk commands behind it
 * (§6.8).
 *
 * Four things a person does with a stay somebody else typed for them at a front
 * desk, and they are four steps of one story:
 *
 *  1. **Claim it.** The desk registered the guest; the guest opens the app and
 *     binds that record to their own account. Until this happens the stay
 *     belongs to nobody, and every step below is unreachable.
 *  2. **Talk to a department.** Housekeeping, the kitchen, maintenance — one
 *     conversation per department, routed to the desk rather than to a person.
 *  3. **Ask for money back.** The rules of the accommodation compute what is
 *     owed; the property decides, and a refusal has to name its rule.
 *  4. **Take an offer.** In `offers.ts`, because an offer outlives any one
 *     stay.
 *
 * ## The claim is the hinge and it is a security boundary
 *
 * A stay typed at a desk carries no `guest_user_id`. Every guest-side route
 * resolves ownership from that column, so an unclaimed stay is invisible to
 * every one of them — which is correct, and is also why "ask for a refund on
 * room 204" cannot be a route that takes a room number. The claim code is the
 * proof, it is mailed to the ONE address the desk wrote down, and binding is
 * the only way a stay ever gains an owner.
 */
export { CLAIM_CODE_PATTERN, IssueStayClaimInviteRequest, StayClaimInvite, StayRegistrationDetails, } from "./ops";
/**
 * Binding a desk-registered stay to the signed-in account.
 *
 * The code is the whole credential, so it is the whole request. There is
 * deliberately no stay id, no room number and no property: a body that named
 * the stay it wanted would be a body that could ask for a stay it was not given
 * a code for, and the code would become a second factor on a lookup rather than
 * the thing being proved.
 */
export declare const ClaimStayRequest: z.ZodObject<{
    code: z.ZodString;
}, "strict", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export type ClaimStayRequest = z.infer<typeof ClaimStayRequest>;
/** How a guest sees a stay of their own. */
export declare const MyStay: z.ZodObject<{
    id: z.ZodString;
    /** Null for a walk in, which never had one. */
    bookingId: z.ZodNullable<z.ZodString>;
    bookingReference: z.ZodNullable<z.ZodString>;
    propertyId: z.ZodNullable<z.ZodString>;
    propertyName: z.ZodNullable<z.ZodString>;
    roomLabel: z.ZodNullable<z.ZodString>;
    lifecycle: z.ZodEnum<["open", "closed"]>;
    /** `staffed` when the desk admitted them, `self` when they let themselves in. */
    checkInMode: z.ZodEnum<["staffed", "self"]>;
    entryAt: z.ZodString;
    plannedExitAt: z.ZodNullable<z.ZodString>;
    actualExitAt: z.ZodNullable<z.ZodString>;
    /** The running bill, when one is open. Null once it has been signed. */
    folioId: z.ZodNullable<z.ZodString>;
    balanceRwf: z.ZodNullable<z.ZodNumber>;
    /** What has actually been paid against this stay, and so what can come back. */
    paidRwf: z.ZodNumber;
    /** Set while a request is being read, so the screen shows it instead of the form. */
    openRefundRequestId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    paidRwf: number;
    propertyName: string | null;
    bookingId: string | null;
    roomLabel: string | null;
    lifecycle: "open" | "closed";
    entryAt: string;
    plannedExitAt: string | null;
    actualExitAt: string | null;
    propertyId: string | null;
    balanceRwf: number | null;
    folioId: string | null;
    bookingReference: string | null;
    checkInMode: "self" | "staffed";
    openRefundRequestId: string | null;
}, {
    id: string;
    paidRwf: number;
    propertyName: string | null;
    bookingId: string | null;
    roomLabel: string | null;
    lifecycle: "open" | "closed";
    entryAt: string;
    plannedExitAt: string | null;
    actualExitAt: string | null;
    propertyId: string | null;
    balanceRwf: number | null;
    folioId: string | null;
    bookingReference: string | null;
    checkInMode: "self" | "staffed";
    openRefundRequestId: string | null;
}>;
export type MyStay = z.infer<typeof MyStay>;
export declare const MyStays: z.ZodObject<{
    stays: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** Null for a walk in, which never had one. */
        bookingId: z.ZodNullable<z.ZodString>;
        bookingReference: z.ZodNullable<z.ZodString>;
        propertyId: z.ZodNullable<z.ZodString>;
        propertyName: z.ZodNullable<z.ZodString>;
        roomLabel: z.ZodNullable<z.ZodString>;
        lifecycle: z.ZodEnum<["open", "closed"]>;
        /** `staffed` when the desk admitted them, `self` when they let themselves in. */
        checkInMode: z.ZodEnum<["staffed", "self"]>;
        entryAt: z.ZodString;
        plannedExitAt: z.ZodNullable<z.ZodString>;
        actualExitAt: z.ZodNullable<z.ZodString>;
        /** The running bill, when one is open. Null once it has been signed. */
        folioId: z.ZodNullable<z.ZodString>;
        balanceRwf: z.ZodNullable<z.ZodNumber>;
        /** What has actually been paid against this stay, and so what can come back. */
        paidRwf: z.ZodNumber;
        /** Set while a request is being read, so the screen shows it instead of the form. */
        openRefundRequestId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        paidRwf: number;
        propertyName: string | null;
        bookingId: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
        propertyId: string | null;
        balanceRwf: number | null;
        folioId: string | null;
        bookingReference: string | null;
        checkInMode: "self" | "staffed";
        openRefundRequestId: string | null;
    }, {
        id: string;
        paidRwf: number;
        propertyName: string | null;
        bookingId: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
        propertyId: string | null;
        balanceRwf: number | null;
        folioId: string | null;
        bookingReference: string | null;
        checkInMode: "self" | "staffed";
        openRefundRequestId: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    stays: {
        id: string;
        paidRwf: number;
        propertyName: string | null;
        bookingId: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
        propertyId: string | null;
        balanceRwf: number | null;
        folioId: string | null;
        bookingReference: string | null;
        checkInMode: "self" | "staffed";
        openRefundRequestId: string | null;
    }[];
}, {
    stays: {
        id: string;
        paidRwf: number;
        propertyName: string | null;
        bookingId: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
        propertyId: string | null;
        balanceRwf: number | null;
        folioId: string | null;
        bookingReference: string | null;
        checkInMode: "self" | "staffed";
        openRefundRequestId: string | null;
    }[];
}>;
export type MyStays = z.infer<typeof MyStays>;
/**
 * What claiming answers.
 *
 * The stay comes back whole rather than as an id, because the screen that asked
 * is the screen that now has to show it, and a second round trip on the one
 * moment the guest is waiting for is a second chance to fail.
 */
export declare const ClaimStayResult: z.ZodObject<{
    stay: z.ZodObject<{
        id: z.ZodString;
        /** Null for a walk in, which never had one. */
        bookingId: z.ZodNullable<z.ZodString>;
        bookingReference: z.ZodNullable<z.ZodString>;
        propertyId: z.ZodNullable<z.ZodString>;
        propertyName: z.ZodNullable<z.ZodString>;
        roomLabel: z.ZodNullable<z.ZodString>;
        lifecycle: z.ZodEnum<["open", "closed"]>;
        /** `staffed` when the desk admitted them, `self` when they let themselves in. */
        checkInMode: z.ZodEnum<["staffed", "self"]>;
        entryAt: z.ZodString;
        plannedExitAt: z.ZodNullable<z.ZodString>;
        actualExitAt: z.ZodNullable<z.ZodString>;
        /** The running bill, when one is open. Null once it has been signed. */
        folioId: z.ZodNullable<z.ZodString>;
        balanceRwf: z.ZodNullable<z.ZodNumber>;
        /** What has actually been paid against this stay, and so what can come back. */
        paidRwf: z.ZodNumber;
        /** Set while a request is being read, so the screen shows it instead of the form. */
        openRefundRequestId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        paidRwf: number;
        propertyName: string | null;
        bookingId: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
        propertyId: string | null;
        balanceRwf: number | null;
        folioId: string | null;
        bookingReference: string | null;
        checkInMode: "self" | "staffed";
        openRefundRequestId: string | null;
    }, {
        id: string;
        paidRwf: number;
        propertyName: string | null;
        bookingId: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
        propertyId: string | null;
        balanceRwf: number | null;
        folioId: string | null;
        bookingReference: string | null;
        checkInMode: "self" | "staffed";
        openRefundRequestId: string | null;
    }>;
    /** True when this call did the binding, false when it had already happened. */
    claimed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    claimed: boolean;
    stay: {
        id: string;
        paidRwf: number;
        propertyName: string | null;
        bookingId: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
        propertyId: string | null;
        balanceRwf: number | null;
        folioId: string | null;
        bookingReference: string | null;
        checkInMode: "self" | "staffed";
        openRefundRequestId: string | null;
    };
}, {
    claimed: boolean;
    stay: {
        id: string;
        paidRwf: number;
        propertyName: string | null;
        bookingId: string | null;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
        propertyId: string | null;
        balanceRwf: number | null;
        folioId: string | null;
        bookingReference: string | null;
        checkInMode: "self" | "staffed";
        openRefundRequestId: string | null;
    };
}>;
export type ClaimStayResult = z.infer<typeof ClaimStayResult>;
/**
 * A desk a guest may write to, as the guest sees it.
 *
 * ONLY departments the property marked `guest_requestable`. That column has
 * existed since ADR-016 and nothing read it: the guest surface had no way to
 * start a conversation at all, so every department was equally unreachable and
 * the flag was decoration. It is the property's control over which of its
 * internal desks take messages from guests, and Accounting is not one of them.
 */
export declare const StayDepartment: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    departmentCategory: z.ZodEnum<["rooms", "fnb", "spa_recreation", "other_operated", "misc_income", "admin_general", "sales_marketing", "it", "engineering", "utilities", "hr"]>;
    /** The department's own line, for the guest who would rather phone. */
    phone: z.ZodNullable<z.ZodString>;
    /** The conversation that already exists with this desk, when one does. */
    threadId: z.ZodNullable<z.ZodString>;
    unreadCount: z.ZodNumber;
    lastMessageAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    phone: string | null;
    lastMessageAt: string | null;
    threadId: string | null;
    departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
    unreadCount: number;
}, {
    name: string;
    id: string;
    phone: string | null;
    lastMessageAt: string | null;
    threadId: string | null;
    departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
    unreadCount: number;
}>;
export type StayDepartment = z.infer<typeof StayDepartment>;
export declare const StayDepartments: z.ZodObject<{
    stayId: z.ZodString;
    departments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        departmentCategory: z.ZodEnum<["rooms", "fnb", "spa_recreation", "other_operated", "misc_income", "admin_general", "sales_marketing", "it", "engineering", "utilities", "hr"]>;
        /** The department's own line, for the guest who would rather phone. */
        phone: z.ZodNullable<z.ZodString>;
        /** The conversation that already exists with this desk, when one does. */
        threadId: z.ZodNullable<z.ZodString>;
        unreadCount: z.ZodNumber;
        lastMessageAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        phone: string | null;
        lastMessageAt: string | null;
        threadId: string | null;
        departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
        unreadCount: number;
    }, {
        name: string;
        id: string;
        phone: string | null;
        lastMessageAt: string | null;
        threadId: string | null;
        departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
        unreadCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    stayId: string;
    departments: {
        name: string;
        id: string;
        phone: string | null;
        lastMessageAt: string | null;
        threadId: string | null;
        departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
        unreadCount: number;
    }[];
}, {
    stayId: string;
    departments: {
        name: string;
        id: string;
        phone: string | null;
        lastMessageAt: string | null;
        threadId: string | null;
        departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
        unreadCount: number;
    }[];
}>;
export type StayDepartments = z.infer<typeof StayDepartments>;
/** Longest first message. Same ceiling as any other message in a thread. */
export declare const STAY_REQUEST_MAX = 4000;
/**
 * Open (or re-open) the conversation with one department, and say something.
 *
 * THE FIRST MESSAGE IS REQUIRED. A thread with no message in it is a row the
 * desk sees as a guest who wanted something and did not say what, and it is the
 * single most common way a "contact us" surface produces noise. One call, one
 * transaction: the thread and the first line are written together or neither
 * is.
 */
export declare const OpenDepartmentRequest: z.ZodObject<{
    departmentId: z.ZodString;
    /** Optional one-liner for the desk's list view. */
    subject: z.ZodOptional<z.ZodString>;
    body: z.ZodString;
}, "strict", z.ZodTypeAny, {
    body: string;
    departmentId: string;
    subject?: string | undefined;
}, {
    body: string;
    departmentId: string;
    subject?: string | undefined;
}>;
export type OpenDepartmentRequest = z.infer<typeof OpenDepartmentRequest>;
export declare const OpenDepartmentResult: z.ZodObject<{
    threadId: z.ZodString;
    departmentId: z.ZodString;
    departmentName: z.ZodNullable<z.ZodString>;
    /** False when the guest already had this conversation and we appended to it. */
    created: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    departmentName: string | null;
    threadId: string;
    departmentId: string;
    created: boolean;
}, {
    departmentName: string | null;
    threadId: string;
    departmentId: string;
    created: boolean;
}>;
export type OpenDepartmentResult = z.infer<typeof OpenDepartmentResult>;
export declare const StayRefundState: z.ZodEnum<["submitted", "approved", "rejected", "withdrawn"]>;
export type StayRefundState = z.infer<typeof StayRefundState>;
export declare const StayRefundReason: z.ZodEnum<["service_failure", "room_not_as_described", "cleanliness", "noise", "maintenance_unresolved", "overcharged", "early_departure", "changed_plans", "other"]>;
export type StayRefundReason = z.infer<typeof StayRefundReason>;
export declare const StayRefundRefusalReason: z.ZodEnum<["non_refundable_rate", "outside_cancellation_window", "nights_already_consumed", "no_show_policy", "house_rules_breach", "damage_to_property", "third_party_booking", "not_reported_during_stay", "duplicate_request", "other"]>;
export type StayRefundRefusalReason = z.infer<typeof StayRefundRefusalReason>;
/**
 * What each refusal MEANS, in the words the guest is shown.
 *
 * On this side of the wire and not in the database, for the same reason
 * `PERMISSION_LABEL` is: the code is the fact and the sentence is presentation,
 * and a property that refuses in Kinyarwanda later needs one table swapped, not
 * a migration.
 *
 * Every sentence names A RULE THE GUEST WAS TOLD ABOUT BEFORE THEY PAID. That
 * is the test a new value has to pass. "Management decision" is not a refusal
 * reason; it is the absence of one, and it is what guests escalate.
 */
export declare const REFUND_REFUSAL_LABEL: Readonly<Record<StayRefundRefusalReason, string>>;
/**
 * How long after checkout a complaint can still be assessed against the rules.
 *
 * Three days. Long enough that somebody who flew home on the morning of
 * departure can still raise it, short enough that the property can still check
 * the room, read the housekeeping log and ask the staff who were on shift. A
 * complaint nobody can verify is not a complaint anybody can fairly decide.
 */
export declare const REFUND_REPORTING_WINDOW_HOURS = 72;
/**
 * The most the rules SUGGEST for a service complaint, in nights.
 *
 * One night. The engine cannot know how many nights a cold shower spoilt, and
 * guessing high would turn a suggestion into an expectation the property then
 * has to argue down in front of the guest. It is a ceiling on the SUGGESTION
 * and not on the decision: `refund.decide` may approve more, which is what a
 * front office manager does all day.
 */
export declare const REFUND_SERVICE_FAILURE_NIGHTS = 1;
/** What the rules of the accommodation say about one request. */
export interface StayRefundAssessment {
    /** Do the rules owe anything at all? */
    eligible: boolean;
    /** The ceiling the rules put on it, in francs. Zero when they owe nothing. */
    maxRefundRwf: number;
    /** The rule that decided it, in a sentence written for the guest. */
    rule: string;
    /**
     * The refusal the rules already point at, or null.
     *
     * Null with `eligible: false` is a real and distinct answer: it means the
     * rules neither owe nor refuse, and a person has to read it. `other` would
     * have collapsed "the rules say no" and "the rules say nothing" into one
     * value, and those are the two cases a desk most needs to tell apart.
     */
    refusalReason: StayRefundRefusalReason | null;
}
export interface StayRefundInputs {
    reason: StayRefundReason;
    /** The non-refundable rate, as locked on the booking. False for a walk in. */
    nonRefundable: boolean;
    /** The cancellation tier locked at sale. Null reads as `flexible`. */
    tier: CancellationTier | null;
    /** Nights contracted for. 0 for an open-ended walk in. */
    nightsBooked: number;
    /** Nights already slept when the guest asked. */
    nightsConsumed: number;
    /** The nightly rate as locked or agreed. Null falls back to the paid total. */
    nightlyRateRwf: number | null;
    /** What has actually been paid: escrow held plus payments on the folio. */
    paidRwf: number;
    /** Is the guest still in the building? */
    lifecycle: "open" | "closed";
    /** Hours since checkout, or null while the stay is open. */
    hoursSinceExit: number | null;
}
/**
 * WHAT THE ACCOMMODATION'S OWN RULES OWE ON ONE STAY, and the only place it is
 * computed.
 *
 * The guest reads this before they submit and the desk reads the same numbers
 * on the decision screen, from one call with the same inputs — so a guest is
 * never shown one figure and answered with another. It is deliberately the same
 * arrangement `cancellationRefund` has, and it consumes that function's tier
 * table rather than restating it: a property that publishes "moderate" has
 * published one policy, not one for cancelling and a second for leaving early.
 *
 * ## It is a SUGGESTION, not the answer
 *
 * Nothing here moves money and nothing here binds the property. `refund.decide`
 * may approve above the ceiling (goodwill) and may refuse below it by citing a
 * rule this function cannot see — a smashed window, a booking whose money a
 * travel agent is holding. What the property may not do is refuse WITHOUT
 * citing a rule, and that is enforced in the database, not here.
 *
 * ## In order, first match wins
 *
 * 1. **Nothing was paid.** There is no refund of nothing.
 * 2. **Raised too late.** More than {@link REFUND_REPORTING_WINDOW_HOURS} after
 *    checkout, the property can no longer check the room or ask the shift.
 * 3. **A service complaint** — dirty, noisy, broken, not as described. The rate
 *    rules do NOT apply: a non-refundable rate is a rule about changing your
 *    mind, never a licence to deliver a room nobody could sleep in. Suggests up
 *    to {@link REFUND_SERVICE_FAILURE_NIGHTS} night's rate.
 * 4. **A billing query.** The engine cannot see which line is disputed, so the
 *    ceiling is everything paid and a person reads the bill.
 * 5. **Changed plans or an early departure.** This is the cancellation policy,
 *    applied to the nights NOT yet slept. A guest who has checked in is by
 *    definition inside every tier's window, so the tier's `afterPercent` is the
 *    one that applies — the same number `cancellationRefund` would have used
 *    one minute before they walked through the door.
 * 6. **Anything else.** No entitlement and no refusal: a person decides.
 */
export declare function stayRefundAssessment(input: StayRefundInputs): StayRefundAssessment;
/** Longest thing a guest may type when explaining what went wrong. */
export declare const REFUND_DETAIL_MAX = 2000;
/**
 * Raising one.
 *
 * `detail` is REQUIRED and a code is not enough. A property cannot check
 * "cleanliness" and cannot answer it in a way the guest will accept; it can
 * check "the bathroom was not cleaned on Tuesday or Wednesday".
 */
export declare const RaiseStayRefundRequest: z.ZodObject<{
    reason: z.ZodEnum<["service_failure", "room_not_as_described", "cleanliness", "noise", "maintenance_unresolved", "overcharged", "early_departure", "changed_plans", "other"]>;
    detail: z.ZodString;
    /** Absent means "whatever the rules allow", which is the normal case. */
    requestedRwf: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    reason: "other" | "service_failure" | "room_not_as_described" | "cleanliness" | "noise" | "maintenance_unresolved" | "overcharged" | "early_departure" | "changed_plans";
    detail: string;
    requestedRwf?: number | undefined;
}, {
    reason: "other" | "service_failure" | "room_not_as_described" | "cleanliness" | "noise" | "maintenance_unresolved" | "overcharged" | "early_departure" | "changed_plans";
    detail: string;
    requestedRwf?: number | undefined;
}>;
export type RaiseStayRefundRequest = z.infer<typeof RaiseStayRefundRequest>;
/** One request, as both sides read it. */
export declare const StayRefundRequestView: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodString;
    stayId: z.ZodString;
    propertyName: z.ZodNullable<z.ZodString>;
    roomLabel: z.ZodNullable<z.ZodString>;
    /** The guest's name, for the property's queue. Null on an unnamed walk in. */
    guestName: z.ZodNullable<z.ZodString>;
    reason: z.ZodEnum<["service_failure", "room_not_as_described", "cleanliness", "noise", "maintenance_unresolved", "overcharged", "early_departure", "changed_plans", "other"]>;
    detail: z.ZodString;
    requestedRwf: z.ZodNullable<z.ZodNumber>;
    state: z.ZodEnum<["submitted", "approved", "rejected", "withdrawn"]>;
    /** The rules as they stood when this was raised, never recomputed on read. */
    policyEligible: z.ZodBoolean;
    policyMaxRwf: z.ZodNumber;
    policyRule: z.ZodString;
    policyRefusalReason: z.ZodNullable<z.ZodEnum<["non_refundable_rate", "outside_cancellation_window", "nights_already_consumed", "no_show_policy", "house_rules_breach", "damage_to_property", "third_party_booking", "not_reported_during_stay", "duplicate_request", "other"]>>;
    approvedRwf: z.ZodNullable<z.ZodNumber>;
    refusalReason: z.ZodNullable<z.ZodEnum<["non_refundable_rate", "outside_cancellation_window", "nights_already_consumed", "no_show_policy", "house_rules_breach", "damage_to_property", "third_party_booking", "not_reported_during_stay", "duplicate_request", "other"]>>;
    /** The sentence for the refusal code, so a client never has to own the table. */
    refusalLabel: z.ZodNullable<z.ZodString>;
    decisionNote: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    decidedAt: string | null;
    id: string;
    reason: "other" | "service_failure" | "room_not_as_described" | "cleanliness" | "noise" | "maintenance_unresolved" | "overcharged" | "early_departure" | "changed_plans";
    reference: string;
    decisionNote: string | null;
    detail: string;
    createdAt: string;
    stayId: string;
    propertyName: string | null;
    guestName: string | null;
    state: "submitted" | "approved" | "rejected" | "withdrawn";
    roomLabel: string | null;
    requestedRwf: number | null;
    policyEligible: boolean;
    policyMaxRwf: number;
    policyRule: string;
    policyRefusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
    approvedRwf: number | null;
    refusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
    refusalLabel: string | null;
}, {
    decidedAt: string | null;
    id: string;
    reason: "other" | "service_failure" | "room_not_as_described" | "cleanliness" | "noise" | "maintenance_unresolved" | "overcharged" | "early_departure" | "changed_plans";
    reference: string;
    decisionNote: string | null;
    detail: string;
    createdAt: string;
    stayId: string;
    propertyName: string | null;
    guestName: string | null;
    state: "submitted" | "approved" | "rejected" | "withdrawn";
    roomLabel: string | null;
    requestedRwf: number | null;
    policyEligible: boolean;
    policyMaxRwf: number;
    policyRule: string;
    policyRefusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
    approvedRwf: number | null;
    refusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
    refusalLabel: string | null;
}>;
export type StayRefundRequestView = z.infer<typeof StayRefundRequestView>;
export declare const StayRefundRequestList: z.ZodObject<{
    requests: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodString;
        stayId: z.ZodString;
        propertyName: z.ZodNullable<z.ZodString>;
        roomLabel: z.ZodNullable<z.ZodString>;
        /** The guest's name, for the property's queue. Null on an unnamed walk in. */
        guestName: z.ZodNullable<z.ZodString>;
        reason: z.ZodEnum<["service_failure", "room_not_as_described", "cleanliness", "noise", "maintenance_unresolved", "overcharged", "early_departure", "changed_plans", "other"]>;
        detail: z.ZodString;
        requestedRwf: z.ZodNullable<z.ZodNumber>;
        state: z.ZodEnum<["submitted", "approved", "rejected", "withdrawn"]>;
        /** The rules as they stood when this was raised, never recomputed on read. */
        policyEligible: z.ZodBoolean;
        policyMaxRwf: z.ZodNumber;
        policyRule: z.ZodString;
        policyRefusalReason: z.ZodNullable<z.ZodEnum<["non_refundable_rate", "outside_cancellation_window", "nights_already_consumed", "no_show_policy", "house_rules_breach", "damage_to_property", "third_party_booking", "not_reported_during_stay", "duplicate_request", "other"]>>;
        approvedRwf: z.ZodNullable<z.ZodNumber>;
        refusalReason: z.ZodNullable<z.ZodEnum<["non_refundable_rate", "outside_cancellation_window", "nights_already_consumed", "no_show_policy", "house_rules_breach", "damage_to_property", "third_party_booking", "not_reported_during_stay", "duplicate_request", "other"]>>;
        /** The sentence for the refusal code, so a client never has to own the table. */
        refusalLabel: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        decidedAt: string | null;
        id: string;
        reason: "other" | "service_failure" | "room_not_as_described" | "cleanliness" | "noise" | "maintenance_unresolved" | "overcharged" | "early_departure" | "changed_plans";
        reference: string;
        decisionNote: string | null;
        detail: string;
        createdAt: string;
        stayId: string;
        propertyName: string | null;
        guestName: string | null;
        state: "submitted" | "approved" | "rejected" | "withdrawn";
        roomLabel: string | null;
        requestedRwf: number | null;
        policyEligible: boolean;
        policyMaxRwf: number;
        policyRule: string;
        policyRefusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
        approvedRwf: number | null;
        refusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
        refusalLabel: string | null;
    }, {
        decidedAt: string | null;
        id: string;
        reason: "other" | "service_failure" | "room_not_as_described" | "cleanliness" | "noise" | "maintenance_unresolved" | "overcharged" | "early_departure" | "changed_plans";
        reference: string;
        decisionNote: string | null;
        detail: string;
        createdAt: string;
        stayId: string;
        propertyName: string | null;
        guestName: string | null;
        state: "submitted" | "approved" | "rejected" | "withdrawn";
        roomLabel: string | null;
        requestedRwf: number | null;
        policyEligible: boolean;
        policyMaxRwf: number;
        policyRule: string;
        policyRefusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
        approvedRwf: number | null;
        refusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
        refusalLabel: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    requests: {
        decidedAt: string | null;
        id: string;
        reason: "other" | "service_failure" | "room_not_as_described" | "cleanliness" | "noise" | "maintenance_unresolved" | "overcharged" | "early_departure" | "changed_plans";
        reference: string;
        decisionNote: string | null;
        detail: string;
        createdAt: string;
        stayId: string;
        propertyName: string | null;
        guestName: string | null;
        state: "submitted" | "approved" | "rejected" | "withdrawn";
        roomLabel: string | null;
        requestedRwf: number | null;
        policyEligible: boolean;
        policyMaxRwf: number;
        policyRule: string;
        policyRefusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
        approvedRwf: number | null;
        refusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
        refusalLabel: string | null;
    }[];
}, {
    requests: {
        decidedAt: string | null;
        id: string;
        reason: "other" | "service_failure" | "room_not_as_described" | "cleanliness" | "noise" | "maintenance_unresolved" | "overcharged" | "early_departure" | "changed_plans";
        reference: string;
        decisionNote: string | null;
        detail: string;
        createdAt: string;
        stayId: string;
        propertyName: string | null;
        guestName: string | null;
        state: "submitted" | "approved" | "rejected" | "withdrawn";
        roomLabel: string | null;
        requestedRwf: number | null;
        policyEligible: boolean;
        policyMaxRwf: number;
        policyRule: string;
        policyRefusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
        approvedRwf: number | null;
        refusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
        refusalLabel: string | null;
    }[];
}>;
export type StayRefundRequestList = z.infer<typeof StayRefundRequestList>;
/**
 * What a guest is shown BEFORE they submit: the same assessment, on the same
 * inputs, for each reason they might pick.
 *
 * Quoted rather than guessed at in the client, for the reason
 * `CancellationQuote` exists: the number on the confirm screen has to be the
 * number the property's queue shows, or the first thing the guest says is that
 * the app promised them something.
 */
export declare const StayRefundQuote: z.ZodObject<{
    stayId: z.ZodString;
    reason: z.ZodEnum<["service_failure", "room_not_as_described", "cleanliness", "noise", "maintenance_unresolved", "overcharged", "early_departure", "changed_plans", "other"]>;
    eligible: z.ZodBoolean;
    maxRefundRwf: z.ZodNumber;
    rule: z.ZodString;
    refusalReason: z.ZodNullable<z.ZodEnum<["non_refundable_rate", "outside_cancellation_window", "nights_already_consumed", "no_show_policy", "house_rules_breach", "damage_to_property", "third_party_booking", "not_reported_during_stay", "duplicate_request", "other"]>>;
    /** What has been paid, so the screen can show what the ceiling is a share of. */
    paidRwf: z.ZodNumber;
    /** Why the guest cannot raise one at all, when they cannot. */
    refusal: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason: "other" | "service_failure" | "room_not_as_described" | "cleanliness" | "noise" | "maintenance_unresolved" | "overcharged" | "early_departure" | "changed_plans";
    paidRwf: number;
    stayId: string;
    refusal: string | null;
    rule: string;
    refusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
    eligible: boolean;
    maxRefundRwf: number;
}, {
    reason: "other" | "service_failure" | "room_not_as_described" | "cleanliness" | "noise" | "maintenance_unresolved" | "overcharged" | "early_departure" | "changed_plans";
    paidRwf: number;
    stayId: string;
    refusal: string | null;
    rule: string;
    refusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request" | null;
    eligible: boolean;
    maxRefundRwf: number;
}>;
export type StayRefundQuote = z.infer<typeof StayRefundQuote>;
/**
 * The property's answer.
 *
 * ONE ROUTE, TWO OUTCOMES, because approving and refusing are the same decision
 * taken by the same person at the same moment, and splitting them into two
 * routes is how a queue ends up with a request somebody half-answered. The
 * shape refuses the incoherent combinations itself: an approval carries an
 * amount, a rejection carries a reason, and neither can carry the other's
 * field.
 */
export declare const DecideStayRefundRequest: z.ZodEffects<z.ZodDiscriminatedUnion<"decision", [z.ZodObject<{
    decision: z.ZodLiteral<"approve">;
    /**
     * What to give back. Zero is legitimate and means "we agree with you and
     * the answer is still nothing" — a rare but real outcome that a refusal
     * would word as a fight.
     */
    approvedRwf: z.ZodNumber;
    note: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    decision: "approve";
    approvedRwf: number;
    note?: string | undefined;
}, {
    decision: "approve";
    approvedRwf: number;
    note?: string | undefined;
}>, z.ZodObject<{
    decision: z.ZodLiteral<"reject">;
    refusalReason: z.ZodEnum<["non_refundable_rate", "outside_cancellation_window", "nights_already_consumed", "no_show_policy", "house_rules_breach", "damage_to_property", "third_party_booking", "not_reported_during_stay", "duplicate_request", "other"]>;
    /**
     * Required when the reason is `other`, because `other` says nothing on
     * its own and a refusal that says nothing is the one thing this whole
     * path exists to prevent. Checked by the `superRefine` below rather than
     * on this branch: a `discriminatedUnion` takes plain objects, and a
     * branch carrying its own `refine` is a `ZodEffects` it will not accept.
     */
    note: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    decision: "reject";
    refusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request";
    note?: string | undefined;
}, {
    decision: "reject";
    refusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request";
    note?: string | undefined;
}>]>, {
    decision: "approve";
    approvedRwf: number;
    note?: string | undefined;
} | {
    decision: "reject";
    refusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request";
    note?: string | undefined;
}, {
    decision: "approve";
    approvedRwf: number;
    note?: string | undefined;
} | {
    decision: "reject";
    refusalReason: "other" | "non_refundable_rate" | "outside_cancellation_window" | "nights_already_consumed" | "no_show_policy" | "house_rules_breach" | "damage_to_property" | "third_party_booking" | "not_reported_during_stay" | "duplicate_request";
    note?: string | undefined;
}>;
export type DecideStayRefundRequest = z.infer<typeof DecideStayRefundRequest>;
/**
 * `POST /api/v1/me/bookings/:id/check-in`: the guest's own identity for a
 * booking, sent from the phone before they reach the desk.
 *
 * The photo is uploaded first through `POST /api/v1/uploads` as `kind=id_photo`,
 * and only its key comes here, so a poor connection retries a small JSON body
 * rather than the image. The document is the same account rule registration
 * uses, which is why a passport number is 6 to 12 characters here too.
 */
export declare const SelfCheckInRequest: z.ZodObject<{
    document: z.ZodDiscriminatedUnion<"documentType", [z.ZodObject<{
        documentType: z.ZodLiteral<"national_id">;
        documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        issuingCountry: z.ZodDefault<z.ZodLiteral<"RW">>;
    }, "strip", z.ZodTypeAny, {
        documentType: "national_id";
        documentNumber: string;
        issuingCountry: "RW";
    }, {
        documentType: "national_id";
        documentNumber: string;
        issuingCountry?: "RW" | undefined;
    }>, z.ZodObject<{
        documentType: z.ZodLiteral<"passport">;
        documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        issuingCountry: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        documentType: "passport";
        documentNumber: string;
        issuingCountry: string;
    }, {
        documentType: "passport";
        documentNumber: string;
        issuingCountry: string;
    }>]>;
    idPhotoObjectKey: z.ZodString;
    addressText: z.ZodString;
}, "strip", z.ZodTypeAny, {
    addressText: string;
    document: {
        documentType: "national_id";
        documentNumber: string;
        issuingCountry: "RW";
    } | {
        documentType: "passport";
        documentNumber: string;
        issuingCountry: string;
    };
    idPhotoObjectKey: string;
}, {
    addressText: string;
    document: {
        documentType: "national_id";
        documentNumber: string;
        issuingCountry?: "RW" | undefined;
    } | {
        documentType: "passport";
        documentNumber: string;
        issuingCountry: string;
    };
    idPhotoObjectKey: string;
}>;
export type SelfCheckInRequest = z.infer<typeof SelfCheckInRequest>;
export declare const SelfCheckInReceipt: z.ZodObject<{
    bookingId: z.ZodString;
    submittedAt: z.ZodString;
    /** False only if the photo could not be attached; the identity still stands. */
    idPhotoStored: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    submittedAt: string;
    bookingId: string;
    idPhotoStored: boolean;
}, {
    submittedAt: string;
    bookingId: string;
    idPhotoStored: boolean;
}>;
export type SelfCheckInReceipt = z.infer<typeof SelfCheckInReceipt>;
//# sourceMappingURL=stay.d.ts.map