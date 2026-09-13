import {
  ClaimOrgRequest,
  type ClaimPreview,
  type RegistrationSummary,
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

import { OwnerClaimService } from '../../../modules/organization/application/owner-claim.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { WorkspaceService } from '../../../shared/auth/workspace.service';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The owner claim → /api/v1/orgs/:orgId/claim (FL02, ADR-049).
 *
 * Behind `SessionGuard` and NOT `WorkspaceGuard`, deliberately: the caller holds
 * no workspace yet, which is the entire point of claiming. The token is the
 * authorization, as for every `org_invitations` row, and on the claim the
 * identity match is the second half of it.
 *
 * `UserThrottlerGuard` on both routes, the pairing `POST /bookings` uses for a
 * session no guard can scope to a workspace, so one signed in account cannot
 * script token guesses across orgs. It applies the module's one registered
 * bucket, five calls a minute per person per route.
 *
 * Both are POSTs with the token in the body, never a GET with it in the query,
 * so the token does not land in this API's access log.
 */
@Controller({ path: 'orgs/:orgId/claim', version: '1' })
@UseGuards(SessionGuard, UserThrottlerGuard)
export class OrgClaimsController {
  constructor(
    private readonly claims: OwnerClaimService,
    private readonly workspaces: WorkspaceService,
  ) {}

  /** What the claim page shows. 404 for any token that is not live for this org. */
  @Post('preview')
  @HttpCode(200)
  preview(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(ClaimOrgRequest)) body: ClaimOrgRequest,
  ): Promise<ClaimPreview> {
    return this.claims.preview(orgId, body.token);
  }

  /**
   * Claim the business. 404 for every refusal, an identity mismatch included,
   * and never a 409: a distinct answer would reveal that the org exists.
   *
   * `mayElevate` is read here, from `WorkspaceService`, the one definition of
   * "verified KYC and an active document". It decides only whether payouts
   * unlock; the organization module does not hold a second copy of the rule.
   */
  @Post()
  @HttpCode(200)
  async claim(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(ClaimOrgRequest)) body: ClaimOrgRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<RegistrationSummary> {
    return this.claims.claim({
      orgId,
      token: body.token,
      userId: user.id,
      claimantMayElevate: await this.workspaces.mayElevate(user.id),
    });
  }
}
