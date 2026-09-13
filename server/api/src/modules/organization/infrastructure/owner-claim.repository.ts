import type { OrgRegistrationStatus } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { type SQL, and, eq, gt, sql } from 'drizzle-orm';

import {
  auditEvents,
  districts,
  identityDocuments,
  oboRegistrations,
  orgInvitations,
  orgMemberships,
  orgs,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { recordRegistrationEvent } from './registration-events';

/** Any reason a claim writes nothing. Rolls the transaction back; answered 404. */
export class ClaimRefused extends Error {
  constructor(readonly why: string) {
    super(`Claim refused: ${why}`);
  }
}

export interface ClaimOutcome {
  activated: boolean;
  payoutUnlocked: boolean;
}

/**
 * The owner claim's reads and its one transaction (FL02, ADR-053).
 *
 * Every refusal here collapses to "no such invitation" at the service. The
 * distinctions (`why`) exist for the log and for a reader of this file, never
 * for the response: a caller who learns WHICH check failed has learnt that a
 * real business sits behind the token.
 */
@Injectable()
export class OwnerClaimRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The invitation a token names, if it is still usable for THIS org: purpose
   * `obo_claim`, status `sent`, not expired, and issued for the org the path
   * names. One rule, read by the preview and re asserted inside the claim.
   */
  async findLiveInvitation(
    orgId: string,
    token: string,
  ): Promise<{ id: string } | null> {
    const [row] = await this.db
      .select({ id: orgInvitations.id })
      .from(orgInvitations)
      .where(liveInvitation(orgId, token))
      .limit(1);
    return row ?? null;
  }

  /**
   * What the claim page shows. Only what the invitation mail already told the
   * token's holder: never the national id, an email or the TIN.
   */
  async previewFacts(orgId: string): Promise<{
    legalName: string;
    districtName: string | null;
    registrationStatus: OrgRegistrationStatus;
    registrantUserId: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        legalName: orgs.legalName,
        districtName: districts.name,
        registrationStatus: orgs.registrationStatus,
        registrantUserId: oboRegistrations.registrantUserId,
      })
      .from(orgs)
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(oboRegistrations, eq(oboRegistrations.orgId, orgs.id))
      .where(eq(orgs.id, orgId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Claim the business, all or nothing (AC-R1, AC-R11).
   *
   * In one transaction: re assert the invitation, check the claimant's identity
   * document against the national id the registrant recorded, make them owner,
   * mark the OBO record claimed (unlocking payouts only when `unlockPayout`),
   * spend the invitation, activate an `approved` business with its event row,
   * and write the audit row. Any failed step throws `ClaimRefused` and nothing
   * is kept.
   *
   * No row lock is taken. Every write that matters is conditional (`status =
   * 'sent'`, `claim_status = 'registrant_held'`, `registration_status =
   * 'approved'`), so two presses of one token end with one claim and one
   * refusal, never a doubled membership or a second activation.
   */
  async claim(input: {
    orgId: string;
    token: string;
    userId: string;
    unlockPayout: boolean;
  }): Promise<ClaimOutcome> {
    return this.db.transaction(async (tx) => {
      // 1. The invitation, by the same rule the preview uses.
      const [invitation] = await tx
        .select({ id: orgInvitations.id })
        .from(orgInvitations)
        .where(liveInvitation(input.orgId, input.token))
        .limit(1);
      if (!invitation) throw new ClaimRefused('no live invitation');

      const [obo] = await tx
        .select({
          id: oboRegistrations.id,
          nationalId: oboRegistrations.intendedOwnerNationalId,
        })
        .from(oboRegistrations)
        .where(
          and(
            eq(oboRegistrations.orgId, input.orgId),
            eq(oboRegistrations.claimInvitationId, invitation.id),
            eq(oboRegistrations.claimStatus, 'registrant_held'),
          ),
        )
        .limit(1);
      if (!obo) throw new ClaimRefused('no unclaimed OBO record for this invitation');

      // 2. Holding the link is not enough (AC-R11). ANY of the claimant's active
      //    documents may match; a registration that recorded no national id can
      //    never match, which fails closed rather than open.
      if (!obo.nationalId) throw new ClaimRefused('no national id recorded');
      const [document] = await tx
        .select({ id: identityDocuments.id })
        .from(identityDocuments)
        .where(
          and(
            eq(identityDocuments.identityId, input.userId),
            eq(identityDocuments.status, 'active'),
            eq(identityDocuments.documentNumber, obo.nationalId),
          ),
        )
        .limit(1);
      if (!document) throw new ClaimRefused('identity document does not match');

      // 3. Owner. A claimant already on the business (a manager, say) is raised
      //    to owner rather than refused by the one membership per person rule.
      await tx
        .insert(orgMemberships)
        .values({ orgId: input.orgId, userId: input.userId, orgRole: 'owner' })
        .onConflictDoUpdate({
          target: [orgMemberships.orgId, orgMemberships.userId],
          set: {
            orgRole: 'owner',
            status: 'active',
            removedAt: null,
            updatedAt: new Date(),
          },
        });

      // 4. Claimed, and the payout lock cleared ONLY for a verified claimant.
      const claimed = await tx
        .update(oboRegistrations)
        .set({
          claimStatus: 'owner_claimed',
          claimedAt: new Date(),
          ...(input.unlockPayout ? { payoutLocked: false } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(oboRegistrations.id, obo.id),
            eq(oboRegistrations.claimStatus, 'registrant_held'),
          ),
        )
        .returning({ id: oboRegistrations.id });
      if (claimed.length === 0) throw new ClaimRefused('claimed concurrently');

      // 5. Spent, conditionally, so a second press finds nothing to accept.
      const spent = await tx
        .update(orgInvitations)
        .set({
          status: 'accepted',
          acceptedByUserId: input.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orgInvitations.id, invitation.id),
            eq(orgInvitations.status, 'sent'),
          ),
        )
        .returning({ id: orgInvitations.id });
      if (spent.length === 0) throw new ClaimRefused('invitation spent concurrently');

      // 6. Activate, with the same guarded update every transition uses. A
      //    business rejected mid claim is at `rejected`, so nothing moves and it
      //    is not silently activated; the claim itself still stands.
      const [org] = await tx
        .update(orgs)
        .set({ registrationStatus: 'active', updatedAt: new Date() })
        .where(
          and(eq(orgs.id, input.orgId), eq(orgs.registrationStatus, 'approved')),
        )
        .returning({ id: orgs.id, districtId: orgs.districtId });
      const activated = org !== undefined;
      if (activated) {
        await recordRegistrationEvent(tx, {
          orgId: input.orgId,
          from: 'approved',
          to: 'active',
          // The owner claiming is the registrant side of the pipeline acting.
          mover: { trigger: 'registrant', actorUserId: input.userId },
        });
      }

      // 7. The audit row, carrying why payouts did or did not unlock.
      const [district] = activated
        ? [{ districtId: org.districtId }]
        : await tx
            .select({ districtId: orgs.districtId })
            .from(orgs)
            .where(eq(orgs.id, input.orgId))
            .limit(1);
      await tx.insert(auditEvents).values({
        actorUserId: input.userId,
        subjectType: 'org',
        subjectId: input.orgId,
        eventType: 'registration.owner_claimed',
        payloadDiff: {
          payoutUnlocked: input.unlockPayout,
          payoutLockReason: input.unlockPayout ? null : 'claimant_not_kyc_verified',
          activated,
          invitationId: invitation.id,
        } as never,
        reason: null,
        districtId: district?.districtId ?? null,
      });

      return { activated, payoutUnlocked: input.unlockPayout };
    });
  }
}

/** The live invitation rule, stated once for both the preview and the claim. */
function liveInvitation(orgId: string, token: string): SQL | undefined {
  return and(
    eq(orgInvitations.token, token),
    eq(orgInvitations.orgId, orgId),
    eq(orgInvitations.purpose, 'obo_claim'),
    eq(orgInvitations.status, 'sent'),
    gt(orgInvitations.expiresAt, sql`now()`),
  );
}
