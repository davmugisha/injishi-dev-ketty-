import type {
  BusinessKind,
  CreateRegistrationRequest,
  OrgRegistrationStatus,
  OversightDecisionPage,
  OversightDocument,
  OversightDocumentList,
  OversightGrant,
  OversightQueueItem,
  OversightRole,
  RegistrantCapacity,
  RegistrationBusinessType,
  RegistrationFeeQuote,
  RegistrationRejectionReason,
  RegistrationSummary,
  TinCheckResult,
} from '@injishi/contracts';
import {
  ORG_CERTIFICATE_KIND_LABEL,
  PSF_CONSENT_VERSION,
  SEPARATION_OF_DUTIES_MESSAGE,
  businessTypeFor,
  businessTypeForKind,
  entityGroupForKind,
  hospitalityKindOf,
  isVenueKind,
  missingRegistrationDocument,
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
  UnprocessableEntityException,
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
import { RegistrationMailer } from '../infrastructure/registration.mailer';
import { buildPsfApplicationRow } from './psf-application-row';
import { PsfMembershipService } from './psf-membership.service';
import { SYSTEM_MOVER, type RegistrationMover } from '../infrastructure/registration-events';
import { tinRecheckDue, tinRecheckStalled } from '../domain/tin-recheck';
import { RraTinAdapter, type TinRegistryBusiness } from '../infrastructure/rra-tin.adapter';
import { IdentityService } from '../../user/application/identity.service';
import { RegistrationDraftService } from './registration-draft.service';
import { ProfileService } from '../../user/application/profile.service';
import { StorageService } from '../../storage/application/storage.service';
import { GeographyService } from '../../geography/application/geography.service';

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
  // Membership is not a registration gate (ADR-056); its queue is its own.
  psf_membership_officer: null,
};

/**
 * How long an officer’s link to a document stays good.
 *
 * Five minutes: long enough to open a PDF, short enough that a link pasted into
 * a chat is dead before anyone follows it. These bytes are evidence about a
 * business, not a public file.
 */
const DOCUMENT_URL_TTL_SECONDS = 300;

@Injectable()
export class RegistrationService {
  private readonly log = new Logger(RegistrationService.name);

  constructor(
    private readonly orgs: OrganizationRepository,
    private readonly tin: RraTinAdapter,
    private readonly profiles: ProfileService,
    /**
     * Geography, composed for ONE question: does the village on this address
     * sit under the sector on it (D24)? `villages` is the module's table, so
     * the join that answers it is the module's to own.
     */
    private readonly geography: GeographyService,
    private readonly claimMailer: ClaimInvitationMailer,
    /**
     * Registration mail (F-S03). Every call sits AFTER the move it describes has
     * committed, and none of them throws, so a mail can neither undo nor fail a
     * registration step.
     */
    private readonly mail: RegistrationMailer,
    /**
     * The storage seam (F-S09), for one job: minting the short lived link an
     * officer opens a document through. This service never touches bytes.
     */
    private readonly storage: StorageService,
    /**
     * PSF membership (ADR-056): a PSF application waits for the TIN check, so
     * the TIN pass is what puts it in PSF's queue. It also files the
     * application a registration carries, through the same row builder.
     */
    private readonly psf: PsfMembershipService,
    /** A business is registered by a verified person, where a check can run (ADR-060). */
    private readonly identity: IdentityService,
    /**
     * The wizard's draft (ADR-060): the TIN check's answer is kept on it (ADR-075 D-m), and the first Pay press
     * marks it with the registration it became, whose settled fee clears it.
     */
    private readonly drafts: RegistrationDraftService,
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

  /** The same quote, asked by kind (ADR-075): the fee is keyed by business type, which the kind decides (D-j). */
  quoteForKind(kind: BusinessKind): Promise<RegistrationFeeQuote> {
    return this.quote(businessTypeForKind(kind));
  }

  /**
   * Ask about a TIN before anything is created or billed (registration Phase 0).
   *
   * The check after payment stayed the gate of record, but on its own it found
   * a mistyped TIN only once a non-refundable fee was paid. This asks the same
   * adapter at the Business step. It writes no `tin_verifications` row, which
   * belongs to an org, and there is none yet; the answer is kept on the
   * caller's draft instead (ADR-075 D-m), so a refresh or another day never
   * asks it again. It moves nothing, so D23's rule that nothing unpaid reaches
   * an officer still holds.
   *
   * The directors' NAMES go only to the helper (ADR-075 AC-7), who picks the
   * owner from them. The owner path learns listed or not, matched here against
   * the caller's own document; with no machine check that document may be
   * typed, and showing the names first would let anyone type one.
   */
  async checkTin(tin: string, userId: string, capacity?: RegistrantCapacity): Promise<TinCheckResult> {
    const answer = await this.answerTin(tin, userId, capacity);
    await this.drafts.recordTinCheck(userId, { tin, capacity: capacity ?? null, answer });
    return answer;
  }

  private async answerTin(tin: string, userId: string, capacity?: RegistrantCapacity): Promise<TinCheckResult> {
    const none = { business: null, registrantIsDirector: null };
    if (await this.orgs.tinTaken(tin)) {
      return {
        tin,
        result: 'taken',
        message:
          'A business on Injishi is already registered with this TIN. If it is yours, sign in with the account that registered it.',
        ...none,
      };
    }
    const outcome = await this.verifyTinSafely(tin);
    switch (outcome.result) {
      case 'verified': {
        const business = outcome.business;
        return {
          tin,
          result: 'verified',
          message: business
            ? `RRA recognises this TIN. The register holds it for ${business.legalName}.`
            : 'RRA recognises this TIN.',
          // Names only: the directors' document numbers stay on this side.
          business: business
            ? {
                legalName: business.legalName,
                registeredOn: business.registeredOn,
                companyType: business.companyType,
                address: business.address,
                directors:
                  capacity === 'on_behalf_of' ? business.directors.map((d) => ({ name: d.name })) : [],
                generated: business.generated,
              }
            : null,
          registrantIsDirector: business
            ? isDirector(business, await this.profiles.documentFor(userId))
            : null,
        };
      }
      case 'failed':
        return { tin, result: 'failed', message: TIN_REFUSED_MESSAGE, ...none };
      case 'pending':
        return {
          tin,
          result: 'pending',
          message:
            'We could not reach RRA just now. You can carry on; we check the TIN again after you submit.',
          ...none,
        };
    }
  }

  /**
   * The adapter's answer, with a throw read as `pending`. An outage must never
   * stop a registrant here, because the check after payment covers it.
   */
  private async verifyTinSafely(tin: string): Promise<
    | { result: 'verified'; business: TinRegistryBusiness | null }
    | { result: 'failed' | 'pending'; business: null }
  > {
    try {
      const outcome = await this.tin.verify(tin);
      return outcome.result === 'verified'
        ? { result: 'verified', business: outcome.business }
        : { result: outcome.result, business: null };
    } catch (error) {
      this.log.warn(`TIN pre-check could not run: ${(error as Error).message}`);
      return { result: 'pending', business: null };
    }
  }

  /**
   * The documents a registration must carry (ADR-075 S5, AC-11), refused with
   * 422 at the field each came from, all at once.
   *
   * - The required row for the kind (`missingRegistrationDocument`, the same
   *   table the wizard's Documents step draws), so the API asks for exactly
   *   what the wizard asks for.
   * - Every certificate a stored `certificate` this registrant uploaded. A key
   *   is otherwise just a string: without this, "required" would be met by
   *   any text, or by someone else's upload.
   */
  private async assertDocuments(
    kind: BusinessKind,
    certificates: readonly { kind: string; objectKey: string }[],
    registrantUserId: string,
  ): Promise<void> {
    const issues: { code: 'custom'; path: (string | number)[]; message: string }[] = [];
    const missing = missingRegistrationDocument(kind, certificates);
    if (missing) {
      const label = ORG_CERTIFICATE_KIND_LABEL[missing];
      // "RDB certificate" keeps its capitals; "Land title" reads mid sentence.
      const named = /^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
      issues.push({ code: 'custom', path: ['business', 'certificates'], message: `Upload the ${named}.` });
    }
    for (const [index, certificate] of certificates.entries()) {
      const stored = await this.storage.describe(certificate.objectKey);
      if (!stored || stored.kind !== 'certificate' || stored.uploadedByUserId !== registrantUserId) {
        issues.push({
          code: 'custom',
          path: ['business', 'certificates', index, 'objectKey'],
          message: 'Upload that document again.',
        });
      }
    }
    if (issues.length > 0) {
      throw new UnprocessableEntityException({ message: 'Validation failed', issues });
    }
  }

  /**
   * What the company register says, held against the request (ADR-060): the
   * legal name must be the register's, and when the register lists directors
   * an OWNER must be one of them, and an on behalf registration must name one
   * of them as its owner. Refused at the field each came from, all at once.
   */
  private async registryIssues(
    request: CreateRegistrationRequest,
    business: TinRegistryBusiness,
    registrantUserId: string,
  ): Promise<{ code: 'custom'; path: (string | number)[]; message: string }[]> {
    const issues: { code: 'custom'; path: (string | number)[]; message: string }[] = [];
    if (normalizeName(request.business.legalName) !== normalizeName(business.legalName)) {
      issues.push({
        code: 'custom',
        path: ['business', 'legalName'],
        message: `The register holds this TIN for ${business.legalName}. Use that name.`,
      });
    }
    const listed = business.directors.some((d) => d.documentNumber);
    if (!listed) return issues;
    if (request.capacity === 'on_behalf_of') {
      const owner = request.intendedOwner?.nationalId ?? null;
      if (owner && !business.directors.some((d) => d.documentNumber === owner)) {
        issues.push({
          code: 'custom',
          path: ['intendedOwner', 'nationalId'],
          message: `That National ID is not one of ${business.legalName}'s directors.`,
        });
      }
    } else if (!isDirector(business, await this.profiles.documentFor(registrantUserId))) {
      issues.push({
        code: 'custom',
        path: ['capacity'],
        message: `You are not listed as a director of ${business.legalName}. Register it on behalf of its owner.`,
      });
    }
    return issues;
  }

  /**
   * Create the registration at `pending_payment` and hand back the bill.
   *
   * A TIN RRA refuses is refused HERE, before a bill exists (Phase 0). An RRA
   * that cannot be reached refuses nothing: the call after payment is still the
   * gate of record, and it retries.
   */
  async create(
    request: CreateRegistrationRequest,
    registrantUserId: string,
    /**
     * The Pay press's `Idempotency-Key` (ADR-075 AC-14), minted once per press at the call site. A replay of it
     * answers the registration it created rather than creating another.
     */
    creationKey: string | null = null,
  ): Promise<RegistrationSummary> {
    if (creationKey) {
      const replay = await this.replayOf(creationKey, registrantUserId);
      if (replay) return replay;
    }
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

    // A verified identity, wherever a check can run (ADR-060). After the
    // profile save, so a person verified a moment ago on About you passes.
    await this.identity.assertMayRegister(registrantUserId);

    const b = request.business;
    const address = b.address;
    // ADR-075 D-h: the kind the org carries. The contract has already refused a hospitality request with none.
    const businessKind: BusinessKind =
      b.domain === 'residence' ? 'residence' : (hospitalityKindOf(b) as BusinessKind);
    const venue = isVenueKind(businessKind);
    if (b.domain === 'hospitality') {
      const tinOutcome = await this.verifyTinSafely(b.tin);
      // The shape the validation pipe gives, so the wizard puts each sentence
      // under the field it came from.
      const issues =
        tinOutcome.result === 'failed'
          ? [{ code: 'custom' as const, path: ['business', 'tin'], message: TIN_REFUSED_MESSAGE }]
          : tinOutcome.business
            ? await this.registryIssues(request, tinOutcome.business, registrantUserId)
            : [];
      if (issues.length > 0) {
        throw new BadRequestException({ message: 'Validation failed', issues });
      }
    }
    await this.assertVillagesPlaced(b);
    const branches = await this.branchRowsFor(b);

    // ADR-056 AC-6: an application a No carries is filed in the create
    // transaction below, so the form someone filled cannot be lost between
    // two calls. Its tier is checked here, first, so a retired one refuses the
    // whole registration with nothing written.
    const psfFiling =
      b.domain === 'hospitality' && b.psfApplication
        ? {
            tier: await this.psf.tierForFiling(b.psfApplication.requestedTierCode),
            // After `profiles.save` above, so a first-time registrant's
            // document is already on file for "use the one on file".
            form: await this.psf.withIdDocument(b.psfApplication, registrantUserId),
            tin: b.tin,
          }
        : null;
    const psfApplication = psfFiling
      ? buildPsfApplicationRow({
          submittedByUserId: registrantUserId,
          capacity: request.capacity === 'on_behalf_of' ? 'on_behalf_of' : 'owner',
          registrationNumber: psfFiling.tin,
          tier: psfFiling.tier,
          form: psfFiling.form,
          consentGivenAt: new Date(),
          consentVersion: PSF_CONSENT_VERSION,
        })
      : null;

    // ADR-075 AC-11: the required document for the kind, from the one table the wizard reads, and every
    // certificate one this registrant uploaded. Last of the checks, so a request refused for something else is
    // refused for that.
    await this.assertDocuments(businessKind, b.certificates, registrantUserId);

    try {
      const created = await this.orgs.createRegistration({
        legalName: b.legalName,
        domain: b.domain,
        businessKind,
        creationKey,
        // A venue sits in the restaurant group and has no accommodation class (D-h); a stay keeps both as sent.
        rdbEntityGroup:
          b.domain === 'hospitality'
            ? venue
              ? entityGroupForKind('bar_restaurant')
              : b.entityGroup
            : null,
        accommodationClass:
          b.domain === 'hospitality' && !venue ? (b.accommodationClass ?? null) : null,
        accommodationClassOther:
          b.domain === 'hospitality' && !venue
            ? (b.accommodationClassOther ?? null)
            : null,
        residenceClass: b.domain === 'residence' ? b.residenceClass : null,
        tourismLicenseNumber:
          b.domain === 'hospitality' ? (b.tourismLicenseNumber ?? null) : null,
        chamberOfTourismMember:
          b.domain === 'hospitality' ? b.chamberOfTourismMember : false,
        psfMember: b.domain === 'hospitality' ? b.psfMember : false,
        // ADR-056: the application a No carries, and the number a Yes carries.
        psfApplication,
        psfMembershipNumber:
          b.domain === 'hospitality' && b.psfMember
            ? (b.psfMembershipNumber ?? null)
            : null,
        eacStarGrade:
          b.domain === 'hospitality' ? (b.eacStarGrade ?? null) : null,
        // D24: a business carries a TIN, a residence carries a UPI. The database
        // carries the same rule, so this maps rather than decides.
        tin: b.domain === 'hospitality' ? b.tin : null,
        upi: b.domain === 'hospitality' ? (b.upi ?? null) : b.upi,
        districtId: address.districtId,
        sectorId: address.sectorId,
        // D24: the fifth level, optional and the only one below sector that is
        // stored — a village resolves upward to its cell, so the cell the
        // picker asked for is already in this id.
        villageId: address.villageId ?? null,
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
        franchise: franchiseRowFor(b),
        certificates: b.certificates.map((c) => ({
          kind: c.kind,
          kindOther: c.kindOther ?? null,
          objectKey: c.objectKey,
          certificateNumber: c.certificateNumber ?? null,
          issuedBy: c.issuedBy ?? null,
          issuedOn: c.issuedOn ?? null,
          expiresOn: c.expiresOn ?? null,
        })),
        branches,
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
      await this.mail.received(created.orgId, created.amountDueRwf);
      // The draft stays the answers' editable source until the fee settles (ADR-075 D-l), so it is marked with the
      // registration it became rather than cleared; settling the fee clears it (D-m).
      await this.drafts.markRegistered(registrantUserId, created.orgId);
      // The PSF receipt. A new registration sits at `pending_payment`, so the
      // application waits for the TIN check and no officer is mailed yet.
      if (psfFiling) {
        await this.psf.afterFiled(created.orgId, psfFiling.tier.nameEn, 'pending_payment');
      }

      return {
        orgId: created.orgId,
        workspaceId: created.workspaceId,
        legalName: b.legalName,
        domain: b.domain,
        businessKind,
        accommodationClass:
          b.domain === 'hospitality' && !venue ? (b.accommodationClass ?? null) : null,
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
        // A replay that lost its key, or a second tab: the caller's own registration of this TIN is the answer
        // (ADR-075 AC-14). Anyone else's is the refusal it always was.
        const own = b.domain === 'hospitality' ? await this.orgs.orgIdByTin(b.tin) : null;
        if (own && (await this.orgs.isMember(own, registrantUserId))) return this.summary(own);
        throw new ConflictException(err.message);
      }
      if (creationKey && isUniqueViolation(err, 'orgs_creation_key_uk')) {
        // Two presses of one key at the same moment: the one that lost the race answers the winner's registration.
        const replay = await this.replayOf(creationKey, registrantUserId);
        if (replay) return replay;
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
   * Every village on this registration sits under the sector sent with it.
   *
   * Separate from `branchRowsFor`, which returns early for a residence: a
   * landlord's address carries a village too, and a check that only hospitality
   * reaches is a check half the registrants walk past. This one covers the
   * business address for both domains, and every branch address for the domain
   * that has branches.
   *
   * The village is OPTIONAL, so an absent one is not an issue. A present one
   * that belongs elsewhere is, and it is refused at its own field path so the
   * wizard can put the sentence under the select that produced it. Every
   * location is examined before anything is thrown, so a registrant with two
   * wrong villages is told about both.
   */
  private async assertVillagesPlaced(
    b: CreateRegistrationRequest['business'],
  ): Promise<void> {
    const located = [
      { path: ['business', 'address'], address: b.address },
      ...(b.domain === 'hospitality'
        ? b.branches.map((branch, index) => ({
            path: ['business', 'branches', index, 'address'],
            address: branch.address,
          }))
        : []),
    ];

    const issues: { code: 'custom'; path: (string | number)[]; message: string }[] = [];
    for (const l of located) {
      if (l.address.villageId === undefined) continue;
      const verdict = await this.geography.checkVillageInSector(
        l.address.villageId,
        l.address.sectorId,
      );
      if (!verdict.ok) {
        issues.push({
          code: 'custom',
          path: [...l.path, 'villageId'],
          message: verdict.message,
        });
      }
    }
    if (issues.length > 0) {
      throw new BadRequestException({ message: 'Validation failed', issues });
    }
  }

  /**
   * The `properties` rows a registration writes (ADR-054 AC-R2, Value sourcing).
   *
   * A hospitality business gets its head office, named with its legal name at
   * its own address, then one row per declared branch. A residence gets none:
   * branches are hospitality only, and a residence's buildings wait on its own
   * inventory model.
   *
   * The district of every row is DERIVED from its sector, as `properties`
   * always does. A sector that does not exist, or a district on the request
   * that disagrees with the sector's, is refused naming the field, before
   * anything is written. The shape of the refusal is the one the validation
   * pipe gives, so the wizard reads both the same way.
   */
  private async branchRowsFor(
    b: CreateRegistrationRequest['business'],
  ): Promise<
    {
      name: string;
      sectorId: number;
      districtId: number;
      street: string | null;
      isHeadOffice: boolean;
    }[]
  > {
    if (b.domain !== 'hospitality') return [];

    const locations = [
      { path: ['business', 'address'], name: b.legalName, address: b.address, isHeadOffice: true },
      ...b.branches.map((branch, index) => ({
        path: ['business', 'branches', index, 'address'],
        name: branch.name,
        address: branch.address,
        isHeadOffice: false,
      })),
    ];
    const districtOf = await this.orgs.districtsForSectors(
      locations.map((l) => l.address.sectorId),
    );

    const issues: { code: 'custom'; path: (string | number)[]; message: string }[] = [];
    for (const l of locations) {
      const districtId = districtOf.get(l.address.sectorId);
      if (districtId === undefined) {
        issues.push({
          code: 'custom',
          path: [...l.path, 'sectorId'],
          message: 'That sector does not exist. Pick one from the list.',
        });
      } else if (districtId !== l.address.districtId) {
        issues.push({
          code: 'custom',
          path: [...l.path, 'districtId'],
          message: 'That sector is not in the district you chose.',
        });
      }
    }
    if (issues.length > 0) {
      throw new BadRequestException({ message: 'Validation failed', issues });
    }

    return locations.map((l) => ({
      name: l.name,
      sectorId: l.address.sectorId,
      districtId: districtOf.get(l.address.sectorId)!,
      street: l.address.street ?? null,
      isHeadOffice: l.isHeadOffice,
    }));
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
    mover: RegistrationMover,
  ): Promise<RegistrationSummary> {
    const before = await this.orgs.findById(orgId);
    if (!before) throw new NotFoundException('Registration not found.');

    if (awaitsRegistrationFee(before.status)) {
      const settled = await this.orgs.settleRegistrationFee(orgId, mover);
      if (!settled) {
        // It lost the race to a concurrent callback, which is not an error: re-reading is the answer. Paying no
        // longer waits on an accepted contract (ADR-075 AC-12); the agreement is signed after approval.
        this.log.log(`Registration fee for ${orgId} was already settled.`);
      } else {
        // Only the call that settled mails, so a repeated callback is silent.
        await this.mail.submitted(orgId, false);
      }
      await this.runTinCheck(orgId);
    }

    return this.summary(orgId);
  }

  /**
   * Reopen a registration fee whose payment the bank reversed (073-gtbank-payments
   * AC-20, `cancel_service`). Only the invoice moves: nothing in the pipeline
   * reads it yet, so the business is not held where it stands (recorded in the
   * child's build notes for the owner).
   */
  async reopenFeeAfterReversal(invoiceId: string): Promise<boolean> {
    return this.orgs.reopenRegistrationInvoice(invoiceId);
  }

  /**
   * Settle the fee because a payment for it landed (073-gtbank-payments AC-16).
   *
   * Called by the payment attempt that took the money, after it has claimed
   * itself as confirmed, so this runs once per attempt. The mover is `system`:
   * the provider settling is what moved the org, not a person's click.
   *
   * - `settled`: this payment settled the fee; the RRA check follows.
   * - `already_settled`: the fee was already paid (another attempt won), so
   *   this payment paid for nothing and is refunded by the caller.
   * - `not_payable`: the registration cannot take a fee (it vanished, or it
   *   has no pending invoice to settle), and the money goes back too. Paying
   *   no longer waits on a contract (ADR-075 AC-12).
   */
  async settleFeeFromPayment(
    orgId: string,
  ): Promise<'settled' | 'already_settled' | 'not_payable'> {
    const before = await this.orgs.findById(orgId);
    if (!before) return 'not_payable';
    if (!awaitsRegistrationFee(before.status)) return 'already_settled';

    if (await this.orgs.settleRegistrationFee(orgId, SYSTEM_MOVER)) {
      await this.mail.submitted(orgId, false);
      await this.runTinCheck(orgId);
      return 'settled';
    }
    const after = await this.orgs.findById(orgId);
    if (after && awaitsRegistrationFee(after.status)) return 'not_payable';
    return 'already_settled';
  }

  /**
   * What paying the fee needs to know (073-gtbank-payments AC-16): where the
   * registration stands and the pending invoice the fee pays. Null when there
   * is no such registration.
   */
  async feeFacts(orgId: string): Promise<{
    status: OrgRegistrationStatus;
    workspaceId: string | null;
    invoiceId: string | null;
    amountDueRwf: number | null;
    legalName: string;
  } | null> {
    const org = await this.orgs.findById(orgId);
    if (!org) return null;
    return {
      status: org.status,
      workspaceId: org.workspaceId,
      invoiceId: org.invoiceId,
      amountDueRwf: org.amountDueRwf,
      legalName: org.legalName,
    };
  }

  /** The org a registration invoice bills, for a payment attempt that names only the invoice. */
  orgOfRegistrationInvoice(invoiceId: string): Promise<string | null> {
    return this.orgs.orgOfRegistrationInvoice(invoiceId);
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
      if (to && (await this.orgs.advance(orgId, 'submitted', to, SYSTEM_MOVER))) {
        await this.mail.queueEntered(orgId, 'business_field_verifier');
      }
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

    // Mail only when THIS call moved the business: the `from` guard makes a
    // concurrent sweep and request race harmlessly, and the loser stays silent.
    if (outcome.result === 'verified') {
      const to = nextStatus('submitted', 'tin_verified');
      if (to && (await this.orgs.advance(orgId, 'submitted', to, SYSTEM_MOVER))) {
        await this.mail.queueEntered(orgId, 'business_field_verifier');
        // ADR-056 AC-8 and AC-9: a PSF application waiting on this check is in
        // PSF's queue from now on. The stamp is its own guarded update, so a
        // resubmitted business that passes again emails no officer twice.
        await this.psf.markQueued(orgId);
      }
      return;
    }
    if (outcome.result === 'failed') {
      const to = nextStatus('submitted', 'rejected');
      if (to && (await this.orgs.advance(orgId, 'submitted', to, SYSTEM_MOVER))) {
        await this.mail.rejected(orgId, {
          gate: 'tin_check',
          reasonCode: null,
          notes: null,
        });
      }
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
  /**
   * The registration an `Idempotency-Key` already created, for its own registrant; null when the key is new. A
   * key that created someone else's registration is refused rather than answered, so a guessed key reveals
   * nothing.
   */
  private async replayOf(creationKey: string, userId: string): Promise<RegistrationSummary | null> {
    const orgId = await this.orgs.orgIdByCreationKey(creationKey);
    if (!orgId) return null;
    if (!(await this.orgs.isMember(orgId, userId))) {
      throw new ConflictException('That Idempotency-Key was already used. Press again for a new one.');
    }
    return this.summary(orgId);
  }

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
      businessKind: org.businessKind,
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
    const branches = await this.orgs.branchesForOrgs(rows.map((r) => r.orgId));
    const evidence = await this.orgs.queueEvidenceFor(rows.map((r) => r.orgId));

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
        documentCount: r.documentCount,
        uncheckedDocumentCount: r.uncheckedDocumentCount,
        waitingSince: r.waitingSince.toISOString(),
        blockedBySeparationOfDuties:
          role === 'business_approver'
            ? violatesSeparationOfDuties({
                actorUserId,
                fieldVerifiedByUserId:
                  await this.orgs.latestFieldVerifierId(r.orgId),
              })
            : false,
        branches: branches.get(r.orgId) ?? [],
        tourismLicenseNumber: r.tourismLicenseNumber,
        onBehalfOf: evidence.get(r.orgId)?.onBehalfOf ?? false,
        certificates: evidence.get(r.orgId)?.certificates ?? [],
        tinCheck: evidence.get(r.orgId)?.tinCheck ?? null,
        registrantName: evidence.get(r.orgId)?.registrantName ?? null,
        intendedOwnerName: evidence.get(r.orgId)?.intendedOwnerName ?? null,
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

    /*
     * F-S03 §5 gives this gate two jobs: the premises exist, AND the documents
     * are legitimate. The second half was unenforceable while nothing served
     * the documents, so the gate passed on the officer's word about a list they
     * could not open. It refuses now while any document is unread, and names
     * the count rather than only saying no.
     *
     * A registration carrying NO documents is not blocked. A residence landlord
     * uploads none, and refusing there would be demanding evidence the wizard
     * never asked for.
     */
    const unchecked = await this.orgs.documentsForOrg(orgId);
    const unread = unchecked.filter((d) => d.checkedAt === null).length;
    if (unread > 0) {
      throw new ConflictException(
        unread === 1
          ? 'One document on this registration has not been checked yet. Open it and mark it checked before verifying the business.'
          : `${unread} documents on this registration have not been checked yet. Open each one and mark it checked before verifying the business.`,
      );
    }

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
    await this.mail.fieldVerified(orgId);
    await this.mail.queueEntered(orgId, 'business_approver');
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
    await this.mail.approved(orgId, awaitingClaim);
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
    await this.mail.rejected(orgId, { gate: stage, reasonCode, notes });
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
    if (moved) {
      await this.mail.submitted(orgId, true);
      await this.runTinCheck(orgId);
    }
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
  // -------------------------------------------------------------------------
  // The documents an officer decides on (F-S03 §5)
  // -------------------------------------------------------------------------

  /**
   * Every document on one registration, for an officer who may act on it.
   *
   * Region and conflict of interest are checked by the SAME helper the gates
   * use, so a document cannot be read through a route that is laxer than the
   * decision it informs. An approver reads it as well as a verifier: approving
   * a business whose evidence you cannot see is the thing this fixes.
   *
   * Each link is minted per read and expires; nothing durable is handed out.
   */
  async documentsFor(
    orgId: string,
    grants: OversightGrant[],
    actorUserId: string,
  ): Promise<OversightDocumentList> {
    await this.grantCovering(orgId, grants, actorUserId);
    return this.documentList(orgId);
  }

  /**
   * Record that this officer has read one document (F-S03 §5).
   *
   * The field verifier's act, never the approver's: the verifier is the officer
   * who goes and looks, and the approver reads what they recorded. A second
   * press is not an error and does not move the name already on it.
   */
  async checkDocument(
    orgId: string,
    certificateId: string,
    grants: OversightGrant[],
    actorUserId: string,
  ): Promise<OversightDocumentList> {
    await this.grantCovering(orgId, grants, actorUserId);
    if (!(await this.orgs.certificateBelongsTo(certificateId, orgId))) {
      throw new NotFoundException('No such document on this registration.');
    }
    await this.orgs.markCertificateChecked({ certificateId, orgId, actorUserId });
    return this.documentList(orgId);
  }

  /** The shape both document routes answer with. */
  private async documentList(orgId: string): Promise<OversightDocumentList> {
    const org = await this.orgs.findById(orgId);
    if (!org) throw new NotFoundException('Registration not found.');

    const rows = await this.orgs.documentsForOrg(orgId);
    const today = new Date().toISOString().slice(0, 10);

    const documents = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        kind: r.kind as OversightDocument['kind'],
        kindOther: r.kindOther,
        certificateNumber: r.certificateNumber,
        issuedBy: r.issuedBy,
        issuedOn: r.issuedOn,
        expiresOn: r.expiresOn,
        // A date comparison on two `YYYY-MM-DD` strings, which sort correctly.
        expired: r.expiresOn !== null && r.expiresOn < today,
        mime: r.mime,
        sizeBytes: r.sizeBytes,
        // No object, or an object whose row has gone: no link, and the console
        // says so. A link that 404s reads as a broken console, not as a
        // missing document.
        url:
          r.objectKey && r.objectPresent
            ? await this.storage.signedUrl(r.objectKey, DOCUMENT_URL_TTL_SECONDS)
            : null,
        checkedAt: r.checkedAt ? r.checkedAt.toISOString() : null,
        checkedByName: r.checkedByName,
      })),
    );

    return {
      orgId,
      legalName: org.legalName,
      status: org.status,
      documents,
      uncheckedCount: documents.filter((d) => d.checkedAt === null).length,
    };
  }

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

/**
 * The `org_franchises` row a registration's answer writes (ADR-075 AC-8), or
 * null for No. A franchisee's agreement is the `franchise_agreement` document
 * it sent, when it sent one; the contract has already refused that document on
 * anyone else.
 */
function franchiseRowFor(
  b: CreateRegistrationRequest['business'],
): Parameters<OrganizationRepository['createRegistration']>[0]['franchise'] {
  if (b.domain !== 'hospitality' || !b.franchise) return null;
  if (b.franchise.role === 'franchisor') {
    return { role: 'franchisor', brandName: b.franchise.brandName, franchisedLocations: b.franchise.franchisedLocations };
  }
  return {
    role: 'franchisee',
    brandName: b.franchise.brandName,
    franchisorLegalName: b.franchise.franchisorLegalName,
    franchisorCountry: b.franchise.franchisorCountry,
    agreementObjectKey: b.certificates.find((c) => c.kind === 'franchise_agreement')?.objectKey ?? null,
  };
}

/** Whether this document is one of the register's directors. */
function isDirector(
  business: TinRegistryBusiness,
  document: { documentNumber: string } | null,
): boolean | null {
  if (!business.directors.some((d) => d.documentNumber)) return null;
  if (!document) return null;
  return business.directors.some((d) => d.documentNumber === document.documentNumber);
}

/** A company name as a register means it: case and spacing do not make two companies. */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** What a registrant is told when RRA does not recognise their TIN. */
const TIN_REFUSED_MESSAGE =
  'RRA does not recognise this TIN. Check it against your RRA certificate.';

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

/** Postgres refused an insert on this unique constraint (23505), however the driver wrapped the error. */
function isUniqueViolation(err: unknown, constraint: string): boolean {
  for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const pg = e as { code?: unknown; constraint?: unknown };
    if (pg.code === '23505' && pg.constraint === constraint) return true;
  }
  return false;
}
