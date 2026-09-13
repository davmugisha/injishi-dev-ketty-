import { z } from "zod";
/**
 * `GET /api/v1/platform`: which platform a deployment is (ADR-043, AC-16).
 *
 * Public and uncredentialed, because every client needs it BEFORE anyone signs
 * in: the verify screen decides from it whether to show the demo code, the sign
 * in screens whether to list personas and when the data was last reset, and the
 * operator app whether its fixture money actions may make up a reference.
 *
 * It discloses only whether a deployment is the demo and holds sample data.
 * The code itself is never in it: a client knows `123456` from
 * `@injishi/auth/client`, because the demo publishes it.
 */
export declare const PlatformEnvironmentName: z.ZodEnum<["production", "demo"]>;
export type PlatformEnvironmentName = z.infer<typeof PlatformEnvironmentName>;
export declare const PlatformInfo: z.ZodObject<{
    /** The API process's one environment. Staging reports `production`. */
    environment: z.ZodEnum<["production", "demo"]>;
    /** The database carries the `sample` marker: demo, staging, a laptop. */
    sampleData: z.ZodBoolean;
    /**
     * When the sample recipe last finished (an ISO instant), or null when it
     * never has. Read per request, so a reseed run by hand shows at once.
     */
    seededAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    environment: "production" | "demo";
    sampleData: boolean;
    seededAt: string | null;
}, {
    environment: "production" | "demo";
    sampleData: boolean;
    seededAt: string | null;
}>;
export type PlatformInfo = z.infer<typeof PlatformInfo>;
/**
 * `GET /api/v1/demo/personas`: the demo roster for the sign in picker (ADR-038
 * child 0, AC-S10; ADR-043, AC-18 and AC-20). Answers only on the demo and is
 * a 404 everywhere else, so a client reads a 404 as "no picker here".
 *
 * The seats come from the same resolver `/me/workspaces` answers from, plus a
 * `staff` seat for platform staff, and are never flattened: a persona who
 * holds five seats is listed with five.
 */
export declare const DemoSurface: z.ZodEnum<["personal", "landlord", "broker", "work", "host", "staff"]>;
export type DemoSurface = z.infer<typeof DemoSurface>;
export declare const DemoSeat: z.ZodObject<{
    /** What the person reads: the org name, `Personal`, or the staff roles. */
    label: z.ZodString;
    surface: z.ZodEnum<["personal", "landlord", "broker", "work", "host", "staff"]>;
}, "strip", z.ZodTypeAny, {
    label: string;
    surface: "broker" | "personal" | "host" | "landlord" | "staff" | "work";
}, {
    label: string;
    surface: "broker" | "personal" | "host" | "landlord" | "staff" | "work";
}>;
export type DemoSeat = z.infer<typeof DemoSeat>;
export declare const DemoPersona: z.ZodObject<{
    email: z.ZodString;
    name: z.ZodString;
    seats: z.ZodArray<z.ZodObject<{
        /** What the person reads: the org name, `Personal`, or the staff roles. */
        label: z.ZodString;
        surface: z.ZodEnum<["personal", "landlord", "broker", "work", "host", "staff"]>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        surface: "broker" | "personal" | "host" | "landlord" | "staff" | "work";
    }, {
        label: string;
        surface: "broker" | "personal" | "host" | "landlord" | "staff" | "work";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    seats: {
        label: string;
        surface: "broker" | "personal" | "host" | "landlord" | "staff" | "work";
    }[];
}, {
    name: string;
    email: string;
    seats: {
        label: string;
        surface: "broker" | "personal" | "host" | "landlord" | "staff" | "work";
    }[];
}>;
export type DemoPersona = z.infer<typeof DemoPersona>;
//# sourceMappingURL=platform.d.ts.map