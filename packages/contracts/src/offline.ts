import { z } from "zod";
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
const Instant = z.string().datetime({ offset: true, message: "A time is an ISO instant." });
export const ReportedTime = z.object({
    occurredAt: Instant.optional(),
    deviceSentAt: Instant.optional(),
});
export type ReportedTime = z.infer<typeof ReportedTime>;
export const RequiredReportedTime = z.object({
    occurredAt: Instant,
    deviceSentAt: Instant,
});
export type RequiredReportedTime = z.infer<typeof RequiredReportedTime>;
/** Both times or neither: half a pair cannot be corrected. */
export function reportedTimePair<T extends ReportedTime>(body: T, ctx: z.RefinementCtx): void {
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
export const OfflineRefusalCode = z.enum([
    "reported_time_too_old",
    "idempotency_key_reused",
    "request_in_progress",
    "time_before_start",
]);
export type OfflineRefusalCode = z.infer<typeof OfflineRefusalCode>;
