import { z } from "zod";
import { IsoDate, PaymentAttemptState, PaymentInstrument } from "./booking";
import { BrokerDeal, type BrokerDealTerms, brokerCommissionSplit } from "./broker-deals";
import { Uuid, ContactPhone } from "./primitives";

/**
 * A broker's bookings at a hotel (2026-11-02, phase 2): under a running deal,
 * a broker books one room or many at once for their clients, with a guest's
 * name on every room. The rooms are confirmed straight away when they are free,
 * because the hotel agreed to the deal.
 *
 * Two ways to pay:
 * - `at_hotel`: nothing is taken now. The guests pay at the desk, and the
 *   commission is taken off the hotel's next payout once they check out.
 * - `momo`: one Mobile Money payment for the whole group, held in escrow like
 *   a guest's own booking. The rooms are written only once it lands; if any of
 *   them sold out meanwhile, the whole payment is refunded and nothing is booked.
 *
 * Every room becomes its own booking (one room, one booking, as everywhere
 * else), and the group ties them together under one reference.
 */

export const BROKER_GROUP_MAX_ROOMS = 50;

export const BrokerBookingPayment = z.enum(["at_hotel", "momo"]);
export type BrokerBookingPayment = z.infer<typeof BrokerBookingPayment>;

/**
 * - `awaiting_payment`: a MoMo prompt is out; nothing is booked yet;
 * - `booked`: every room is a confirmed booking;
 * - `failed`: the payment was refused or never answered, or the rooms sold out
 *   before it landed (refunded in full). Nothing is booked.
 */
export const BrokerGroupStatus = z.enum(["awaiting_payment", "booked", "failed"]);
export type BrokerGroupStatus = z.infer<typeof BrokerGroupStatus>;

/** `GET /ops/broker/hotels/:orgId/rooms?checkIn&checkOut`: what can be booked, and at what rate. */
export const BrokerRoomsQuery = z.object({ checkIn: IsoDate, checkOut: IsoDate });
export type BrokerRoomsQuery = z.infer<typeof BrokerRoomsQuery>;

export const BrokerRoomType = z.object({
  id: Uuid,
  name: z.string(),
  /** Most guests a room sleeps (infants not counted). */
  capacity: z.number().int(),
  maxAdults: z.number().int().nullable(),
  maxChildren: z.number().int().nullable(),
  /** `per_person`: the rate is per guest per night; `per_unit`: per room per night. */
  priceBasis: z.string().nullable(),
  nightlyRateRwf: z.number().int(),
  singleGuestPriceRwf: z.number().int().nullable(),
  minStay: z.number().int().nullable(),
  /** Rooms free on every night of the stay. */
  freeRooms: z.number().int(),
});
export type BrokerRoomType = z.infer<typeof BrokerRoomType>;

export const BrokerRoomOffer = z.object({
  hotel: z.object({ orgId: Uuid, name: z.string() }),
  deal: BrokerDeal,
  checkIn: IsoDate,
  checkOut: IsoDate,
  nights: z.number().int(),
  roomTypes: z.array(BrokerRoomType),
});
export type BrokerRoomOffer = z.infer<typeof BrokerRoomOffer>;

const GuestName = z
  .string()
  .trim()
  .min(2, "Give the guest's name.")
  .max(120, "Keep the name under 120 characters.");

export const BrokerBookingRoom = z.object({
  roomTypeId: Uuid,
  /** Who sleeps in this room: the desk checks them in by this name. */
  guestName: GuestName,
  guestPhone: ContactPhone.nullable().optional(),
  adults: z.number().int().min(1, "At least one adult.").max(20),
  children: z.number().int().min(0).max(20),
});
export type BrokerBookingRoom = z.infer<typeof BrokerBookingRoom>;

/** `POST /ops/broker/hotels/:orgId/bookings`. */
export const CreateBrokerBookingRequest = z
  .object({
    checkIn: IsoDate,
    checkOut: IsoDate,
    rooms: z
      .array(BrokerBookingRoom)
      .min(1, "Add at least one room.")
      .max(BROKER_GROUP_MAX_ROOMS, `At most ${BROKER_GROUP_MAX_ROOMS} rooms in one booking.`),
    /** The number the hotel calls about the whole booking: usually the broker's own. */
    contactPhone: ContactPhone,
    note: z.string().trim().max(1000, "Keep the note under 1,000 characters.").nullable().optional(),
    payment: z.discriminatedUnion("method", [
      z.object({ method: z.literal("at_hotel") }),
      z.object({
        method: z.literal("momo"),
        instrument: PaymentInstrument,
        /** One per press of Pay, reused on every retry of that press. */
        attemptToken: z.string().uuid(),
      }),
    ]),
  })
  .refine((v) => v.checkOut > v.checkIn, { message: "Check-out comes after check-in.", path: ["checkOut"] });
export type CreateBrokerBookingRequest = z.infer<typeof CreateBrokerBookingRequest>;

/** What the deal earns on a group, as it stands when it is booked; paid out after the stays (phase 3). */
export const BrokerCommissionEstimate = z.object({
  commissionRwf: z.number().int(),
  brokerRwf: z.number().int(),
  injishiRwf: z.number().int(),
  /** Why it is zero, when it is: a bulk deal needs more rooms than this booking has. */
  note: z.string().nullable(),
});
export type BrokerCommissionEstimate = z.infer<typeof BrokerCommissionEstimate>;

export const BrokerGroupRoom = z.object({
  roomTypeId: Uuid,
  roomTypeName: z.string(),
  guestName: z.string(),
  guestPhone: z.string().nullable(),
  adults: z.number().int(),
  children: z.number().int(),
  grossRwf: z.number().int(),
  /** The booking once written; null while the group waits for its payment or after it failed. */
  booking: z.object({ id: Uuid, reference: z.string(), status: z.string() }).nullable(),
});
export type BrokerGroupRoom = z.infer<typeof BrokerGroupRoom>;

export const BrokerBookingGroup = z.object({
  id: Uuid,
  /** `BG-7Q2M-4XKD`, what the broker and the hotel say on the phone. */
  reference: z.string(),
  hotel: z.object({ orgId: Uuid, name: z.string() }),
  dealId: Uuid,
  checkIn: IsoDate,
  checkOut: IsoDate,
  nights: z.number().int(),
  payment: BrokerBookingPayment,
  status: BrokerGroupStatus,
  totalRwf: z.number().int(),
  commission: BrokerCommissionEstimate,
  contactPhone: z.string(),
  note: z.string().nullable(),
  rooms: z.array(BrokerGroupRoom),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  /** The MoMo prompt behind a `momo` group, while there is one to show. */
  attempt: z
    .object({
      attemptToken: z.string(),
      state: PaymentAttemptState,
      payerMasked: z.string().nullable(),
      expiresAt: z.string(),
      failureReason: z.string().nullable(),
    })
    .nullable(),
});
export type BrokerBookingGroup = z.infer<typeof BrokerBookingGroup>;

export const BrokerBookingList = z.object({ groups: z.array(BrokerBookingGroup) });
export type BrokerBookingList = z.infer<typeof BrokerBookingList>;

/**
 * What a deal earns on a booking: a percent of what the guests pay for the rooms, or the fixed sum when
 * the booking has at least the deal's fewest rooms. Split 85 / 15 between the broker and Injishi.
 */
export function brokerCommissionFor(terms: BrokerDealTerms, totalRwf: number, rooms: number): BrokerCommissionEstimate {
  if (terms.kind === "percent") {
    const commissionRwf = Math.round((totalRwf * terms.percent) / 100);
    return { commissionRwf, ...brokerCommissionSplit(commissionRwf), note: null };
  }
  if (rooms < terms.minRooms) {
    return {
      commissionRwf: 0,
      brokerRwf: 0,
      injishiRwf: 0,
      note: `This deal pays on bookings of ${terms.minRooms} rooms or more.`,
    };
  }
  return { commissionRwf: terms.amountRwf, ...brokerCommissionSplit(terms.amountRwf), note: null };
}
