"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoPersona = exports.DemoSeat = exports.DemoSurface = exports.PlatformInfo = exports.PlatformEnvironmentName = void 0;
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
 * `staff` seat for platform staff, and are never flattened: a persona who
 * holds five seats is listed with five.
 */
exports.DemoSurface = zod_1.z.enum(["personal", "landlord", "broker", "work", "host", "staff"]);
exports.DemoSeat = zod_1.z.object({
    /** What the person reads: the org name, `Personal`, or the staff roles. */
    label: zod_1.z.string(),
    surface: exports.DemoSurface,
});
exports.DemoPersona = zod_1.z.object({
    email: zod_1.z.string(),
    name: zod_1.z.string(),
    seats: zod_1.z.array(exports.DemoSeat),
});
//# sourceMappingURL=platform.js.map