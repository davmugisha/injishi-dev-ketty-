"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAFF_ROLE_LABEL = exports.OVERSIGHT_ROLE_LABEL = exports.DemoPersona = exports.DemoSeat = exports.DemoSurface = exports.PlatformInfo = exports.PlatformEnvironmentName = void 0;
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
exports.DemoPersona = zod_1.z.object({
    email: zod_1.z.string(),
    name: zod_1.z.string(),
    seats: zod_1.z.array(exports.DemoSeat),
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