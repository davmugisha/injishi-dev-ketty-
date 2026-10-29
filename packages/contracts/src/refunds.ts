import { z } from "zod";

import { MobileMoneyNetwork } from "./booking";
import { RwfAmount, Uuid } from "./primitives";
import { PassportNumber, RwandanNationalId } from "./registration";

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
export const GuestRefundStatus = z.enum(["processing", "needs_details", "delayed", "paid"]);
export type GuestRefundStatus = z.infer<typeof GuestRefundStatus>;

export const GuestRefund = z.object({
  id: Uuid,
  /** The bank reference (`INJ…`), what a person quotes to support. */
  reference: z.string(),
  amountRwf: RwfAmount,
  status: GuestRefundStatus,
  /**
   * What the payment it returns was for. A stay whose booking was never made
   * (the room went while the payment was being approved) has no booking
   * reference, and must not read as a registration fee.
   */
  paidFor: z.enum(["stay", "order", "registration_fee"]).nullable(),
  /** The booking it refunds, or null (a registrant's duplicate fee). */
  bookingReference: z.string().nullable(),
  propertyName: z.string().nullable(),
  /** The paying number, masked (`078••••456`). */
  paidTo: z.string(),
  network: MobileMoneyNetwork.nullable(),
  createdAt: z.string(),
  paidAt: z.string().nullable(),
});
export type GuestRefund = z.infer<typeof GuestRefund>;

export const GuestRefundList = z.object({
  refunds: z.array(GuestRefund),
  /**
   * The account holds a verified identity, so its refunds never ask for
   * details and the payee form is not offered (the route refuses it with 409).
   */
  hasVerifiedIdentity: z.boolean(),
});
export type GuestRefundList = z.infer<typeof GuestRefundList>;

/**
 * The name and ID the bank needs, from a payer with no verified identity
 * (`PUT /api/v1/me/refunds/:transactionId/payee`). The ID is checked by its
 * type with the same rules registration uses, and no message repeats it.
 */
export const RefundPayeeRequest = z.discriminatedUnion("idType", [
  z.object({
    idType: z.literal("national_id"),
    idNumber: RwandanNationalId,
    fullName: z.string().trim().min(3, "Give your full name as it is on your ID.").max(120),
  }),
  z.object({
    idType: z.literal("passport"),
    idNumber: PassportNumber,
    fullName: z.string().trim().min(3, "Give your full name as it is on your passport.").max(120),
  }),
]);
export type RefundPayeeRequest = z.infer<typeof RefundPayeeRequest>;
