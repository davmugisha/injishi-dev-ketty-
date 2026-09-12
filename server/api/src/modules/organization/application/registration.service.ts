import type {
  CreateRegistrationRequest,
  OrgRegistrationStatus,
  OversightGrant,
  OversightQueueItem,
  OversightRole,
  RegistrationBusinessType,
  RegistrationFeeQuote,
  RegistrationRejectionReason,
  RegistrationSummary,
} from '@injishi/contracts';
import {
  SEPARATION_OF_DUTIES_MESSAGE,
  businessTypeFor,
  violatesSeparationOfDuties,
  withinScope,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  awaitsRegistrationFee,
  nextStatus,
} from '../domain/registration-status';
import {
  DuplicateTinError,
  MissingFeeError,
  OrganizationRepository,
} from '../infrastructure/organization.repository';
import { RraTinAdapter } from '../infrastructure/rra-tin.adapter';
import { ProfileService } from '../../user/application/profile.service';

/**
 * Business registration (F-S03 / FL01), the write path.
 *
 * The order of operations IS the decision (D23): create at `pending_payment`
 * with a bill, take the fee, and only then call RRA. Nothing unpaid reaches a
 * government officer's queue, which is the whole reason the fee moved to the
 * front of the pipeline.
 *
 * This is ORGANIZATION MODULE's only outward-facing surface. The API layer and
 * other modules compose this service, never the repository or the adapter.
 */
/**
 * Which gate each oversight function decides, expressed as the status the org
 * is IN while waiting for it (D25). `tax_compliance_officer` decides no gate,
 * which is why this maps to null rather than throwing: holding a tax console is
 * not an error, it just is not this pipeline.
 */
const STAGE_FOR_ROLE: Readonly<
  Record<OversightRole, 'tin_verified' | 'field_verified' | null>
> = {
  business_field_verifier: 'tin_verified',
  business_approver: 'field_verified',
  tax_compliance_officer: null,
};

@Injectable()
export class RegistrationService {
  private readonly log = new Logger(RegistrationService.name);

  constructor(
    private readonly orgs: OrganizationRepository,
    private readonly tin: RraTinAdapter,
    private readonly profiles: ProfileService,
  ) {}

  /** What this registration will cost, before anyone commits to it. */
  async quote(
    businessType: RegistrationBusinessType,
  ): Promise<RegistrationFeeQuote> {
    const amountRwf = await this.orgs.currentFee(businessType);
    if (amountRwf === null) {
      // A missing fee is a configuration gap, not a user error: admin has not
      // priced this path yet (F-A10). Saying so beats quoting zero.
      throw new NotFoundException(
        'Registration for this business type is not open yet.',
      );
    }
    return { businessType, amountRwf, currency: 'RWF' };
  }

  /**
   * Create the registration at `pending_payment` and hand back the bill.
   *
   * Nothing is verified here. The RRA call is deliberately downstream of the
   * payment, so this method never talks to an external system and cannot be
   * made slow or flaky by one.
   */
  async create(
    request: CreateRegistrationRequest,
    registrantUserId: string,
  ): Promise<RegistrationSummary> {
    if (request.role === 'broker') {
      // A broker is a `brokers` row, not an org, so it cannot come through
      // here: this method writes `orgs` and bills against `org_id`. The broker
      // path is `POST /registrations/broker`, served by
      // `BrokerRegistrationService` (F-R09, ADR-026). Refusing plainly beats
      // writing a half-broker into `orgs` and calling it registered.
      throw new BadRequestException(
        'A broker registers at /api/v1/registrations/broker, not here.',
      );
    }

    // Step 1 is saved BEFORE the business is created, and in its own
    // transaction. Two reasons. A registrant who then gets Step 2 wrong keeps
    // what they typed and does not retype it. And the identity document is
    // claimed at the earliest possible moment, so the "one human, one account"
    // clash is reported before an org row exists to clean up.
    if (request.personal) {
      await this.profiles.save(registrantUserId, request.personal);
    }

    // Asked even when Step 1 WAS supplied. A returning registrant may omit the
    // block and still owe a field; a new one may send a block that a later
    // schema change made incomplete. The stored profile is the only thing worth
    // checking, so it is the only thing checked.
    if (!(await this.profiles.isComplete(registrantUserId))) {
      throw new BadRequestException(
        'We still need your personal details before you can register a business.',
      );
    }

    const b = request.business;
    const address = b.address;

    try {
      const created = await this.orgs.createRegistration({
        legalName: b.legalName,
        domain: b.domain,
        rdbEntityGroup: b.domain === 'hospitality' ? b.entityGroup : null,
        accommodationClass:
          b.domain === 'hospitality' ? b.accommodationClass : null,
        accommodationClassOther:
          b.domain === 'hospitality'
            ? (b.accommodationClassOther ?? null)
            : null,
        residenceClass: b.domain === 'residence' ? b.residenceClass : null,
        tourismLicenseNumber:
          b.domain === 'hospitality' ? (b.tourismLicenseNumber ?? null) : null,
        chamberOfTourismMember:
          b.domain === 'hospitality' ? b.chamberOfTourismMember : false,
        psfMember: b.domain === 'hospitality' ? b.psfMember : false,
        eacStarGrade:
          b.domain === 'hospitality' ? (b.eacStarGrade ?? null) : null,
        // D24: a business carries a TIN, a residence carries a UPI. The database
        // carries the same rule, so this maps rather than decides.
        tin: b.domain === 'hospitality' ? b.tin : null,
        upi: b.domain === 'hospitality' ? (b.upi ?? null) : b.upi,
        districtId: address.districtId,
        sectorId: address.sectorId,
        addressText: address.street ?? null,
        ownerUserId: registrantUserId,
        businessType: businessTypeFor(request.role),
        // FL02: an OBO registration is held by the registrant and payout-locked
        // until the intended owner claims it. Captured here or it is captured
        // nowhere — the contract validates the block and nothing else read it.
        obo:
          request.capacity === 'on_behalf_of' && request.intendedOwner
            ? {
                intendedOwnerName: request.intendedOwner.name,
                intendedOwnerNationalId:
                  request.intendedOwner.nationalId ?? null,
                intendedOwnerEmail: request.intendedOwner.email ?? null,
              }
            : null,
        certificates: b.certificates.map((c) => ({
          kind: c.kind,
          kindOther: c.kindOther ?? null,
          objectKey: c.objectKey,
          certificateNumber: c.certificateNumber ?? null,
          issuedBy: c.issuedBy ?? null,
          issuedOn: c.issuedOn ?? null,
          expiresOn: c.expiresOn ?? null,
        })),
      });

      return {
        orgId: created.orgId,
        workspaceId: created.workspaceId,
        legalName: b.legalName,
        domain: b.domain,
        accommodationClass:
          b.domain === 'hospitality' ? b.accommodationClass : null,
        status: 'pending_payment',
        amountDueRwf: created.amountDueRwf,
        invoiceId: created.invoiceId,
        rejectionReason: null,
        rejectionNotes: null,
        submittedAt: null,
      };
    } catch (err) {
      if (err instanceof DuplicateTinError) {
        throw new ConflictException(err.message);
      }
      if (err instanceof MissingFeeError) {
        throw new NotFoundException(
          'Registration for this business type is not open yet.',
        );
      }
      throw err;
    }
  }

  /**
   * Settle the registration fee, then run the TIN check (D23).
   *
   * The payment and the check are separate steps on purpose. Settling is
   * idempotent and conditional, so a repeated callback advances nothing twice;
   * the RRA call that follows is the only part that can be slow or fail, and
   * failing it leaves the org safely at `submitted` for a retry.
   */
  async settleFeeAndVerify(orgId: string): Promise<RegistrationSummary> {
    const before = await this.orgs.findById(orgId);
    if (!before) throw new NotFoundException('Registration not found.');

    if (awaitsRegistrationFee(before.status)) {
      const settled = await this.orgs.settleRegistrationFee(orgId);
      if (!settled) {
        // Lost the race to a concurrent callback. Not an error: the org has
        // already moved on, and re-reading is the honest answer.
        this.log.log(`Registration fee for ${orgId} was already settled.`);
      }
      await this.runTinCheck(orgId);
    }

    return this.summary(orgId);
  }

  /**
   * Ask RRA whether the TIN is real, and record the answer either way.
   *
   * Every outcome writes a `tin_verifications` row, including the outage. The
   * log is the evidence trail admin's TIN console reads (F-A07), and a check
   * that happened but left no row is indistinguishable from one that never ran.
   */
  async runTinCheck(orgId: string): Promise<void> {
    const org = await this.orgs.findById(orgId);
    if (!org) throw new NotFoundException('Registration not found.');
    if (org.status !== 'submitted') return;

    if (!org.tin) {
      // A residence has no TIN to check, so the automatic gate does not apply
      // and it goes straight to the human ones.
      const to = nextStatus('submitted', 'tin_verified');
      if (to) await this.orgs.advance(orgId, 'submitted', to);
      return;
    }

    const outcome = await this.tin.verify(org.tin);
    await this.orgs.recordTinCheck({
      orgId,
      tin: org.tin,
      result: outcome.result,
      latencyMs: outcome.latencyMs,
      adapterMode: outcome.adapterMode,
      raw: outcome.raw,
    });

    if (outcome.result === 'verified') {
      const to = nextStatus('submitted', 'tin_verified');
      if (to) await this.orgs.advance(orgId, 'submitted', to);
      return;
    }
    if (outcome.result === 'failed') {
      const to = nextStatus('submitted', 'rejected');
      if (to) await this.orgs.advance(orgId, 'submitted', to);
      return;
    }
    // `pending` is RRA being unreachable, never a rejection. The org holds at
    // `submitted` and is retried; telling a real business it failed a check
    // that never ran would be the worse error (F-S03 §8).
  }

  /** What the pending workspace renders. */
  async summary(orgId: string): Promise<RegistrationSummary> {
    const org = await this.orgs.findById(orgId);
    if (!org) throw new NotFoundException('Registration not found.');
    if (!org.workspaceId) {
      throw new NotFoundException('That registration has no workspace.');
    }
    // Read only when it can matter. A rejected org owes an explanation; an
    // active one still carrying an old rejection would be telling the registrant
    // off for something they have already corrected.
    const rejection =
      org.status === 'rejected' ? await this.orgs.latestRejection(orgId) : null;
    return {
      orgId: org.id,
      workspaceId: org.workspaceId,
      legalName: org.legalName,
      domain: org.domain,
      accommodationClass:
        org.accommodationClass as RegistrationSummary['accommodationClass'],
      status: org.status,
      amountDueRwf: awaitsRegistrationFee(org.status)
        ? (org.amountDueRwf ?? null)
        : null,
      invoiceId: awaitsRegistrationFee(org.status)
        ? (org.invoiceId ?? null)
        : null,
      rejectionReason: rejection?.reasonCode ?? null,
      rejectionNotes: rejection?.notes ?? null,
      submittedAt: org.createdAt.toISOString(),
    };
  }

  /**
   * The businesses waiting on this officer, inside their region (F-S03 §6).
   *
   * The stage is derived from the FUNCTION, not passed in: a field verifier's
   * queue is everything at `tin_verified` and an approver's is everything at
   * `field_verified`. Letting a caller name the stage would let a verifier ask
   * for the approval queue.
   */
  async queueFor(
    actorUserId: string,
    grants: OversightGrant[],
  ): Promise<OversightQueueItem[]> {
    const role = grants[0]?.oversightRole;
    if (!role) return [];
    const stage = STAGE_FOR_ROLE[role];
    if (!stage) return [];

    const districtIds = await this.districtScopeFor(grants);
    const rows = await this.orgs.findQueue({ stage, districtIds });

    // Only the approval queue can be blocked this way, and only per row: an
    // approver may hold a mixed queue where they verified some of it.
    const items = await Promise.all(
      rows.map(async (r) => ({
        orgId: r.orgId,
        legalName: r.legalName,
        domain: r.domain,
        accommodationClass:
          r.accommodationClass as OversightQueueItem['accommodationClass'],
        tin: r.tin,
        upi: r.upi,
        districtId: r.districtId,
        districtName: r.districtName,
        sectorName: r.sectorName,
        addressText: r.addressText,
        status: r.status,
        waitingSince: r.waitingSince.toISOString(),
        blockedBySeparationOfDuties:
          role === 'business_approver'
            ? violatesSeparationOfDuties({
                actorUserId,
                fieldVerifiedByUserId:
                  await this.orgs.latestFieldVerifierId(r.orgId),
              })
            : false,
      })),
    );
    return items;
  }

  /**
   * The field verifier's gate: `tin_verified → field_verified` (Decision B).
   *
   * Confirms the business physically exists and its documents are legitimate.
   * Passing it activates nothing on its own — only the approver does.
   */
  async fieldVerify(
    orgId: string,
    actorUserId: string,
    grants: OversightGrant[],
    notes: string | null,
  ): Promise<RegistrationSummary> {
    const grant = await this.grantCovering(orgId, grants);
    await this.decide({
      orgId,
      stage: 'tin_verified',
      decision: 'passed',
      to: 'field_verified',
      actorUserId,
      grant,
      reasonCode: null,
      notes,
    });
    return this.summary(orgId);
  }

  /**
   * The approver's gate: `field_verified → approved`, and then straight on to
   * `active` in the same transaction (D21, retimed by D23).
   *
   * Nothing further is owed — the registration fee settled at submission — so
   * the approver's decision is the last gate. The single exception is the OBO
   * path, where the business is approved but held by an agent rather than its
   * owner, and rests payout-locked until the owner claims it (F-S03 §8).
   */
  async approve(
    orgId: string,
    actorUserId: string,
    grants: OversightGrant[],
    notes: string | null,
  ): Promise<RegistrationSummary> {
    const grant = await this.grantCovering(orgId, grants);

    // Separation of duties, re-checked HERE and not only at grant time: an
    // officer can legitimately hold both functions in different scopes, so the
    // question is never "may this person approve" but "may they approve THIS".
    const verifier = await this.orgs.latestFieldVerifierId(orgId);
    if (violatesSeparationOfDuties({ actorUserId, fieldVerifiedByUserId: verifier })) {
      throw new ForbiddenException(SEPARATION_OF_DUTIES_MESSAGE);
    }

    const awaitingClaim = await this.orgs.isAwaitingOwnerClaim(orgId);
    await this.decide({
      orgId,
      stage: 'field_verified',
      decision: 'passed',
      to: 'approved',
      actorUserId,
      grant,
      reasonCode: null,
      notes,
      thenActivate: !awaitingClaim,
    });
    if (awaitingClaim) {
      this.log.log(
        `Org ${orgId} is approved and held for an owner claim (OBO); it stays payout-locked.`,
      );
    }
    return this.summary(orgId);
  }

  /**
   * Refuse at either gate, with a reason the registrant can act on.
   *
   * The stage is read from where the org actually IS, so an officer cannot
   * reject a business at a gate it has not reached. The database refuses a
   * mismatch between the gate and the function on top of that.
   */
  async reject(
    orgId: string,
    actorUserId: string,
    grants: OversightGrant[],
    reasonCode: RegistrationRejectionReason,
    notes: string | null,
  ): Promise<RegistrationSummary> {
    const grant = await this.grantCovering(orgId, grants);
    const stage = STAGE_FOR_ROLE[grant.oversightRole];
    if (!stage) {
      throw new ForbiddenException('That console does not decide registrations.');
    }
    await this.decide({
      orgId,
      stage,
      decision: 'rejected',
      to: 'rejected',
      actorUserId,
      grant,
      reasonCode,
      notes,
    });
    return this.summary(orgId);
  }

  /**
   * Correct and resubmit: `rejected → submitted`, then the RRA check again.
   *
   * Never back to `pending_payment`. The fee is once per org ever and is
   * non-refundable (D23), so a corrected registration must not be presented
   * with a second bill.
   */
  async resubmit(orgId: string, actorUserId: string): Promise<RegistrationSummary> {
    const org = await this.orgs.findById(orgId);
    if (!org) throw new NotFoundException('Registration not found.');
    await this.assertOwns(orgId, actorUserId);

    const to = nextStatus(org.status, 'resubmitted');
    if (!to) {
      throw new ConflictException(
        'Only a rejected registration can be resubmitted.',
      );
    }
    const moved = await this.orgs.advance(orgId, org.status, to);
    if (moved) await this.runTinCheck(orgId);
    return this.summary(orgId);
  }

  /** Refuse a registrant who is not on this org. */
  async assertOwns(orgId: string, userId: string): Promise<void> {
    if (!(await this.orgs.isMember(orgId, userId))) {
      // 404 rather than 403: whether a registration exists is itself something
      // a stranger should not learn.
      throw new NotFoundException('Registration not found.');
    }
  }

  /**
   * The grant that actually reaches this business, or a refusal.
   *
   * An officer may hold several assignments; only one has to cover the target.
   * Scope is a BOUNDARY — an out of region business is unreachable, not merely
   * unlisted — so a miss is a 403, never an empty result.
   */
  private async grantCovering(
    orgId: string,
    grants: OversightGrant[],
  ): Promise<OversightGrant> {
    const org = await this.orgs.findById(orgId);
    if (!org) throw new NotFoundException('Registration not found.');

    const districtId = org.districtId;
    const provinceId =
      districtId === null
        ? null
        : await this.orgs.provinceIdForDistrict(districtId);

    const covering = grants.find((g) =>
      withinScope(g, { provinceId, districtId }),
    );
    if (!covering) {
      throw new ForbiddenException(
        'That business is outside the region you are assigned to.',
      );
    }
    return covering;
  }

  /** Record the decision and move the org, or explain why the move is stale. */
  private async decide(input: {
    orgId: string;
    stage: 'tin_verified' | 'field_verified';
    decision: 'passed' | 'rejected';
    to: OrgRegistrationStatus;
    actorUserId: string;
    grant: OversightGrant;
    reasonCode: RegistrationRejectionReason | null;
    notes: string | null;
    thenActivate?: boolean;
  }): Promise<void> {
    const org = await this.orgs.findById(input.orgId);
    if (!org) throw new NotFoundException('Registration not found.');
    if (org.status !== input.stage) {
      throw new ConflictException(
        `This registration is at ${org.status}, so that decision no longer applies.`,
      );
    }

    const done = await this.orgs.recordReviewAndAdvance({
      orgId: input.orgId,
      stage: input.stage,
      decision: input.decision,
      to: input.to,
      decidedByUserId: input.actorUserId,
      oversightRole: input.grant.oversightRole as
        | 'business_field_verifier'
        | 'business_approver',
      governmentBodyCode: input.grant.governmentBodyCode,
      governmentTitle: input.grant.governmentTitle,
      reasonCode: input.reasonCode,
      notes: input.notes,
      districtId: org.districtId,
      thenActivate: input.thenActivate ?? false,
    });
    if (!done) {
      // Lost the race to another officer. Not an error in the data, but the
      // caller's decision was taken against a state that no longer holds.
      throw new ConflictException(
        'Another officer moved this registration first. Reload and try again.',
      );
    }
  }

  /**
   * Which districts an officer's grants reach, or null for "everywhere".
   *
   * Null is not "none": a country-scoped grant adds no predicate at all, and
   * collapsing that to an empty list would silently hide every business from
   * the officer who can see the most.
   */
  private async districtScopeFor(
    grants: OversightGrant[],
  ): Promise<number[] | null> {
    if (grants.some((g) => g.scopeLevel === 'country')) return null;
    const ids = new Set<number>();
    for (const g of grants) {
      if (g.scopeLevel === 'district' && g.districtId !== null) {
        ids.add(g.districtId);
      }
      if (g.scopeLevel === 'province' && g.provinceId !== null) {
        for (const id of await this.orgs.districtIdsInProvince(g.provinceId)) {
          ids.add(id);
        }
      }
    }
    return [...ids];
  }
}
