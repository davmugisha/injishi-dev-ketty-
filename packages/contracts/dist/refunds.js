"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundPayeeRequest = exports.GuestRefundList = exports.GuestRefund = exports.GuestRefundStatus = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const primitives_1 = require("./primitives");
const registration_1 = require("./registration");
/**
 * A guest's own refunds — `GET /api/v1/me/refunds` (073-gtbank-payments
 * AC-12, AC-12a).
 *
 * Cancelling is immediate and the refund follows: it is written OWED and sent
 * when Hangaa's account can cover it, so for a while a guest has a cancelled
 * booking and money on its way. This is where they watch it, and where they
 * give the bank the name and ID it needs when their account holds no verified
 * identity.
 *
 * FOUR WORDS, NOT ELEVEN. The bank record has queue reasons and provider
 * statuses a guest has no use for. `processing` is everything a machine is
 * still doing; `needs_details` is the one thing the guest can do; `delayed`
 * means a person at Injishi is on it; `paid` means the bank paid it.
 *
 * NOTHING HERE CAN CHANGE WHERE A REFUND GOES. `paidTo` is the paying number,
 * masked, and is never an input: a refund only ever goes back to the wallet
 * that paid.
 */
exports.GuestRefundStatus = zod_1.z.enum(["processing", "needs_details", "delayed", "paid"]);
exports.GuestRefund = zod_1.z.object({
    id: primitives_1.Uuid,
    /** The bank reference (`INJ…`), what a person quotes to support. */
    reference: zod_1.z.string(),
    amountRwf: primitives_1.RwfAmount,
    status: exports.GuestRefundStatus,
    /**
     * What the payment it returns was for. A stay whose booking was never made
     * (the room went while the payment was being approved) has no booking
     * reference, and must not read as a registration fee.
     */
    paidFor: zod_1.z.enum(["stay", "order", "registration_fee"]).nullable(),
    /** The booking it refunds, or null (a registrant's duplicate fee). */
    bookingReference: zod_1.z.string().nullable(),
    propertyName: zod_1.z.string().nullable(),
    /** The paying number, masked (`078••••456`). */
    paidTo: zod_1.z.string(),
    network: booking_1.MobileMoneyNetwork.nullable(),
    createdAt: zod_1.z.string(),
    paidAt: zod_1.z.string().nullable(),
});
exports.GuestRefundList = zod_1.z.object({
    refunds: zod_1.z.array(exports.GuestRefund),
    /**
     * The account holds a verified identity, so its refunds never ask for
     * details and the payee form is not offered (the route refuses it with 409).
     */
    hasVerifiedIdentity: zod_1.z.boolean(),
});
/**
 * The name and ID the bank needs, from a payer with no verified identity
 * (`PUT /api/v1/me/refunds/:transactionId/payee`). The ID is checked by its
 * type with the same rules registration uses, and no message repeats it.
 */
exports.RefundPayeeRequest = zod_1.z.discriminatedUnion("idType", [
    zod_1.z.object({
        idType: zod_1.z.literal("national_id"),
        idNumber: registration_1.RwandanNationalId,
        fullName: zod_1.z.string().trim().min(3, "Give your full name as it is on your ID.").max(120),
    }),
    zod_1.z.object({
        idType: zod_1.z.literal("passport"),
        idNumber: registration_1.PassportNumber,
        fullName: zod_1.z.string().trim().min(3, "Give your full name as it is on your passport.").max(120),
    }),
]);
//# sourceMappingURL=refunds.js.map