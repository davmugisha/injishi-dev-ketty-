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
    /**
     * The git commit this process was BUILT from (`INJISHI_COMMIT`, stamped on
     * the image), or null when it was started from a working tree that did not
     * say.
     *
     * Without it there is no way to ask a deployed API which code it is
     * running, so "shipped" is a claim nothing can check: a deploy that
     * silently served the previous image looked exactly like one that worked.
     * It is a commit sha and nothing else — never a branch, a version or a
     * build date — because the sha is the only one of those that names one
     * tree.
     *
     * `nullish` rather than `nullable`, for the same reason `DemoPersona.story`
     * is: an API older than this field does not send the key, and every client
     * reads this payload with `safeParse` and falls back to NULL on a failure.
     * Required, the first frontend deployed ahead of the API would lose the
     * whole platform answer — the demo pill, the persona picker, the fixed-code
     * notice — over a field it does not use. The API always sends the key; a
     * missing one means "an API that could not tell you".
     */
    commit: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    environment: "production" | "demo";
    sampleData: boolean;
    seededAt: string | null;
    commit?: string | null | undefined;
}, {
    environment: "production" | "demo";
    sampleData: boolean;
    seededAt: string | null;
    commit?: string | null | undefined;
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
    role: string;
    label: string;
    detail: string | null;
    surface: "broker" | "personal" | "host" | "landlord" | "oversight" | "staff" | "work";
    roleKey: string;
}, {
    role: string;
    label: string;
    detail: string | null;
    surface: "broker" | "personal" | "host" | "landlord" | "oversight" | "staff" | "work";
    roleKey: string;
}>;
export type DemoSeat = z.infer<typeof DemoSeat>;
/**
 * One thing a presenter can do as this persona, in the order a demo would do it.
 * `href` is where it happens: a path on the web origin (the operator app is
 * served under it at `/w/...` and `/oversight`), an absolute url for a console
 * on another host (admin), or null when the step is read rather than clicked.
 */
export declare const DemoStoryStep: z.ZodObject<{
    title: z.ZodString;
    detail: z.ZodString;
    href: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    detail: string;
    href: string | null;
}, {
    title: string;
    detail: string;
    href: string | null;
}>;
export type DemoStoryStep = z.infer<typeof DemoStoryStep>;
/**
 * What a persona is FOR in the demo: who they are, why the platform matters to
 * them, and what to try. Written against the seeded storyline, so every step
 * points at something the demo data actually holds (`verify-demo-story.mjs`
 * checks those anchors).
 */
export declare const DemoStory: z.ZodObject<{
    /** One line: "Front desk at Amahoro Boutique Hotel". */
    headline: z.ZodString;
    /** Two or three sentences a stakeholder reads before choosing. */
    summary: z.ZodString;
    tryThis: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        detail: z.ZodString;
        href: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        detail: string;
        href: string | null;
    }, {
        title: string;
        detail: string;
        href: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    summary: string;
    headline: string;
    tryThis: {
        title: string;
        detail: string;
        href: string | null;
    }[];
}, {
    summary: string;
    headline: string;
    tryThis: {
        title: string;
        detail: string;
        href: string | null;
    }[];
}>;
export type DemoStory = z.infer<typeof DemoStory>;
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
        role: string;
        label: string;
        detail: string | null;
        surface: "broker" | "personal" | "host" | "landlord" | "oversight" | "staff" | "work";
        roleKey: string;
    }, {
        role: string;
        label: string;
        detail: string | null;
        surface: "broker" | "personal" | "host" | "landlord" | "oversight" | "staff" | "work";
        roleKey: string;
    }>, "many">;
    /**
     * Null for a persona the demo guide does not narrate; absent from an API
     * older than the guide, so a client must treat a missing story as none.
     */
    story: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        /** One line: "Front desk at Amahoro Boutique Hotel". */
        headline: z.ZodString;
        /** Two or three sentences a stakeholder reads before choosing. */
        summary: z.ZodString;
        tryThis: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            detail: z.ZodString;
            href: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            title: string;
            detail: string;
            href: string | null;
        }, {
            title: string;
            detail: string;
            href: string | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        summary: string;
        headline: string;
        tryThis: {
            title: string;
            detail: string;
            href: string | null;
        }[];
    }, {
        summary: string;
        headline: string;
        tryThis: {
            title: string;
            detail: string;
            href: string | null;
        }[];
    }>>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    seats: {
        role: string;
        label: string;
        detail: string | null;
        surface: "broker" | "personal" | "host" | "landlord" | "oversight" | "staff" | "work";
        roleKey: string;
    }[];
    story?: {
        summary: string;
        headline: string;
        tryThis: {
            title: string;
            detail: string;
            href: string | null;
        }[];
    } | null | undefined;
}, {
    name: string;
    email: string;
    seats: {
        role: string;
        label: string;
        detail: string | null;
        surface: "broker" | "personal" | "host" | "landlord" | "oversight" | "staff" | "work";
        roleKey: string;
    }[];
    story?: {
        summary: string;
        headline: string;
        tryThis: {
            title: string;
            detail: string;
            href: string | null;
        }[];
    } | null | undefined;
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