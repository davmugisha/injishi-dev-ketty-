import type {
  CreateRegistrationRequest,
  OrgRegistrationStatus,
  OversightDecisionPage,
  OversightGrant,
  OversightQueueItem,
  OversightRole,
  RegistrationBusinessType,
  RegistrationConflictCode,
  RegistrationFeeQuote,
  RegistrationRejectionReason,
  RegistrationSummary,
} from '@injishi/contracts';
import {
  OPERATOR_CONTRACT_VERSION,
  SEPARATION_OF_DUTIES_MESSAGE,
  businessTypeFor,
  OVERSIGHT_OWN_BUSINESS_MESSAGE,
  districtScopeOf,
  scopeCoversDistrict,
  violatesSeparationOfDuties,
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
import { ClaimInvitationMailer } from '../infrastructure/claim-invitation.mailer';
import { SYSTEM_MOVER } from '../infrastructure/registration-events';
import { tinRecheckDue, tinRecheckStalled } from '../domain/tin-recheck';
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
    private readonly claimMailer: ClaimInvitationMailer,
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
        // The contract requires all three (ADR-053 J25), so a registration
        // created here can always be invited and always be matched.
        obo:
          request.capacity === 'on_behalf_of' && request.intendedOwner
            ? {
                intendedOwnerName: request.intendedOwner.name,
                intendedOwnerNationalId: request.intendedOwner.nationalId,
                intendedOwnerEmail: request.intendedOwner.email,
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

      // Mailed AFTER the create transaction committed (ADR-053), so a relay
      // failing cannot undo a registration that already exists. `send` never
      // throws; a failure is logged and the invitation row stands.
      if (created.claimInvitation) {
        await this.claimMailer.send({
          orgId: created.orgId,
          email: created.claimInvitation.email,
          token: created.claimInvitation.token,
          expiresAt: created.claimInvitation.expiresAt,
          legalName: b.legalName,
          intendedOwnerName: created.claimInvitation.intendedOwnerName,
          registrantName: await this.orgs.displayNameFor(registrantUserId),
        });
      }

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
        contractVersion: null,
        contractAcceptedAt: null,
        // An OBO registration is born locked (FL02); nobody else's is.
        payoutLocked: created.obo ? true : null,
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
  async settleFeeAndVerify(
    orgId: string,
    actorUserId: string,
  ): Promise<RegistrationSummary> {
    const before = await this.orgs.findById(orgId);
    if (!before) throw new NotFoundException('Registration not found.');

    if (awaitsRegistrationFee(before.status)) {
      const settled = await this.orgs.settleRegistrationFee(orgId, actorUserId);
      if (!settled) {
        // Two reasons a settle writes nothing, and they need opposite answers.
        // Still at `pending_payment` with no contract is the refusal (ADR-053,
        // AC-R13), read AFTER the attempt so an accept that landed in between is
        // honoured rather than refused. Anything else lost the race to a
        // concurrent callback, which is not an error: re-reading is the answer.
        const after = await this.orgs.findById(orgId);
        if (
          after &&
          awaitsRegistrationFee(after.status) &&
          after.contractVersion === null
        ) {
          throw new ConflictException({
            code: 'contract_not_accepted' satisfies RegistrationConflictCode,
            message:
              'Accept the operator contract before paying the registration fee.',
          });
        }
        this.log.log(`Registration fee for ${orgId} was already settled.`);
      }
      await this.runTinCheck(orgId);
    }

    return this.summary(orgId);
  }

  /**
   * Accept the operator contract, between creating the business and paying for
   * it (ADR-053, AC-R8).
   *
   * Refusals run in a fixed order so two that apply at once always answer the
   * same way: not a member (404), past `pending_payment` (409
   * `contract_not_open`), then a version that is not the current document (409
   * `contract_version_stale`). The stored version is always the constant, never
   * the request's, so the request can only ever confirm it.
   *
   * Accepting twice returns the first acceptance unchanged.
   */
  async acceptContract(
    orgId: string,
    actorUserId: string,
    contractVersion: string,
  ): Promise<RegistrationSummary> {
    await this.assertOwns(orgId, actorUserId);
    const org = await this.orgs.findById(orgId);
    if (!org) throw new NotFoundException('Registration not found.');

    if (!awaitsRegistrationFee(org.status)) {
      throw this.contractNotOpen();
    }
    if (contractVersion !== OPERATOR_CONTRACT_VERSION) {
      throw new ConflictException({
        code: 'contract_version_stale' satisfies RegistrationConflictCode,
        message:
          'The contract has changed since this page loaded. Reload it and read the current terms.',
      });
    }

    const wrote = await this.orgs.acceptContract({
      orgId,
      userId: actorUserId,
      contractVersion: OPERATOR_CONTRACT_VERSION,
    });
    if (!wrote) {
      // Either it was already accepted, which is the idempotent answer, or the
      // business moved past `pending_payment` between the read and the write.
      const now = await this.orgs.findById(orgId);
      if (!now?.contractVersion) throw this.contractNotOpen();
    }
    return this.summary(orgId);
  }

  private contractNotOpen(): ConflictException {
    return new ConflictException({
      code: 'contract_not_open' satisfies RegistrationConflictCode,
      message:
        'The contract is accepted while the registration fee is still owed, and this registration is past that step.',
    });
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
      if (to) await this.orgs.advance(orgId, 'submitted', to, SYSTEM_MOVER);
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
      if (to) await this.orgs.advance(orgId, 'submitted', to, SYSTEM_MOVER);
      return;
    }
    if (outcome.result === 'failed') {
      const to = nextStatus('submitted', 'rejected');
      if (to) await this.orgs.advance(orgId, 'submitted', to, SYSTEM_MOVER);
      return;
    }
    // `pending` is RRA being unreachable, never a rejection. The org holds at
    // `submitted` and is retried; telling a real business it failed a check
    // that never ran would be the worse error (F-S03 §8).
  }

  /**
   * Try again every business whose RRA check came back unanswered and is due
   * (ADR-053, AC-R5). Called by the repeatable sweep, never by a request.
   *
   * Each attempt goes through `runTinCheck`, the same path submission takes, so
   * a retry writes its own `tin_verifications` row and, on an answer, moves the
   * business with a `system` event exactly as the first attempt would have.
   *
   * At the ceiling nothing happens here, on purpose. The business stays at
   * `submitted` and admin's review queue flags it stalled, because the ceiling
   * is where a human decides. It is never auto rejected.
   *
   * One business failing does not stop the rest: an adapter that throws for one
   * TIN is not a reason to leave every other paying business waiting.
   */
  async recheckPendingTins(
    now: Date = new Date(),
  ): Promise<{ due: number; rechecked: number; stalled: number }> {
    const pending = await this.orgs.pendingTinRechecks();
    let due = 0;
    let rechecked = 0;
    let stalled = 0;

    for (const org of pending) {
      if (tinRecheckStalled(org.attempts)) {
        stalled += 1;
        continue;
      }
      if (!tinRecheckDue(org.attempts, org.lastCheckedAt, now)) continue;
      due += 1;
      try {
        await this.runTinCheck(org.orgId);
        rechecked += 1;
      } catch (error) {
        this.log.error(
          `TIN recheck failed for ${org.orgId}: ${(error as Error).message}`,
        );
      }
    }

    return { due, rechecked, stalled };
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
    const payoutLocked = await this.orgs.payoutLockedFor(orgId);
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
      contractVersion: org.contractVersion,
      contractAcceptedAt: org.contractAcceptedAt?.toISOString() ?? null,
      payoutLocked,
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

    // The one definition of region scope (ADR-053, AC-G8): the list reads the
    // same district set the single record gate below asks about.
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
    const grant = await this.grantCovering(orgId, grants, actorUserId);
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
    const grant = await this.grantCovering(orgId, grants, actorUserId);

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
    const grant = await this.grantCovering(orgId, grants, actorUserId);
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
    const moved = await this.orgs.advance(orgId, org.status, to, {
      trigger: 'registrant',
      actorUserId,
    });
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
    actorUserId: string,
  ): Promise<OversightGrant> {
    const org = await this.orgs.findById(orgId);
    if (!org) throw new NotFoundException('Registration not found.');

    // Conflict of interest, the act-time half (ADR-053, AC-G3). Checked BEFORE
    // scope, because an officer gating their own business is a worse answer than
    // one gating a business in the wrong district, and it is refused whatever
    // their region: the objection is the interest, not the geography.
    //
    // The grant-time check cannot cover this direction. A person appointed first
    // can be added to a business afterwards, and nothing revisits their grant when
    // that happens.
    if (await this.orgs.holdsOrgRole(orgId, actorUserId)) {
      throw new ForbiddenException(OVERSIGHT_OWN_BUSINESS_MESSAGE);
    }

    // The SAME set the queue lists from (ADR-053, AC-G8), asked of one business.
    // The gate is the whole set; the covering grant is the one whose own share of
    // that set holds the district, and it is only needed for the body and title
    // the review row copies.
    const provinces = await this.provinceDistrictsFor(grants);
    const covering = scopeCoversDistrict(
      districtScopeOf(grants, provinces),
      org.districtId,
    )
      ? grants.find((g) =>
          scopeCoversDistrict(districtScopeOf([g], provinces), org.districtId),
        )
      : undefined;
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
   * The officer's own decisions, newest first (ADR-053, AC-G6).
   *
   * Their OWN only: this is their record of what they decided and why, and a
   * colleague's decisions are somebody else's record that no role has asked to
   * read. Every read writes a `record_access_logs` row, like every other
   * oversight read of registration data.
   */
  async decisionsFor(
    actorUserId: string,
    cursor: string | undefined,
  ): Promise<OversightDecisionPage> {
    const page = await this.orgs.decisionsBy({
      userId: actorUserId,
      before: decodeDecisionCursor(cursor),
      limit: DECISION_PAGE_SIZE,
    });
    await this.orgs.logDecisionLogRead(actorUserId);
    const last = page.rows.at(-1);
    return {
      items: page.rows.map((r) => ({
        reviewId: r.id,
        orgId: r.orgId,
        legalName: r.legalName,
        stage: r.stage,
        decision: r.decision,
        reasonCode: r.reasonCode,
        notes: r.notes,
        governmentBodyCode: r.governmentBodyCode,
        governmentTitle: r.governmentTitle,
        decidedAt: r.decidedAt.toISOString(),
      })),
      nextCursor:
        page.more && last ? encodeDecisionCursor(last.decidedAt, last.id) : null,
    };
  }

  /**
   * Which districts an officer's grants reach, or null for "everywhere", read
   * through `districtScopeOf` in `@injishi/contracts`, the one definition.
   * Only the geography lookup is here, because the package reads no rows.
   */
  private async districtScopeFor(
    grants: OversightGrant[],
  ): Promise<number[] | null> {
    return districtScopeOf(grants, await this.provinceDistrictsFor(grants));
  }

  /** The districts of every province these grants name, and no others. */
  private async provinceDistrictsFor(
    grants: OversightGrant[],
  ): Promise<Map<number, number[]>> {
    const provinceIds = [
      ...new Set(
        grants
          .filter((g) => g.scopeLevel === 'province' && g.provinceId !== null)
          .map((g) => g.provinceId as number),
      ),
    ];
    return this.orgs.districtsByProvince(provinceIds);
  }
}

/** How many decisions one page of the log carries. */
const DECISION_PAGE_SIZE = 25;

/**
 * An opaque cursor over (decided_at, id): the time alone cannot break a tie
 * between two decisions recorded in the same millisecond, which would skip or
 * repeat a row at a page boundary. base64url so nobody builds one by hand.
 */
function encodeDecisionCursor(decidedAt: Date, id: string): string {
  return Buffer.from(`${decidedAt.toISOString()}|${id}`, 'utf8').toString(
    'base64url',
  );
}

/** A malformed cursor reads as no cursor (the newest page), never a 400. */
function decodeDecisionCursor(
  cursor: string | undefined,
): { decidedAt: Date; id: string } | undefined {
  if (!cursor) return undefined;
  const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const decidedAt = at ? new Date(at) : null;
  if (!decidedAt || Number.isNaN(decidedAt.getTime()) || !id) return undefined;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  return { decidedAt, id };
}
