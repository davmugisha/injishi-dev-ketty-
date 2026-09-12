import { StaffAccess } from "@injishi/contracts";

import { apiGet, type ApiResult } from "./server";

/**
 * Who is asking — `GET /api/v1/me/staff` (F-S01, ADR-012).
 *
 * Not one of the 14 admin sections: it sits in front of all of them, and it is
 * the only route in this app that a NON-staff caller is allowed to reach. That
 * is deliberate on the API side — the route is guarded by `SessionGuard` alone,
 * so it can answer `isStaff: false` to somebody who is signed in. A route
 * mounted behind `StaffGuard` could only ever 403, and a 403 is indistinguishable
 * from "we could not ask".
 *
 * `permissions` arrives already resolved from `roles` by the server. A client
 * that turns a role into powers holds its own copy of the table and drifts from
 * the server's — the exact bug ADR-012 removed on the org side.
 */
export function getStaffAccess(): Promise<ApiResult<StaffAccess>> {
  return apiGet("/api/v1/me/staff", StaffAccess);
}
