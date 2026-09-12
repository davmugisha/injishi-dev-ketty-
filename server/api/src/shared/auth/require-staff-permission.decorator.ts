import { SetMetadata } from '@nestjs/common';
import type { StaffPermission } from '@injishi/contracts';

/**
 * Metadata key `StaffGuard` reads. Exported so the guard and the decorator
 * cannot drift onto two different strings — the failure mode there is silent:
 * the reflector finds nothing, the guard sees "no permission declared", and an
 * admin route that meant to require `admin.money.override` lets any staffer
 * through.
 */
export const REQUIRE_STAFF_PERMISSION = 'require_staff_permission';

/**
 * The platform-staff permission this admin route needs.
 *
 * Mirrors `@RequirePermission(...)` on the org side deliberately: same
 * `SetMetadata` shape, same "omit it and the route requires only that the
 * caller is staff at all" default, so a reader who knows one knows the other.
 *
 * The argument is typed `StaffPermission` — the Zod-inferred union from
 * `@injishi/contracts` — rather than `string`, so a typo (`admin.finance.read`
 * for `admin.finance.view`) fails the build instead of resolving to a
 * permission nobody holds and 403-ing every caller in production. That is the
 * whole reason this takes the contracts type: a misspelled permission is
 * indistinguishable from a correctly spelled one at runtime.
 *
 * Never widen it to accept a bare string, and never introduce a permission name
 * here that `packages/contracts/src/staff-authz.ts` does not define. That file
 * is the ONE model; the API resolves from it and the console renders from it.
 */
export const RequireStaffPermission = (
  permission: StaffPermission,
): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRE_STAFF_PERMISSION, permission);
