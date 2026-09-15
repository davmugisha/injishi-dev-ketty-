import { z } from "zod";
import type { OversightRole, StaffRole } from "./primitives";
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
 * `staff` seat for platform staff and an `oversight` seat per active government
 * assignment, and are never flattened: a persona who holds five seats is listed
 * with five. A person who is ONLY a government officer holds no workspace, so
 * without the `oversight` seat they would drop off the roster entirely.
 */
export declare const DemoSurface: z.ZodEnum<["personal", "landlord", "broker", "work", "host", "staff", "oversight"]>;
export type DemoSurface = z.infer<typeof DemoSurface>;
export declare const DemoSeat: z.ZodObject<{
    /**
     * WHERE the seat is: the org name, `Personal`, `Brokerage`, the admin
     * console, or the government body and region an officer covers.
     */
    label: z.ZodString;
    surface: z.ZodEnum<["personal", "landlord", "broker", "work", "host", "staff", "oversight"]>;
    /**
     * WHAT the person is in that seat, as they would say it: `Owner`,
     * `Front office · Receptionist`, `Field verifier`, `Platform staff · Ops`,
     * `Guest / tenant`. Worded by the API so every picker reads the same words.
     */
    role: z.ZodString;
    /**
     * The same role as a stable key a client may branch or sort on: the
     * `OrgRole` or `OversightRole` value, or `staff`, `personal`, `broker`.
     */
    roleKey: z.ZodString;
    /**
     * An optional finer line: the government's own title for the post, or a
     * department position such as `Head of Front Office`. Null when there is
     * nothing more to say.
     */
    detail: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    label: string;
    detail: string | null;
    role: string;
    surface: "broker" | "personal" | "oversight" | "host" | "landlord" | "staff" | "work";
    roleKey: string;
}, {
    label: string;
    detail: string | null;
    role: string;
    surface: "broker" | "personal" | "oversight" | "host" | "landlord" | "staff" | "work";
    roleKey: string;
}>;
export type DemoSeat = z.infer<typeof DemoSeat>;
export declare const DemoPersona: z.ZodObject<{
    email: z.ZodString;
    name: z.ZodString;
    seats: z.ZodArray<z.ZodObject<{
        /**
         * WHERE the seat is: the org name, `Personal`, `Brokerage`, the admin
         * console, or the government body and region an officer covers.
         */
        label: z.ZodString;
        surface: z.ZodEnum<["personal", "landlord", "broker", "work", "host", "staff", "oversight"]>;
        /**
         * WHAT the person is in that seat, as they would say it: `Owner`,
         * `Front office · Receptionist`, `Field verifier`, `Platform staff · Ops`,
         * `Guest / tenant`. Worded by the API so every picker reads the same words.
         */
        role: z.ZodString;
        /**
         * The same role as a stable key a client may branch or sort on: the
         * `OrgRole` or `OversightRole` value, or `staff`, `personal`, `broker`.
         */
        roleKey: z.ZodString;
        /**
         * An optional finer line: the government's own title for the post, or a
         * department position such as `Head of Front Office`. Null when there is
         * nothing more to say.
         */
        detail: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        detail: string | null;
        role: string;
        surface: "broker" | "personal" | "oversight" | "host" | "landlord" | "staff" | "work";
        roleKey: string;
    }, {
        label: string;
        detail: string | null;
        role: string;
        surface: "broker" | "personal" | "oversight" | "host" | "landlord" | "staff" | "work";
        roleKey: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    seats: {
        label: string;
        detail: string | null;
        role: string;
        surface: "broker" | "personal" | "oversight" | "host" | "landlord" | "staff" | "work";
        roleKey: string;
    }[];
}, {
    name: string;
    email: string;
    seats: {
        label: string;
        detail: string | null;
        role: string;
        surface: "broker" | "personal" | "oversight" | "host" | "landlord" | "staff" | "work";
        roleKey: string;
    }[];
}>;
export type DemoPersona = z.infer<typeof DemoPersona>;
/**
 * The short words an oversight role is read in, as a badge. The admin
 * console's appoint dialog words the same three with a description attached;
 * this is the name alone. (The org role's words are `ORG_ROLE_LABEL` in
 * `ops.ts`.)
 */
export declare const OVERSIGHT_ROLE_LABEL: Readonly<Record<OversightRole, string>>;
/** The short words a platform staff role is read in. */
export declare const STAFF_ROLE_LABEL: Readonly<Record<StaffRole, string>>;
//# sourceMappingURL=platform.d.ts.map