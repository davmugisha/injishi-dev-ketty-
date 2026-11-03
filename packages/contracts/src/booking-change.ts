import { z } from "zod";
import { IsoDate, MobileMoneyNetwork, PaymentAttemptState, PaymentInstrument } from "./booking";

/**
 * The desk changes a confirmed reservation (2026-10-30, the owner's decisions): its dates, its room type,
 * its number of guests. Never the guest's own details.
 *
 * A change reprices the stay. When it costs more the desk chooses each time: `bill` puts the difference on
 * the guest's bill, settled at the desk; `momo` asks the guest to pay it now by MoMo, and the change
 * applies once they have. When it costs less, the difference stays on the bill as credit, used against
 * extras, and what is left of it is refunded at check out.
 */

/** What the desk wants the reservation to become. Every field is the new value, changed or not. */
export const ReservationChangeAsk = z.object({
    checkIn: IsoDate,
    checkOut: IsoDate,
    roomTypeId: z.string().uuid(),
    adults: z.number().int().min(1).max(20),
    children: z.number().int().min(0).max(20),
});
export type ReservationChangeAsk = z.infer<typeof ReservationChangeAsk>;

/** How a difference is settled: nothing owed, on the bill, by MoMo now, or credit on the bill. */
export const ChangeSettlement = z.enum(["none", "bill", "momo", "credit"]);
export type ChangeSettlement = z.infer<typeof ChangeSettlement>;

/** `POST /ops/reservations/:id/change/quote`: what a change would cost, before anything moves. */
export const ReservationChangeQuote = z.object({
    nights: z.number().int(),
    fromNightlyRwf: z.number().int(),
    toNightlyRwf: z.number().int(),
    /** What the guest has paid for the room so far. */
    paidRoomRwf: z.number().int(),
    /** What the room costs after the change. */
    newRoomRwf: z.number().int(),
    /** More owed when positive, credit when negative. */
    differenceRwf: z.number().int(),
    /** The settlements the desk may choose from: `bill` and `momo` when it costs more. */
    settlements: z.array(ChangeSettlement),
    /** Whether the new room type has a free unit every night of the new dates (this booking left out). */
    available: z.boolean(),
    /** Why the change cannot be made, in the desk's words. Empty when it can. */
    problems: z.array(z.string()),
});
export type ReservationChangeQuote = z.infer<typeof ReservationChangeQuote>;

/** `POST /ops/reservations/:id/change`: the change, and how the desk settles a higher price. */
export const ReservationChangeRequest = ReservationChangeAsk.extend({
    /** Required when the change costs more; ignored otherwise. */
    settlement: z.enum(["bill", "momo"]).optional(),
    /** The guest's MoMo number, for `momo`. */
    instrument: PaymentInstrument.optional(),
    /** One per press of "Ask the guest to pay", so a retried press is the same request. */
    attemptToken: z.string().min(8).max(80).optional(),
});
export type ReservationChangeRequest = z.infer<typeof ReservationChangeRequest>;

/** The change as the desk sees it after the press. */
export const ReservationChangeResult = z.object({
    changeId: z.string().uuid(),
    /** `applied`, or `awaiting_payment` while the guest is asked by MoMo; `abandoned` if that failed. */
    status: z.enum(["applied", "awaiting_payment", "abandoned"]),
    settlement: ChangeSettlement,
    differenceRwf: z.number().int(),
    /** The MoMo request, for `momo`: poll it until it is answered. */
    attempt: z
        .object({
            attemptToken: z.string(),
            state: PaymentAttemptState,
            network: MobileMoneyNetwork.nullable(),
            payerMasked: z.string().nullable(),
            amountRwf: z.number().int().nullable(),
            expiresAt: z.string(),
            failureReason: z.string().nullable(),
        })
        .nullable(),
});
export type ReservationChangeResult = z.infer<typeof ReservationChangeResult>;

/** `GET /ops/reservations/:id/change`: the stay as it stands, and the room types it may move to. */
export const ReservationChangeForm = z.object({
    reference: z.string(),
    current: ReservationChangeAsk,
    roomTypes: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        /** Guests it sleeps; adults and children within it. */
        capacity: z.number().int(),
        maxAdults: z.number().int().nullable(),
        maxChildren: z.number().int().nullable(),
        /** Its price for the room (per room) or per guest, a night. */
        nightlyRateRwf: z.number().int().nullable(),
        priceBasis: z.string().nullable(),
    })),
    /** Why it cannot change at all (checked in, a request, no payment held). Empty when it can. */
    problems: z.array(z.string()),
});
export type ReservationChangeForm = z.infer<typeof ReservationChangeForm>;
