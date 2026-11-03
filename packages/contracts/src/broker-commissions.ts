import { z } from "zod";
import { BrokerDealKind } from "./broker-deals";
import { Uuid } from "./primitives";
import { MomoNetwork } from "./rentals/vocab";

/**
 * A broker's commission, earned and collected (2026-11-02, phase 3).
 *
 * Earned at check-out, only on a stay that happened:
 * - a percent deal earns its percent of the room price for the nights the
 *   guest actually stayed (the owner's call), one commission per booking;
 * - a bulk deal earns its fixed sum once the last room of the group has
 *   checked out, one commission per group.
 *
 * Collected from the hotel's money, never asked of the broker: the hotel's
 * payout at check-out is smaller by what it owes, oldest commission first. A
 * prepaid stay pays its own commission out of its escrow; a stay paid at the
 * hotel leaves it owed, and the hotel's next payouts take it. Once a commission
 * is fully collected, the broker's 85% is paid to their MoMo number and Injishi
 * keeps 15%.
 */

/** `owed`: the hotel still owes some of it; `collected`: all of it came off the hotel's payouts. */
export const BrokerCommissionStatus = z.enum(["owed", "collected"]);
export type BrokerCommissionStatus = z.infer<typeof BrokerCommissionStatus>;

/** Where the broker's share is: not yet (still owed), on its way, waiting for a payout number, paid, refused. */
export const BrokerShareStatus = z.enum(["waiting_for_hotel", "held", "queued", "paid", "failed"]);
export type BrokerShareStatus = z.infer<typeof BrokerShareStatus>;

export const BrokerCommission = z.object({
  id: Uuid,
  kind: BrokerDealKind,
  broker: z.object({ id: Uuid, name: z.string().nullable() }),
  hotel: z.object({ orgId: Uuid, name: z.string() }),
  groupReference: z.string(),
  /** The booking a percent commission was earned on; null for a bulk one (the whole group). */
  bookingReference: z.string().nullable(),
  guestName: z.string().nullable(),
  /** What the percent was taken of: the room price for the nights stayed. Null for a bulk sum. */
  baseRwf: z.number().int().nullable(),
  nightsStayed: z.number().int().nullable(),
  commissionRwf: z.number().int(),
  injishiRwf: z.number().int(),
  brokerRwf: z.number().int(),
  /** How much has come off the hotel's payouts so far, and what it still owes. */
  collectedRwf: z.number().int(),
  owedRwf: z.number().int(),
  status: BrokerCommissionStatus,
  earnedAt: z.string(),
  collectedAt: z.string().nullable(),
  share: z.object({
    status: BrokerShareStatus,
    amountRwf: z.number().int(),
    destinationMasked: z.string().nullable(),
    paidAt: z.string().nullable(),
    failureReason: z.string().nullable(),
  }),
});
export type BrokerCommission = z.infer<typeof BrokerCommission>;

export const BrokerCommissionList = z.object({
  commissions: z.array(BrokerCommission),
  totals: z.object({
    /** Still owed by hotels. */
    owedRwf: z.number().int(),
    /** Taken off the hotels' payouts. */
    collectedRwf: z.number().int(),
    /** Paid to the broker (their 85% of what was collected). */
    paidToBrokerRwf: z.number().int(),
  }),
});
export type BrokerCommissionList = z.infer<typeof BrokerCommissionList>;

/** The MoMo number a broker's commission is paid to. One per broker. */
export const BrokerPayoutAccount = z.object({
  accountName: z.string(),
  network: MomoNetwork,
  phoneMasked: z.string(),
});
export type BrokerPayoutAccount = z.infer<typeof BrokerPayoutAccount>;

/** `PUT /ops/broker/payout-account`. */
export const SetBrokerPayoutAccountRequest = z.object({
  accountName: z.string().trim().min(2, "Give the name on the MoMo account.").max(120, "Keep the name under 120 characters."),
  /** As typed: `0788 123 456` or `+250788123456`; `normalizeRwPhone` reads it, `momoNetworkOf` names its network. */
  phone: z.string().trim().min(9, "Give the MoMo number.").max(20, "That number is too long."),
});
export type SetBrokerPayoutAccountRequest = z.infer<typeof SetBrokerPayoutAccountRequest>;
