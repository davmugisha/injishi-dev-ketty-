import { z } from "zod";
export declare const ReportedTime: z.ZodObject<{
    occurredAt: z.ZodOptional<z.ZodString>;
    deviceSentAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    occurredAt?: string | undefined;
    deviceSentAt?: string | undefined;
}, {
    occurredAt?: string | undefined;
    deviceSentAt?: string | undefined;
}>;
export type ReportedTime = z.infer<typeof ReportedTime>;
export declare const RequiredReportedTime: z.ZodObject<{
    occurredAt: z.ZodString;
    deviceSentAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    occurredAt: string;
    deviceSentAt: string;
}, {
    occurredAt: string;
    deviceSentAt: string;
}>;
export type RequiredReportedTime = z.infer<typeof RequiredReportedTime>;
/** Both times or neither: half a pair cannot be corrected. */
export declare function reportedTimePair<T extends ReportedTime>(body: T, ctx: z.RefinementCtx): void;
/**
 * The codes an offline write's refusal can carry, so a client matches on a
 * code and never on wording.
 */
export declare const OfflineRefusalCode: z.ZodEnum<["reported_time_too_old", "idempotency_key_reused", "request_in_progress", "time_before_start"]>;
export type OfflineRefusalCode = z.infer<typeof OfflineRefusalCode>;
//# sourceMappingURL=offline.d.ts.map