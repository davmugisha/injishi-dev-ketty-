import { z } from "zod";
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
export declare const GuestRefundStatus: z.ZodEnum<["processing", "needs_details", "delayed", "paid"]>;
export type GuestRefundStatus = z.infer<typeof GuestRefundStatus>;
export declare const GuestRefund: z.ZodObject<{
    id: z.ZodString;
    /** The bank reference (`INJ…`), what a person quotes to support. */
    reference: z.ZodString;
    amountRwf: z.ZodNumber;
    status: z.ZodEnum<["processing", "needs_details", "delayed", "paid"]>;
    /**
     * What the payment it returns was for. A stay whose booking was never made
     * (the room went while the payment was being approved) has no booking
     * reference, and must not read as a registration fee.
     */
    paidFor: z.ZodNullable<z.ZodEnum<["stay", "order", "registration_fee"]>>;
    /** The booking it refunds, or null (a registrant's duplicate fee). */
    bookingReference: z.ZodNullable<z.ZodString>;
    propertyName: z.ZodNullable<z.ZodString>;
    /** The paying number, masked (`078••••456`). */
    paidTo: z.ZodString;
    network: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money"]>>;
    createdAt: z.ZodString;
    paidAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "paid" | "processing" | "needs_details" | "delayed";
    id: string;
    network: "mtn_momo" | "airtel_money" | null;
    reference: string;
    amountRwf: number;
    createdAt: string;
    propertyName: string | null;
    paidAt: string | null;
    bookingReference: string | null;
    paidFor: "registration_fee" | "stay" | "order" | null;
    paidTo: string;
}, {
    status: "paid" | "processing" | "needs_details" | "delayed";
    id: string;
    network: "mtn_momo" | "airtel_money" | null;
    reference: string;
    amountRwf: number;
    createdAt: string;
    propertyName: string | null;
    paidAt: string | null;
    bookingReference: string | null;
    paidFor: "registration_fee" | "stay" | "order" | null;
    paidTo: string;
}>;
export type GuestRefund = z.infer<typeof GuestRefund>;
export declare const GuestRefundList: z.ZodObject<{
    refunds: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** The bank reference (`INJ…`), what a person quotes to support. */
        reference: z.ZodString;
        amountRwf: z.ZodNumber;
        status: z.ZodEnum<["processing", "needs_details", "delayed", "paid"]>;
        /**
         * What the payment it returns was for. A stay whose booking was never made
         * (the room went while the payment was being approved) has no booking
         * reference, and must not read as a registration fee.
         */
        paidFor: z.ZodNullable<z.ZodEnum<["stay", "order", "registration_fee"]>>;
        /** The booking it refunds, or null (a registrant's duplicate fee). */
        bookingReference: z.ZodNullable<z.ZodString>;
        propertyName: z.ZodNullable<z.ZodString>;
        /** The paying number, masked (`078••••456`). */
        paidTo: z.ZodString;
        network: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money"]>>;
        createdAt: z.ZodString;
        paidAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "paid" | "processing" | "needs_details" | "delayed";
        id: string;
        network: "mtn_momo" | "airtel_money" | null;
        reference: string;
        amountRwf: number;
        createdAt: string;
        propertyName: string | null;
        paidAt: string | null;
        bookingReference: string | null;
        paidFor: "registration_fee" | "stay" | "order" | null;
        paidTo: string;
    }, {
        status: "paid" | "processing" | "needs_details" | "delayed";
        id: string;
        network: "mtn_momo" | "airtel_money" | null;
        reference: string;
        amountRwf: number;
        createdAt: string;
        propertyName: string | null;
        paidAt: string | null;
        bookingReference: string | null;
        paidFor: "registration_fee" | "stay" | "order" | null;
        paidTo: string;
    }>, "many">;
    /**
     * The account holds a verified identity, so its refunds never ask for
     * details and the payee form is not offered (the route refuses it with 409).
     */
    hasVerifiedIdentity: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    refunds: {
        status: "paid" | "processing" | "needs_details" | "delayed";
        id: string;
        network: "mtn_momo" | "airtel_money" | null;
        reference: string;
        amountRwf: number;
        createdAt: string;
        propertyName: string | null;
        paidAt: string | null;
        bookingReference: string | null;
        paidFor: "registration_fee" | "stay" | "order" | null;
        paidTo: string;
    }[];
    hasVerifiedIdentity: boolean;
}, {
    refunds: {
        status: "paid" | "processing" | "needs_details" | "delayed";
        id: string;
        network: "mtn_momo" | "airtel_money" | null;
        reference: string;
        amountRwf: number;
        createdAt: string;
        propertyName: string | null;
        paidAt: string | null;
        bookingReference: string | null;
        paidFor: "registration_fee" | "stay" | "order" | null;
        paidTo: string;
    }[];
    hasVerifiedIdentity: boolean;
}>;
export type GuestRefundList = z.infer<typeof GuestRefundList>;
/**
 * The name and ID the bank needs, from a payer with no verified identity
 * (`PUT /api/v1/me/refunds/:transactionId/payee`). The ID is checked by its
 * type with the same rules registration uses, and no message repeats it.
 */
export declare const RefundPayeeRequest: z.ZodDiscriminatedUnion<"idType", [z.ZodObject<{
    idType: z.ZodLiteral<"national_id">;
    idNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    fullName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    idNumber: string;
    idType: "national_id";
}, {
    fullName: string;
    idNumber: string;
    idType: "national_id";
}>, z.ZodObject<{
    idType: z.ZodLiteral<"passport">;
    idNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    fullName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    idNumber: string;
    idType: "passport";
}, {
    fullName: string;
    idNumber: string;
    idType: "passport";
}>]>;
export type RefundPayeeRequest = z.infer<typeof RefundPayeeRequest>;
//# sourceMappingURL=refunds.d.ts.map