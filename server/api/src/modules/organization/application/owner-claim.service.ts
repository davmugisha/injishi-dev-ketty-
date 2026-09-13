import type { ClaimPreview, RegistrationSummary } from '@injishi/contracts';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { OrganizationRepository } from '../infrastructure/organization.repository';
import {
  ClaimRefused,
  OwnerClaimRepository,
} from '../infrastructure/owner-claim.repository';
import { RegistrationService } from './registration.service';

/**
 * The owner claim (FL02, ADR-053): the end of the pipeline an OBO registration
 * could never reach.
 *
 * **Every refusal is the same 404**, worded the same way: an expired token, a
 * spent one, a revoked one, one issued for another org, a token that never
 * existed, and a claimant whose identity document does not match. A distinct
 * answer for any of them tells the holder of a bad token that a real business
 * sits behind it, which is the probe the token exists to prevent.
 */
const NO_SUCH_INVITATION = 'That claim link is not valid.';

@Injectable()
export class OwnerClaimService {
  private readonly log = new Logger(OwnerClaimService.name);

  constructor(
    private readonly claims: OwnerClaimRepository,
    private readonly orgs: OrganizationRepository,
    private readonly registrations: RegistrationService,
  ) {}

  /**
   * What `/claim-org` shows before the owner commits (AC-R3).
   *
   * Authorized by a session and a live token, NOT by the identity match. The
   * invitation mail already names the business and its registrant, so checking
   * identity here buys no secrecy; and it would turn an owner whose document was
   * captured wrongly into a bare 404 with no way to learn why. The match stays
   * the claim's.
   */
  async preview(orgId: string, token: string): Promise<ClaimPreview> {
    const invitation = await this.claims.findLiveInvitation(orgId, token);
    if (!invitation) throw new NotFoundException(NO_SUCH_INVITATION);

    const facts = await this.claims.previewFacts(orgId);
    if (!facts) throw new NotFoundException(NO_SUCH_INVITATION);

    return {
      orgId,
      legalName: facts.legalName,
      districtName: facts.districtName,
      registrationStatus: facts.registrationStatus,
      registrantName: facts.registrantUserId
        ? await this.orgs.displayNameFor(facts.registrantUserId)
        : null,
    };
  }

  /**
   * Claim the business (AC-R1, AC-R2, AC-R11, AC-R12).
   *
   * `claimantMayElevate` is `WorkspaceService.mayElevate` for the session user,
   * read by the caller: verified KYC and an active document. It decides the
   * payout lock and nothing else. The identity match decides ownership, and it
   * is self declared, which is exactly why it is not allowed to unlock money.
   */
  async claim(input: {
    orgId: string;
    token: string;
    userId: string;
    claimantMayElevate: boolean;
  }): Promise<RegistrationSummary> {
    try {
      const outcome = await this.claims.claim({
        orgId: input.orgId,
        token: input.token,
        userId: input.userId,
        unlockPayout: input.claimantMayElevate,
      });
      this.log.log(
        `Org ${input.orgId} claimed by ${input.userId}: ` +
          `${outcome.activated ? 'activated' : 'not at approved, so not activated'}, ` +
          `payouts ${outcome.payoutUnlocked ? 'unlocked' : 'still locked (claimant not KYC verified)'}.`,
      );
    } catch (error) {
      if (error instanceof ClaimRefused) {
        // The reason is logged against the org id, never the token.
        this.log.warn(`Claim on org ${input.orgId} by ${input.userId} refused: ${error.why}`);
        throw new NotFoundException(NO_SUCH_INVITATION);
      }
      throw error;
    }
    return this.registrations.summary(input.orgId);
  }
}
