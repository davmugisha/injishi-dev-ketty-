import { PSF_NO_INSTRUMENT_MESSAGE, psfInstrument } from './psf-instrument';
import { psfPayee } from './psf-payee';
import {
  PSF_CONSENT_VERSION,
  PSF_DOMAINS,
  PSF_NOT_FOR_RESIDENCE_MESSAGE,
  PSF_NOT_OPEN_MESSAGE,
  PSF_NOT_PAYABLE_MESSAGE,
  PSF_OPEN_APPLICATION_MESSAGE,
  PSF_DISTRICT_DECIDES_MESSAGE,
  PSF_OWN_BUSINESS_MESSAGE,
  PSF_OWNER_GROUP_SHORT,
  PSF_STANDING_LABEL,
  defaultPsfMembershipDates,
  districtLetters,
  formatPsfMembershipNumber,
  wholeDaysBetween,
  districtScopeOf,
  isInPsfQueueState,
  isPsfApplicant,
  psfBusinessActivityFor,
  psfFeeProblem,
  psfStartingFee,
  resolvePsfTierFee,
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
  type PsfApplicationBranch,
  type PsfApplicationStatus,
  type PsfBranchDecisionRequest,
  type PsfDeclineRequest,
  type PsfMembershipOverview,
  type PsfOfficerApplication,
  type PsfQueuePage,
  type PsfRegisterSummary,
  type PsfSubmittedCapacity,
  type PsfTier,
  type PsfAreaQuery,
  type PsfQueueAreaQuery,
  type PsfBusinessHistory,
  PSF_CONTACT_ROLE_LABEL,
  PSF_DECLINE_REASON_LABEL,
  type CreatePsfSubsectorRequest,
  type CreatePsfFormFieldRequest,
  type PsfBusinessDetail,
  type PsfFeesView,
  type PsfFormField,
  type PsfFormFieldsOfficerView,
  type PsfFormFieldsPublic,
  type PsfOfficerFeesView,
  type SetPsfTierFeeRequest,
  type PsfSubsectorsView,
  type UpdatePsfFormFieldRequest,
  type UpdatePsfSubsectorRequest,
  PSF_OUT_OF_SCOPE_MESSAGE,
  psfFeeCeilings,
  provinceDisplayName,
  looksLikePsfNumber,
  normalizePsfNumber,
  type ConfirmPsfClaimRequest,
  type PsfClaimsPage,
  type PsfClaimsQuery,
  type PsfMemberListResult,
  type RejectPsfClaimRequest,
  type UploadPsfMemberListRequest,
} from '@injishi/contracts';
import {
  BadRequestException,
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
  type PsfClaimInScope,
  type PsfOfficerApplicationRow,
  type PsfOrgFacts,
  type PsfScope,
  type PsfTierRow,
} from '../infrastructure/psf-membership.repository';
import { PsfReportRepository } from '../infrastructure/psf-report.repository';
import {
  buildPsfApplicationRow,
  toPsfApplicationView,
  toPsfMembershipView,
  toPsfTierView,
  toSubsectorView,
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
    /** The next membership number in a district's run, for the approve dialog. */
    private readonly report: PsfReportRepository,
  ) {}

  /** Whether a number is already another business's current membership (0121). */
  async numberHeldByAnotherBusiness(membershipNumber: string): Promise<boolean> {
    return (await this.repo.currentHolderOf(membershipNumber)) !== null;
  }

  // ── Membership claims (0121, 2026-10-30) ───────────────────────────────────────────────────────────

  /** The claims in the officer's region, with PSF's own list beside each, and the list's size. */
  async claims(grants: OversightGrant[], query: PsfClaimsQuery): Promise<PsfClaimsPage> {
    const scope = await this.scopeOf(grants);
    const [{ rows, counts }, list] = await Promise.all([
      this.repo.claims(scope, query.status),
      this.repo.memberListSummary(),
    ]);
    const count = (s: string): number => counts.find((c) => c.status === s)?.n ?? 0;
    return {
      items: rows.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        legalName: r.legalName,
        businessCode: r.businessCode ?? null,
        tin: r.tin ?? null,
        districtName: r.districtName ?? null,
        membershipNumber: r.membershipNumber,
        status: r.status,
        claimedAt: r.claimedAt.toISOString(),
        claimedByName: r.claimedByName ?? null,
        decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
        decidedByName: r.decidedByName ?? null,
        decisionNote: r.decisionNote ?? null,
        matchedBy: r.matchedBy ?? null,
        listed: r.listedNumber
          ? {
              legalName: r.listedName ?? null,
              tin: r.listedTin ?? null,
              tierCode: r.listedTier ?? null,
              expiresOn: r.listedExpires ?? null,
              tinMatches: !!r.listedTin && r.listedTin === r.tin,
            }
          : null,
      })),
      counts: { claimed: count('claimed'), confirmed: count('confirmed'), rejected: count('rejected') },
      list: { rows: list.rows, uploadedAt: list.uploadedAt ? list.uploadedAt.toISOString() : null },
    };
  }

  /** The claim, if it is open and in the officer's region; refused otherwise. */
  private async openClaimInScope(grants: OversightGrant[], id: string): Promise<PsfClaimInScope> {
    const claim = await this.repo.claim(id);
    if (!claim || !covers(await this.scopeOf(grants), claim.districtId)) {
      throw new NotFoundException('That claim is not in your region.');
    }
    if (claim.status !== 'claimed') throw new ConflictException('That claim has already been decided.');
    return claim;
  }

  /** Confirm a claim with the tier and dates PSF's records give; the business is told. */
  async confirmClaim(userId: string, grants: OversightGrant[], id: string, body: ConfirmPsfClaimRequest): Promise<void> {
    const claim = await this.openClaimInScope(grants, id);
    if (!(await this.repo.tierCodes()).includes(body.tierCode)) {
      throw new BadRequestException('That tier is not one of PSF\'s.');
    }
    await this.repo.confirmClaim({
      claimId: claim.id,
      orgId: claim.orgId,
      membershipNumber: claim.membershipNumber,
      tierCode: body.tierCode,
      startsOn: body.startsOn,
      expiresOn: body.expiresOn,
      decidedByUserId: userId,
      matchedBy: 'officer',
      note: body.note?.trim() || null,
    });
    await this.mail.claimConfirmed(claim.orgId, claim.membershipNumber, body.expiresOn);
  }

  /** Reject a claim with the reason the business is told. */
  async rejectClaim(userId: string, grants: OversightGrant[], id: string, body: RejectPsfClaimRequest): Promise<void> {
    const claim = await this.openClaimInScope(grants, id);
    if (!(await this.repo.rejectClaim(claim.id, userId, body.reason))) {
      throw new ConflictException('That claim has already been decided.');
    }
    await this.mail.claimRejected(claim.orgId, claim.membershipNumber, body.reason);
  }

  /**
   * PSF's own member list, from its spreadsheet: rows replaced by number, then every open claim the list
   * now confirms (number and TIN match, a tier and dates given) is confirmed and its business told.
   */
  async uploadMemberList(userId: string, body: UploadPsfMemberListRequest): Promise<PsfMemberListResult> {
    const tiers = new Set(await this.repo.tierCodes());
    const skipped: string[] = [];
    const rows = body.rows.flatMap((r) => {
      const number = normalizePsfNumber(r.membershipNumber);
      if (!looksLikePsfNumber(number)) {
        skipped.push(`${r.membershipNumber}: not a membership number`);
        return [];
      }
      const tierCode = r.tierCode && tiers.has(r.tierCode) ? r.tierCode : null;
      if (r.tierCode && !tierCode) skipped.push(`${number}: tier "${r.tierCode}" is not one of PSF's, kept without a tier`);
      return [
        {
          membershipNumber: number,
          legalName: r.legalName?.trim() || null,
          tin: r.tin?.replace(/\D/g, "") || null,
          tierCode,
          startsOn: r.startsOn ?? null,
          expiresOn: r.expiresOn ?? null,
        },
      ];
    });
    await this.repo.upsertMemberList(rows, userId);
    const matches = await this.repo.claimsTheListConfirms();
    for (const m of matches) {
      if (!m.tierCode || !m.startsOn || !m.expiresOn || m.expiresOn <= m.startsOn) continue;
      await this.repo.confirmClaim({
        claimId: m.claimId,
        orgId: m.orgId,
        membershipNumber: m.membershipNumber,
        tierCode: m.tierCode,
        startsOn: m.startsOn,
        expiresOn: m.expiresOn,
        decidedByUserId: userId,
        matchedBy: 'member_list',
        note: null,
      });
      await this.mail.claimConfirmed(m.orgId, m.membershipNumber, m.expiresOn);
    }
    return { rows: rows.length, confirmedClaims: matches.length, skipped: skipped.slice(0, 50) };
  }

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
      subsectorName: facts.subsectorName,
      associationName: facts.associationName,
      ownerGroups: facts.ownerGroups,
      registrationKind: facts.registrationKind,
    };
  }

  // --- The catalogues --------------------------------------------------------

  async tiers(): Promise<PsfTier[]> {
    return (await this.repo.tiers(true)).map(toPsfTierView);
  }

  /**
   * The active clusters, each with its active associations and subtypes, in
   * order. The subtypes are the national ones, and the district's own when the
   * form names the district the business is in.
   */
  async catalogue(districtId?: number): Promise<PsfCatalogue> {
    const [clusters, associations, subsectors] = await Promise.all([
      this.repo.clusters(true),
      this.repo.associations(true),
      this.repo.subsectors(districtId ? [districtId] : []),
    ]);
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
        subsectors: subsectors.filter((x) => x.clusterCode === c.code).map(toSubsectorView),
      })),
    };
  }

  // --- What a band costs, by place (2026-10-20) ---------------------------------

  /** Every active band's price in a district, for the public form. */
  async feesIn(districtId: number): Promise<PsfFeesView> {
    const [tiers, rows] = await Promise.all([this.repo.tiers(true), this.repo.tierFees(districtId)]);
    const priced = tiers.map((t) => ({
      tierCode: t.code,
      ...resolvePsfTierFee(
        rows.find((r) => r.tierCode === t.code && r.districtId === districtId)?.annualFeeRwf ?? null,
        rows.find((r) => r.tierCode === t.code && r.districtId === null)?.annualFeeRwf ?? null,
        psfStartingFee(t),
      ),
    }));
    // What a business may pay in each band: up to the top of its catalogue
    // range, or, with no range, up to the next band's price.
    const ceilings = psfFeeCeilings(
      priced.map((f) => {
        const t = tiers.find((x) => x.code === f.tierCode);
        return { ...f, bandMaxRwf: t?.priceKind === 'range' ? t.annualFeeMaxRwf : null };
      }),
    );
    return { districtId, fees: priced.map((f) => ({ ...f, ceilingRwf: ceilings.get(f.tierCode) ?? null })) };
  }

  /**
   * The officer's Fees screen. A district officer sees their district; a
   * province or national officer sees the district the switcher names, or,
   * with none named, the national prices (which only a national officer sets).
   */
  async feesForOfficer(grants: OversightGrant[], area: PsfAreaQuery = {}): Promise<PsfOfficerFeesView> {
    const scope = await this.scopeOf(grants);
    const districtId = area.district ?? (scope !== null && scope.length === 1 ? scope[0]! : null);
    if (districtId !== null && scope !== null && !scope.includes(districtId)) throw new ForbiddenException(PSF_OUT_OF_SCOPE_MESSAGE);
    const [tiers, rows, districtName] = await Promise.all([
      this.repo.tiers(true),
      this.repo.tierFees(districtId),
      districtId === null ? Promise.resolve(null) : this.repo.districtName(districtId),
    ]);
    return {
      districtId,
      districtName,
      canEditNational: scope === null,
      canEditDistrict: districtId !== null && this.canEditSubsector(scope, districtId),
      rows: tiers.map((t) => {
        const own = districtId === null ? undefined : rows.find((r) => r.tierCode === t.code && r.districtId === districtId);
        const national = rows.find((r) => r.tierCode === t.code && r.districtId === null);
        const band = psfStartingFee(t);
        const shown = own ?? national;
        return {
          tierCode: t.code,
          tierName: t.nameEn,
          family: t.family,
          priceKind: t.priceKind,
          bandMinRwf: t.annualFeeMinRwf ?? (t.priceKind === 'fixed' ? t.annualFeeRwf : null),
          bandMaxRwf: t.annualFeeMaxRwf ?? (t.priceKind === 'fixed' ? t.annualFeeRwf : null),
          bandFeeRwf: band,
          nationalRwf: national?.annualFeeRwf ?? null,
          districtRwf: own?.annualFeeRwf ?? null,
          ...(() => {
            const r = resolvePsfTierFee(own?.annualFeeRwf ?? null, national?.annualFeeRwf ?? null, band);
            return { effectiveRwf: r.amountRwf, source: r.source };
          })(),
          updatedAt: shown ? shown.updatedAt.toISOString() : null,
          updatedByName: shown?.updatedByName ?? null,
        };
      }),
    };
  }

  /** Set or clear a band's price for a place the officer may price. */
  async setTierFee(officerUserId: string, grants: OversightGrant[], input: SetPsfTierFeeRequest): Promise<PsfOfficerFeesView> {
    const scope = await this.scopeOf(grants);
    if (!this.canEditSubsector(scope, input.districtId)) {
      throw new ForbiddenException(
        input.districtId === null ? 'Only a national PSF officer sets the national prices. Set your district’s instead.' : PSF_OUT_OF_SCOPE_MESSAGE,
      );
    }
    const tier = await this.repo.tier(input.tierCode);
    if (!tier || !tier.active) throw new NotFoundException('That membership band is not offered any more.');
    if (input.amountRwf !== null) {
      const rwf = (n: number | null): string => `RWF ${(n ?? 0).toLocaleString('en-US')}`;
      const low = tier.annualFeeMinRwf;
      const high = tier.annualFeeMaxRwf;
      const outside =
        (tier.priceKind === 'range' && low !== null && high !== null && (input.amountRwf < low || input.amountRwf > high)) ||
        (tier.priceKind === 'minimum' && low !== null && input.amountRwf < low);
      if (outside) {
        throw new UnprocessableEntityException({
          message: 'Validation failed',
          issues: [
            {
              code: 'custom',
              path: ['amountRwf'],
              message: tier.priceKind === 'range' ? `This band runs from ${rwf(low)} to ${rwf(high)}.` : `This band starts at ${rwf(low)}.`,
            },
          ],
        });
      }
    }
    await this.repo.setTierFee({ ...input, userId: officerUserId });
    return this.feesForOfficer(grants, input.districtId === null ? {} : { district: input.districtId });
  }

  // --- Dynamic membership form fields (2026-10-26) -----------------------------

  /** Active fields for the public and registration membership forms. */
  async formFieldsPublic(): Promise<PsfFormFieldsPublic> {
    const rows = await this.repo.formFields(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the public form does not say which fields are active: all of them are
    return { fields: rows.map(toFormFieldView).map(({ active: _a, ...f }) => f) };
  }

  /** Every field for the officer console; only a national officer may edit. */
  async formFieldsForOfficer(grants: OversightGrant[]): Promise<PsfFormFieldsOfficerView> {
    const scope = await this.scopeOf(grants);
    const rows = await this.repo.formFields(false);
    return { fields: rows.map(toFormFieldView), canEdit: scope === null };
  }

  async createFormField(
    grants: OversightGrant[],
    input: CreatePsfFormFieldRequest,
  ): Promise<PsfFormFieldsOfficerView> {
    if ((await this.scopeOf(grants)) !== null) {
      throw new ForbiddenException('Only the PSF National Manager configures the membership form.');
    }
    try {
      await this.repo.insertFormField({
        key: input.key,
        label: input.label,
        helpText: input.helpText ?? null,
        fieldType: input.fieldType,
        required: input.required,
        options: input.fieldType === 'select' ? input.options : [],
        sortOrder: input.sortOrder,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('That field key is already in use.');
      }
      throw error;
    }
    return this.formFieldsForOfficer(grants);
  }

  async updateFormField(
    grants: OversightGrant[],
    id: string,
    input: UpdatePsfFormFieldRequest,
  ): Promise<PsfFormFieldsOfficerView> {
    if ((await this.scopeOf(grants)) !== null) {
      throw new ForbiddenException('Only the PSF National Manager configures the membership form.');
    }
    const existing = await this.repo.formField(id);
    if (!existing) throw new NotFoundException('That form field is gone.');
    if (input.options !== undefined && existing.fieldType === 'select' && input.options.length < 1) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['options'], message: 'A select field needs at least one option.' }],
      });
    }
    if (input.options !== undefined && existing.fieldType !== 'select') {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['options'], message: 'Only a select field carries options.' }],
      });
    }
    await this.repo.updateFormField(id, {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.helpText !== undefined ? { helpText: input.helpText } : {}),
      ...(input.required !== undefined ? { required: input.required } : {}),
      ...(input.options !== undefined ? { options: input.options } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    });
    return this.formFieldsForOfficer(grants);
  }

  // --- Subtypes, as officers keep them (2026-10-20) -----------------------------

  /**
   * Which subtypes an officer may change: a national officer, the national
   * ones and every district's; anyone else, the districts they cover. A
   * national subtype is the country's list, so only the country's officer
   * sets it.
   */
  private canEditSubsector(scope: PsfScope, districtId: number | null): boolean {
    if (scope === null) return true;
    return districtId !== null && scope.includes(districtId);
  }

  async subsectorsForOfficer(grants: OversightGrant[], area: PsfAreaQuery = {}): Promise<PsfSubsectorsView> {
    const scope = await this.scopeOf(grants);
    const shown = await this.scopeFor(grants, area);
    const [clusters, associations, subsectors, places] = await Promise.all([
      this.repo.clusters(true),
      this.repo.associations(true),
      this.repo.subsectors(shown, true),
      this.report.districtNames(scope),
    ]);
    return {
      clusters: clusters.map((c) => ({
        code: c.code,
        nameEn: c.nameEn,
        subsectors: subsectors
          .filter((x) => x.clusterCode === c.code)
          .map((x) => ({ ...toSubsectorView(x), canEdit: this.canEditSubsector(scope, x.districtId) })),
      })),
      places: [
        ...(scope === null ? [{ districtId: null, label: "National (every district)" }] : []),
        ...places.map((p) => ({ districtId: p.id, label: `${p.name} district only` })),
      ],
      associations: associations.map((a) => ({ code: a.code, clusterCode: a.clusterCode, nameEn: a.nameEn })),
    };
  }

  private async assertSubsectorInput(clusterCode: string, associationCodes: readonly string[]): Promise<void> {
    const associations = await this.repo.associations(false);
    const foreign = associationCodes.filter((code) => associations.find((a) => a.code === code)?.clusterCode !== clusterCode);
    if (foreign.length) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['associationCodes'], message: 'Pick associations of this sector only.' }],
      });
    }
  }

  async createSubsector(officerUserId: string, grants: OversightGrant[], input: CreatePsfSubsectorRequest): Promise<PsfSubsectorsView> {
    const scope = await this.scopeOf(grants);
    if (!this.canEditSubsector(scope, input.districtId)) {
      throw new ForbiddenException(
        input.districtId === null
          ? 'Only a national PSF officer sets the national list. Add it for your district instead.'
          : PSF_OUT_OF_SCOPE_MESSAGE,
      );
    }
    if (!(await this.repo.clusters(true)).some((c) => c.code === input.clusterCode)) {
      throw new UnprocessableEntityException('That sector is not on PSF’s list.');
    }
    await this.assertSubsectorInput(input.clusterCode, input.associationCodes);
    const id = await this.repo.insertSubsector({ ...input, userId: officerUserId });
    if (!id) {
      throw new ConflictException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['nameEn'], message: 'This sector already has a subtype by that name there.' }],
      });
    }
    return this.subsectorsForOfficer(grants);
  }

  async updateSubsector(
    officerUserId: string,
    grants: OversightGrant[],
    id: string,
    input: UpdatePsfSubsectorRequest,
  ): Promise<PsfSubsectorsView> {
    const row = await this.repo.subsector(id);
    if (!row) throw new NotFoundException('Subtype not found.');
    if (!this.canEditSubsector(await this.scopeOf(grants), row.districtId)) {
      throw new ForbiddenException(row.districtId === null ? 'Only a national PSF officer changes the national list.' : PSF_OUT_OF_SCOPE_MESSAGE);
    }
    if (input.associationCodes) await this.assertSubsectorInput(row.clusterCode, input.associationCodes);
    if (!(await this.repo.updateSubsector(id, { ...input, userId: officerUserId }))) {
      throw new ConflictException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['nameEn'], message: 'This sector already has a subtype by that name there.' }],
      });
    }
    return this.subsectorsForOfficer(grants);
  }

  /**
   * The subtype a public form picked, or a refusal at its field: it must be
   * active, of the sector the association is in, and national or the
   * business's own district's.
   */
  async subsectorForRegistration(id: string, associationClusterCode: string, districtId: number): Promise<void> {
    const row = await this.repo.subsector(id);
    const ok = row && row.active && row.clusterCode === associationClusterCode && (row.districtId === null || row.districtId === districtId);
    if (!ok) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['business', 'subsectorId'], message: 'That kind of business is not offered here any more. Pick another, or type it.' }],
      });
    }
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
   * `phoneE164` is the number the prompt goes to, carried as the fee's
   * instrument (073-gtbank-payments).
   */
  async pay(
    orgId: string,
    userId: string,
    applicationId: string,
    input: PayPsfMembershipRequest,
  ): Promise<PsfMembershipOverview> {
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
    await this.chargeApproved({
      orgId,
      legalName: facts.legalName,
      app,
      scopeId: workspaceId,
      recordedByUserId: userId,
      phoneE164: input.phoneE164 ?? null,
    });
    return this.overview(orgId, userId);
  }

  /**
   * Charge an approved application's fee and, once it settles, record the
   * membership: the one money path, for the workspace's Pay button and the
   * public tracking page alike.
   *
   * `scopeId` is what the payment is scoped to: the workspace, or for a
   * business that came through the public form and has none, the business
   * itself. It prefixes the idempotency key (ADR-020 AC-27), so a retry, a
   * double press or a "Check payment" only ever finds the one charge.
   *
   * A prompt still waiting on the person is a 409 `payment_pending`: pressing
   * again asks the provider again under the same key.
   */
  async chargeApproved(input: {
    orgId: string;
    legalName: string;
    app: { id: string; status: string; approvedFeeRwf: number | null; approvedMembershipNumber: string | null; requestedTierName: string };
    scopeId: string;
    recordedByUserId: string;
    /** The number the prompt goes to. */
    phoneE164: string | null;
  }): Promise<void> {
    const { app, orgId } = input;
    if (app.status !== 'approved' || app.approvedFeeRwf === null) {
      throw new ConflictException(PSF_NOT_PAYABLE_MESSAGE);
    }
    const instrument = psfInstrument(input.phoneE164);
    if (!instrument) throw new UnprocessableEntityException(PSF_NO_INSTRUMENT_MESSAGE);
    let receipt;
    try {
      receipt = await this.payments.chargeOneTimeFee({
        kind: 'one_time_fee',
        purpose: 'psf_membership',
        feeCode: 'psf_membership',
        instrument,
        idempotencyKey: `${input.scopeId}:psf-membership:${app.id}`,
        amountRwf: app.approvedFeeRwf,
        currency: 'RWF',
        workspaceId: input.scopeId,
        memo: `PSF membership ${app.approvedMembershipNumber ?? ''} for ${input.legalName}`.trim(),
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
      applicationId: app.id,
      orgId,
      amountRwf: receipt.amountRwf,
      paymentRef: receipt.adapterRef,
      paymentMode: receipt.mode,
      paidAt,
      startsOn,
      expiresOn,
      recordedByUserId: input.recordedByUserId,
    });
    // Only the call that recorded it remits and mails, so a race stays silent.
    if (recorded) {
      await this.remit(app.id, input.scopeId, receipt.amountRwf);
      await this.mail.member(orgId, {
        tierName: app.requestedTierName,
        membershipNumber: recorded.membershipNumber,
        annualFeeRwf: receipt.amountRwf,
        startsOn,
        expiresOn,
        paymentReference: receipt.adapterRef,
      });
    }
  }

  /**
   * Pass a paid fee on to PSF. Best effort and after the fact: the membership
   * stands whatever happens here, and a fee not yet passed on stays visible as
   * `remitted_at IS NULL` for finance. Until PSF's account is configured
   * nothing is sent, and the log says so rather than pretending.
   */
  private async remit(applicationId: string, workspaceId: string, amountRwf: number): Promise<void> {
    const payee = psfPayee((key) => this.config.get<string>(key));
    if (!payee) {
      this.log.warn(
        `PSF's payout account is not configured (PSF_PAYOUT_DESTINATION, PSF_PAYOUT_REF, PSF_PAYOUT_NAME, PSF_PAYOUT_ID_NUMBER, PSF_PAYOUT_PHONE); the fee on application ${applicationId} is held for PSF.`,
      );
      return;
    }
    try {
      const sent = await this.payments.payout({
        kind: 'payout',
        payee,
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

  /**
   * The officer's region, narrowed to one district or one province when the
   * console asks (the province and national views' switcher). A place outside
   * the region narrows to nothing: the region is a boundary, never widened.
   */
  async scopeFor(grants: OversightGrant[], area: PsfAreaQuery = {}): Promise<PsfScope> {
    const scope = await this.scopeOf(grants);
    let narrowed: readonly number[] | null = scope;
    if (area.province !== undefined) {
      const inProvince = (await this.repo.districtsByProvince([area.province])).get(area.province) ?? [];
      narrowed = narrowed === null ? inProvince : narrowed.filter((id) => inProvince.includes(id));
    }
    if (area.district !== undefined) {
      narrowed = narrowed === null ? [area.district] : narrowed.filter((id) => id === area.district);
    }
    return narrowed;
  }

  async queue(
    officerUserId: string,
    grants: OversightGrant[],
    query: PsfQueueAreaQuery,
  ): Promise<PsfQueuePage> {
    const scope = await this.scopeFor(grants, { district: query.district, province: query.province });
    const deciding = decidingDistricts(grants);
    const now = new Date();
    const offset = decodeOffset(query.cursor);
    const page = await this.repo.queuePage(
      officerUserId,
      scope,
      { q: query.q, cluster: query.cluster, family: query.family, group: query.group, sort: query.sort },
      offset,
      QUEUE_PAGE_SIZE,
    );
    return {
      items: page.rows.map((r) => ({
        applicationId: r.applicationId,
        orgId: r.orgId,
        businessName: r.businessName,
        businessCode: r.businessCode,
        domain: r.domain,
        districtName: r.districtName,
        associationName: r.associationName,
        subsectorName: r.subsectorName,
        clusterName: r.clusterName,
        ownerGroups: r.ownerGroups,
        requestedTierName: r.requestedTierName,
        declaredFeeRwf: r.declaredFeeRwf,
        paidRwf: r.paidAmountRwf,
        submittedAt: r.submittedAt.toISOString(),
        queuedAt: r.queuedAt ? r.queuedAt.toISOString() : null,
        registrationStatus: r.registrationStatus,
        canDecide: !r.officerHasStake && deciding.includes(r.districtId ?? -1),
        districtId: r.districtId,
        waitingDays: wholeDaysBetween(r.sortAt, now),
        docId: r.docId,
        headOfficeInScope: covers(scope, r.districtId),
        branchesPending: r.branchesPending,
        decidesHere: deciding.includes(r.districtId ?? -1),
      })),
      nextCursor: page.more ? encodeOffset(offset + QUEUE_PAGE_SIZE) : null,
      total: page.total,
    };
  }

  /**
   * The business behind an application, for the officer's detail: its
   * payments, its applications and its memberships, inside the officer's
   * region whatever the application's state.
   */
  async businessHistoryFor(grants: OversightGrant[], applicationId: string): Promise<PsfBusinessHistory> {
    const app = await this.repo.applicationById(applicationId);
    const facts = app ? await this.repo.orgFacts(app.orgId) : null;
    const scope = await this.scopeOf(grants);
    if (!app || !facts || (scope !== null && (facts.districtId === null || !scope.includes(facts.districtId)))) {
      throw new NotFoundException('This business is not in your region.');
    }
    return this.historyOf(app.orgId);
  }

  /**
   * One business on its own page (2026-10-20): its register row, the person
   * on its newest application, and every payment, application and membership.
   * Outside the officer's region it does not exist.
   */
  async businessDetail(grants: OversightGrant[], orgId: string): Promise<PsfBusinessDetail> {
    const scope = await this.scopeOf(grants);
    const page = await this.repo.registerPage(scope, { orgId }, undefined, 1);
    const row = page.rows[0];
    if (!row) throw new NotFoundException('This business is not in your region.');
    const [history, newest, branches] = await Promise.all([
      this.historyOf(orgId),
      this.repo.newestApplicationContact(orgId),
      this.repo.orgBranches(orgId),
    ]);
    return {
      business: {
        ...row,
        registeredAt: row.registeredAt.toISOString(),
        lastPaidAt: row.lastPaidAt ? row.lastPaidAt.toISOString() : null,
        headOfficeInScope: covers(scope, row.districtId),
      },
      // Every branch, in any district: whoever opens the business sees where it trades.
      branches: branches.map((b) => ({
        id: b.id,
        provinceName: b.provinceName ? provinceDisplayName(b.provinceName) : null,
        districtId: b.districtId,
        districtName: b.districtName,
        sectorName: b.sectorName,
        street: b.street,
        status: b.status,
        note: b.decisionNote,
        inScope: covers(scope, b.districtId),
      })),
      contact: newest
        ? {
            name: `${newest.firstName} ${newest.lastName}`.trim(),
            role: PSF_CONTACT_ROLE_LABEL[newest.contactRole],
            phoneE164: newest.phoneE164,
            email: newest.email || null,
          }
        : null,
      history,
    };
  }

  private async historyOf(orgId: string): Promise<PsfBusinessHistory> {
    const h = await this.repo.businessHistory(orgId);
    const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
    const payments: PsfBusinessHistory['payments'] = [];
    if (h.registrationFee?.paidAt) {
      payments.push({ kind: 'registration_fee', amountRwf: h.registrationFee.amountRwf, at: iso(h.registrationFee.paidAt), status: 'paid', reference: null, applicationDocId: null });
    }
    for (const a of h.applications) {
      if (a.paidAt && a.paidAmountRwf !== null) {
        payments.push({ kind: 'membership_fee', amountRwf: a.paidAmountRwf, at: iso(a.paidAt), status: 'paid', reference: a.paymentRef, applicationDocId: a.docId });
      }
    }
    payments.sort((x, y) => (x.at ?? '9999').localeCompare(y.at ?? '9999'));
    return {
      registeredAt: iso(h.registeredAt),
      payments,
      applications: h.applications.map((a) => ({
        id: a.id,
        docId: a.docId,
        tierName: a.tierName,
        status: a.status,
        submittedAt: a.createdAt.toISOString(),
        decidedAt: iso(a.decidedAt),
        declineReasonLabel: a.declineReason ? PSF_DECLINE_REASON_LABEL[a.declineReason] : null,
        membershipNumber: a.approvedMembershipNumber,
      })),
      memberships: h.memberships.map((m) => ({
        number: m.membershipNumber,
        tierName: m.tierName,
        startsOn: m.startsOn,
        expiresOn: m.expiresOn,
        current: m.endedAt === null,
      })),
    };
  }

  private async toOfficerView(row: PsfOfficerApplicationRow, scope: PsfScope, deciding: number[]): Promise<PsfOfficerApplication> {
    const headOfficeInScope = covers(scope, row.districtId);
    const decidesHere = deciding.includes(row.districtId ?? -1);
    const branches = await this.branchViews(row.id, row.status, deciding, row.officerHasStake);
    let suggested: string | null = null;
    if (row.status === 'submitted' && row.districtId !== null) {
      const year = Number(kigaliToday().slice(0, 4));
      const letters = districtLetters(row.districtId, row.districtName);
      suggested = formatPsfMembershipNumber(letters, year, (await this.report.lastMembershipNumber(letters, year)) + 1);
    }
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
        subsectorName: row.subsectorName,
        associationName: row.associationName,
        ownerGroups: row.ownerGroups,
        registrationKind: row.registrationKind,
      },
      // Only an application still with PSF is decided; an approved one waits
      // on the business's payment. Only its district's manager decides it.
      canDecide: row.status === 'submitted' && !row.officerHasStake && decidesHere,
      docId: row.docId,
      waitingDays: wholeDaysBetween(row.queuedAt ?? row.createdAt, row.decidedAt ?? new Date()),
      suggestedMembershipNumber: suggested,
      paidBeforeReview: row.paidAt !== null && (row.decidedAt === null || row.paidAt <= row.decidedAt),
      headOfficeInScope,
      branches,
      decidesHere,
    };
  }

  /**
   * An application's branches for one officer: each decidable only by the
   * District Manager of its district, while it waits and the business is
   * still open.
   */
  private async branchViews(
    applicationId: string,
    status: PsfApplicationStatus,
    deciding: number[],
    officerHasStake: boolean,
  ): Promise<PsfApplicationBranch[]> {
    const open = status === 'submitted' || status === 'approved' || status === 'member';
    return (await this.repo.branchesOf(applicationId)).map((b) => ({
      id: b.id,
      districtId: b.districtId,
      districtName: b.districtName,
      sectorName: b.sectorName,
      street: b.street,
      status: b.status,
      note: b.decisionNote,
      decidedAt: b.decidedAt ? b.decidedAt.toISOString() : null,
      canDecide: b.status === 'pending' && open && !officerHasStake && deciding.includes(b.districtId),
    }));
  }

  async officerApplication(
    officerUserId: string,
    grants: OversightGrant[],
    applicationId: string,
  ): Promise<PsfOfficerApplication> {
    const scope = await this.scopeOf(grants);
    const row = await this.repo.officerApplication(officerUserId, scope, applicationId, true, true);
    if (!row) throw new NotFoundException('This application is not in your region.');
    return await this.toOfficerView(row, scope, decidingDistricts(grants));
  }

  /**
   * Admit or decline one branch (2026-10-23). The officer of the BRANCH's
   * district decides it, whoever decides the business: 404 outside their
   * region, 403 with a stake, 409 once decided or once the business is
   * declined or withdrawn.
   */
  async decideBranch(
    officerUserId: string,
    grants: OversightGrant[],
    applicationId: string,
    branchId: string,
    input: PsfBranchDecisionRequest,
  ): Promise<PsfOfficerApplication> {
    const scope = await this.scopeOf(grants);
    const row = await this.repo.officerApplication(officerUserId, scope, applicationId, true, true);
    const branch = row ? (await this.repo.branchesOf(row.id)).find((b) => b.id === branchId) : undefined;
    if (!row || !branch || !covers(scope, branch.districtId)) {
      throw new NotFoundException('This branch is not in your region.');
    }
    if (!decidingDistricts(grants).includes(branch.districtId)) throw new ForbiddenException(PSF_DISTRICT_DECIDES_MESSAGE);
    if (row.officerHasStake) throw new ForbiddenException(PSF_OWN_BUSINESS_MESSAGE);
    if (branch.status !== 'pending' || !['submitted', 'approved', 'member'].includes(row.status)) {
      throw new ConflictException('This branch is no longer waiting on PSF.');
    }
    const moved = await this.repo.decideBranch({
      applicationId,
      branchId,
      officerUserId,
      status: input.decision === 'admit' ? 'admitted' : 'declined',
      note: input.note ?? null,
    });
    // Another officer won the race between the read and the write.
    if (!moved) throw new ConflictException('This branch is no longer waiting on PSF.');
    return this.officerApplication(officerUserId, grants, applicationId);
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
    if (!decidingDistricts(grants).includes(row.districtId ?? -1)) throw new ForbiddenException(PSF_DISTRICT_DECIDES_MESSAGE);
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
    // PSF approves only a business that has paid (2026-10-20): a paid
    // application becomes a member at once, and its fee goes on to PSF.
    if (row.paidAt) return this.approvePaid(officerUserId, grants, row, input);
    // A membership number names one business: PSF's register and the
    // certificate both read it, so a second business may not be given it.
    if (await this.report.membershipNumberTaken(input.membershipNumber, applicationId)) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['membershipNumber'], message: 'That membership number is already given to another business.' }],
      });
    }
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

  private async assertNumberFree(number: string, applicationId: string): Promise<void> {
    if (await this.report.membershipNumberTaken(number, applicationId)) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['membershipNumber'], message: 'That membership number is already given to another business.' }],
      });
    }
  }

  private async approvePaid(
    officerUserId: string,
    grants: OversightGrant[],
    row: PsfOfficerApplicationRow,
    input: PsfApproveRequest,
  ): Promise<PsfOfficerApplication> {
    await this.assertNumberFree(input.membershipNumber, row.id);
    const { startsOn, expiresOn } = defaultPsfMembershipDates(kigaliToday());
    const done = await this.repo.approvePaid({
      applicationId: row.id,
      officerUserId,
      bodyCode: this.bodyOf(grants),
      membershipNumber: input.membershipNumber,
      note: input.note ?? null,
      startsOn,
      expiresOn,
    });
    if (!done) throw new ConflictException(PSF_NOT_OPEN_MESSAGE);
    await this.remit(row.id, done.orgId, done.amountRwf);
    await this.mail.member(done.orgId, {
      tierName: row.requestedTierName,
      membershipNumber: input.membershipNumber,
      annualFeeRwf: done.amountRwf,
      startsOn,
      expiresOn,
      paymentReference: row.paymentRef,
    });
    return this.decidedView(row.id, done.orgId, decidingDistricts(grants));
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
    // Nothing is refunded (2026-10-23): a fee paid before review is kept, and
    // goes on to PSF as an approval's does.
    const after = await this.repo.applicationById(applicationId);
    if (after?.paidAt && after.paidAmountRwf !== null) await this.remit(applicationId, decided.orgId, after.paidAmountRwf);
    await this.mail.declined(decided.orgId, input.reason, input.note ?? null);
    return this.decidedView(applicationId, decided.orgId, decidingDistricts(grants));
  }

  /** A declined application, read back for the officer who declined it. */
  private async decidedView(applicationId: string, orgId: string, deciding: number[]): Promise<PsfOfficerApplication> {
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
      docId: app.docId,
      waitingDays: wholeDaysBetween(app.queuedAt ?? app.createdAt, app.decidedAt ?? new Date()),
      suggestedMembershipNumber: null,
      paidBeforeReview: app.paidAt !== null && (app.decidedAt === null || app.paidAt <= app.decidedAt),
      headOfficeInScope: true,
      // The officer who just decided the business holds no stake in it.
      branches: await this.branchViews(applicationId, app.status, deciding, false),
      decidesHere: true,
    };
  }

  // --- The officer's register of businesses ----------------------------------

  /**
   * Every business in the officer's region, filtered (the PSF path): what kind
   * of business registered, where, and how it stands with PSF. A district
   * filter outside the region finds nothing, because the region is a boundary.
   */
  async register(grants: OversightGrant[], query: PsfBusinessesQuery): Promise<PsfBusinessesPage> {
    const scope = await this.scopeFor(grants, { province: query.province });
    const page = await this.repo.registerPage(
      scope,
      {
        q: query.q,
        districtId: query.district,
        clusterCode: query.cluster,
        subsectorId: query.subsector,
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
        lastPaidAt: r.lastPaidAt ? r.lastPaidAt.toISOString() : null,
        headOfficeInScope: covers(scope, r.districtId),
      })),
      nextCursor: page.more && last ? encodeQueueCursor(last.registeredAt, last.orgId) : null,
      total: page.total,
    };
  }

  /** The officer's region at a glance, over the whole region. */
  async registerSummary(grants: OversightGrant[], area: PsfAreaQuery = {}): Promise<PsfRegisterSummary> {
    const scope = await this.scopeFor(grants, area);
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
/**
 * The districts an officer DECIDES in (2026-10-23): their district-level PSF
 * postings only. A province or national posting reads, for reporting, and
 * decides nothing.
 */
function decidingDistricts(grants: OversightGrant[]): number[] {
  return grants
    .filter((g) => g.oversightRole === 'psf_membership_officer' && g.scopeLevel === 'district' && g.districtId !== null)
    .map((g) => g.districtId as number);
}

/** Whether a region holds a district. Null scope is the whole country. */
function covers(scope: PsfScope, districtId: number | null): boolean {
  return scope === null || (districtId !== null && scope.includes(districtId));
}

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

/** The queue's cursor: an offset, base64url so it reads as opaque. */
function encodeOffset(n: number): string {
  return Buffer.from(`o:${n}`, 'utf8').toString('base64url');
}
function decodeOffset(cursor: string | undefined): number {
  if (!cursor) return 0;
  const m = /^o:(\d+)$/.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  return m ? Math.min(Number(m[1]), 10_000) : 0;
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

function toFormFieldView(row: {
  id: string;
  key: string;
  label: string;
  helpText: string | null;
  fieldType: string;
  required: boolean;
  options: string[] | null;
  sortOrder: number;
  active: boolean;
}): PsfFormField {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    helpText: row.helpText,
    fieldType: row.fieldType as PsfFormField['fieldType'],
    required: row.required,
    options: row.options ?? [],
    sortOrder: row.sortOrder,
    active: row.active,
  };
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | undefined;
  return e?.code === '23505' || e?.cause?.code === '23505';}
