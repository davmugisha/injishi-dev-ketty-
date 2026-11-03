import { z } from "zod";
import { BrokerScope } from "./broker-plans";
import { Uuid } from "./primitives";
import { BrokerStatus } from "./registration";
import { CalendarDay } from "./rentals/dates";

/**
 * A broker's deal with a hotel (2026-11-02, the owner's call): the broker brings
 * the hotel bookings, and the hotel pays the broker a commission on the stays
 * those bookings become.
 *
 * Two kinds of commission:
 * - `percent`: a share of what the guest paid for the room, on every booking
 *   the broker makes there ("10% of each booking");
 * - `bulk_fixed`: one sum for a booking of at least so many rooms at once
 *   ("RWF 200,000 for a booking of 10 rooms or more").
 *
 * The broker proposes, the hotel's owner accepts or declines, and either side
 * may end a deal that is running. A broker and a hotel have at most one deal
 * that is proposed or running at a time.
 *
 * Injishi takes `BROKER_COMMISSION_INJISHI_SHARE` of every commission and the
 * broker gets the rest. The money itself (the commission taken off the hotel's
 * payout at check-out, or billed when there is no payout) is the next phase;
 * a deal says the terms both sides agreed.
 */

/** Injishi's share of a commission: 15% of what the hotel pays the broker. */
export const BROKER_COMMISSION_INJISHI_SHARE = 0.15;

export const BrokerDealKind = z.enum(["percent", "bulk_fixed"]);
export type BrokerDealKind = z.infer<typeof BrokerDealKind>;

/**
 * - `proposed`: the broker asked, the hotel has not answered;
 * - `active`: the hotel accepted, and it runs until it ends;
 * - `declined`: the hotel said no;
 * - `withdrawn`: the broker took a proposal back before the hotel answered;
 * - `ended`: one side ended a running deal, or its end date passed.
 */
export const BrokerDealStatus = z.enum(["proposed", "active", "declined", "withdrawn", "ended"]);
export type BrokerDealStatus = z.infer<typeof BrokerDealStatus>;

/** The deal statuses that still bind a pair: a second deal waits until this one is over. */
export const BROKER_DEAL_LIVE_STATUSES = ["proposed", "active"] as const satisfies readonly BrokerDealStatus[];

/** The lowest and highest commission a percent deal may carry, in percent. */
export const BROKER_DEAL_PERCENT_MIN = 1;
export const BROKER_DEAL_PERCENT_MAX = 30;

export const BrokerDealTerms = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("percent"),
    /** Of what the guest paid for the room. Steps of half a percent: 7.5 is fine, 7.25 is not. */
    percent: z
      .number({ invalid_type_error: "Give the commission as a number." })
      .min(BROKER_DEAL_PERCENT_MIN, `A commission is at least ${BROKER_DEAL_PERCENT_MIN}%.`)
      .max(BROKER_DEAL_PERCENT_MAX, `A commission is at most ${BROKER_DEAL_PERCENT_MAX}%.`)
      .refine((v) => Number.isInteger(v * 2), "Use whole or half percents, like 10 or 7.5."),
  }),
  z.object({
    kind: z.literal("bulk_fixed"),
    /** One sum for the whole booking, whole francs. */
    amountRwf: z
      .number({ invalid_type_error: "Give the amount in francs." })
      .int("Give the amount in whole francs.")
      .min(1_000, "The amount is at least RWF 1,000.")
      .max(50_000_000, "The amount is at most RWF 50,000,000."),
    /** The fewest rooms booked together that count as a bulk booking. */
    minRooms: z
      .number({ invalid_type_error: "Give the number of rooms." })
      .int("Give a whole number of rooms.")
      .min(2, "A bulk booking is at least 2 rooms.")
      .max(500, "A bulk booking is at most 500 rooms."),
  }),
]);
export type BrokerDealTerms = z.infer<typeof BrokerDealTerms>;

const DealNote = z.string().trim().max(1000, "Keep the note under 1,000 characters.");

/** `POST /ops/broker/hotels/:orgId/deals`: the broker proposes a deal to a hotel. */
export const ProposeBrokerDealRequest = z
  .object({
    terms: BrokerDealTerms,
    /** Null: from the day the hotel accepts. */
    startsOn: CalendarDay.nullable().optional(),
    /** Null: until one side ends it. */
    endsOn: CalendarDay.nullable().optional(),
    /** What the broker wants the hotel to know: who they bring, how many, when. */
    note: DealNote.nullable().optional(),
  })
  .refine((v) => !v.startsOn || !v.endsOn || v.endsOn > v.startsOn, {
    message: "The end date comes after the start date.",
    path: ["endsOn"],
  });
export type ProposeBrokerDealRequest = z.infer<typeof ProposeBrokerDealRequest>;

/** `POST /ops/broker-deals/:id/decision`: the hotel accepts or declines a proposal. */
export const DecideBrokerDealRequest = z.object({
  decision: z.enum(["accept", "decline"]),
  /** Said to the broker; most useful with a decline. */
  note: DealNote.nullable().optional(),
});
export type DecideBrokerDealRequest = z.infer<typeof DecideBrokerDealRequest>;

/** `POST …/deals/:id/end` (either side) and `…/withdraw` (the broker): why, said to the other side. */
export const EndBrokerDealRequest = z.object({ note: DealNote.nullable().optional() });
export type EndBrokerDealRequest = z.infer<typeof EndBrokerDealRequest>;

/** One deal, as either side reads it. */
export const BrokerDeal = z.object({
  id: Uuid,
  status: BrokerDealStatus,
  terms: BrokerDealTerms,
  startsOn: CalendarDay.nullable(),
  endsOn: CalendarDay.nullable(),
  /** The broker's note with the proposal. */
  note: z.string().nullable(),
  broker: z.object({
    id: Uuid,
    name: z.string().nullable(),
    /** Shown to the hotel, so it can call the broker before answering. */
    phone: z.string().nullable(),
    email: z.string().nullable(),
  }),
  hotel: z.object({
    orgId: Uuid,
    name: z.string(),
    district: z.string().nullable(),
  }),
  proposedAt: z.string(),
  /** When the hotel accepted or declined, and what it said. */
  decidedAt: z.string().nullable(),
  decisionNote: z.string().nullable(),
  /** When it was withdrawn or ended, by which side, and why. */
  closedAt: z.string().nullable(),
  closedBy: z.enum(["broker", "hotel"]).nullable(),
  closeNote: z.string().nullable(),
});
export type BrokerDeal = z.infer<typeof BrokerDeal>;

export const BrokerDealList = z.object({ deals: z.array(BrokerDeal) });
export type BrokerDealList = z.infer<typeof BrokerDealList>;

/** One hotel a broker may propose a deal to: running, listed, inside the plan's area. */
export const BrokerHotel = z.object({
  orgId: Uuid,
  name: z.string(),
  /** "Hotel", "Lodge", "Guest house"… */
  kindLabel: z.string().nullable(),
  /** Confirmed by Injishi staff; null until then. */
  stars: z.number().int().min(1).max(5).nullable(),
  district: z.string().nullable(),
  sector: z.string().nullable(),
  /** The room types on offer. */
  roomTypes: z.number().int(),
  /** The lowest nightly price, whole francs; null when none is set. */
  fromRwf: z.number().int().nullable(),
  /** This broker's proposed or running deal with the hotel, if any. */
  deal: BrokerDeal.nullable(),
});
export type BrokerHotel = z.infer<typeof BrokerHotel>;

/** `GET /ops/broker/hotels`. */
export const BrokerHotels = z.object({
  brokerStatus: BrokerStatus,
  hotels: z.array(BrokerHotel),
  scope: BrokerScope,
});
export type BrokerHotels = z.infer<typeof BrokerHotels>;

const rwf = (n: number): string => `RWF ${Math.round(n).toLocaleString("en-US")}`;

/** The terms in one line: "10% of each booking", "RWF 200,000 for a booking of 10 rooms or more". */
export function brokerDealTermsLine(terms: BrokerDealTerms): string {
  return terms.kind === "percent"
    ? `${terms.percent}% of each booking`
    : `${rwf(terms.amountRwf)} for a booking of ${terms.minRooms} rooms or more`;
}

/** How a commission divides: Injishi's 15%, rounded to the franc, and the broker's rest. */
export function brokerCommissionSplit(commissionRwf: number): { injishiRwf: number; brokerRwf: number } {
  const injishiRwf = Math.round(commissionRwf * BROKER_COMMISSION_INJISHI_SHARE);
  return { injishiRwf, brokerRwf: commissionRwf - injishiRwf };
}
