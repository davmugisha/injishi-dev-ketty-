import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AdminActionRequest,
  type AdminClaimCodeReissued,
  AdminReasonQuery,
  type AdminSessionsRevoked,
  AdminUserListQuery,
  type AdminUnclaimedStaysResponse,
  type AdminUserListResponse,
} from '@injishi/contracts';

import { CurrentUser, SessionGuard } from '../../../shared/auth/session.guard';
import type { SessionUser } from '../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { AdminUsersService } from './admin-users.service';
import { AdminUserActionsService } from './user-actions.service';

/**
 * The people directory -> `GET /api/v1/admin/users` (INTERFACE.md §3).
 *
 * `@UseGuards(SessionGuard, StaffGuard)` IN THAT ORDER. `StaffGuard` throws a
 * 500 rather than treating the request as anonymous when the session guard did
 * not run first, exactly as `WorkspaceGuard` does, so reversing these two is a
 * loud boot-time-shaped failure instead of a quiet 403 that reads in a log as
 * "that staffer lost their access".
 *
 * THIS IS THE PII SURFACE OF THIS AREA. Everything the directory returns is
 * somebody else's identity, so the reason gate and the access log below are not
 * decoration: they are the difference between a console and a data export.
 */
@Controller({ path: 'admin/users', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminUsersController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly actions: AdminUserActionsService,
  ) {}

  /**
   * Stays nobody claimed.
   *
   * DECLARED BEFORE the directory route and before any parameterised route.
   * Nest matches in declaration order, so a parameterised `:id` route above this
   * one would swallow `unclaimed-stays` as an id and answer the wrong question
   * with a 200 — the failure that looks like a working endpoint. There is no
   * such route in this area today; the ordering is kept anyway so adding one
   * later cannot silently break this.
   *
   * NO REASON GATE, because INTERFACE.md marks only `GET /` as PII. This route
   * is about rows that have no owner: `guestName` here is the name written on a
   * walk-in card, not a directory entry that can be searched by identity.
   */
  @Get('unclaimed-stays')
  @RequireStaffPermission('admin.user.view')
  listUnclaimedStays(): Promise<AdminUnclaimedStaysResponse> {
    return this.users.listUnclaimedStays();
  }

  /**
   * The user directory.
   *
   * `reason` IS REQUIRED AND IS NOT PART OF `AdminUserListQuery`. The filter
   * schema defines the FILTERS, and a Zod object strips what it does not
   * declare, so a reason passed through that pipe would be silently discarded
   * and the access log would record an empty string. It is therefore parsed by
   * its own schema, in a second pipe, before the service is called at all.
   *
   * That schema is `AdminReasonQuery` in `@injishi/contracts`, not a local one.
   * It was local, twice, and the two copies disagreed: this route accepted any
   * non-empty string while the OBO register floored the reason at four
   * characters, so `reason=x` was refused at one door and accepted at another,
   * from the same browser, for the same person.
   *
   * Refusing rather than defaulting to something like "admin console read" is
   * the whole control: a default reason is a reason nobody wrote, and a trail
   * full of identical machine-written reasons cannot answer the only question
   * it is ever asked — why did this person look at my record.
   */
  @Get()
  @RequireStaffPermission('admin.user.view')
  listUsers(
    @Query(new ZodValidationPipe(AdminUserListQuery)) query: AdminUserListQuery,
    @Query(new ZodValidationPipe(AdminReasonQuery)) stated: AdminReasonQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminUserListResponse> {
    return this.users.listUsers(query, user.id, stated.reason);
  }

  // -------------------------------------------------------------------------
  // Writes. Each takes a written reason, answers 409 on a move the target is
  // not in a position to make, and commits exactly one `audit_events` row with
  // its change (`AdminUserActionsService`). `@HttpCode(200)` because they
  // change something that exists and create nothing.
  //
  // The literal `stays/...` route is declared BEFORE `:userId/...` for the
  // reason the reads above are ordered: a parameter route declared first is
  // the one that answers.
  // -------------------------------------------------------------------------

  /**
   * Give an unclaimed walk-in stay a new claim code; the old one stops working.
   *
   * `admin.user.session.revoke`, CHOSEN FROM WHAT EXISTS because no claim-code
   * permission does and this route may not invent one. A claim code is a bearer
   * credential: whoever types it takes the stay and the identity captured on
   * it. Re-issuing one revokes the old credential and mints its replacement,
   * which is the same class of power as ending a person's sessions — rotating
   * the key to somebody's record — and it is held by exactly the same roles
   * (`ops`, `super_admin`). The rejected alternatives: `admin.user.view` is a
   * READ, and a read permission must never authorise a write; `admin.dsr.action`
   * is compliance's legal workflow for data subject requests, which a lost slip
   * at a front desk is not; `admin.moderation.act` is about content.
   */
  @Post('stays/:stayId/reissue-claim')
  @HttpCode(200)
  @RequireStaffPermission('admin.user.session.revoke')
  reissueClaim(
    @Param('stayId', ParseUUIDPipe) stayId: string,
    @Body(new ZodValidationPipe(AdminActionRequest)) body: AdminActionRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminClaimCodeReissued> {
    return this.actions.reissueClaimCode(stayId, user.id, body.reason);
  }

  /**
   * End every session this person holds. 409 on your own account.
   *
   * The permission `ops` was given precisely for this ("enough of users to end
   * a session", `staff-authz.ts`): a compromised account is contained by
   * support staff, not only by a super_admin who may be asleep.
   */
  @Post(':userId/revoke-sessions')
  @HttpCode(200)
  @RequireStaffPermission('admin.user.session.revoke')
  revokeSessions(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(AdminActionRequest)) body: AdminActionRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminSessionsRevoked> {
    return this.actions.revokeSessions(userId, user.id, body.reason);
  }
}
