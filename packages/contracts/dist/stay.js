"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecideStayRefundRequest = exports.StayRefundQuote = exports.StayRefundRequestList = exports.StayRefundRequestView = exports.RaiseStayRefundRequest = exports.REFUND_DETAIL_MAX = exports.REFUND_SERVICE_FAILURE_NIGHTS = exports.REFUND_REPORTING_WINDOW_HOURS = exports.REFUND_REFUSAL_LABEL = exports.StayRefundRefusalReason = exports.StayRefundReason = exports.StayRefundState = exports.OpenDepartmentResult = exports.OpenDepartmentRequest = exports.STAY_REQUEST_MAX = exports.StayDepartments = exports.StayDepartment = exports.ClaimStayResult = exports.MyStays = exports.MyStay = exports.ClaimStayRequest = exports.StayRegistrationDetails = exports.StayClaimInvite = exports.IssueStayClaimInviteRequest = exports.CLAIM_CODE_PATTERN = void 0;
exports.stayRefundAssessment = stayRefundAssessment;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const ops_1 = require("./ops");
const primitives_1 = require("./primitives");
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
// ---------------------------------------------------------------------------
// Registering a guest at the desk
// ---------------------------------------------------------------------------
/*
 * The three desk-side shapes of this story — `StayRegistrationDetails`,
 * `StayClaimInvite` and `IssueStayClaimInviteRequest` — live in `ops.ts`,
 * beside `CheckInRequest` and `WalkInRequest`, which carry one of them.
 *
 * Not for tidiness: this module imports `DepartmentCategory` from `ops.ts`, so
 * defining them here and importing them there would make the two modules import
 * each other. A cycle between two files of Zod schemas is not a type-level
 * nuisance — one of them evaluates first, and whichever gets there second reads
 * `undefined` where a schema should be, at import time, in every consumer.
 */
var ops_2 = require("./ops");
Object.defineProperty(exports, "CLAIM_CODE_PATTERN", { enumerable: true, get: function () { return ops_2.CLAIM_CODE_PATTERN; } });
Object.defineProperty(exports, "IssueStayClaimInviteRequest", { enumerable: true, get: function () { return ops_2.IssueStayClaimInviteRequest; } });
Object.defineProperty(exports, "StayClaimInvite", { enumerable: true, get: function () { return ops_2.StayClaimInvite; } });
Object.defineProperty(exports, "StayRegistrationDetails", { enumerable: true, get: function () { return ops_2.StayRegistrationDetails; } });
// ---------------------------------------------------------------------------
// Claiming it
// ---------------------------------------------------------------------------
/**
 * Binding a desk-registered stay to the signed-in account.
 *
 * The code is the whole credential, so it is the whole request. There is
 * deliberately no stay id, no room number and no property: a body that named
 * the stay it wanted would be a body that could ask for a stay it was not given
 * a code for, and the code would become a second factor on a lookup rather than
 * the thing being proved.
 */
exports.ClaimStayRequest = zod_1.z
    .object({
    code: zod_1.z
        .string()
        .trim()
        .toUpperCase()
        .regex(ops_1.CLAIM_CODE_PATTERN, "That is not a claim code."),
})
    .strict();
/** How a guest sees a stay of their own. */
exports.MyStay = zod_1.z.object({
    id: primitives_1.Uuid,
    /** Null for a walk in, which never had one. */
    bookingId: primitives_1.Uuid.nullable(),
    bookingReference: zod_1.z.string().nullable(),
    propertyId: primitives_1.Uuid.nullable(),
    propertyName: zod_1.z.string().nullable(),
    roomLabel: zod_1.z.string().nullable(),
    lifecycle: zod_1.z.enum(["open", "closed"]),
    /** `staffed` when the desk admitted them, `self` when they let themselves in. */
    checkInMode: zod_1.z.enum(["staffed", "self"]),
    entryAt: zod_1.z.string(),
    plannedExitAt: zod_1.z.string().nullable(),
    actualExitAt: zod_1.z.string().nullable(),
    /** The running bill, when one is open. Null once it has been signed. */
    folioId: primitives_1.Uuid.nullable(),
    balanceRwf: primitives_1.RwfAmount.nullable(),
    /** What has actually been paid against this stay, and so what can come back. */
    paidRwf: primitives_1.RwfAmount,
    /** Set while a request is being read, so the screen shows it instead of the form. */
    openRefundRequestId: primitives_1.Uuid.nullable(),
});
exports.MyStays = zod_1.z.object({ stays: zod_1.z.array(exports.MyStay) });
/**
 * What claiming answers.
 *
 * The stay comes back whole rather than as an id, because the screen that asked
 * is the screen that now has to show it, and a second round trip on the one
 * moment the guest is waiting for is a second chance to fail.
 */
exports.ClaimStayResult = zod_1.z.object({
    stay: exports.MyStay,
    /** True when this call did the binding, false when it had already happened. */
    claimed: zod_1.z.boolean(),
});
// ---------------------------------------------------------------------------
// Talking to a department
// ---------------------------------------------------------------------------
/**
 * A desk a guest may write to, as the guest sees it.
 *
 * ONLY departments the property marked `guest_requestable`. That column has
 * existed since ADR-016 and nothing read it: the guest surface had no way to
 * start a conversation at all, so every department was equally unreachable and
 * the flag was decoration. It is the property's control over which of its
 * internal desks take messages from guests, and Accounting is not one of them.
 */
exports.StayDepartment = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    departmentCategory: ops_1.DepartmentCategory,
    /** The department's own line, for the guest who would rather phone. */
    phone: zod_1.z.string().nullable(),
    /** The conversation that already exists with this desk, when one does. */
    threadId: primitives_1.Uuid.nullable(),
    unreadCount: zod_1.z.number().int().nonnegative(),
    lastMessageAt: zod_1.z.string().nullable(),
});
exports.StayDepartments = zod_1.z.object({
    stayId: primitives_1.Uuid,
    departments: zod_1.z.array(exports.StayDepartment),
});
/** Longest first message. Same ceiling as any other message in a thread. */
exports.STAY_REQUEST_MAX = 4000;
/**
 * Open (or re-open) the conversation with one department, and say something.
 *
 * THE FIRST MESSAGE IS REQUIRED. A thread with no message in it is a row the
 * desk sees as a guest who wanted something and did not say what, and it is the
 * single most common way a "contact us" surface produces noise. One call, one
 * transaction: the thread and the first line are written together or neither
 * is.
 */
exports.OpenDepartmentRequest = zod_1.z
    .object({
    departmentId: primitives_1.Uuid,
    /** Optional one-liner for the desk's list view. */
    subject: zod_1.z.string().trim().min(1).max(120).optional(),
    body: zod_1.z.string().trim().min(1).max(exports.STAY_REQUEST_MAX),
})
    .strict();
exports.OpenDepartmentResult = zod_1.z.object({
    threadId: primitives_1.Uuid,
    departmentId: primitives_1.Uuid,
    departmentName: zod_1.z.string().nullable(),
    /** False when the guest already had this conversation and we appended to it. */
    created: zod_1.z.boolean(),
});
// ---------------------------------------------------------------------------
// Asking for money back
// ---------------------------------------------------------------------------
exports.StayRefundState = zod_1.z.enum([
    "submitted",
    "approved",
    "rejected",
    "withdrawn",
]);
exports.StayRefundReason = zod_1.z.enum([
    "service_failure",
    "room_not_as_described",
    "cleanliness",
    "noise",
    "maintenance_unresolved",
    "overcharged",
    "early_departure",
    "changed_plans",
    "other",
]);
exports.StayRefundRefusalReason = zod_1.z.enum([
    "non_refundable_rate",
    "outside_cancellation_window",
    "nights_already_consumed",
    "no_show_policy",
    "house_rules_breach",
    "damage_to_property",
    "third_party_booking",
    "not_reported_during_stay",
    "duplicate_request",
    "other",
]);
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
exports.REFUND_REFUSAL_LABEL = {
    non_refundable_rate: "This stay was booked on the non-refundable rate, which is cheaper because it is not refundable.",
    outside_cancellation_window: "The cancellation window on this booking's rate had already closed when the request was made.",
    nights_already_consumed: "The nights being claimed for have already been stayed, and a night slept is not refundable.",
    no_show_policy: "The property's no-show policy applies to this reservation.",
    house_rules_breach: "The stay ended under the property's house rules.",
    damage_to_property: "Damage recorded against this stay is being settled first.",
    third_party_booking: "This booking was paid to a travel agent or booking site, which holds the money and must refund it.",
    not_reported_during_stay: "This was raised after the stay ended, too late for the property to check or put right.",
    duplicate_request: "This has already been answered on an earlier request.",
    other: "See the property's note below.",
};
/**
 * How long after checkout a complaint can still be assessed against the rules.
 *
 * Three days. Long enough that somebody who flew home on the morning of
 * departure can still raise it, short enough that the property can still check
 * the room, read the housekeeping log and ask the staff who were on shift. A
 * complaint nobody can verify is not a complaint anybody can fairly decide.
 */
exports.REFUND_REPORTING_WINDOW_HOURS = 72;
/**
 * The most the rules SUGGEST for a service complaint, in nights.
 *
 * One night. The engine cannot know how many nights a cold shower spoilt, and
 * guessing high would turn a suggestion into an expectation the property then
 * has to argue down in front of the guest. It is a ceiling on the SUGGESTION
 * and not on the decision: `refund.decide` may approve more, which is what a
 * front office manager does all day.
 */
exports.REFUND_SERVICE_FAILURE_NIGHTS = 1;
/** Reasons that say "you did not deliver", as opposed to "I changed my mind". */
const SERVICE_REASONS = [
    "service_failure",
    "room_not_as_described",
    "cleanliness",
    "noise",
    "maintenance_unresolved",
];
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
function stayRefundAssessment(input) {
    const paid = Math.max(0, Math.floor(input.paidRwf));
    const cap = (amountRwf) => Math.max(0, Math.min(paid, Math.floor(amountRwf)));
    if (paid <= 0) {
        return {
            eligible: false,
            maxRefundRwf: 0,
            rule: "Nothing has been paid on this stay yet, so there is nothing to refund. Anything you are charged for will be settled on the bill.",
            refusalReason: null,
        };
    }
    if (input.lifecycle === "closed" &&
        input.hoursSinceExit !== null &&
        input.hoursSinceExit > exports.REFUND_REPORTING_WINDOW_HOURS) {
        return {
            eligible: false,
            maxRefundRwf: 0,
            rule: `Raised more than ${exports.REFUND_REPORTING_WINDOW_HOURS / 24} days after checkout, which is past the window for the property to check it.`,
            refusalReason: "not_reported_during_stay",
        };
    }
    if (SERVICE_REASONS.includes(input.reason)) {
        const nightly = nightlyRate(input);
        const ceiling = cap(nightly * exports.REFUND_SERVICE_FAILURE_NIGHTS);
        return {
            eligible: ceiling > 0,
            maxRefundRwf: ceiling,
            rule: ceiling > 0
                ? `A complaint about the room or the service is judged on what happened, not on the rate booked. The rules here suggest up to ${exports.REFUND_SERVICE_FAILURE_NIGHTS} night (${ceiling.toLocaleString("en-RW")} RWF); the property can agree more.`
                : "A complaint about the room or the service is judged on what happened. There is no nightly rate recorded on this stay, so the property will price it.",
            refusalReason: null,
        };
    }
    if (input.reason === "overcharged") {
        return {
            eligible: true,
            maxRefundRwf: paid,
            rule: "A billing query is checked against the bill line by line, so anything charged in error comes back in full.",
            refusalReason: null,
        };
    }
    if (input.reason === "early_departure" || input.reason === "changed_plans") {
        if (input.nonRefundable) {
            return {
                eligible: false,
                maxRefundRwf: 0,
                rule: exports.REFUND_REFUSAL_LABEL.non_refundable_rate,
                refusalReason: "non_refundable_rate",
            };
        }
        const unusedNights = Math.max(0, input.nightsBooked - input.nightsConsumed);
        if (unusedNights === 0) {
            return {
                eligible: false,
                maxRefundRwf: 0,
                rule: exports.REFUND_REFUSAL_LABEL.nights_already_consumed,
                refusalReason: "nights_already_consumed",
            };
        }
        const tier = input.tier ?? "flexible";
        const percent = booking_1.CANCELLATION_TIERS[tier].afterPercent;
        if (percent === 0) {
            return {
                eligible: false,
                maxRefundRwf: 0,
                rule: `The ${tier.replace(/_/g, " ")} policy this stay was booked on refunds nothing once check-in has passed.`,
                refusalReason: "outside_cancellation_window",
            };
        }
        const unusedValue = nightlyRate(input) * unusedNights;
        const ceiling = cap((unusedValue * percent) / 100);
        return {
            eligible: ceiling > 0,
            maxRefundRwf: ceiling,
            rule: `${unusedNights} night${unusedNights === 1 ? "" : "s"} of this stay are unused. The ${tier.replace(/_/g, " ")} policy refunds ${percent}% of them after check-in: ${ceiling.toLocaleString("en-RW")} RWF.`,
            refusalReason: ceiling > 0 ? null : "outside_cancellation_window",
        };
    }
    return {
        eligible: false,
        maxRefundRwf: 0,
        rule: "This one is not covered by a standing rule, so somebody at the property will read it and answer.",
        refusalReason: null,
    };
}
/**
 * A night's price, falling back to the paid total spread over the nights
 * booked.
 *
 * The fall back matters: a walk in has no locked rate, and pricing their unused
 * nights at zero would tell them the rules owe nothing when what actually
 * happened is that nobody wrote the rate down.
 */
function nightlyRate(input) {
    if (input.nightlyRateRwf && input.nightlyRateRwf > 0) {
        return Math.floor(input.nightlyRateRwf);
    }
    if (input.nightsBooked > 0)
        return Math.floor(input.paidRwf / input.nightsBooked);
    return 0;
}
/** Longest thing a guest may type when explaining what went wrong. */
exports.REFUND_DETAIL_MAX = 2000;
/**
 * Raising one.
 *
 * `detail` is REQUIRED and a code is not enough. A property cannot check
 * "cleanliness" and cannot answer it in a way the guest will accept; it can
 * check "the bathroom was not cleaned on Tuesday or Wednesday".
 */
exports.RaiseStayRefundRequest = zod_1.z
    .object({
    reason: exports.StayRefundReason,
    detail: zod_1.z.string().trim().min(10).max(exports.REFUND_DETAIL_MAX),
    /** Absent means "whatever the rules allow", which is the normal case. */
    requestedRwf: zod_1.z.number().int().positive().optional(),
})
    .strict();
/** One request, as both sides read it. */
exports.StayRefundRequestView = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string(),
    stayId: primitives_1.Uuid,
    propertyName: zod_1.z.string().nullable(),
    roomLabel: zod_1.z.string().nullable(),
    /** The guest's name, for the property's queue. Null on an unnamed walk in. */
    guestName: zod_1.z.string().nullable(),
    reason: exports.StayRefundReason,
    detail: zod_1.z.string(),
    requestedRwf: primitives_1.RwfAmount.nullable(),
    state: exports.StayRefundState,
    /** The rules as they stood when this was raised, never recomputed on read. */
    policyEligible: zod_1.z.boolean(),
    policyMaxRwf: primitives_1.RwfAmount,
    policyRule: zod_1.z.string(),
    policyRefusalReason: exports.StayRefundRefusalReason.nullable(),
    approvedRwf: primitives_1.RwfAmount.nullable(),
    refusalReason: exports.StayRefundRefusalReason.nullable(),
    /** The sentence for the refusal code, so a client never has to own the table. */
    refusalLabel: zod_1.z.string().nullable(),
    decisionNote: zod_1.z.string().nullable(),
    decidedAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
exports.StayRefundRequestList = zod_1.z.object({
    requests: zod_1.z.array(exports.StayRefundRequestView),
});
/**
 * What a guest is shown BEFORE they submit: the same assessment, on the same
 * inputs, for each reason they might pick.
 *
 * Quoted rather than guessed at in the client, for the reason
 * `CancellationQuote` exists: the number on the confirm screen has to be the
 * number the property's queue shows, or the first thing the guest says is that
 * the app promised them something.
 */
exports.StayRefundQuote = zod_1.z.object({
    stayId: primitives_1.Uuid,
    reason: exports.StayRefundReason,
    eligible: zod_1.z.boolean(),
    maxRefundRwf: primitives_1.RwfAmount,
    rule: zod_1.z.string(),
    refusalReason: exports.StayRefundRefusalReason.nullable(),
    /** What has been paid, so the screen can show what the ceiling is a share of. */
    paidRwf: primitives_1.RwfAmount,
    /** Why the guest cannot raise one at all, when they cannot. */
    refusal: zod_1.z.string().nullable(),
});
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
exports.DecideStayRefundRequest = zod_1.z.discriminatedUnion("decision", [
    zod_1.z
        .object({
        decision: zod_1.z.literal("approve"),
        /**
         * What to give back. Zero is legitimate and means "we agree with you and
         * the answer is still nothing" — a rare but real outcome that a refusal
         * would word as a fight.
         */
        approvedRwf: zod_1.z.number().int().nonnegative(),
        note: zod_1.z.string().trim().max(1000).optional(),
    })
        .strict(),
    zod_1.z
        .object({
        decision: zod_1.z.literal("reject"),
        refusalReason: exports.StayRefundRefusalReason,
        /**
         * Required when the reason is `other`, because `other` says nothing on
         * its own and a refusal that says nothing is the one thing this whole
         * path exists to prevent. Checked by the `superRefine` below rather than
         * on this branch: a `discriminatedUnion` takes plain objects, and a
         * branch carrying its own `refine` is a `ZodEffects` it will not accept.
         */
        note: zod_1.z.string().trim().max(1000).optional(),
    })
        .strict(),
]).superRefine((v, ctx) => {
    if (v.decision === "reject" && v.refusalReason === "other" && (v.note?.trim().length ?? 0) === 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Say why, when the reason is 'other'.",
            path: ["note"],
        });
    }
});
//# sourceMappingURL=stay.js.map