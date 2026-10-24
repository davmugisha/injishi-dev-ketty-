import { z } from "zod";
import { Uuid } from "../primitives";
import { RentalsSetupStep } from "./api";
import { CalendarDay } from "./dates";

// ===========================================================================
// The landlord's home: nav counts, what needs attention, the month's figures,
// where the buildings are, and each unit's photos and video tour
// ===========================================================================
//
// Every route is under `/api/v1/ops/`, behind a session and the workspace, for
// a residence business only (any other business is answered 404). Money is
// whole francs; days and months are Kigali's.

const IsoMoment = z.string();
const Count = z.number().int().min(0);
/** `yyyy-mm`, a Kigali calendar month. */
export const MonthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month as yyyy-mm.");
export type MonthKey = z.infer<typeof MonthKey>;

// --- Summary: what the navigation counts and what needs the landlord -------------

/** The things a landlord is asked to look at, in the order the home lists them. */
export const RentalsAttentionKind = z.enum([
  "setup_incomplete",
  "no_payout_account",
  "overdue_rent",
  "leases_to_sign",
  "ready_to_start",
  "notices_to_acknowledge",
  "filings_due",
  "waiting_for_tenant",
]);
export type RentalsAttentionKind = z.infer<typeof RentalsAttentionKind>;

/** One line of "Needs attention". Only kinds with something to do are listed. */
export const RentalsAttentionItem = z.object({
  kind: RentalsAttentionKind,
  count: Count,
  /** The money involved, where there is some (the overdue amount). */
  amountRwf: z.number().int().nullable(),
  /** "2 leases wait for your signature". */
  title: z.string(),
  /** One more short line, or null. */
  detail: z.string().nullable(),
  /** danger: money or a legal deadline is late; warning: needs doing soon; info: waiting on someone else. */
  tone: z.enum(["danger", "warning", "info"]),
});
export type RentalsAttentionItem = z.infer<typeof RentalsAttentionItem>;

/** `GET /ops/rentals/summary`: the counts the navigation shows and the "Needs attention" list. */
export const RentalsSummary = z.object({
  counts: z.object({
    /** Units not retired. */
    units: Count,
    /** Units that can be let and have no tenant or signed lease. */
    vacantUnits: Count,
    /** Drafts the landlord still has to sign. */
    leasesToSign: Count,
    /** Signed by the landlord, waiting for the tenant. */
    waitingForTenant: Count,
    /** Signed by both, not started yet. */
    readyToStart: Count,
    /** Active or ending tenancies. */
    liveLeases: Count,
    /** Open rent past its due day plus the lease's grace days. */
    overdueCharges: Count,
    overdueRwf: z.number().int().min(0),
    /** Tenants' move out notices nobody acknowledged yet. */
    noticesToAcknowledge: Count,
    /** RRA lease filings not marked filed, and those already past their due day. */
    filingsDue: Count,
    filingsLate: Count,
  }),
  setup: z.object({
    complete: z.boolean(),
    done: Count,
    total: Count,
    next: RentalsSetupStep.nullable(),
  }),
  hasPayoutAccount: z.boolean(),
  attention: z.array(RentalsAttentionItem),
});
export type RentalsSummary = z.infer<typeof RentalsSummary>;

// --- Overview: the figures of the home ------------------------------------------------

/** Rent expected and collected in one Kigali month. */
export const RentalsMonthFigure = z.object({
  month: MonthKey,
  /** Rent charges due in the month, not waived. */
  expectedRwf: z.number().int().min(0),
  /** Rent paid in the month: allocations of payments that succeeded (or were received) then. */
  collectedRwf: z.number().int().min(0),
});
export type RentalsMonthFigure = z.infer<typeof RentalsMonthFigure>;

/** How many months the rent trend covers, this month included. */
export const OVERVIEW_MONTHS = 12;

/** `GET /ops/rentals/overview`: the home's figures, for the current Kigali month. */
export const RentalsOverview = z.object({
  today: CalendarDay,
  month: MonthKey,
  /** Buildings of the business. */
  properties: Count,
  /** Units not retired. */
  units: Count,
  /** Units with a tenancy running (active or ending). */
  occupiedUnits: Count,
  /** Units that can be let and have no tenancy, signed lease or lease out for signing. */
  vacantUnits: Count,
  /** Units signed or out for signing, not lived in yet. */
  reservedUnits: Count,
  offMarketUnits: Count,
  /** People with a tenancy running. */
  tenants: Count,
  /** Occupied units over the units that are let or can be let, 0 to 100 with one decimal; null with none. */
  occupancyPercent: z.number().min(0).max(100).nullable(),
  rent: z.object({
    expectedThisMonthRwf: z.number().int().min(0),
    collectedThisMonthRwf: z.number().int().min(0),
    expectedLastMonthRwf: z.number().int().min(0),
    collectedLastMonthRwf: z.number().int().min(0),
    /** Collected this month against last month, in percent; null when last month had nothing. */
    collectedChangePercent: z.number().nullable(),
  }),
  overdue: z.object({
    amountRwf: z.number().int().min(0),
    /** Overdue rent charges. */
    charges: Count,
    /** Leases with overdue rent. */
    leases: Count,
  }),
  /** The last `OVERVIEW_MONTHS` months, oldest first, ending with this month. */
  months: z.array(RentalsMonthFigure),
});
export type RentalsOverview = z.infer<typeof RentalsOverview>;

/** The months of the rent trend: `count` Kigali months ending with the one `today` is in, oldest first. */
export function overviewMonths(today: string, count: number = OVERVIEW_MONTHS): string[] {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const index = y * 12 + (m - 1) - i;
    out.push(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);
  }
  return out;
}

/** The change from `before` to `now` in percent, one decimal; null when there was nothing before. */
export function percentChange(now: number, before: number): number | null {
  if (before <= 0) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}

// --- Where a building is ------------------------------------------------------------

/** One place of the Province > District > Sector > Cell > Village chain. */
export const PlaceRef = z.object({ id: z.number().int().positive(), name: z.string() });
export type PlaceRef = z.infer<typeof PlaceRef>;

/** A building of the business with where it is, as far as it is known. */
export const RentalPropertyView = z.object({
  id: Uuid,
  name: z.string(),
  /** The street line: "KG 9 Ave, house 14". */
  street: z.string().nullable(),
  place: z.object({
    province: PlaceRef.nullable(),
    district: PlaceRef.nullable(),
    sector: PlaceRef.nullable(),
    cell: PlaceRef.nullable(),
    village: PlaceRef.nullable(),
  }),
  /** The village is known: setup's location step is done for it. */
  located: z.boolean(),
  /** Units in it that are not retired. */
  units: Count,
});
export type RentalPropertyView = z.infer<typeof RentalPropertyView>;

/** `GET /ops/properties`: the business's buildings, the first made from the registration when there is none. */
export const RentalPropertyList = z.object({ properties: z.array(RentalPropertyView) });
export type RentalPropertyList = z.infer<typeof RentalPropertyList>;

const PlaceId = (what: string) =>
  z.number({ required_error: `Choose the ${what}.`, invalid_type_error: `Choose the ${what}.` }).int().positive();

/**
 * `PUT /ops/properties/:id/location`: the whole chain down to the village, and the street. The API checks
 * every level sits under the one above it.
 */
export const PropertyLocationRequest = z.object({
  provinceId: PlaceId("province"),
  districtId: PlaceId("district"),
  sectorId: PlaceId("sector"),
  cellId: PlaceId("cell"),
  villageId: PlaceId("village"),
  street: z
    .string()
    .trim()
    .max(160, "Keep the street under 160 characters.")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});
export type PropertyLocationRequest = z.infer<typeof PropertyLocationRequest>;

// --- A unit's photos and video tour ---------------------------------------------------

/** The most photos one unit holds. */
export const UNIT_PHOTO_MAX = 20;
/** One photo's size limit as uploaded (it is stored re-encoded, at most 2048 px). */
export const UNIT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/** A video tour's size limit, on its own route. */
export const UNIT_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const UNIT_VIDEO_MIN_SECONDS = 1;
export const UNIT_VIDEO_MAX_SECONDS = 180;
/** The poster still sent with a video. */
export const UNIT_VIDEO_POSTER_MAX_BYTES = 2 * 1024 * 1024;

export const UnitPhotoView = z.object({
  id: Uuid,
  /** A short-lived read. */
  url: z.string(),
  /** 0 is the cover. */
  position: z.number().int().min(0),
  caption: z.string().nullable(),
});
export type UnitPhotoView = z.infer<typeof UnitPhotoView>;

export const UnitVideoView = z.object({
  id: Uuid,
  url: z.string(),
  posterUrl: z.string().nullable(),
  durationS: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  updatedAt: IsoMoment,
});
export type UnitVideoView = z.infer<typeof UnitVideoView>;

/** `GET /ops/units/:id/media`, and the answer of every photo and video change. */
export const UnitMediaView = z.object({
  unitId: Uuid,
  photos: z.array(UnitPhotoView),
  video: UnitVideoView.nullable(),
});
export type UnitMediaView = z.infer<typeof UnitMediaView>;

/** `PATCH /ops/units/:id/photos/order`: every photo of the unit, in the new order (the first is the cover). */
export const ReorderUnitPhotosRequest = z
  .object({
    photoIds: z.array(Uuid).min(1, "Send the photos in their new order.").max(UNIT_PHOTO_MAX),
  })
  .refine((v) => new Set(v.photoIds).size === v.photoIds.length, {
    message: "A photo is named twice.",
    path: ["photoIds"],
  });
export type ReorderUnitPhotosRequest = z.infer<typeof ReorderUnitPhotosRequest>;

/** The fields sent beside the video file of `PUT /ops/units/:id/video` (multipart). */
export const UnitVideoFields = z.object({
  durationS: z.coerce
    .number({ invalid_type_error: "Send the video's length in seconds." })
    .int()
    .min(UNIT_VIDEO_MIN_SECONDS, "A video tour runs at least a second.")
    .max(UNIT_VIDEO_MAX_SECONDS, "A video tour runs at most 3 minutes."),
  width: z.coerce.number().int().min(1).max(10_000).optional(),
  height: z.coerce.number().int().min(1).max(10_000).optional(),
});
export type UnitVideoFields = z.infer<typeof UnitVideoFields>;
