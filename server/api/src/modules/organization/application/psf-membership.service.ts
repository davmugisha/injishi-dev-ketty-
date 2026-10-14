import {
  PSF_CONSENT_VERSION,
  PSF_HOSPITALITY_ONLY_MESSAGE,
  PSF_NOT_OPEN_MESSAGE,
  PSF_OPEN_APPLICATION_MESSAGE,
  PSF_OWN_BUSINESS_MESSAGE,
  isInPsfQueueState,
  isPsfApplicant,
  psfBusinessActivityFor,
  splitPsfName,
  type AdminOrgPsf,
  type OversightGrant,
  type PsfApplicationInput,
  type PsfApplicationPrefill,
  type PsfIdDocument,
  type PsfDeclineRequest,
  type PsfMemberDecisionRequest,
  type PsfMembershipOverview,
  type PsfOfficerApplication,
  type PsfQueuePage,
  type PsfSubmittedCapacity,
  type PsfTier,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ProfileService } from '../../user/application/profile.service';
import { PsfMembershipMailer } from '../infrastructure/psf-membership.mailer';
import {
  OpenPsfApplicationExists,
  PsfMembershipRepository,
  type PsfOrgFacts,
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

/**
 * PSF membership (ADR-056): a business applies, a PSF membership officer
 * decides, a Yes becomes a membership.
 *
 * Who may act for a business is `isPsfApplicant` in `@injishi/contracts`,
 * read over facts this service resolves. It is an identity check, never a
 * workspace permission, because the application must work at every
 * registration stage and a pending business holds no permission (ADR-053
 * rule 2).
 */
@Injectable()
export class PsfMembershipService {
  constructor(
    private readonly repo: PsfMembershipRepository,
    private readonly mail: PsfMembershipMailer,
    /** Read only for "use the document on file" (registration Phase 0). */
    private readonly profiles: ProfileService,
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
    if (facts.domain !== 'hospitality') {
      throw new UnprocessableEntityException(PSF_HOSPITALITY_ONLY_MESSAGE);
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

  // --- The catalogue ---------------------------------------------------------

  async tiers(): Promise<PsfTier[]> {
    return (await this.repo.tiers(true)).map(toPsfTierView);
  }

  // --- The business's side (AC-15 to AC-17) ----------------------------------

  async overview(orgId: string, userId: string): Promise<PsfMembershipOverview> {
    const facts = await this.applicantFacts(orgId, userId);
    const [current, applications, activeTiers] = await Promise.all([
      this.repo.currentMembership(orgId),
      this.repo.applications(orgId),
      this.repo.tiers(true),
    ]);
    const openRow = applications.find((a) => a.status === 'submitted') ?? null;
    return {
      orgId,
      registrationNumber: facts.tin ?? '',
      current: current ? toPsfMembershipView(current) : null,
      open: openRow
        ? {
            ...toPsfApplicationView(openRow),
            stage: isInPsfQueueState(facts.registrationStatus) ? 'with_psf' : 'waiting_tin_check',
          }
        : null,
      history: applications.filter((a) => a.status !== 'submitted').map(toPsfApplicationView),
      // No open application, and something to pick. A current membership does
      // not block it: renewing means applying again.
      canApply: openRow === null && activeTiers.length > 0 && facts.tin !== null,
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
      businessActivity: psfBusinessActivityFor(facts.accommodationClass, facts.accommodationClassOther),
      tradeDirection: 'none',
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

  /** Apply from the workspace (AC-16). The wizard files through the same row builder. */
  async apply(orgId: string, userId: string, input: PsfApplicationInput): Promise<PsfMembershipOverview> {
    const facts = await this.applicantFacts(orgId, userId);
    if (!facts.tin) {
      throw new UnprocessableEntityException('This business has no TIN on record, which PSF’s form needs.');
    }
    const tier = await this.repo.tier(input.requestedTierCode);
    if (!tier || !tier.active) {
      throw new UnprocessableEntityException('That membership tier is not offered any more. Pick another.');
    }
    try {
      await this.repo.insertApplication({
        orgId,
        ...buildPsfApplicationRow({
          submittedByUserId: userId,
          capacity: this.capacityOf(facts, userId),
          registrationNumber: facts.tin,
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

  async queue(officerUserId: string, cursor: string | undefined): Promise<PsfQueuePage> {
    const page = await this.repo.queuePage(officerUserId, decodeQueueCursor(cursor), QUEUE_PAGE_SIZE);
    const last = page.rows.at(-1);
    return {
      items: page.rows.map((r) => ({
        applicationId: r.applicationId,
        orgId: r.orgId,
        businessName: r.businessName,
        districtName: r.districtName,
        requestedTierName: r.requestedTierName,
        submittedAt: r.submittedAt.toISOString(),
        queuedAt: r.queuedAt ? r.queuedAt.toISOString() : null,
        registrationStatus: r.registrationStatus,
        canDecide: !r.officerHasStake,
      })),
      nextCursor: page.more && last ? encodeQueueCursor(last.sortAt, last.applicationId) : null,
    };
  }

  async officerApplication(officerUserId: string, applicationId: string): Promise<PsfOfficerApplication> {
    const row = await this.repo.officerApplication(officerUserId, applicationId);
    if (!row) throw new NotFoundException('This application is not in the membership queue.');
    return {
      ...toPsfApplicationView(row),
      orgId: row.orgId,
      businessName: row.businessName,
      districtName: row.districtName,
      registrationStatus: row.registrationStatus,
      canDecide: !row.officerHasStake,
    };
  }

  /**
   * The application an officer may decide, or the right refusal: 409 when it
   * is no longer open (AC-13), 404 when it is not in the queue at all, 403 when
   * the officer holds a stake in the business (AC-14).
   */
  private async decidable(
    officerUserId: string,
    applicationId: string,
  ): Promise<NonNullable<Awaited<ReturnType<PsfMembershipRepository['officerApplication']>>>> {
    const row = await this.repo.officerApplication(officerUserId, applicationId);
    if (!row) {
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

  async member(
    officerUserId: string,
    grants: OversightGrant[],
    applicationId: string,
    input: PsfMemberDecisionRequest,
  ): Promise<PsfOfficerApplication> {
    await this.decidable(officerUserId, applicationId);
    const tier = await this.repo.tier(input.tierCode);
    if (!tier || !tier.active) {
      throw new UnprocessableEntityException('Confirm a tier that is still offered.');
    }
    const decided = await this.repo.decideMember({
      applicationId,
      officerUserId,
      bodyCode: this.bodyOf(grants),
      tierCode: tier.code,
      membershipNumber: input.membershipNumber,
      annualFeeRwf: input.annualFeeRwf,
      startsOn: input.startsOn,
      expiresOn: input.expiresOn,
    });
    // Another officer won the race between the read and the write.
    if (!decided) throw new ConflictException(PSF_NOT_OPEN_MESSAGE);
    await this.mail.member(decided.orgId, {
      tierName: tier.nameEn,
      membershipNumber: input.membershipNumber,
      annualFeeRwf: input.annualFeeRwf,
      startsOn: input.startsOn,
      expiresOn: input.expiresOn,
    });
    return this.decidedView(applicationId, decided.orgId);
  }

  async decline(
    officerUserId: string,
    grants: OversightGrant[],
    applicationId: string,
    input: PsfDeclineRequest,
  ): Promise<PsfOfficerApplication> {
    await this.decidable(officerUserId, applicationId);
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

  /** A decided application, read back for the officer who decided it. */
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
      canDecide: false,
    };
  }
}

/** Today as a yyyy-mm-dd date in Kigali, the date PSF's paperwork uses. */
function kigaliToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
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
