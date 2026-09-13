import {
  type AcceptedStaffInvitation,
  type StaffInvitationPreview,
  StaffInvitationTokenRequest,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { StaffInvitationService } from '../../../modules/organization/application/staff-invitation.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Accepting a staff invitation → /api/v1/orgs/:orgId/staff-invitation.
 *
 * Behind `SessionGuard` and NOT `WorkspaceGuard`, for the owner claim's reason:
 * the invitee holds no workspace yet, which is the point of accepting. The
 * token is the authorization, and the signed-in address matching the invited
 * one is the second half of it.
 *
 * `UserThrottlerGuard` on both, as on the claim, so one account cannot script
 * token guesses. Both are POSTs with the token in the body, so it never lands
 * in an access log.
 */
@Controller({ path: 'orgs/:orgId/staff-invitation', version: '1' })
@UseGuards(SessionGuard, UserThrottlerGuard)
export class StaffInvitationsController {
  constructor(private readonly invitations: StaffInvitationService) {}

  /** What the join page shows. 404 for any token not live for this business. */
  @Post('preview')
  @HttpCode(200)
  preview(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(StaffInvitationTokenRequest))
    body: StaffInvitationTokenRequest,
  ): Promise<StaffInvitationPreview> {
    return this.invitations.preview(orgId, body.token);
  }

  /** Accept, as the signed-in account. 403 when that is not the invited address. */
  @Post('accept')
  @HttpCode(200)
  accept(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(StaffInvitationTokenRequest))
    body: StaffInvitationTokenRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AcceptedStaffInvitation> {
    return this.invitations.accept({
      orgId,
      token: body.token,
      userId: user.id,
      userEmail: user.email,
    });
  }
}
