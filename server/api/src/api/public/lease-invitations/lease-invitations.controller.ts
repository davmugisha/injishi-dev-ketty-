import { LeaseInvitationToken, type LeaseInvitationPreview } from '@injishi/contracts';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { LeaseInvitationsService } from '../../../modules/rentals/application/lease-invitations.service';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The tenant's invitation page, before they have an account:
 * `GET /api/v1/lease-invitations/:token` (blueprint 2.5).
 *
 * Public on purpose: this is how a tenant reaches Injishi at all. The landlord
 * typed their email, the email carries the token, and the page shows who
 * invited them to what before asking them to sign in with that address. The
 * address itself is partly hidden; taking the lease still needs a session for
 * it (`POST /me/lease-invitations/accept`).
 *
 * Throttled per address (no session here, so `UserThrottlerGuard` falls back
 * to the IP): a token is a secret, and guessing at one should be slow.
 */
@Controller({ path: 'lease-invitations', version: '1' })
@UseGuards(UserThrottlerGuard)
export class LeaseInvitationsController {
  constructor(private readonly invitations: LeaseInvitationsService) {}

  @Get(':token')
  @Throttle({ money: { limit: 20, ttl: 60_000 } })
  preview(@Param('token', new ZodValidationPipe(LeaseInvitationToken)) token: string): Promise<LeaseInvitationPreview> {
    return this.invitations.preview(token);
  }
}
