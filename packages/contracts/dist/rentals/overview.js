"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitVideoFields = exports.ReorderUnitPhotosRequest = exports.UnitMediaView = exports.UnitVideoView = exports.UnitPhotoView = exports.UNIT_VIDEO_POSTER_MAX_BYTES = exports.UNIT_VIDEO_MAX_SECONDS = exports.UNIT_VIDEO_MIN_SECONDS = exports.UNIT_VIDEO_MAX_BYTES = exports.UNIT_PHOTO_MAX_BYTES = exports.UNIT_PHOTO_MAX = exports.PropertyLocationRequest = exports.RentalPropertyList = exports.RentalPropertyView = exports.PlaceRef = exports.RentalsOverview = exports.OVERVIEW_MONTHS = exports.RentalsMonthFigure = exports.RentalsSummary = exports.RentalsAttentionItem = exports.RentalsAttentionKind = exports.MonthKey = void 0;
exports.overviewMonths = overviewMonths;
exports.percentChange = percentChange;
const zod_1 = require("zod");
const primitives_1 = require("../primitives");
const api_1 = require("./api");
const dates_1 = require("./dates");
// ===========================================================================
// The landlord's home: nav counts, what needs attention, the month's figures,
// where the buildings are, and each unit's photos and video tour
// ===========================================================================
//
// Every route is under `/api/v1/ops/`, behind a session and the workspace, for
// a residence business only (any other business is answered 404). Money is
// whole francs; days and months are Kigali's.
const IsoMoment = zod_1.z.string();
const Count = zod_1.z.number().int().min(0);
/** `yyyy-mm`, a Kigali calendar month. */
exports.MonthKey = zod_1.z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month as yyyy-mm.");
// --- Summary: what the navigation counts and what needs the landlord -------------
/** The things a landlord is asked to look at, in the order the home lists them. */
exports.RentalsAttentionKind = zod_1.z.enum([
    "setup_incomplete",
    "no_payout_account",
    "overdue_rent",
    "leases_to_sign",
    "ready_to_start",
    "notices_to_acknowledge",
    "filings_due",
    "waiting_for_tenant",
]);
/** One line of "Needs attention". Only kinds with something to do are listed. */
exports.RentalsAttentionItem = zod_1.z.object({
    kind: exports.RentalsAttentionKind,
    count: Count,
    /** The money involved, where there is some (the overdue amount). */
    amountRwf: zod_1.z.number().int().nullable(),
    /** "2 leases wait for your signature". */
    title: zod_1.z.string(),
    /** One more short line, or null. */
    detail: zod_1.z.string().nullable(),
    /** danger: money or a legal deadline is late; warning: needs doing soon; info: waiting on someone else. */
    tone: zod_1.z.enum(["danger", "warning", "info"]),
});
/** `GET /ops/rentals/summary`: the counts the navigation shows and the "Needs attention" list. */
exports.RentalsSummary = zod_1.z.object({
    counts: zod_1.z.object({
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
        overdueRwf: zod_1.z.number().int().min(0),
        /** Tenants' move out notices nobody acknowledged yet. */
        noticesToAcknowledge: Count,
        /** RRA lease filings not marked filed, and those already past their due day. */
        filingsDue: Count,
        filingsLate: Count,
    }),
    setup: zod_1.z.object({
        complete: zod_1.z.boolean(),
        done: Count,
        total: Count,
        next: api_1.RentalsSetupStep.nullable(),
    }),
    hasPayoutAccount: zod_1.z.boolean(),
    attention: zod_1.z.array(exports.RentalsAttentionItem),
});
// --- Overview: the figures of the home ------------------------------------------------
/** Rent expected and collected in one Kigali month. */
exports.RentalsMonthFigure = zod_1.z.object({
    month: exports.MonthKey,
    /** Rent charges due in the month, not waived. */
    expectedRwf: zod_1.z.number().int().min(0),
    /** Rent paid in the month: allocations of payments that succeeded (or were received) then. */
    collectedRwf: zod_1.z.number().int().min(0),
});
/** How many months the rent trend covers, this month included. */
exports.OVERVIEW_MONTHS = 12;
/** `GET /ops/rentals/overview`: the home's figures, for the current Kigali month. */
exports.RentalsOverview = zod_1.z.object({
    today: dates_1.CalendarDay,
    month: exports.MonthKey,
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
    occupancyPercent: zod_1.z.number().min(0).max(100).nullable(),
    rent: zod_1.z.object({
        expectedThisMonthRwf: zod_1.z.number().int().min(0),
        collectedThisMonthRwf: zod_1.z.number().int().min(0),
        expectedLastMonthRwf: zod_1.z.number().int().min(0),
        collectedLastMonthRwf: zod_1.z.number().int().min(0),
        /** Collected this month against last month, in percent; null when last month had nothing. */
        collectedChangePercent: zod_1.z.number().nullable(),
    }),
    overdue: zod_1.z.object({
        amountRwf: zod_1.z.number().int().min(0),
        /** Overdue rent charges. */
        charges: Count,
        /** Leases with overdue rent. */
        leases: Count,
    }),
    /** The last `OVERVIEW_MONTHS` months, oldest first, ending with this month. */
    months: zod_1.z.array(exports.RentalsMonthFigure),
});
/** The months of the rent trend: `count` Kigali months ending with the one `today` is in, oldest first. */
function overviewMonths(today, count = exports.OVERVIEW_MONTHS) {
    const [y, m] = today.split("-").map(Number);
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
        const index = y * 12 + (m - 1) - i;
        out.push(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);
    }
    return out;
}
/** The change from `before` to `now` in percent, one decimal; null when there was nothing before. */
function percentChange(now, before) {
    if (before <= 0)
        return null;
    return Math.round(((now - before) / before) * 1000) / 10;
}
// --- Where a building is ------------------------------------------------------------
/** One place of the Province > District > Sector > Cell > Village chain. */
exports.PlaceRef = zod_1.z.object({ id: zod_1.z.number().int().positive(), name: zod_1.z.string() });
/** A building of the business with where it is, as far as it is known. */
exports.RentalPropertyView = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    /** The street line: "KG 9 Ave, house 14". */
    street: zod_1.z.string().nullable(),
    place: zod_1.z.object({
        province: exports.PlaceRef.nullable(),
        district: exports.PlaceRef.nullable(),
        sector: exports.PlaceRef.nullable(),
        cell: exports.PlaceRef.nullable(),
        village: exports.PlaceRef.nullable(),
    }),
    /** The village is known: setup's location step is done for it. */
    located: zod_1.z.boolean(),
    /** Units in it that are not retired. */
    units: Count,
});
/** `GET /ops/properties`: the business's buildings, the first made from the registration when there is none. */
exports.RentalPropertyList = zod_1.z.object({ properties: zod_1.z.array(exports.RentalPropertyView) });
const PlaceId = (what) => zod_1.z.number({ required_error: `Choose the ${what}.`, invalid_type_error: `Choose the ${what}.` }).int().positive();
/**
 * `PUT /ops/properties/:id/location`: the whole chain down to the village, and the street. The API checks
 * every level sits under the one above it.
 */
exports.PropertyLocationRequest = zod_1.z.object({
    provinceId: PlaceId("province"),
    districtId: PlaceId("district"),
    sectorId: PlaceId("sector"),
    cellId: PlaceId("cell"),
    villageId: PlaceId("village"),
    street: zod_1.z
        .string()
        .trim()
        .max(160, "Keep the street under 160 characters.")
        .transform((v) => (v === "" ? null : v))
        .nullable()
        .optional(),
});
// --- A unit's photos and video tour ---------------------------------------------------
/** The most photos one unit holds. */
exports.UNIT_PHOTO_MAX = 20;
/** One photo's size limit as uploaded (it is stored re-encoded, at most 2048 px). */
exports.UNIT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/** A video tour's size limit, on its own route. */
exports.UNIT_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
exports.UNIT_VIDEO_MIN_SECONDS = 1;
exports.UNIT_VIDEO_MAX_SECONDS = 180;
/** The poster still sent with a video. */
exports.UNIT_VIDEO_POSTER_MAX_BYTES = 2 * 1024 * 1024;
exports.UnitPhotoView = zod_1.z.object({
    id: primitives_1.Uuid,
    /** A short-lived read. */
    url: zod_1.z.string(),
    /** 0 is the cover. */
    position: zod_1.z.number().int().min(0),
    caption: zod_1.z.string().nullable(),
});
exports.UnitVideoView = zod_1.z.object({
    id: primitives_1.Uuid,
    url: zod_1.z.string(),
    posterUrl: zod_1.z.string().nullable(),
    durationS: zod_1.z.number().int(),
    width: zod_1.z.number().int().nullable(),
    height: zod_1.z.number().int().nullable(),
    updatedAt: IsoMoment,
});
/** `GET /ops/units/:id/media`, and the answer of every photo and video change. */
exports.UnitMediaView = zod_1.z.object({
    unitId: primitives_1.Uuid,
    photos: zod_1.z.array(exports.UnitPhotoView),
    video: exports.UnitVideoView.nullable(),
});
/** `PATCH /ops/units/:id/photos/order`: every photo of the unit, in the new order (the first is the cover). */
exports.ReorderUnitPhotosRequest = zod_1.z
    .object({
    photoIds: zod_1.z.array(primitives_1.Uuid).min(1, "Send the photos in their new order.").max(exports.UNIT_PHOTO_MAX),
})
    .refine((v) => new Set(v.photoIds).size === v.photoIds.length, {
    message: "A photo is named twice.",
    path: ["photoIds"],
});
/** The fields sent beside the video file of `PUT /ops/units/:id/video` (multipart). */
exports.UnitVideoFields = zod_1.z.object({
    durationS: zod_1.z.coerce
        .number({ invalid_type_error: "Send the video's length in seconds." })
        .int()
        .min(exports.UNIT_VIDEO_MIN_SECONDS, "A video tour runs at least a second.")
        .max(exports.UNIT_VIDEO_MAX_SECONDS, "A video tour runs at most 3 minutes."),
    width: zod_1.z.coerce.number().int().min(1).max(10000).optional(),
    height: zod_1.z.coerce.number().int().min(1).max(10000).optional(),
});
//# sourceMappingURL=overview.js.map