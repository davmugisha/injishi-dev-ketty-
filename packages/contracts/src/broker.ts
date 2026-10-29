import { z } from "zod";
import { BrokerScope } from "./broker-plans";
import { Uuid } from "./primitives";
import { BrokerStatus } from "./registration";
import { BrokerFeeRecord, BrokerFeeTerms, PlacementStatus } from "./rentals/brokers";
import { CalendarDay } from "./rentals/dates";

/**
 * The broker's own surface (`/api/v1/ops/broker/*`).
 *
 * A broker sees only the units a landlord switched on for brokers, inside the
 * area their plan covers (District, Province or Country). A unit outside that
 * is not there at all: every read and command answers 404. Revealing a
 * landlord's contact is free and logged; a placement says "I have a tenant for
 * this unit" and becomes the lease's broker record when the landlord names the
 * broker on the lease. Fees are recorded, never collected by Injishi.
 */

/** The landlord contact a broker revealed, as it stood when they revealed it. */
export const BrokerContact = z.object({
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  revealedAt: z.string(),
});
export type BrokerContact = z.infer<typeof BrokerContact>;

/** The broker's placement on a unit, when they started one. */
export const BrokerHomePlacement = z.object({ id: Uuid, status: PlacementStatus });
export type BrokerHomePlacement = z.infer<typeof BrokerHomePlacement>;

/** One opted-in vacant unit a broker may offer. */
export const BrokerHome = z.object({
  unitId: Uuid,
  unitLabel: z.string(),
  propertyName: z.string(),
  landlordName: z.string(),
  districtId: z.number().int().nullable(),
  district: z.string().nullable(),
  sector: z.string().nullable(),
  bedrooms: z.number().int().nullable(),
  bathrooms: z.number().int().nullable(),
  kitchen: z.enum(["own", "shared", "none"]).nullable(),
  furnished: z.boolean(),
  sizeSqm: z.number().int().nullable(),
  rentRwf: z.number().int(),
  depositRwf: z.number().int().nullable(),
  /** What the landlord pays the broker who brings the tenant. */
  fee: BrokerFeeTerms,
  /** The fee in francs on this unit's asking rent. */
  feeRwf: z.number().int(),
  /** Signed, short-lived photo URLs, cover first. */
  photos: z.array(z.string()),
  video: z.object({ url: z.string(), posterUrl: z.string().nullable(), durationS: z.number().int() }).nullable(),
  /** Null when it is free now. */
  availableFrom: CalendarDay.nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  /** Null until this broker reveals the landlord. */
  contact: BrokerContact.nullable(),
  placement: BrokerHomePlacement.nullable(),
});
export type BrokerHome = z.infer<typeof BrokerHome>;

export const BrokerHomesSort = z.enum(["newest", "price_asc", "price_desc", "fee_desc"]);
export type BrokerHomesSort = z.infer<typeof BrokerHomesSort>;

/** `GET /ops/broker/homes`. A district outside the plan shows nothing. */
export const BrokerHomesQuery = z.object({
  district: z.coerce.number().int().positive().optional(),
  minRent: z.coerce.number().int().nonnegative().optional(),
  maxRent: z.coerce.number().int().positive().optional(),
  /** At least this many bedrooms. */
  bedrooms: z.coerce.number().int().min(0).max(20).optional(),
  q: z.string().trim().max(80).optional(),
  sort: BrokerHomesSort.optional(),
});
export type BrokerHomesQuery = z.infer<typeof BrokerHomesQuery>;

export const BrokerHomes = z.object({
  brokerStatus: BrokerStatus,
  /** The district filter applied, or null for the whole plan area. */
  districtId: z.number().int().nullable(),
  /** Every district inside the plan with a home on offer, with how many. */
  districts: z.array(z.object({ id: z.number().int(), name: z.string(), count: z.number().int() })),
  homes: z.array(BrokerHome),
  scope: BrokerScope,
});
export type BrokerHomes = z.infer<typeof BrokerHomes>;

/** `POST /ops/broker/homes/:unitId/reveal`. `first` is false when it was revealed before. */
export const BrokerReveal = z.object({ unitId: Uuid, contact: BrokerContact, first: z.boolean() });
export type BrokerReveal = z.infer<typeof BrokerReveal>;

/** `POST /ops/broker/homes/:unitId/placements`: "I have a tenant for this unit". */
export const StartPlacementRequest = z.object({
  tenantName: z.string().trim().max(120, "Keep the name under 120 characters.").nullable().optional(),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").nullable().optional(),
});
export type StartPlacementRequest = z.infer<typeof StartPlacementRequest>;

export const BrokerPlacement = z.object({
  id: Uuid,
  status: PlacementStatus,
  startedAt: z.string(),
  unit: z.object({ id: Uuid, label: z.string(), propertyName: z.string(), district: z.string().nullable() }).nullable(),
  landlordName: z.string().nullable(),
  tenantName: z.string().nullable(),
  note: z.string().nullable(),
  /** The unit's fee when the placement started. */
  terms: BrokerFeeTerms.nullable(),
  /** The lease the landlord wrote naming this broker. */
  lease: z
    .object({ id: Uuid, reference: z.string(), tenantName: z.string(), status: z.string(), startDate: CalendarDay })
    .nullable(),
  fee: BrokerFeeRecord.nullable(),
});
export type BrokerPlacement = z.infer<typeof BrokerPlacement>;

export const BrokerPlacementList = z.object({ placements: z.array(BrokerPlacement) });
export type BrokerPlacementList = z.infer<typeof BrokerPlacementList>;

/** One fee a lease records for this broker. */
export const BrokerFeeLine = z.object({
  leaseId: Uuid,
  reference: z.string(),
  tenantName: z.string(),
  unitLabel: z.string(),
  propertyName: z.string(),
  landlordName: z.string(),
  startDate: CalendarDay,
  fee: BrokerFeeRecord,
});
export type BrokerFeeLine = z.infer<typeof BrokerFeeLine>;

/** `GET /ops/broker/earnings`: what landlords recorded as owed and paid. Injishi moves none of it. */
export const BrokerEarnings = z.object({
  owedRwf: z.number().int(),
  paidRwf: z.number().int(),
  paidThisYearRwf: z.number().int(),
  /** Recorded by the month the lease starts, the last 12 months, oldest first (`yyyy-mm`). */
  byMonth: z.array(z.object({ month: z.string(), paidRwf: z.number().int(), owedRwf: z.number().int() })),
  fees: z.array(BrokerFeeLine),
});
export type BrokerEarnings = z.infer<typeof BrokerEarnings>;

export const BrokerReview = z.object({
  stars: z.number().int(),
  comment: z.string().nullable(),
  from: z.enum(["tenant", "landlord"]),
  /** A tenant by first name; a landlord by their business. */
  raterName: z.string().nullable(),
  propertyName: z.string().nullable(),
  ratedAt: z.string(),
});
export type BrokerReview = z.infer<typeof BrokerReview>;

/** `GET /ops/broker/reviews`. */
export const BrokerReviews = z.object({
  average: z.number().nullable(),
  count: z.number().int(),
  /** How many ratings gave 5, 4, 3, 2 and 1 stars, in that order. */
  breakdown: z.array(z.number().int()).length(5),
  /** Leases they brought a tenant to that started. */
  placedCount: z.number().int(),
  reviews: z.array(BrokerReview),
});
export type BrokerReviews = z.infer<typeof BrokerReviews>;

/** `GET /ops/broker/summary`: the figures the broker home opens on. */
export const BrokerSummary = z.object({
  name: z.string().nullable(),
  status: BrokerStatus,
  scope: BrokerScope,
  homesInScope: z.number().int(),
  openPlacements: z.number().int(),
  owedRwf: z.number().int(),
  paidRwf: z.number().int(),
  ratingAverage: z.number().nullable(),
  ratingCount: z.number().int(),
});
export type BrokerSummary = z.infer<typeof BrokerSummary>;
