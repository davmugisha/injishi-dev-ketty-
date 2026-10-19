import {
  PSF_CONSENT_VERSION,
  PSF_DOMAINS,
  PSF_NOT_FOR_RESIDENCE_MESSAGE,
  PSF_NOT_OPEN_MESSAGE,
  PSF_NOT_PAYABLE_MESSAGE,
  PSF_OPEN_APPLICATION_MESSAGE,
  PSF_OWN_BUSINESS_MESSAGE,
  PSF_OWNER_GROUP_SHORT,
  PSF_STANDING_LABEL,
  defaultPsfMembershipDates,
  districtLetters,
  districtScopeOf,
  isInPsfQueueState,
  isPsfApplicant,
  psfBusinessActivityFor,
  psfFeeProblem,
  splitPsfName,
  type AdminOrgPsf,
  type OversightGrant,
  type PayPsfMembershipRequest,
  type PsfApplicationInput,
  type PsfApplicationPrefill,
  type PsfApproveRequest,
  type PsfBusinessesPage,
  type PsfBusinessesQuery,
  type PsfBusinessProfile,
  type PsfCatalogue,
  type PsfIdDocument,
  type PsfDeclineRequest,
  type PsfMembershipOverview,
  type PsfOfficerApplication,
  type PsfQueuePage,
  type PsfRegisterSummary,
  type PsfSubmittedCapacity,
  type PsfTier,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  PAYMENT_PORT,
  PaymentDeclinedError,
  PaymentUnavailableError,
  type PaymentPort,
} from '../../payments/domain/payment-port';
import { ProfileService } from '../../user/application/profile.service';
import { PsfMembershipMailer } from '../infrastructure/psf-membership.mailer';
import {
  OpenPsfApplicationExists,
  PsfMembershipRepository,
  type PsfAssociationRow,
  type PsfOfficerApplicationRow,
  type PsfOrgFacts,
  type PsfScope,
  type PsfTierRow,
} from '../infrastructure/psf-membership.repository';
import {
  buildPsfApplicationRow,
  toPsfApplicationView,
  toPsfMembershipView,
  toPsfTierView,
} from './psf-application-row';

/** Twenty five a page, the officer's decision log's page size (ADR-056 AC-10). */
const QUEUE_PAGE_SIZE = 25;
/** The register pages the same way, a little longer because its rows are short. */
const REGISTER_PAGE_SIZE = 30;

/**
 * PSF membership (ADR-056, widened by the PSF path): a business applies, a PSF
 * membership officer approves, the business pays through Injishi, and the
 * payment makes it a member.
 *
 * Who may act for a business is `isPsfApplicant` in `@injishi/contracts`,
 * read over facts this service resolves. It is an identity check, never a
 * workspace permission, because the application must work at every
 * registration stage and a pending business holds no permission (ADR-053
 * rule 2).
 *
 * An officer's region bounds everything they read and decide: the queue, one
 * application, and the register of businesses, through `districtScopeOf`, the
 * same rule the registration consoles apply.
 */
@Injectable()
export class PsfMembershipService {
  private readonly log = new Logger(PsfMembershipService.name);

  constructor(
    private readonly repo: PsfMembershipRepository,
    private readonly mail: PsfMembershipMailer,
    /** Read only for "use the document on file" (registration Phase 0). */
    private readonly profiles: ProfileService,
    /** The membership fee is charged here and passed on to PSF (the PSF path). */
    @Inject(PAYMENT_PORT) private readonly payments: PaymentPort,
    /** Where PSF's money goes: `PSF_PAYOUT_DESTINATION` and `PSF_PAYOUT_REF`. */
    private readonly config: ConfigService,
  ) {}

  /**
   * The form with its ID resolved: the one typed, or the applicant's own
   * document on file, copied here so the full number never crosses to the
   * browser. Refused at the field when there is nothing on file to copy.
   */
  async withIdDocument(
    form: PsfApplicationInput,
    userId: string,
  ): Promise<PsfApplicationInput & { idDocument: PsfIdDocument }> {
    if (form.idDocument) return { ...form, idDocument: form.idDocument };
    const onFile = await this.profiles.documentFor(userId);
    if (!onFile) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        issues: [
          {
            code: 'custom',
            path: ['idDocument', 'documentNumber'],
            message: 'There is no ID on your profile to use. Type the ID number instead.',
          },
        ],
      });
    }
    return { ...form, idDocument: onFile };
  }

  // --- The applicant ---------------------------------------------------------

  /**
   * The business, when the caller may act on its PSF membership; a refusal
   * otherwise: 404 for no such business, 422 for a residence, 403 for anyone
   * the applicant rule does not name.
   */
  private async applicantFacts(orgId: string, userId: string): Promise<PsfOrgFacts> {
    const facts = await this.repo.orgFacts(orgId);
    if (!facts) throw new NotFoundException('Business not found.');
    if (!PSF_DOMAINS.includes(facts.domain)) {
      throw new UnprocessableEntityException(PSF_NOT_FOR_RESIDENCE_MESSAGE);
    }
    const orgRole = await this.repo.activeRole(orgId, userId);
    if (!isPsfApplicant({ userId, domain: facts.domain, orgRole, obo: facts.obo })) {
      throw new ForbiddenException("Only the business's owner can see or change its PSF membership.");
    }
    return facts;
  }

  /** The on behalf agent, while the claim is still open; the owner otherwise. */
  private capacityOf(facts: PsfOrgFacts, userId: string): PsfSubmittedCapacity {
    return facts.obo?.claimStatus === 'registrant_held' && facts.obo.registrantUserId === userId
      ? 'on_behalf_of'
      : 'owner';
  }

  /**
   * What PSF's form files a business under (AC-3): a hotel's TIN, or whatever
   * a PSF business registered with. `none` files no number.
   */
  private registrationOf(facts: PsfOrgFacts): { type: string; number: string | null } {
    if (facts.domain !== 'enterprise') return { type: 'tin', number: facts.tin };
    const type = facts.registrationKind ?? (facts.tin ? 'tin' : 'none');
    return { type, number: type === 'tin' ? facts.tin : type === 'none' ? null : facts.registrationNumber };
  }

  private profileOf(facts: PsfOrgFacts): PsfBusinessProfile {
    return {
      domain: facts.domain,
      businessCode: facts.businessCode,
      districtName: facts.districtName,
      clusterName: facts.clusterName,
      associationName: facts.associationName,
      ownerGroups: facts.ownerGroups,
      registrationKind: facts.registrationKind,
    };
  }

  // --- The catalogues --------------------------------------------------------

  async tiers(): Promise<PsfTier[]> {
    return (await this.repo.tiers(true)).map(toPsfTierView);
  }

  /** The active clusters, each with its active associations, in order. */
  async catalogue(): Promise<PsfCatalogue> {
    const [clusters, associations] = await Promise.all([this.repo.clusters(true), this.repo.associations(true)]);
    return {
      clusters: clusters.map((c) => ({
        code: c.code,
        nameEn: c.nameEn,
        nameRw: c.nameRw,
        description: c.description,
        sortOrder: c.sortOrder,
        active: c.active,
        associations: associations
          .filter((a) => a.clusterCode === c.code)
          .map((a) => ({
            code: a.code,
            clusterCode: a.clusterCode,
            nameEn: a.nameEn,
            acronym: a.acronym,
            sortOrder: a.sortOrder,
            active: a.active,
          })),
      })),
    };
  }

  /**
   * The association a PSF registration names, or a refusal at its field. Read
   * BEFORE the registration's transaction opens, like a tier, so a retired
   * association refuses the whole registration with nothing written.
   */
  async associationForRegistration(code: string): Promise<PsfAssociationRow> {
    const association = await this.repo.activeAssociation(code);
    if (!association) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        issues: [
          {
            code: 'custom',
            path: ['business', 'associationCode'],
            message: 'That association is not on PSF’s list any more. Pick another.',
          },
        ],
      });
    }
    return association;
  }

  /** Whether an association is still offered, for a hotel's default (RHA). */
  async associationOffered(code: string): Promise<boolean> {
    return (await this.repo.activeAssociation(code)) !== null;
  }

  // --- The business's side (AC-15 to AC-17) ----------------------------------

  async overview(orgId: string, userId: string): Promise<PsfMembershipOverview> {
    const facts = await this.applicantFacts(orgId, userId);
    const [current, applications, activeTiers] = await Promise.all([
      this.repo.currentMembership(orgId),
      this.repo.applications(orgId),
      this.repo.tiers(true),
    ]);
    const openRow = applications.find((a) => a.status === 'submitted' || a.status === 'approved') ?? null;
    const registration = this.registrationOf(facts);
    return {
      orgId,
      registrationNumber: registration.number ?? '',
      profile: this.profileOf(facts),
      current: current ? toPsfMembershipView(current) : null,
      open: openRow
        ? {
            ...toPsfApplicationView(openRow),
            stage:
              openRow.status === 'approved'
                ? 'awaiting_payment'
                : isInPsfQueueState(facts.registrationStatus)
                  ? 'with_psf'
                  : 'waiting_tin_check',
          }
        : null,
      history: applications
        .filter((a) => a.status !== 'submitted' && a.status !== 'approved')
        .map(toPsfApplicationView),
      // No open application, and something to pick. A current membership does
      // not block it: renewing means applying again. A hotel files under its
      // TIN, so it needs one; a PSF business files under whatever it has.
      canApply:
        openRow === null &&
        activeTiers.length > 0 &&
        (facts.domain === 'enterprise' || facts.tin !== null),
      prefill: await this.prefill(facts, userId, applications[0] ?? null),
    };
  }

  /**
   * What the apply form starts from (ADR-056 value sourcing): the last filed
   * form when there is one, else the business row and the person. On behalf,
   * the person is the intended owner, never the agent typing.
   */
  private async prefill(
    facts: PsfOrgFacts,
    userId: string,
    last: Awaited<ReturnType<PsfMembershipRepository['applications']>>[number] | null,
  ): Promise<PsfApplicationPrefill> {
    if (last) {
      const f = toPsfApplicationView(last).form;
      return {
        companyName: f.companyName,
        streetAddress: f.streetAddress,
        businessActivity: f.businessActivity,
        website: f.website ?? undefined,
        companyType: f.companyType,
        ownership: f.ownership,
        ownershipOther: f.ownershipOther ?? undefined,
        tradeDirection: f.tradeDirection,
        tradeGoods: f.tradeGoods ?? undefined,
        tradeCountries: f.tradeCountries,
        contactRole: f.contactRole,
        firstName: f.firstName,
        lastName: f.lastName,
        gender: f.gender,
        phoneE164: f.phoneE164,
        email: f.email,
        idDocumentType: f.idDocumentType,
        idDocumentNumber: f.idDocumentNumber,
        dateOfBirth: f.dateOfBirth,
      };
    }
    const business: PsfApplicationPrefill = {
      companyName: facts.legalName,
      streetAddress: facts.addressText ?? undefined,
      businessActivity: psfBusinessActivityFor(
        facts.accommodationClass,
        facts.accommodationClassOther,
        facts.domain === 'enterprise' ? facts.associationName : null,
      ),
      tradeDirection: 'none',
      // A cooperative and an NGO say so in how they registered.
      ...(facts.registrationKind === 'rca'
        ? { companyType: 'cooperative' as const }
        : facts.registrationKind === 'rgb'
          ? { companyType: 'ngo' as const }
          : {}),
    };
    if (this.capacityOf(facts, userId) === 'on_behalf_of' && facts.obo) {
      return {
        ...business,
        ...splitPsfName(facts.obo.intendedOwnerName),
        email: facts.obo.intendedOwnerEmail ?? undefined,
        idDocumentType: facts.obo.intendedOwnerNationalId ? 'national_id' : undefined,
        idDocumentNumber: facts.obo.intendedOwnerNationalId ?? undefined,
      };
    }
    const person = await this.repo.personFacts(userId);
    if (!person) return business;
    return {
      ...business,
      contactRole: 'owner',
      ...(person.name ? splitPsfName(person.name) : {}),
      gender: person.gender === 'male' || person.gender === 'female' ? person.gender : undefined,
      phoneE164: person.phoneE164 ?? undefined,
      email: person.email,
      idDocumentType:
        person.documentType === 'national_id' || person.documentType === 'passport'
          ? person.documentType
          : undefined,
      idDocumentNumber: person.documentNumber ?? undefined,
      dateOfBirth: person.dob ?? undefined,
    };
  }

  /**
   * The tier a registration's application names, or a 422 (AC-6). Read
   * BEFORE the registration's transaction opens, so a retired tier refuses the
   * whole registration with nothing written.
   */
  async tierForFiling(code: string): Promise<PsfTierRow> {
    const tier = await this.repo.tier(code);
    if (!tier || !tier.active) {
      throw new UnprocessableEntityException('That membership tier is not offered any more. Pick another.');
    }
    return tier;
  }

  /**
   * The amount a business declared, checked against its tier (the PSF path):
   * a business pays what it can afford, inside the band it picked. Refused at
   * the field, so the form can say which band it missed.
   */
  assertDeclaredFee(tier: PsfTierRow, declaredFeeRwf: number | undefined, path: (string | number)[] = ['declaredFeeRwf']): void {
    const problem = psfFeeProblem(tier, declaredFeeRwf);
    if (problem) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path, message: problem }],
      });
    }
  }

  /** Apply from the workspace (AC-16). The wizard files through the same row builder. */
  async apply(orgId: string, userId: string, input: PsfApplicationInput): Promise<PsfMembershipOverview> {
    const facts = await this.applicantFacts(orgId, userId);
    const registration = this.registrationOf(facts);
    if (facts.domain !== 'enterprise' && !registration.number) {
      throw new UnprocessableEntityException('This business has no TIN on record, which PSF’s form needs.');
    }
    const tier = await this.repo.tier(input.requestedTierCode);
    if (!tier || !tier.active) {
      throw new UnprocessableEntityException('That membership tier is not offered any more. Pick another.');
    }
    this.assertDeclaredFee(tier, input.declaredFeeRwf);
    try {
      await this.repo.insertApplication({
        orgId,
        ...buildPsfApplicationRow({
          submittedByUserId: userId,
          capacity: this.capacityOf(facts, userId),
          registrationType: registration.type,
          registrationNumber: registration.number,
          tier,
          form: await this.withIdDocument(input, userId),
          consentGivenAt: new Date(),
          consentVersion: PSF_CONSENT_VERSION,
        }),
      });
    } catch (error) {
      if (error instanceof OpenPsfApplicationExists) {
        throw new ConflictException(PSF_OPEN_APPLICATION_MESSAGE);
      }
      throw error;
    }
    await this.afterFiled(orgId, tier.nameEn, facts.registrationStatus);
    return this.overview(orgId, userId);
  }

  /**
   * What follows a filed application, whichever door it came through: the
   * receipt to the business, and when the business is already past the TIN
   * check, the queue stamp and the officers' email.
   */
  async afterFiled(
    orgId: string,
    tierName: string,
    registrationStatus: PsfOrgFacts['registrationStatus'],
  ): Promise<void> {
    const withPsf = isInPsfQueueState(registrationStatus);
    await this.mail.received(orgId, tierName, withPsf);
    if (withPsf) await this.markQueued(orgId);
  }

  async withdraw(orgId: string, userId: string, applicationId: string): Promise<PsfMembershipOverview> {
    await this.applicantFacts(orgId, userId);
    const moved = await this.repo.withdraw(orgId, applicationId, userId);
    if (!moved) {
      const app = await this.repo.applicationById(applicationId);
      if (!app || app.orgId !== orgId) throw new NotFoundException('Application not found.');
      throw new ConflictException(PSF_NOT_OPEN_MESSAGE);
    }
    return this.overview(orgId, userId);
  }

  /**
   * Pay an approved application's fee (the PSF path), which is what makes the
   * business a member.
   *
   * The amount is the approval's, never the request's. The charge goes through
   * the payment seam keyed on the application, so a retry, a double press or a
   * "Check payment" after a handset prompt can only ever find the one charge.
   * A prompt still waiting on the person is a 409 `payment_pending`, not a
   * failure: pressing again asks the provider again under the same key.
   *
   * `phoneE164` is the number the prompt goes to. The seam's one time fee does
   * not carry an instrument yet, the gap `CaptureEscrowCommand` closed for
   * bookings (ADR-047); when a live adapter lands it travels the same way.
   */
  async pay(
    orgId: string,
    userId: string,
    applicationId: string,
    input: PayPsfMembershipRequest,
  ): Promise<PsfMembershipOverview> {
    void input.phoneE164;
    const facts = await this.applicantFacts(orgId, userId);
    const app = await this.repo.applicationById(applicationId);
    if (!app || app.orgId !== orgId) throw new NotFoundException('Application not found.');
    // Already paid: the press that lands after the payment did is not an error.
    if (app.status === 'member' && app.paidAt) return this.overview(orgId, userId);
    if (app.status !== 'approved' || app.approvedFeeRwf === null) {
      throw new ConflictException(PSF_NOT_PAYABLE_MESSAGE);
    }
    const workspaceId = await this.repo.workspaceIdFor(orgId);
    if (!workspaceId) throw new NotFoundException('This business has no workspace to pay from.');

    let receipt;
    try {
      receipt = await this.payments.chargeOneTimeFee({
        kind: 'one_time_fee',
        feeCode: 'psf_membership',
        idempotencyKey: `${workspaceId}:psf-membership:${applicationId}`,
        amountRwf: app.approvedFeeRwf,
        currency: 'RWF',
        workspaceId,
        memo: `PSF membership ${app.approvedMembershipNumber ?? ''} for ${facts.legalName}`.trim(),
      });
    } catch (error) {
      if (error instanceof PaymentDeclinedError) {
        throw new UnprocessableEntityException(`Mobile money declined the payment: ${error.reason}`);
      }
      if (error instanceof PaymentUnavailableError) {
        throw new ServiceUnavailableException('We could not reach mobile money, and nothing was taken. Try again in a moment.');
      }
      throw error;
    }
    if (receipt.settlement === 'pending') {
      throw new ConflictException({
        code: 'payment_pending',
        message: 'Approve the payment on your phone, then press Check payment.',
      });
    }

    const paidAt = receipt.occurredAt;
    const { startsOn, expiresOn } = defaultPsfMembershipDates(kigaliDate(paidAt));
    const recorded = await this.repo.recordPayment({
      applicationId,
      orgId,
      amountRwf: receipt.amountRwf,
      paymentRef: receipt.adapterRef,
      paymentMode: receipt.mode,
      paidAt,
      startsOn,
      expiresOn,
      recordedByUserId: userId,
    });
    // Only the call that recorded it remits and mails, so a race stays silent.
    if (recorded) {
      await this.remit(applicationId, workspaceId, receipt.amountRwf);
      await this.mail.member(orgId, {
        tierName: app.requestedTierName,
        membershipNumber: recorded.membershipNumber,
        annualFeeRwf: receipt.amountRwf,
        startsOn,
        expiresOn,
        paymentReference: receipt.adapterRef,
      });
    }
    return this.overview(orgId, userId);
  }

  /**
   * Pass a paid fee on to PSF. Best effort and after the fact: the membership
   * stands whatever happens here, and a fee not yet passed on stays visible as
   * `remitted_at IS NULL` for finance. Until PSF's account is configured
   * nothing is sent, and the log says so rather than pretending.
   */
  private async remit(applicationId: string, workspaceId: string, amountRwf: number): Promise<void> {
    const destination = this.config.get<string>('PSF_PAYOUT_DESTINATION');
    const destinationRef = this.config.get<string>('PSF_PAYOUT_REF');
    if ((destination !== 'momo' && destination !== 'bank') || !destinationRef) {
      this.log.warn(
        `PSF's payout account is not configured (PSF_PAYOUT_DESTINATION, PSF_PAYOUT_REF); the fee on application ${applicationId} is held for PSF.`,
      );
      return;
    }
    try {
      const sent = await this.payments.payout({
        kind: 'payout',
        destination,
        destinationRef,
        idempotencyKey: `${workspaceId}:psf-remittance:${applicationId}`,
        amountRwf,
        currency: 'RWF',
        workspaceId,
        memo: 'PSF membership fee',
      });
      if (sent.settlement === 'settled') await this.repo.recordRemittance(applicationId, sent.adapterRef);
    } catch (error) {
      this.log.error(
        `The fee on application ${applicationId} was not passed on to PSF: ${
          error instanceof Error ? error.message : 'unknown failure'
        }. The membership stands; the fee is held for PSF.`,
      );
    }
  }

  /**
   * Stamp an application's first entry into PSF's queue, and email the
   * officers for exactly the applications this call stamped (AC-9). Called at
   * submit, when the TIN check passes, and by the daily sweep; any of them may
   * race, and only the one that stamps sends.
   */
  async markQueued(orgId: string): Promise<number> {
    const stamped = await this.repo.markQueued(orgId);
    for (const id of stamped) {
      const app = await this.repo.applicationById(id);
      if (app) await this.mail.queueEntered(orgId, app.requestedTierName);
    }
    return stamped.length;
  }

  // --- Admin (AC-20) ----------------------------------------------------------

  /** The business's PSF section for the admin detail, without the filed form. */
  async adminView(orgId: string): Promise<AdminOrgPsf> {
    const [current, applications] = await Promise.all([
      this.repo.currentMembership(orgId),
      this.repo.applications(orgId),
    ]);
    return {
      membership: current ? toPsfMembershipView(current) : null,
      applications: applications.map((a) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the filed form (ID number, date of birth) is left out on purpose: admin reads this without a reason (AC-20)
        const { form: _form, ...summary } = toPsfApplicationView(a);
        return summary;
      }),
    };
  }

  // --- The daily sweep (AC-18, and the AC-9 catch up) -----------------------

  /**
   * End what expired, remind what expires within 30 days, and stamp any
   * application that reached the queue without its stamp (a crash between
   * the TIN advance and `markQueued`). `today` is Kigali's date, passed in so a
   * test can pin it.
   */
  async sweep(today: string = kigaliToday()): Promise<{ ended: number; reminded: number; stamped: number }> {
    const ended = await this.repo.endExpired(today);
    for (const e of ended) await this.mail.expired(e.orgId, e.membershipNumber);

    const reminders = await this.repo.claimExpiryReminders(today, addDays(today, 30));
    for (const r of reminders) await this.mail.expiring(r.orgId, r.membershipNumber, r.expiresOn);

    let stamped = 0;
    for (const orgId of await this.repo.unstampedQueuedOrgs()) stamped += await this.markQueued(orgId);
    return { ended: ended.length, reminded: reminders.length, stamped };
  }

  // --- The officer's side (AC-10 to AC-14) -----------------------------------

  /** The districts these grants cover: null for the country (`districtScopeOf`). */
  private async scopeOf(grants: OversightGrant[]): Promise<PsfScope> {
    const own = grants.filter((g) => g.oversightRole === 'psf_membership_officer');
    const provinceIds = [
      ...new Set(own.filter((g) => g.scopeLevel === 'province' && g.provinceId !== null).map((g) => g.provinceId as number)),
    ];
    return districtScopeOf(own, await this.repo.districtsByProvince(provinceIds));
  }

  async queue(officerUserId: string, grants: OversightGrant[], cursor: string | undefined): Promise<PsfQueuePage> {
    const scope = await this.scopeOf(grants);
    const page = await this.repo.queuePage(officerUserId, scope, decodeQueueCursor(cursor), QUEUE_PAGE_SIZE);
    const last = page.rows.at(-1);
    return {
      items: page.rows.map((r) => ({
        applicationId: r.applicationId,
        orgId: r.orgId,
        businessName: r.businessName,
        businessCode: r.businessCode,
        domain: r.domain,
        districtName: r.districtName,
        associationName: r.associationName,
        ownerGroups: r.ownerGroups,
        requestedTierName: r.requestedTierName,
        declaredFeeRwf: r.declaredFeeRwf,
        submittedAt: r.submittedAt.toISOString(),
        queuedAt: r.queuedAt ? r.queuedAt.toISOString() : null,
        registrationStatus: r.registrationStatus,
        canDecide: !r.officerHasStake,
      })),
      nextCursor: page.more && last ? encodeQueueCursor(last.sortAt, last.applicationId) : null,
    };
  }

  private toOfficerView(row: PsfOfficerApplicationRow): PsfOfficerApplication {
    return {
      ...toPsfApplicationView(row),
      orgId: row.orgId,
      businessName: row.businessName,
      districtName: row.districtName,
      registrationStatus: row.registrationStatus,
      profile: {
        domain: row.domain,
        businessCode: row.businessCode,
        districtName: row.districtName,
        clusterName: row.clusterName,
        associationName: row.associationName,
        ownerGroups: row.ownerGroups,
        registrationKind: row.registrationKind,
      },
      // Only an application still with PSF is decided; an approved one waits
      // on the business's payment.
      canDecide: row.status === 'submitted' && !row.officerHasStake,
    };
  }

  async officerApplication(
    officerUserId: string,
    grants: OversightGrant[],
    applicationId: string,
  ): Promise<PsfOfficerApplication> {
    const row = await this.repo.officerApplication(officerUserId, await this.scopeOf(grants), applicationId);
    if (!row) throw new NotFoundException('This application is not in the membership queue.');
    return this.toOfficerView(row);
  }

  /**
   * The application an officer may decide, or the right refusal: 409 when it
   * is no longer waiting on PSF (AC-13), 404 when it is not in the queue or not
   * in the officer's region, 403 when the officer holds a stake (AC-14).
   */
  private async decidable(
    officerUserId: string,
    grants: OversightGrant[],
    applicationId: string,
  ): Promise<PsfOfficerApplicationRow> {
    const row = await this.repo.officerApplication(officerUserId, await this.scopeOf(grants), applicationId);
    if (!row || row.status !== 'submitted') {
      const app = await this.repo.applicationById(applicationId);
      if (app && app.status !== 'submitted') throw new ConflictException(PSF_NOT_OPEN_MESSAGE);
      throw new NotFoundException('This application is not in the membership queue.');
    }
    if (row.officerHasStake) throw new ForbiddenException(PSF_OWN_BUSINESS_MESSAGE);
    return row;
  }

  /** The body the deciding officer sits at, copied onto the decision (D25). */
  private bodyOf(grants: OversightGrant[]): string {
    return grants.find((g) => g.oversightRole === 'psf_membership_officer')?.governmentBodyCode ?? 'PSF';
  }

  /**
   * Approve an application (AC-11 as the PSF path changed it). The business
   * owes what it declared, unless the officer names another amount; a tier PSF
   * prices itself, or an application filed before amounts were declared,
   * needs the officer's amount.
   */
  async approve(
    officerUserId: string,
    grants: OversightGrant[],
    applicationId: string,
    input: PsfApproveRequest,
  ): Promise<PsfOfficerApplication> {
    const row = await this.decidable(officerUserId, grants, applicationId);
    const fee =
      input.feeRwf ??
      row.declaredFeeRwf ??
      (row.quotedPriceKind === 'fixed' ? row.quotedFeeRwf : null);
    if (!fee) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['feeRwf'], message: 'Give the annual fee PSF charges for this tier.' }],
      });
    }
    const decided = await this.repo.approve({
      applicationId,
      officerUserId,
      bodyCode: this.bodyOf(grants),
      membershipNumber: input.membershipNumber,
      feeRwf: fee,
      note: input.note ?? null,
    });
    // Another officer won the race between the read and the write.
    if (!decided) throw new ConflictException(PSF_NOT_OPEN_MESSAGE);
    await this.mail.approved(decided.orgId, {
      tierName: row.requestedTierName,
      membershipNumber: input.membershipNumber,
      feeRwf: fee,
    });
    return this.officerApplication(officerUserId, grants, applicationId);
  }

  async decline(
    officerUserId: string,
    grants: OversightGrant[],
    applicationId: string,
    input: PsfDeclineRequest,
  ): Promise<PsfOfficerApplication> {
    await this.decidable(officerUserId, grants, applicationId);
    const decided = await this.repo.decline({
      applicationId,
      officerUserId,
      bodyCode: this.bodyOf(grants),
      reason: input.reason,
      note: input.note ?? null,
    });
    if (!decided) throw new ConflictException(PSF_NOT_OPEN_MESSAGE);
    await this.mail.declined(decided.orgId, input.reason, input.note ?? null);
    return this.decidedView(applicationId, decided.orgId);
  }

  /** A declined application, read back for the officer who declined it. */
  private async decidedView(applicationId: string, orgId: string): Promise<PsfOfficerApplication> {
    const [app, facts] = await Promise.all([
      this.repo.applicationById(applicationId),
      this.repo.orgFacts(orgId),
    ]);
    if (!app || !facts) throw new NotFoundException('Application not found.');
    return {
      ...toPsfApplicationView(app),
      orgId,
      businessName: facts.legalName,
      districtName: facts.districtName,
      registrationStatus: facts.registrationStatus,
      profile: this.profileOf(facts),
      canDecide: false,
    };
  }

  // --- The officer's register of businesses ----------------------------------

  /**
   * Every business in the officer's region, filtered (the PSF path): what kind
   * of business registered, where, and how it stands with PSF. A district
   * filter outside the region finds nothing, because the region is a boundary.
   */
  async register(grants: OversightGrant[], query: PsfBusinessesQuery): Promise<PsfBusinessesPage> {
    const scope = await this.scopeOf(grants);
    const page = await this.repo.registerPage(
      scope,
      {
        q: query.q,
        districtId: query.district,
        clusterCode: query.cluster,
        associationCode: query.association,
        tierCode: query.tier,
        standing: query.standing,
        group: query.group,
        tin: query.tin,
        kind: query.kind,
      },
      decodeQueueCursor(query.cursor),
      REGISTER_PAGE_SIZE,
    );
    const last = page.rows.at(-1);
    return {
      items: page.rows.map((r) => ({
        ...r,
        registeredAt: r.registeredAt.toISOString(),
      })),
      nextCursor: page.more && last ? encodeQueueCursor(last.registeredAt, last.orgId) : null,
      total: page.total,
    };
  }

  /** The officer's region at a glance, over the whole region. */
  async registerSummary(grants: OversightGrant[]): Promise<PsfRegisterSummary> {
    const scope = await this.scopeOf(grants);
    const year = Number(kigaliToday().slice(0, 4));
    // Midnight on 1 January in Kigali, which is UTC+2 all year.
    const yearStart = new Date(Date.UTC(year, 0, 1) - 2 * 3600 * 1000);
    const [s, regionLabel] = await Promise.all([this.repo.registerSummary(scope, yearStart), this.regionLabel(grants)]);
    return {
      regionLabel,
      total: s.total,
      members: s.members,
      waiting: s.waiting,
      paidThisYearRwf: s.paidThisYearRwf,
      byCluster: s.byCluster.map((c) => ({ key: c.key ?? 'none', label: c.label ?? 'Not classified', count: c.count })),
      byStanding: s.byStanding.map((r) => ({ key: r.key, label: PSF_STANDING_LABEL[r.key], count: r.count })),
      byGroup: s.byGroup.map((g) => ({ key: g.key, label: PSF_OWNER_GROUP_SHORT[g.key], count: g.count })),
      byDistrict: s.byDistrict.map((d) => ({
        key: String(d.key ?? 'none'),
        label: d.label ?? 'No district',
        letters: d.key === null ? '—' : districtLetters(d.key, d.label),
        count: d.count,
      })),
    };
  }

  /** The officer's region in words: Rwanda, or the provinces and districts posted to. */
  private async regionLabel(grants: OversightGrant[]): Promise<string> {
    const own = grants.filter((g) => g.oversightRole === 'psf_membership_officer');
    if (own.some((g) => g.scopeLevel === 'country')) return 'Rwanda';
    const districtIds = own.filter((g) => g.scopeLevel === 'district' && g.districtId !== null).map((g) => g.districtId as number);
    const provinceIds = own.filter((g) => g.scopeLevel === 'province' && g.provinceId !== null).map((g) => g.provinceId as number);
    const names = await this.repo.regionNames(districtIds, provinceIds);
    const parts = [
      ...provinceIds.map((id) => names.provinces.get(id)).filter((n): n is string => Boolean(n)),
      ...districtIds.map((id) => names.districts.get(id)).filter((n): n is string => Boolean(n)).map((n) => `${n} district`),
    ];
    return parts.length ? parts.join(', ') : 'No region';
  }
}

/** Today as a yyyy-mm-dd date in Kigali, the date PSF's paperwork uses. */
function kigaliToday(): string {
  return kigaliDate(new Date());
}

/** A moment, as the yyyy-mm-dd date it was in Kigali. */
function kigaliDate(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(at);
}

/** A yyyy-mm-dd date moved by whole days, in calendar terms. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The same encoding the officer's decision log pages by: base64url of `iso|id`. */
function encodeQueueCursor(sortAt: Date, id: string): string {
  return Buffer.from(`${sortAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

/** A malformed cursor reads as no cursor (the first page), never a 400. */
function decodeQueueCursor(cursor: string | undefined): { sortAt: Date; id: string } | undefined {
  if (!cursor) return undefined;
  const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const sortAt = at ? new Date(at) : null;
  if (!sortAt || Number.isNaN(sortAt.getTime()) || !id) return undefined;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  return { sortAt, id };
}
