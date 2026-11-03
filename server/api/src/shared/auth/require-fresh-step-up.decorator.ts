import { SetMetadata } from '@nestjs/common';

/** Metadata key `StaffGuard` reads; exported so the two cannot drift apart. */
export const REQUIRE_FRESH_STEP_UP = 'require_fresh_step_up';

/**
 * This admin route hands out authority, so the emailed step-up must be recent:
 * within `STAFF_GRANT_STEP_UP_SECONDS` (ten minutes, owner decision 2026-11-02).
 *
 * Role grants are single signer (ADR-053). The once per session code proves
 * the staffer held the mailbox when they signed in; this proves it at the
 * moment of granting. A stale step-up is refused with `step_up_stale`, and the
 * console asks for a new code (`POST /me/two-factor/send` then `/verify`) and
 * tries again.
 */
export const RequireFreshStepUp = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRE_FRESH_STEP_UP, true);
