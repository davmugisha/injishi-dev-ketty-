import { Module } from '@nestjs/common';

import { AuthModule } from '../../modules/auth/auth.module';
import { TwoFactorService } from '../../shared/auth/two-factor.service';
import { WorkspaceService } from '../../shared/auth/workspace.service';

/**
 * What every admin area module needs in order to be guarded, provided once.
 *
 * The two guards on an admin controller need three things between them, and
 * they come from different places:
 *
 *   - `SessionGuard` needs `AUTH_INSTANCE`, which `AuthModule` exports.
 *   - `StaffGuard` needs `WorkspaceService`, which nothing exports — it is a
 *     bare class that each consumer has to provide.
 *   - `StaffGuard` also needs `TwoFactorService`, for the F-S02 emailed step-up
 *     it now enforces on every admin route. Another bare class.
 *
 * The four area modules were each written to satisfy the first two on their
 * own, which works and stands up four `WorkspaceService` instances. That is not
 * a correctness bug today, because the service is stateless and reads through
 * the global Drizzle provider, but it contradicts the rule this codebase already
 * states out loud one directory over: `public-api.module.ts` provides
 * `WorkspaceService` exactly once and comments it as "the one resolver of which
 * workspaces does this user hold". Four copies of the one resolver is the
 * beginning of four answers.
 *
 * So this module holds them once and re-exports `AuthModule` with them, and an
 * area module imports this and nothing else. That is what made the step-up safe
 * to switch on: `TwoFactorService` was added HERE, so every admin route
 * acquired it at the same moment. Adding it area by area would have risked one
 * module being missed — and that does not fail a typecheck, it fails at boot,
 * because a guard's dependencies are resolved in the module of the controller
 * it guards.
 *
 * What `TwoFactorService` itself injects resolves from this module's scope, the
 * same set `public-api.module.ts` gives it: `WorkspaceService` (provided just
 * below), `OtpMailer` (exported by `AuthModule`, which is why the import stays
 * here rather than moving to each area), and `DRIZZLE` and `ConfigService`, both
 * global. It reads the process's environment from `PLATFORM` (ADR-043), so
 * it is an ordinary singleton, as are the guards that inject it.
 */
@Module({
  imports: [AuthModule],
  providers: [WorkspaceService, TwoFactorService],
  exports: [AuthModule, WorkspaceService, TwoFactorService],
})
export class AdminSharedModule {}
