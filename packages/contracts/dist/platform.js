"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAFF_ROLE_LABEL = exports.OVERSIGHT_ROLE_LABEL = exports.DemoPersona = exports.DemoStory = exports.DemoStoryStep = exports.DemoSeat = exports.DemoSurface = exports.PlatformInfo = exports.PlatformEnvironmentName = void 0;
const zod_1 = require("zod");
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
exports.PlatformEnvironmentName = zod_1.z.enum(["production", "demo"]);
exports.PlatformInfo = zod_1.z.object({
    /** The API process's one environment. Staging reports `production`. */
    environment: exports.PlatformEnvironmentName,
    /** The database carries the `sample` marker: demo, staging, a laptop. */
    sampleData: zod_1.z.boolean(),
    /**
     * When the sample recipe last finished (an ISO instant), or null when it
     * never has. Read per request, so a reseed run by hand shows at once.
     */
    seededAt: zod_1.z.string().nullable(),
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
    commit: zod_1.z.string().nullish(),
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
    googleSignIn: zod_1.z.boolean().nullish(),
});
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
exports.DemoSurface = zod_1.z.enum(["personal", "landlord", "broker", "work", "host", "staff", "oversight"]);
exports.DemoSeat = zod_1.z.object({
    /**
     * WHERE the seat is: the org name, `Personal`, `Brokerage`, the admin
     * console, or the government body and region an officer covers.
     */
    label: zod_1.z.string(),
    surface: exports.DemoSurface,
    /**
     * WHAT the person is in that seat, as they would say it: `Owner`,
     * `Front office · Receptionist`, `Field verifier`, `Platform staff · Ops`,
     * `Guest / tenant`. Worded by the API so every picker reads the same words.
     */
    role: zod_1.z.string(),
    /**
     * The same role as a stable key a client may branch or sort on: the
     * `OrgRole` or `OversightRole` value, or `staff`, `personal`, `broker`.
     */
    roleKey: zod_1.z.string(),
    /**
     * An optional finer line: the government's own title for the post, or a
     * department position such as `Head of Front Office`. Null when there is
     * nothing more to say.
     */
    detail: zod_1.z.string().nullable(),
});
/**
 * One thing a presenter can do as this persona, in the order a demo would do it.
 * `href` is where it happens: a path on the web origin (the operator app is
 * served under it at `/w/...` and `/oversight`), an absolute url for a console
 * on another host (admin), or null when the step is read rather than clicked.
 */
exports.DemoStoryStep = zod_1.z.object({
    title: zod_1.z.string(),
    detail: zod_1.z.string(),
    href: zod_1.z.string().nullable(),
});
/**
 * What a persona is FOR in the demo: who they are, why the platform matters to
 * them, and what to try. Written against the seeded storyline, so every step
 * points at something the demo data actually holds (`verify-demo-story.mjs`
 * checks those anchors).
 */
exports.DemoStory = zod_1.z.object({
    /** One line: "Front desk at Amahoro Boutique Hotel". */
    headline: zod_1.z.string(),
    /** Two or three sentences a stakeholder reads before choosing. */
    summary: zod_1.z.string(),
    tryThis: zod_1.z.array(exports.DemoStoryStep),
});
exports.DemoPersona = zod_1.z.object({
    email: zod_1.z.string(),
    name: zod_1.z.string(),
    seats: zod_1.z.array(exports.DemoSeat),
    /**
     * Null for a persona the demo guide does not narrate; absent from an API
     * older than the guide, so a client must treat a missing story as none.
     */
    story: exports.DemoStory.nullish(),
});
/**
 * The short words an oversight role is read in, as a badge. The admin
 * console's appoint dialog words the same three with a description attached;
 * this is the name alone. (The org role's words are `ORG_ROLE_LABEL` in
 * `ops.ts`.)
 */
exports.OVERSIGHT_ROLE_LABEL = {
    business_approver: "Approver",
    business_field_verifier: "Field verifier",
    tax_compliance_officer: "Tax compliance officer",
    psf_membership_officer: "PSF membership officer",
    village_leader: "Village leader",
    dasso: "Sector DASSO",
    cell_executive: "Cell executive secretary",
    district_officer: "District officer",
    district_immigration: "District immigration officer",
};
/** The short words a platform staff role is read in. */
exports.STAFF_ROLE_LABEL = {
    super_admin: "Super admin",
    ops: "Ops",
    compliance: "Compliance",
    finance: "Finance",
    trainer: "Trainer",
};
//# sourceMappingURL=platform.js.map