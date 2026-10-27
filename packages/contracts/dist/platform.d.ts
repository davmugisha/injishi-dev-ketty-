import { z } from "zod";
import type { OversightRole, StaffRole } from "./primitives";
import { MobileMoneyNetwork } from "./booking";
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
/** A seam's effective mode (ADR-073 D-b): switched off, a test, or real. */
export declare const IntegrationMode: z.ZodEnum<["off", "mock", "live"]>;
export type IntegrationMode = z.infer<typeof IntegrationMode>;
/** What a collection pays for (073-gtbank-payments AC-2). */
export declare const PaymentPurposeName: z.ZodEnum<["booking", "service_order", "registration_fee", "rent", "subscription"]>;
export type PaymentPurposeName = z.infer<typeof PaymentPurposeName>;
export declare const PaymentRules: z.ZodObject<{
    networks: z.ZodArray<z.ZodEnum<["mtn_momo", "airtel_money"]>, "many">;
    maxCollectionRwf: z.ZodNullable<z.ZodNumber>;
    livePurposes: z.ZodArray<z.ZodEnum<["booking", "service_order", "registration_fee", "rent", "subscription"]>, "many">;
}, "strip", z.ZodTypeAny, {
    networks: ("mtn_momo" | "airtel_money")[];
    maxCollectionRwf: number | null;
    livePurposes: ("booking" | "registration_fee" | "subscription" | "service_order" | "rent")[];
}, {
    networks: ("mtn_momo" | "airtel_money")[];
    maxCollectionRwf: number | null;
    livePurposes: ("booking" | "registration_fee" | "subscription" | "service_order" | "rent")[];
}>;
export type PaymentRules = z.infer<typeof PaymentRules>;
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
    /**
     * Whether this API can sign a person in with Google: both Google OAuth
     * credentials are configured, so the provider is mounted.
     *
     * Every sign in screen asks before drawing the button as pressable. Without
     * it a screen either hides a route that works or offers one that answers
     * "provider not found" after the press.
     *
     * `nullish` for the reason `commit` gives: an API older than this field
     * does not send it, and a client reads a missing key as "not offered".
     */
    googleSignIn: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    /**
     * The effective mode of every client facing seam (ADR-073 AC-5; today
     * `payments` and `card_payments`, from 073-gtbank-payments). A screen
     * labels `mock` as a test, hides an action whose seam is `off`, and never
     * decides on its own whether money is real (AC-17).
     *
     * `nullish` for the reason `commit` gives. A client reads a missing key as
     * "unknown", and offers no money action it cannot label.
     */
    integrations: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodEnum<["off", "mock", "live"]>>>>;
    /**
     * What a payment screen must know before the payer presses pay
     * (073-gtbank-payments AC-2, AC-23): the networks a Request to Pay may go
     * to, the largest amount one prompt may ask for (null: no limit), and the
     * purposes that take money on this stack. `nullish` as above.
     */
    paymentRules: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        networks: z.ZodArray<z.ZodEnum<["mtn_momo", "airtel_money"]>, "many">;
        maxCollectionRwf: z.ZodNullable<z.ZodNumber>;
        livePurposes: z.ZodArray<z.ZodEnum<["booking", "service_order", "registration_fee", "rent", "subscription"]>, "many">;
    }, "strip", z.ZodTypeAny, {
        networks: ("mtn_momo" | "airtel_money")[];
        maxCollectionRwf: number | null;
        livePurposes: ("booking" | "registration_fee" | "subscription" | "service_order" | "rent")[];
    }, {
        networks: ("mtn_momo" | "airtel_money")[];
        maxCollectionRwf: number | null;
        livePurposes: ("booking" | "registration_fee" | "subscription" | "service_order" | "rent")[];
    }>>>;
}, "strip", z.ZodTypeAny, {
    environment: "production" | "demo";
    sampleData: boolean;
    seededAt: string | null;
    commit?: string | null | undefined;
    googleSignIn?: boolean | null | undefined;
    integrations?: Record<string, "mock" | "live" | "off"> | null | undefined;
    paymentRules?: {
        networks: ("mtn_momo" | "airtel_money")[];
        maxCollectionRwf: number | null;
        livePurposes: ("booking" | "registration_fee" | "subscription" | "service_order" | "rent")[];
    } | null | undefined;
}, {
    environment: "production" | "demo";
    sampleData: boolean;
    seededAt: string | null;
    commit?: string | null | undefined;
    googleSignIn?: boolean | null | undefined;
    integrations?: Record<string, "mock" | "live" | "off"> | null | undefined;
    paymentRules?: {
        networks: ("mtn_momo" | "airtel_money")[];
        maxCollectionRwf: number | null;
        livePurposes: ("booking" | "registration_fee" | "subscription" | "service_order" | "rent")[];
    } | null | undefined;
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
/**
 * Why a payment cannot be taken under the rules this stack publishes, or null
 * (073-gtbank-payments AC-23, AC-24).
 *
 * ONE function for the API and every form, the way `instrumentProblem` is, so
 * the checkout and the register wizard say exactly what the API would refuse,
 * before the payer presses pay, and the two cannot drift:
 * - a card, while the card seam is not `live`;
 * - a mobile money network the bank does not prompt on this stack;
 * - an amount above the bank's collection limit.
 *
 * Every sentence names the network or the limit, because "this payment
 * cannot be taken" sends a payer to try again with nothing to change.
 */
export declare function paymentRuleProblem(terms: {
    rules: PaymentRules | null | undefined;
    cardPayments: IntegrationMode | null | undefined;
}, amountRwf: number, instrument: {
    kind: "card";
} | {
    kind: "mobile_money";
    network: MobileMoneyNetwork;
}): string | null;
//# sourceMappingURL=platform.d.ts.map