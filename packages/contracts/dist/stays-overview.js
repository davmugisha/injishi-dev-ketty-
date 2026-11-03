"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaysActivity = exports.StayActivityItem = exports.StayActivityStatus = exports.StaysSummary = exports.COMPACT_MAX_ROOMS = exports.StaySize = void 0;
exports.staySize = staySize;
exports.stayUnitWords = stayUnitWords;
exports.letsLongStays = letsLongStays;
exports.nightsSold = nightsSold;
const zod_1 = require("zod");
const business_kind_1 = require("./business-kind");
const primitives_1 = require("./primitives");
const dates_1 = require("./rentals/dates");
// ===========================================================================
// A short-stay business's home (2026-10-29): guest houses, lodges, hotels,
// motels, serviced apartments, villas and tented camps.
// ===========================================================================
//
// `GET /api/v1/ops/stays-overview/summary` is small and read on every page (the sidebar's counts and how
// the business is run); `GET /api/v1/ops/stays-overview/activity?from=&to=` carries the stays and the
// money of a period, read by the home only. Both are narrowed to the branches the person covers.
/**
 * How a stay business is run, which decides what the app offers it. A place of up to
 * `COMPACT_MAX_ROOMS` rooms is run by its owner and perhaps one helper: one short menu, no departments,
 * no outlets, no revenue desk. A larger one has a team and the full hotel tools. A small lodge and a
 * small hotel are alike; a large guest house is run like a lodge. Rooms, not the business kind, decide.
 */
exports.StaySize = zod_1.z.enum(["compact", "full"]);
exports.COMPACT_MAX_ROOMS = 12;
function staySize(rooms) {
    return rooms <= exports.COMPACT_MAX_ROOMS ? "compact" : "full";
}
/** The words a stay business's screens use for what it lets: rooms, apartments, cottages, tents. */
function stayUnitWords(kind) {
    if (kind === "apartment")
        return { one: "apartment", many: "apartments" };
    if (kind === "tented_camp")
        return { one: "tent", many: "tents" };
    if (kind === "villa")
        return { one: "villa", many: "villas" };
    return { one: "room", many: "rooms" };
}
/** Long stays are let by the week and the month as well as the night. */
function letsLongStays(kind) {
    return kind === "apartment" || kind === "villa";
}
exports.StaysSummary = zod_1.z.object({
    today: dates_1.CalendarDay,
    business: zod_1.z.object({
        orgName: zod_1.z.string(),
        kind: business_kind_1.BusinessKind,
        size: exports.StaySize,
        /** Bookable rooms (or apartments, tents) across the covered branches. */
        rooms: zod_1.z.number().int().min(0),
        roomTypes: zod_1.z.number().int().min(0),
        properties: zod_1.z.number().int().min(0),
        /** The one branch when there is one, for the header. */
        propertyName: zod_1.z.string().nullable(),
    }),
    counts: zod_1.z.object({
        arrivalsToday: zod_1.z.number().int().min(0),
        departuresToday: zod_1.z.number().int().min(0),
        inHouse: zod_1.z.number().int().min(0),
        /** Booking requests waiting for the business to accept or decline. */
        requestsWaiting: zod_1.z.number().int().min(0),
    }),
});
/** Where a stay stands, as the home and the calendar word it. */
exports.StayActivityStatus = zod_1.z.enum(["requested", "confirmed", "in_house", "checked_out", "cancelled", "no_show"]);
exports.StayActivityItem = zod_1.z.object({
    id: primitives_1.Uuid,
    /** A booking (with or without its stay yet), or a walk in, which has no booking. */
    source: zod_1.z.enum(["booking", "walk_in"]),
    reference: zod_1.z.string().nullable(),
    guestName: zod_1.z.string(),
    roomTypeName: zod_1.z.string(),
    roomLabel: zod_1.z.string().nullable(),
    /** The first night. */
    checkIn: dates_1.CalendarDay,
    /** The morning they leave; for an open-ended walk in, today's tomorrow. */
    checkOut: dates_1.CalendarDay,
    status: exports.StayActivityStatus,
    channel: zod_1.z.string().nullable(),
    nightlyRwf: zod_1.z.number().int().min(0),
    totalRwf: zod_1.z.number().int().min(0),
});
exports.StaysActivity = zod_1.z.object({
    from: dates_1.CalendarDay,
    to: dates_1.CalendarDay,
    today: dates_1.CalendarDay,
    rooms: zod_1.z.number().int().min(0),
    stays: zod_1.z.array(exports.StayActivityItem),
    /** Money received on guests' bills, summed per business day (payments less refunds). */
    payments: zod_1.z.array(zod_1.z.object({ day: dates_1.CalendarDay, amountRwf: zod_1.z.number().int() })),
});
/** Nights sold on each day of a period: a stay counts on every night from its check in to the night before it leaves. */
function nightsSold(stays, days) {
    const live = stays.filter((s) => s.status !== "cancelled" && s.status !== "no_show" && s.status !== "requested");
    return days.map((d) => live.filter((s) => s.checkIn <= d && d < s.checkOut).length);
}
//# sourceMappingURL=stays-overview.js.map