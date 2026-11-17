import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';

import {
  type OwnershipTransferView,
  OwnershipTransferService,
} from '../../../modules/organization/application/ownership-transfer.service';
import { OWNERSHIP_STEP_UP_SECONDS } from '../../../modules/organization/domain/ownership-transfer';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import {
  CurrentSession,
  CurrentUser,
  SessionGuard,
  type SessionRecord,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { TwoFactorService } from '../../../shared/auth/two-factor.service';
import { CurrentWorkspace, RequirePermission, RequireProduct, WorkspaceGuard } from '../../../shared/auth/workspace.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

const RequestTransferBody = z.object({
  toUserId: z.string().uuid(),
  previousOwnerRole: z.string().min(1).max(40),
});
type RequestTransferBody = z.infer<typeof RequestTransferBody>;

/**
 * The owner's side of an ownership transfer → /api/v1/ops/team/ownership-transfer (migration 0155).
 *
 * `team.manage` opens the route; the service then requires the caller's membership role to BE owner, so a role given
 * team.manage by a preset still cannot hand the business away. Asking needs a fresh email step-up on this session
 * (`verifiedWithin`, ten minutes): the caller asks for a code (`POST /me/two-factor/send`), enters it
 * (`POST /me/two-factor/verify`), then asks for the transfer.
 */
@Controller({ path: 'ops/team/ownership-transfer', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('account')
export class OpsOwnershipTransferController {
  constructor(
    private readonly transfers: OwnershipTransferService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  @Get()
  @RequirePermission('team.manage')
  current(
    @CurrentWorkspace() ws: ScopedWorkspace,
  ): Promise<{ transfer: OwnershipTransferView | null; eligible: { userId: string; name: string; roleLabel: string }[] }> {
    return this.transfers.current(ws);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('team.manage')
  async request(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @CurrentSession() session: SessionRecord,
    @Body(new ZodValidationPipe(RequestTransferBody)) body: RequestTransferBody,
  ): Promise<{ transfer: OwnershipTransferView }> {
    const fresh = await this.twoFactor.verifiedWithin(session.id, OWNERSHIP_STEP_UP_SECONDS);
    return this.transfers.request(ws, user.id, fresh, body);
  }

  @Post(':transferId/cancel')
  @HttpCode(200)
  @RequirePermission('team.manage')
  cancel(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Param('transferId', ParseUUIDPipe) transferId: string,
  ): Promise<{ transfer: null }> {
    return this.transfers.cancel(ws, user.id, transferId);
  }
}

/**
 * The side of the member asked to become owner → /api/v1/me/ownership-transfers (migration 0155).
 *
 * Behind `SessionGuard` and NOT `WorkspaceGuard`: the request is addressed to a person, and only that person, signed in
 * as themselves, sees, accepts or declines it. Accepting needs a fresh email step-up on this session and a verified
 * identity. `UserThrottlerGuard`, as on the owner claim, so one account cannot script attempts.
 */
@Controller({ path: 'me/ownership-transfers', version: '1' })
@UseGuards(SessionGuard, UserThrottlerGuard)
export class MeOwnershipTransfersController {
  constructor(
    private readonly transfers: OwnershipTransferService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  /**
   * The notice on every POS screen reads this, so it may not share accept's and decline's five a minute: the
   * throttler counts per handler, and a manager opening a few screens in a minute was answered 429 and lost the
   * notice. Two a second per person is above any screen and still a ceiling on a looping client.
   */
  @Get()
  @Throttle({ money: { limit: 120, ttl: 60_000 } })
  inbox(@CurrentUser() user: SessionUser): Promise<{ transfers: OwnershipTransferView[] }> {
    return this.transfers.inbox(user.id);
  }

  @Post(':transferId/accept')
  @HttpCode(200)
  async accept(
    @CurrentUser() user: SessionUser,
    @CurrentSession() session: SessionRecord,
    @Param('transferId', ParseUUIDPipe) transferId: string,
  ): Promise<{ orgId: string; legalName: string }> {
    const fresh = await this.twoFactor.verifiedWithin(session.id, OWNERSHIP_STEP_UP_SECONDS);
    return this.transfers.accept(user.id, fresh, transferId);
  }

  @Post(':transferId/decline')
  @HttpCode(200)
  decline(
    @CurrentUser() user: SessionUser,
    @Param('transferId', ParseUUIDPipe) transferId: string,
  ): Promise<{ declined: true }> {
    return this.transfers.decline(user.id, transferId);
  }
}
