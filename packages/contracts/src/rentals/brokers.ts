import { z } from "zod";
import { Uuid } from "../primitives";
import { CalendarDay } from "./dates";
import { PositiveRwf, formatRwf } from "./vocab";

// ===========================================================================
// Brokers on the landlord's side (2026-10-25: opt in per unit, landlord-set fee)
// ===========================================================================
//
// A broker sees only the units a landlord switched on ("Brokers may offer this
// unit"), with the fee the landlord set: a percent of the first month's rent or
// a fixed amount. The fee is a RECORD on the lease (who brought the tenant and
// what was agreed); the money moves outside Injishi, and the landlord marks it
// paid.

export const BrokerFeeKind = z.enum(["percent", "fixed"]);
export type BrokerFeeKind = z.infer<typeof BrokerFeeKind>;

/** The highest percent of the first month a fee may be: two months' rent. */
export const BROKER_FEE_PERCENT_MAX = 200;

/** What a landlord pays a broker who brings the tenant. */
export const BrokerFeeTerms = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("percent"),
    percent: z
      .number({ invalid_type_error: "Enter a percent.", required_error: "Enter a percent." })
      .int("Whole percent only.")
      .min(1, "Enter 1% or more.")
      .max(BROKER_FEE_PERCENT_MAX, `Up to ${BROKER_FEE_PERCENT_MAX}%.`),
  }),
  z.object({ kind: z.literal("fixed"), amountRwf: PositiveRwf }),
]);
export type BrokerFeeTerms = z.infer<typeof BrokerFeeTerms>;

/** The fee in francs for a first month's rent: a percent rounds down to the franc. */
export function brokerFeeAmount(terms: BrokerFeeTerms, monthlyRentRwf: number): number {
  if (terms.kind === "fixed") return terms.amountRwf;
  return Math.floor((monthlyRentRwf * terms.percent) / 100);
}

/** "50% of the first month" or "RWF 100,000". */
export function brokerFeeWords(terms: BrokerFeeTerms): string {
  return terms.kind === "percent" ? `${terms.percent}% of the first month` : formatRwf(terms.amountRwf);
}

/** The terms from the columns that hold them; null when they do not make a whole fee. */
export function brokerFeeFrom(
  kind: BrokerFeeKind | null,
  percent: number | null,
  amountRwf: number | null,
): BrokerFeeTerms | null {
  if (kind === "percent" && percent !== null) return { kind, percent };
  if (kind === "fixed" && amountRwf !== null) return { kind, amountRwf };
  return null;
}

/** `PUT /ops/rentals/profile/brokers`: the fee a new unit starts with when brokers may offer it. */
export const BrokerDefaultsRequest = z.object({ fee: BrokerFeeTerms.nullable() });
export type BrokerDefaultsRequest = z.infer<typeof BrokerDefaultsRequest>;

/** Owed until the landlord marks it paid; void when the lease was cancelled before it started. */
export const BrokerFeeRecordStatus = z.enum(["owed", "paid", "void"]);
export type BrokerFeeRecordStatus = z.infer<typeof BrokerFeeRecordStatus>;

/** The fee as the lease records it. */
export const BrokerFeeRecord = z.object({
  terms: BrokerFeeTerms,
  amountRwf: z.number().int(),
  status: BrokerFeeRecordStatus,
  paidAt: z.string().nullable(),
});
export type BrokerFeeRecord = z.infer<typeof BrokerFeeRecord>;

/** A star rating with an optional comment. */
export const BrokerStars = z
  .number({ invalid_type_error: "Pick 1 to 5 stars.", required_error: "Pick 1 to 5 stars." })
  .int("Pick 1 to 5 stars.")
  .min(1, "Pick 1 to 5 stars.")
  .max(5, "Pick 1 to 5 stars.");

/** `POST /ops/leases/:id/broker-rating` and `POST /me/tenancies/:leaseId/broker-rating`. */
export const BrokerRatingRequest = z.object({
  stars: BrokerStars,
  comment: z.string().trim().max(500, "Keep it under 500 characters.").nullable().optional(),
});
export type BrokerRatingRequest = z.infer<typeof BrokerRatingRequest>;

export const BrokerRatingView = z.object({ stars: z.number().int(), comment: z.string().nullable(), ratedAt: z.string() });
export type BrokerRatingView = z.infer<typeof BrokerRatingView>;

/** `PUT /ops/leases/:id/broker-fee`: the landlord marks the fee paid, or owed again. */
export const BrokerFeeStatusRequest = z.object({ paid: z.boolean() });
export type BrokerFeeStatusRequest = z.infer<typeof BrokerFeeStatusRequest>;

/** The broker on a lease, as the landlord sees it. */
export const LeaseBrokerView = z.object({
  id: Uuid,
  name: z.string().nullable(),
  phone: z.string().nullable(),
  placementId: Uuid.nullable(),
  fee: BrokerFeeRecord.nullable(),
  /** The landlord's own rating of the broker on this lease. */
  rating: BrokerRatingView.nullable(),
  /** The tenancy has started, so the broker can be rated. */
  canRate: z.boolean(),
});
export type LeaseBrokerView = z.infer<typeof LeaseBrokerView>;

/** The broker on a tenant's lease: rated once the tenancy starts. */
export const TenancyBrokerView = z.object({
  name: z.string().nullable(),
  rating: BrokerRatingView.nullable(),
  canRate: z.boolean(),
});
export type TenancyBrokerView = z.infer<typeof TenancyBrokerView>;

export const PlacementStatus = z.enum(["initiated", "converted", "abandoned", "unavailable"]);
export type PlacementStatus = z.infer<typeof PlacementStatus>;

/** One placement as the landlord sees it: a broker says they have a tenant for a unit. */
export const LandlordPlacementView = z.object({
  id: Uuid,
  status: PlacementStatus,
  startedAt: z.string(),
  broker: z.object({
    id: Uuid,
    name: z.string().nullable(),
    phone: z.string().nullable(),
    ratingAverage: z.number().nullable(),
    ratingCount: z.number().int(),
  }),
  unit: z.object({ id: Uuid, label: z.string(), propertyName: z.string() }).nullable(),
  /** Who the broker says they bring, when they said. */
  tenantName: z.string().nullable(),
  note: z.string().nullable(),
  /** The unit's fee when the broker started. */
  terms: BrokerFeeTerms.nullable(),
  lease: z
    .object({ id: Uuid, reference: z.string(), tenantName: z.string(), status: z.string(), startDate: CalendarDay })
    .nullable(),
  fee: BrokerFeeRecord.nullable(),
  rating: BrokerRatingView.nullable(),
});
export type LandlordPlacementView = z.infer<typeof LandlordPlacementView>;

/** `GET /ops/rentals/placements`. */
export const LandlordPlacementList = z.object({
  placements: z.array(LandlordPlacementView),
  /** Fees owed and paid, over every lease that names a broker. */
  owedRwf: z.number().int(),
  paidRwf: z.number().int(),
});
export type LandlordPlacementList = z.infer<typeof LandlordPlacementList>;

/** A broker the landlord can name on a lease (`GET /ops/rentals/brokers?q=`). */
export const BrokerPick = z.object({
  id: Uuid,
  name: z.string().nullable(),
  phone: z.string().nullable(),
  ratingAverage: z.number().nullable(),
  ratingCount: z.number().int(),
  /** An open placement this broker started on this landlord's units, newest first. */
  placements: z.array(z.object({ id: Uuid, unitId: Uuid.nullable(), unitLabel: z.string().nullable(), tenantName: z.string().nullable() })),
});
export type BrokerPick = z.infer<typeof BrokerPick>;

export const BrokerPickList = z.object({ brokers: z.array(BrokerPick) });
export type BrokerPickList = z.infer<typeof BrokerPickList>;

export const BrokerPickQuery = z.object({ q: z.string().trim().max(80).optional() });
export type BrokerPickQuery = z.infer<typeof BrokerPickQuery>;
