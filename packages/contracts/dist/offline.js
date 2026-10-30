"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfflineRefusalCode = exports.RequiredReportedTime = exports.ReportedTime = void 0;
exports.reportedTimePair = reportedTimePair;
const zod_1 = require("zod");
/**
 * Offline writes (mobile spec 0003, cross child contract 1): the time a write
 * really happened, as a phone that may have been out of signal reports it.
 *
 * `occurredAt` is the tap on the phone's clock and `deviceSentAt` is the phone's
 * clock when this attempt is sent; both or neither. The server corrects the tap
 * for a wrong phone clock (`occurredAt + (receivedAt - deviceSentAt)`, never
 * later than `receivedAt`) and refuses one older than 7 days (`422
 * reported_time_too_old`). Without the pair the time is the moment the request
 * arrived, as before.
 *
 * A route mixes it in with `.merge(ReportedTime).superRefine(reportedTimePair)`,
 * or `.merge(RequiredReportedTime)` where the route is offline only.
 */
const Instant = zod_1.z.string().datetime({ offset: true, message: "A time is an ISO instant." });
exports.ReportedTime = zod_1.z.object({
    occurredAt: Instant.optional(),
    deviceSentAt: Instant.optional(),
});
exports.RequiredReportedTime = zod_1.z.object({
    occurredAt: Instant,
    deviceSentAt: Instant,
});
/** Both times or neither: half a pair cannot be corrected. */
function reportedTimePair(body, ctx) {
    if ((body.occurredAt === undefined) !== (body.deviceSentAt === undefined)) {
        ctx.addIssue({
            code: "custom",
            message: "Send occurredAt and deviceSentAt together.",
            path: [body.occurredAt === undefined ? "occurredAt" : "deviceSentAt"],
        });
    }
}
/**
 * The codes an offline write's refusal can carry, so a client matches on a
 * code and never on wording.
 */
exports.OfflineRefusalCode = zod_1.z.enum([
    "reported_time_too_old",
    "idempotency_key_reused",
    "request_in_progress",
    "time_before_start",
]);
//# sourceMappingURL=offline.js.map