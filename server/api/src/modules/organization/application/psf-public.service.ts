import { PSF_NO_INSTRUMENT_MESSAGE, psfInstrument } from './psf-instrument';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import {
  PSF_CONSENT_VERSION,
  PSF_DECLINE_REASON_LABEL,
  PSF_FAMILY_LABEL,
  maskEmail,
  normalizeBusinessCode,
  normalizePsfNumber,
  maskPhone,
  provinceDisplayName,
  splitPsfName,
  wholeDaysBetween,
  type PsfIdentityConfirmRequest,
  type PsfIdentityLookupRequest,
  type PsfIdentityLookupResult,
  type PsfMemberLookupConfirm,
  type PsfMemberLookupConfirmed,
  type PsfMemberLookupRequest,
  type PsfMemberLookupResult,
  type PsfPublicSubmitRequest,
  type PsfPublicSubmitResult,
  type PsfRenewRequest,
  type PsfRenewalState,
  type PsfTrackEvent,
  type PsfTrackPayResult,
  type PsfTrackStage,
  type PsfTrackView,
  type PsfVerifiedApplicant,
  type PsfCardUploadResult,
  type PsfLogoUploadResult,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { SMS_PORT, type SmsPort } from '../../sms/domain/sms-port';
import {
  PAYMENT_PORT,
  PaymentDeclinedError,
  PaymentUnavailableError,
  type PaymentPort,
  type PaymentReceipt,
} from '../../pay/domain/payment-port';
import { StorageService } from '../../storage/application/storage.service';
import { isObjectKey } from '../../storage/domain/object-key';
import { IdentityService } from '../../user/application/identity.service';
import {
  DuplicateTinError,
  OrganizationRepository,
} from '../infrastructure/organization.repository';
import { renderPsfCertificate } from '../infrastructure/psf-certificate.renderer';
import { PsfMembershipMailer } from '../infrastructure/psf-membership.mailer';
import { PsfMembershipRepository } from '../infrastructure/psf-membership.repository';
import { PsfPublicRepository, type PsfTrackRow } from '../infrastructure/psf-public.repository';
import { PsfRenewalRepository } from '../infrastructure/psf-renewal.repository';
import { kigaliDateOf, psfRenewalTerms } from '../domain/psf-renewal-rules';
import { buildPsfApplicationRow } from './psf-application-row';
import { PsfMembershipService } from './psf-membership.service';
import { RegistrationService } from './registration.service';

/** A code lives ten minutes and takes five wrong guesses, like the account check. */
const CODE_TTL_SECONDS = 600;
const CODE_MAX_ATTEMPTS = 5;
/** Long enough to fill in the rest of the form, short enough not to linger. */
const TOKEN_TTL_SECONDS = 30 * 60;

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
function digestsMatch(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}
function fieldError(path: (string | number)[], message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ message: 'Validation failed', issues: [{ code: 'custom', path, message }] });
}

/**
 * THE PUBLIC PSF PATH (2026-10-19): a business joins PSF with no account.
 *
 *   1. `lookup` + `confirm`: a National ID, bound to the person by a code sent
 *      to the phone the population register holds. Nothing is revealed until
 *      the code is read back, exactly as the account check behaves (ADR-060).
 *   2. `submit`: the whole form at once. The business, its application and its
 *      fee bill are one transaction; the RWF 5,000 is then charged, and a
 *      settled charge gives the business its code and puts it in PSF's queue.
 *   3. `track` / `payRegistration` / `payMembership`: everything after, by docID.
 *
 * The officer's side is unchanged: these applications land in the same queue,
 * are decided by the same `PsfMembershipService`, and are paid through its one
 * money path.
 */
@Injectable()
export class PsfPublicService {
  private readonly log = new Logger(PsfPublicService.name);

  constructor(
    private readonly repo: PsfPublicRepository,
    private readonly psfRepo: PsfMembershipRepository,
    private readonly psf: PsfMembershipService,
    private readonly orgs: OrganizationRepository,
    private readonly registration: RegistrationService,
    private readonly identity: IdentityService,
    @Inject(SMS_PORT) private readonly sms: SmsPort,
    @Inject(PAYMENT_PORT) private readonly payments: PaymentPort,
    private readonly mail: PsfMembershipMailer,
    private readonly storage: StorageService,
    private readonly renewals: PsfRenewalRepository,
    private readonly config: ConfigService,
  ) {}

  // --- 1. Who is applying ------------------------------------------------------

  async lookup(input: PsfIdentityLookupRequest): Promise<PsfIdentityLookupResult> {
    const found = await this.identity.lookupRegister(input.documentNumber);
    if (found.status === 'unavailable') {
      return {
        status: 'unavailable',
        message:
          this.identity.registryMode === 'off'
            ? 'National ID lookup is not available here yet.'
            : 'We could not reach the population register just now. Try again in a few minutes.',
      };
    }
    if (found.status === 'not_found') {
      return {
        status: 'not_found',
        message: 'The population register has no one with that National ID. Check the number on your card.',
      };
    }
    const phone = found.person.phoneE164;
    if (!phone) {
      return {
        status: 'no_phone',
        message: 'The register holds no phone for this National ID, so we cannot send you a code. Update your phone with NIDA, then try again.',
      };
    }
    const demo = this.identity.demoCode;
    const code = demo ?? String(randomInt(0, 1_000_000)).padStart(6, '0');
    const checkId = await this.repo.createCheck({
      documentNumber: input.documentNumber,
      codeHash: hash(code),
      codeExpiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000),
    });
    try {
      await this.sms.send({
        toE164: phone,
        body: `${code} is your PSF registration code. It lasts ${CODE_TTL_SECONDS / 60} minutes. Never share it.`,
      });
    } catch (error) {
      await this.repo.deleteCheck(checkId);
      this.log.warn(`PSF identity code could not be sent: ${(error as Error).message}`);
      return { status: 'unavailable', message: 'We could not send the code just now. Try again in a few minutes.' };
    }
    // Shown on screen when no text really goes (2026-11-02): the demo's fixed code, or, while SMS is the
    // mock (a sample database only, which prints the code to the log anyway), the code just made.
    const shown = demo ?? (this.sms.mode === 'mock' ? code : null);
    return { status: 'code_sent', checkId, sentTo: maskPhone(phone), expiresInSeconds: CODE_TTL_SECONDS, demoCode: shown };
  }

  async confirm(input: PsfIdentityConfirmRequest): Promise<PsfVerifiedApplicant> {
    const check = await this.repo.check(input.checkId);
    if (!check || check.verifiedAt) throw new GoneException('That code has been used or replaced. Ask for a new one.');
    if (check.codeExpiresAt.getTime() <= Date.now()) {
      await this.repo.deleteCheck(check.id);
      throw new GoneException('That code has expired. Ask for a new one.');
    }
    if (check.attempts >= CODE_MAX_ATTEMPTS) {
      await this.repo.deleteCheck(check.id);
      throw new GoneException('Too many wrong codes. Ask for a new one.');
    }
    if (!digestsMatch(check.codeHash, hash(input.code.trim()))) {
      await this.repo.countWrongAttempt(check.id);
      const left = CODE_MAX_ATTEMPTS - check.attempts - 1;
      throw new BadRequestException({
        message: 'Validation failed',
        issues: [
          {
            code: 'custom',
            path: ['code'],
            message:
              left > 0
                ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`
                : 'That code is not right, and it cannot be used again. Ask for a new one.',
          },
        ],
      });
    }
    // Asked again rather than trusted from the lookup: nothing about the
    // person was kept between the two calls.
    const found = await this.identity.lookupRegister(check.documentNumber);
    if (found.status !== 'found') throw new GoneException('The population register did not answer. Ask for a new code.');
    const gender = found.person.gender === 'male' || found.person.gender === 'female' ? found.person.gender : null;
    const person = {
      fullName: found.person.fullName,
      dateOfBirth: found.person.dateOfBirth,
      gender,
      phoneE164: found.person.phoneE164,
      generated: found.generated,
    };
    const token = randomBytes(24).toString('base64url');
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);
    await this.repo.verifyCheck(check.id, { person, tokenHash: hash(token), tokenExpiresAt });
    const names = splitPsfName(person.fullName);
    return {
      checkToken: token,
      fullName: person.fullName,
      firstName: names.firstName,
      lastName: names.lastName,
      dateOfBirth: person.dateOfBirth,
      gender,
      documentNumberMasked: `•••• ${check.documentNumber.slice(-4)}`,
      phoneMasked: person.phoneE164 ? maskPhone(person.phoneE164) : null,
      phoneE164: person.phoneE164,
      generated: person.generated,
      expiresAt: tokenExpiresAt.toISOString(),
    };
  }

  // --- 2. The one form -------------------------------------------------------

  async submit(input: PsfPublicSubmitRequest): Promise<PsfPublicSubmitResult> {
    const check = await this.repo.checkByToken(hash(input.checkToken));
    if (!check || !check.person) {
      throw new GoneException('Your ID check has expired. Check your National ID again, then send the form.');
    }
    const { business, membership, contact } = input;

    // Everything that can refuse is read before anything is written.
    // A card holder (2026-11-02) pays nothing now: its level is checked, never an amount, and its card is
    // one the card upload stored and nobody else has filed.
    const cardHolder = membership.intake === 'card_holder';
    const tier = cardHolder
      ? await this.cardHolderTier(membership.tierCode)
      : await this.bandOrRefuse(business.address.districtId, membership.tierCode, membership.declaredFeeRwf, ['membership']);
    // Refused above when missing, for a new application.
    const declared = cardHolder ? 0 : (membership.declaredFeeRwf as number);
    if (cardHolder) await this.cardOrRefuse(membership.cardObjectKey);
    const association = await this.psf.associationForRegistration(business.associationCode);
    if (business.subsectorId) {
      await this.psf.subsectorForRegistration(business.subsectorId, association.clusterCode, business.address.districtId);
    }
    const districtOf = await this.orgs.districtsForSectors([
      business.address.sectorId,
      ...business.branches.map((b) => b.address.sectorId),
    ]);
    if (districtOf.get(business.address.sectorId) !== business.address.districtId) {
      throw fieldError(['business', 'address', 'sectorId'], 'That sector is not in the district you picked.');
    }
    // Each branch goes to its own district's officer, so its place must hold together too.
    business.branches.forEach((b, i) => {
      if (districtOf.get(b.address.sectorId) !== b.address.districtId) {
        throw fieldError(['business', 'branches', i, 'address', 'sectorId'], 'That sector is not in the district you picked.');
      }
    });
    // The logo, when given: a key the logo upload minted, and nobody else's.
    if (business.logoObjectKey) {
      const logo = isObjectKey(business.logoObjectKey) ? await this.storage.describe(business.logoObjectKey) : null;
      if (!logo || logo.kind !== 'org_logo' || (await this.repo.logoInUse(business.logoObjectKey))) {
        throw fieldError(['business', 'logoObjectKey'], 'Upload your logo again, then send the form.');
      }
    }
    if (!(await this.repo.spendCheck(check.id))) {
      throw new GoneException('This ID check was already used to send a form. Check your National ID again.');
    }

    const names = splitPsfName(check.person.fullName);
    const registrationNumber =
      business.registrationKind === 'tin'
        ? (business.tin ?? null)
        : business.registrationKind === 'none'
          ? null
          : (business.registrationNumber ?? null);
    const row = buildPsfApplicationRow({
      submittedByUserId: null,
      applicantPhoneE164: contact.phoneE164,
      applicantEmail: contact.email ?? null,
      capacity: 'owner',
      registrationType: business.registrationKind,
      registrationNumber,
      tier,
      form: {
        requestedTierCode: tier.code,
        // A card holder declares no fee: nothing is paid now (2026-11-02).
        declaredFeeRwf: cardHolder ? undefined : declared,
        companyName: business.legalName,
        streetAddress: business.address.street,
        website: business.website,
        companyType: business.companyType,
        ownership: business.ownership,
        ownershipOther: business.ownershipOther,
        businessActivity: business.businessActivity,
        tradeDirection: business.tradeDirection,
        tradeGoods: business.tradeGoods,
        tradeCountries: business.tradeCountries,
        contactRole: contact.role,
        firstName: names.firstName,
        lastName: names.lastName,
        gender: contact.gender,
        phoneE164: contact.phoneE164,
        // PSF's form has an email line; a business without one leaves it blank.
        email: contact.email ?? '',
        idDocument: { documentType: 'national_id', documentNumber: check.documentNumber },
        dateOfBirth: check.person.dateOfBirth,
        consent: true,
      },
      consentGivenAt: new Date(),
      consentVersion: PSF_CONSENT_VERSION,
      intake: cardHolder ? 'card_holder' : 'new',
    });

    let created;
    try {
      created = await this.orgs.createPublicPsfRegistration({
        legalName: business.legalName,
        tin: business.registrationKind === 'tin' ? (business.tin ?? null) : null,
        districtId: business.address.districtId,
        sectorId: business.address.sectorId,
        villageId: business.address.villageId ?? null,
        addressText: business.address.street,
        psfAssociationCode: business.associationCode,
        psfAssociationOther: business.associationOther ?? null,
        psfSubsectorId: business.subsectorId ?? null,
        psfSubsectorOther: business.subsectorOther ?? null,
        ownerGroups: business.ownerGroups,
        registrationKind: business.registrationKind,
        registrationNumber: business.registrationKind === 'tin' || business.registrationKind === 'none' ? null : registrationNumber,
        logoObjectKey: business.logoObjectKey ?? null,
        cardObjectKey: cardHolder ? (membership.cardObjectKey ?? null) : null,
        application: row,
        branches: business.branches.map((b) => ({
          districtId: b.address.districtId,
          sectorId: b.address.sectorId,
          street: b.address.street,
        })),
      });
    } catch (error) {
      await this.repo.unspendCheck(check.id);
      if (error instanceof DuplicateTinError) {
        throw fieldError(['business', 'tin'], 'A business with this TIN is already registered on Injishi.');
      }
      throw error;
    }

    // A card holder goes straight to PSF: nothing to pay, its card for the District Manager to check.
    const charged = cardHolder
      ? await this.fileCardHolder(created.orgId, created.applicationId)
      : await this.chargeAtSubmit(created.orgId, created.applicationId, declared, contact.phoneE164);
    const facts = await this.psfRepo.orgFacts(created.orgId);
    return {
      docId: created.docId,
      businessCode: facts?.businessCode ?? null,
      totalRwf: declared,
      feePaid: charged.paid,
      feeProblem: charged.problem,
    };
  }

  /** A card holder's level: one PSF offers. Its year and price are on its card, not checked here. */
  private async cardHolderTier(tierCode: string): Promise<NonNullable<Awaited<ReturnType<PsfMembershipRepository['tier']>>>> {
    const tier = await this.psfRepo.tier(tierCode);
    if (!tier || !tier.active) throw fieldError(['membership', 'tierCode'], 'Pick the level printed on your card.');
    return tier;
  }

  /** The card a card holder sends: stored by the card upload, and filed by no other business. */
  private async cardOrRefuse(objectKey: string | undefined): Promise<void> {
    const card = objectKey && isObjectKey(objectKey) ? await this.storage.describe(objectKey) : null;
    if (!card || card.kind !== 'certificate' || (await this.repo.cardInUse(objectKey as string))) {
      throw fieldError(['membership', 'cardObjectKey'], 'Upload your PSF card again, then send the form.');
    }
  }

  /** A card holder's business moves to PSF at once, with no payment: its code, the TIN check, the queue. */
  private async fileCardHolder(orgId: string, applicationId: string): Promise<{ paid: boolean; problem: string | null }> {
    if (await this.orgs.settlePublicPsfPayment(orgId)) {
      await this.registration.runTinCheck(orgId);
      const app = await this.psfRepo.applicationById(applicationId);
      const facts = await this.psfRepo.orgFacts(orgId);
      if (app && facts) await this.psf.afterFiled(orgId, app.requestedTierName, facts.registrationStatus);
    }
    return { paid: true, problem: null };
  }

  /** A card holder's old PSF card (2026-11-02), under the form's ID check, like the logo. */
  async uploadCard(checkToken: string | undefined, file: { body: Buffer; mime: string; filename: string }): Promise<PsfCardUploadResult> {
    const check = checkToken ? await this.repo.checkByToken(hash(checkToken)) : null;
    if (!check || !check.person) {
      throw new GoneException('Your ID check has expired. Check your National ID again, then add your card.');
    }
    const stored = await this.storage.putCertificate({ ...file, uploadedByUserId: null });
    return { objectKey: stored.objectKey, sizeBytes: stored.sizeBytes, filename: stored.filename };
  }

  /**
   * THE ONE PAYMENT AT SUBMIT (2026-10-20): PSF approves only a business that
   * has paid, so the form takes the membership fee as one mobile money prompt.
   * There is no registration fee, and nothing is refunded (2026-10-23). On a
   * settled charge: the fee is recorded on the application, the business moves
   * to PSF and is given its code, then the TIN check when there is a TIN, and
   * PSF's queue.
   *
   * Never throws for a payment that did not go through: the docID exists
   * either way, and the tracking page offers the payment again under the same
   * key, so a retry can only ever find the one charge.
   */
  private async chargeAtSubmit(
    orgId: string,
    applicationId: string,
    membershipFeeRwf: number,
    phoneE164: string | null,
  ): Promise<{ paid: boolean; problem: string | null }> {
    const instrument = psfInstrument(phoneE164);
    if (!instrument) return { paid: false, problem: PSF_NO_INSTRUMENT_MESSAGE };
    let receipt;
    try {
      receipt = await this.payments.chargeOneTimeFee({
        kind: 'one_time_fee',
        purpose: 'psf_membership',
        feeCode: 'psf_membership',
        instrument,
        // No workspace on this path: the business itself scopes the money.
        idempotencyKey: `${orgId}:psf-submit:${applicationId}`,
        amountRwf: membershipFeeRwf,
        currency: 'RWF',
        workspaceId: orgId,
        withoutWorkspace: true,
        memo: 'PSF membership fee',
      });
    } catch (error) {
      if (error instanceof PaymentDeclinedError) return { paid: false, problem: `Mobile money declined the payment: ${error.reason}` };
      if (error instanceof PaymentUnavailableError) {
        return { paid: false, problem: 'We could not reach mobile money, and nothing was taken. Try again in a moment.' };
      }
      throw error;
    }
    receipt = await this.settleIfApproved(orgId, receipt);
    if (receipt.settlement === 'pending') {
      return { paid: false, problem: 'Approve the payment on your phone, then press Check payment.' };
    }
    await this.psfRepo.recordPrepayment({
      applicationId,
      amountRwf: membershipFeeRwf,
      paymentRef: receipt.adapterRef,
      paymentMode: receipt.mode,
      paidAt: receipt.occurredAt,
    });
    if (await this.orgs.settlePublicPsfPayment(orgId)) {
      await this.registration.runTinCheck(orgId);
      const app = await this.psfRepo.applicationById(applicationId);
      const facts = await this.psfRepo.orgFacts(orgId);
      if (app && facts) await this.psf.afterFiled(orgId, app.requestedTierName, facts.registrationStatus);
    }
    return { paid: true, problem: null };
  }

  /**
   * A logo from the form (2026-10-23). The form has no session, so a live,
   * verified, unspent ID check stands in for one: the same token the form
   * will be sent with. Without it this would be an anonymous file host.
   */
  async uploadLogo(checkToken: string | undefined, file: { body: Buffer; mime: string; filename: string }): Promise<PsfLogoUploadResult> {
    const check = checkToken ? await this.repo.checkByToken(hash(checkToken)) : null;
    if (!check || !check.person) {
      throw new GoneException('Your ID check has expired. Check your National ID again, then add your logo.');
    }
    return this.storage.putOrgLogo(file);
  }

  /** The business's logo, for the tracking page and the certificate; 404 without one. */
  async logo(docId: string): Promise<{ bytes: Buffer; mime: string }> {
    const row = await this.rowOrNotFound(docId);
    if (!row.logoObjectKey) throw new NotFoundException('This business has no logo.');
    const described = await this.storage.describe(row.logoObjectKey);
    return { bytes: await this.storage.readBytes(row.logoObjectKey), mime: described?.mime ?? 'image/png' };
  }

  // --- 3. By docID -----------------------------------------------------------

  private async rowOrNotFound(docId: string): Promise<PsfTrackRow> {
    const row = await this.repo.byDocId(docId);
    if (!row) throw new NotFoundException('No application has that docID. Check it on your receipt or text message.');
    return row;
  }

  async track(docId: string): Promise<PsfTrackView> {
    return this.view(await this.rowOrNotFound(docId));
  }

  // --- The certificate, as a file (2026-10-20) ------------------------------------

  /** The member's certificate as a PDF, or a 409 while there is none. */
  async certificate(docId: string): Promise<{ filename: string; content: Buffer }> {
    const { view } = await this.certificateFacts(docId);
    const m = view.membership!;
    const content = await renderPsfCertificate({
      businessName: view.business.name,
      businessCode: view.business.code,
      districtName: view.business.districtName,
      levelName: m.family ? PSF_FAMILY_LABEL[m.family] : view.request.familyName,
      membershipNumber: m.number,
      startsOn: m.startsOn ?? '',
      expiresOn: m.expiresOn ?? '',
      docId: view.docId,
      issuedBy: view.reviewingOffice,
      // The QR opens the member's card (2026-11-02), which anyone may check.
      trackUrl: this.mail.cardLink(m.number),
      businessLogo: await this.logoForCertificate(docId),
    });
    return { filename: `PSF-certificate-${m.number.replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`, content };
  }

  /**
   * Mail the certificate to the email the application gave, and only that
   * one: an address typed here would let anyone holding a docID send a
   * business's papers anywhere.
   */
  /** The logo as the certificate embeds it, or none when there is none (or it cannot be read). */
  private async logoForCertificate(docId: string): Promise<{ bytes: Buffer; mime: 'image/png' | 'image/jpeg' } | null> {
    try {
      const { bytes, mime } = await this.logo(docId);
      return mime === 'image/png' || mime === 'image/jpeg' ? { bytes, mime } : null;
    } catch {
      return null;
    }
  }

  async emailCertificate(docId: string): Promise<{ sentTo: string }> {
    const { view, row } = await this.certificateFacts(docId);
    if (!row.applicantEmail) {
      throw new ConflictException('No email was given with this application, so there is nowhere to send it. Download it instead.');
    }
    const { content } = await this.certificate(docId);
    const m = view.membership!;
    try {
      await this.mail.certificate(
        row.applicantEmail,
        { name: view.contact.name, legalName: view.business.name, tierName: m.tierName, membershipNumber: m.number, expiresOn: m.expiresOn, docId: view.docId },
        content,
      );
    } catch {
      throw new ServiceUnavailableException('We could not send the email just now. Try again in a moment, or download the certificate.');
    }
    return { sentTo: maskEmail(row.applicantEmail) };
  }

  private async certificateFacts(docId: string): Promise<{ view: PsfTrackView; row: PsfTrackRow }> {
    const row = await this.rowOrNotFound(docId);
    const view = await this.view(row);
    if (!view.membership || (view.stage !== 'member' && view.stage !== 'lapsed')) {
      throw new ConflictException('There is no certificate yet: it is issued when PSF approves the membership.');
    }
    return { view, row };
  }

  async payRegistration(docId: string): Promise<PsfTrackPayResult> {
    const row = await this.rowOrNotFound(docId);
    if (row.registrationStatus !== 'pending_payment') {
      return { status: 'paid', message: null, view: await this.view(row) };
    }
    // The payment at submit, again: the membership fee, under the same key.
    const charged = await this.chargeAtSubmit(
      row.orgId,
      row.applicationId,
      row.declaredFeeRwf ?? 0,
      row.applicantPhoneE164 ?? row.phoneE164,
    );
    return {
      status: charged.paid ? 'paid' : charged.problem?.startsWith('Approve') ? 'pending' : 'declined',
      message: charged.problem,
      view: await this.track(docId),
    };
  }

  async payMembership(docId: string): Promise<PsfTrackPayResult> {
    const row = await this.rowOrNotFound(docId);
    if (row.status === 'member' && row.paidAt) return { status: 'paid', message: null, view: await this.view(row) };
    const app = await this.psfRepo.applicationById(row.applicationId);
    if (!app) throw new NotFoundException('Application not found.');
    if (!app.decidedByUserId) throw new ConflictException('This application is not waiting for a payment.');
    try {
      await this.psf.chargeApproved({
        orgId: row.orgId,
        legalName: row.businessName,
        app,
        scopeId: row.orgId,
        // The approval is what the membership stands on: the officer who gave it.
        recordedByUserId: app.decidedByUserId,
        phoneE164: row.applicantPhoneE164 ?? row.phoneE164,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        const body = error.getResponse() as { code?: string; message?: string } | string;
        const message = typeof body === 'string' ? body : (body.message ?? error.message);
        const pending = typeof body !== 'string' && body.code === 'payment_pending';
        if (pending || error.getStatus() === 422 || error.getStatus() === 503) {
          return { status: pending ? 'pending' : 'declined', message, view: await this.track(docId) };
        }
      }
      throw error;
    }
    return { status: 'paid', message: null, view: await this.track(docId) };
  }

  // --- 3b. Tracking by membership number (2026-11-02) ---------------------------

  /**
   * A membership number is printed on the certificate, so it alone opens nothing: a code goes by text to
   * the phone the application gave, and the lookup token carries the docID, the code's fingerprint and an
   * expiry, signed with the server's secret. Nothing is kept, so a code is good until it expires.
   */
  async memberLookup(input: PsfMemberLookupRequest): Promise<PsfMemberLookupResult> {
    // A membership number, or the business's code (2026-11-02): both are printed, so either sends a code.
    const businessCode = normalizeBusinessCode(input.membershipNumber);
    const number = normalizePsfNumber(input.membershipNumber);
    const lookUp = async (): Promise<{ docId: string; phoneE164: string | null } | null> =>
      (await this.renewals.trackingByMembershipNumber(number)) ?? (businessCode ? await this.renewals.trackingByBusinessCode(businessCode) : null);
    let found = await lookUp();
    if (!found) {
      // A member confirmed from its card at registration had no application to track (2026-11-03): its
      // member record is filed now, once, and the lookup tried again.
      const orgId = await this.psfRepo.memberOrgOf(number, businessCode);
      if (orgId && (await this.psf.ensureMemberRecord(orgId))) found = await lookUp();
    }
    if (!found) {
      return {
        status: 'not_found',
        message: 'No business on Injishi has that membership number or business code. Check it on the certificate, or track with your docID.',
      };
    }
    if (!found.phoneE164) {
      return { status: 'no_phone', message: 'There is no phone on this application to send a code to. Track it with your docID instead.' };
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    try {
      await this.sms.send({
        toE164: found.phoneE164,
        body: `${code} is your PSF tracking code. It lasts ${CODE_TTL_SECONDS / 60} minutes. Never share it.`,
      });
    } catch (error) {
      this.log.warn(`PSF tracking code could not be sent: ${(error as Error).message}`);
      return { status: 'unavailable', message: 'We could not send the code just now. Try again in a few minutes, or track with your docID.' };
    }
    const payload = Buffer.from(JSON.stringify({ d: found.docId, h: hash(code), e: Date.now() + CODE_TTL_SECONDS * 1000 })).toString('base64url');
    return {
      status: 'code_sent',
      lookupToken: `${payload}.${this.sign(payload)}`,
      sentTo: maskPhone(found.phoneE164),
      expiresInSeconds: CODE_TTL_SECONDS,
      // Shown on screen only while no text really goes (SMS is the mock, on a sample database).
      demoCode: this.sms.mode === 'mock' ? code : null,
    };
  }

  memberLookupConfirm(input: PsfMemberLookupConfirm): PsfMemberLookupConfirmed {
    const [payload = '', signature = ''] = input.lookupToken.split('.');
    const expected = this.sign(payload);
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new GoneException('That code has expired. Ask for a new one.');
    }
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { d: string; h: string; e: number };
    if (body.e <= Date.now()) throw new GoneException('That code has expired. Ask for a new one.');
    if (!digestsMatch(body.h, hash(input.code.trim()))) {
      throw new BadRequestException({ message: 'Validation failed', issues: [{ code: 'custom', path: ['code'], message: 'That code is not right. Check the text and try again.' }] });
    }
    return { docId: body.d };
  }

  private sign(payload: string): string {
    return createHmac('sha256', `psf-track:${this.config.getOrThrow<string>('BETTER_AUTH_SECRET')}`).update(payload).digest('base64url');
  }

  // --- 4. Renewing (2026-11-02) ------------------------------------------------

  /**
   * Pay the next year. A paid renewal renews at once, with no officer: the year
   * runs on from the old end date, or from today once lapsed, and the band may
   * change at the district's current price. Never throws for a payment that did
   * not go through; a prompt still waiting is charged again under the same key,
   * so pressing again can only ever find the one charge.
   */
  async renew(docId: string, input: PsfRenewRequest): Promise<PsfTrackPayResult> {
    const row = await this.rowOrNotFound(docId);
    const latest = await this.renewals.latestMembership(row.orgId);
    if (row.status !== 'member' || !latest || !latest.expiresOn || latest.source === 'self_declared') {
      throw new ConflictException('There is no PSF membership to renew on this application yet.');
    }
    if (row.districtId === null) throw new ConflictException('This business has no district, so PSF has no price for it.');
    const terms = psfRenewalTerms({ expiresOn: latest.expiresOn, ended: latest.endedAt !== null, today: kigaliDateOf(new Date()) });
    if (!terms.open) throw new ConflictException(terms.reason);
    const tier = await this.bandOrRefuse(row.districtId, input.tierCode, input.declaredFeeRwf, []);

    // The same band, amount and phone again is the same prompt; anything else is a new one. No phone is
    // Check payment (2026-11-02): the prompt already waiting for this band and amount, on its own phone.
    const waiting = await this.renewals.pending(row.orgId);
    const sameRequest =
      waiting !== null &&
      waiting.membershipId === latest.id &&
      waiting.tierCode === tier.code &&
      waiting.amountRwf === input.declaredFeeRwf &&
      waiting.startsOn === terms.startsOn;
    const phoneE164 = input.phoneE164 ?? (sameRequest ? waiting.payerPhoneE164 : null);
    const instrument = psfInstrument(phoneE164);
    if (!instrument || !phoneE164) return { status: 'declined', message: PSF_NO_INSTRUMENT_MESSAGE, view: await this.track(docId) };
    const renewal =
      sameRequest && waiting.payerPhoneE164 === phoneE164
        ? waiting
        : await this.renewals.start({
            orgId: row.orgId,
            membershipId: latest.id,
            applicationId: row.applicationId,
            membershipNumber: latest.membershipNumber,
            tierCode: tier.code,
            amountRwf: input.declaredFeeRwf,
            payerPhoneE164: phoneE164,
            startsOn: terms.startsOn,
            expiresOn: terms.expiresOn,
          });

    let receipt;
    try {
      receipt = await this.payments.chargeOneTimeFee({
        kind: 'one_time_fee',
        purpose: 'psf_membership',
        feeCode: 'psf_membership',
        instrument,
        idempotencyKey: `${row.orgId}:psf-renewal:${renewal.id}`,
        amountRwf: renewal.amountRwf,
        currency: 'RWF',
        workspaceId: row.orgId,
        withoutWorkspace: true,
        memo: 'PSF membership renewal',
      });
    } catch (error) {
      if (error instanceof PaymentDeclinedError) {
        const message = `Mobile money declined the payment: ${error.reason}`;
        await this.renewals.fail(renewal.id, message);
        return { status: 'declined', message, view: await this.track(docId) };
      }
      if (error instanceof PaymentUnavailableError) {
        const message = 'We could not reach mobile money, and nothing was taken. Try again in a moment.';
        await this.renewals.fail(renewal.id, message);
        return { status: 'declined', message, view: await this.track(docId) };
      }
      throw error;
    }
    receipt = await this.settleIfApproved(row.orgId, receipt);
    if (receipt.settlement === 'pending') {
      return { status: 'pending', message: 'Approve the payment on your phone, then press Check payment.', view: await this.track(docId) };
    }
    const paid = await this.renewals.applyPaid({
      renewalId: renewal.id,
      paidAt: receipt.occurredAt,
      paymentRef: receipt.adapterRef,
      paymentMode: receipt.mode,
    });
    // Only the call that applied it remits and tells, so a race stays silent.
    if (paid) {
      await this.psf.remitRenewal(paid.id, row.orgId, paid.amountRwf, (ref) => this.renewals.recordRemittance(paid.id, ref));
      await this.mail.renewed(row.orgId, {
        membershipNumber: paid.membershipNumber,
        tierName: tier.nameEn,
        amountRwf: paid.amountRwf,
        startsOn: paid.startsOn,
        expiresOn: paid.expiresOn,
        paymentReference: receipt.adapterRef,
      });
    }
    return { status: 'paid', message: null, view: await this.track(docId) };
  }

  /**
   * A prompt that came back pending is asked about again at the gateway, as a
   * broker's fee is: a business with no workspace is not in the money queue's
   * sweep by workspace, so pressing Check payment must be able to settle it.
   */
  private async settleIfApproved(orgId: string, receipt: PaymentReceipt): Promise<PaymentReceipt> {
    if (receipt.settlement !== 'pending') return receipt;
    const asked = await this.payments.fetchTransaction(orgId, receipt.adapterRef).catch(() => null);
    return asked?.settlement === 'settled' ? { ...receipt, ...asked, settlement: 'settled' } : receipt;
  }

  /** Where renewing stands for the tracking page; null before the business was a member. */
  private renewalState(
    latest: Awaited<ReturnType<PsfRenewalRepository['latestMembership']>>,
    pending: Awaited<ReturnType<PsfRenewalRepository['pending']>>,
  ): PsfRenewalState | null {
    if (!latest || !latest.expiresOn || latest.source === 'self_declared') return null;
    const terms = psfRenewalTerms({ expiresOn: latest.expiresOn, ended: latest.endedAt !== null, today: kigaliDateOf(new Date()) });
    return {
      ...terms,
      tierCode: latest.tierCode,
      pending: pending
        ? { tierCode: pending.tierCode, tierName: pending.tierName, amountRwf: pending.amountRwf, phoneMasked: maskPhone(pending.payerPhoneE164) }
        : null,
    };
  }

  /**
   * The band and the amount, held to PSF's prices in the district (2026-10-20):
   * at least the band's price, and under the next band's (2026-10-23). An
   * amount outside the band is refused rather than charged. `at` prefixes the
   * field paths of a refusal.
   */
  private async bandOrRefuse(
    districtId: number,
    tierCode: string,
    declared: number | undefined,
    at: string[],
  ): Promise<NonNullable<Awaited<ReturnType<PsfMembershipRepository['tier']>>>> {
    const tier = await this.psfRepo.tier(tierCode);
    if (!tier || !tier.active) throw fieldError([...at, 'tierCode'], 'That membership is not offered any more. Pick another.');
    const band = (await this.psf.feesIn(districtId)).fees.find((f) => f.tierCode === tier.code);
    const price = band?.amountRwf ?? null;
    if (price === null) {
      throw fieldError([...at, 'tierCode'], 'PSF has not set a price for this membership in your district yet. Pick another.');
    }
    const ceiling = band?.ceilingRwf ?? null;
    const rwf = (n: number): string => `RWF ${n.toLocaleString('en-US')}`;
    if (declared === undefined || declared < price) {
      throw fieldError(
        [...at, 'declaredFeeRwf'],
        `This band starts at ${rwf(price)} a year in your district. Pay at least that, or pick a lower band.`,
      );
    }
    if (ceiling !== null && declared > ceiling) {
      throw fieldError([...at, 'declaredFeeRwf'], `This band goes up to ${rwf(ceiling)} a year. For more, pick the next band.`);
    }
    return tier;
  }

  // --- The view --------------------------------------------------------------

  private stageOf(row: PsfTrackRow, membershipEnded: boolean): PsfTrackStage {
    if (row.status === 'member') return membershipEnded ? 'lapsed' : 'member';
    if (row.status === 'approved') return 'approved';
    if (row.status === 'declined') return 'declined';
    if (row.status === 'withdrawn') return 'withdrawn';
    if (row.registrationStatus === 'rejected') return 'declined';
    if (row.registrationStatus === 'pending_payment') return 'fee_due';
    return 'under_review';
  }

  private async view(row: PsfTrackRow): Promise<PsfTrackView> {
    // The newest membership of the business, so a renewal after a lapse (a new
    // row under the same number) is what shows.
    const [latest, fee, events, branches, paidRenewals, pendingRenewal] = await Promise.all([
      row.status === 'member' ? this.renewals.latestMembership(row.orgId) : Promise.resolve(null),
      // Only on an application from before the fee was dropped (2026-10-23).
      this.repo.registrationFee(row.orgId),
      this.repo.registrationEvents(row.orgId),
      this.psfRepo.branchesOf(row.applicationId),
      row.status === 'member' ? this.renewals.paidOf(row.orgId) : Promise.resolve([]),
      row.status === 'member' ? this.renewals.pending(row.orgId) : Promise.resolve(null),
    ]);
    const membership = latest && latest.source !== 'self_declared' ? latest : null;
    const stage = this.stageOf(row, Boolean(membership?.endedAt));
    const now = new Date();
    const reviewFrom = row.queuedAt ?? events.find((e) => e.to === 'active')?.at ?? null;
    const tinRejected = row.registrationStatus === 'rejected' && row.status === 'submitted';

    const timeline: PsfTrackEvent[] = [
      { kind: 'submitted', at: row.createdAt.toISOString(), title: 'Application sent', detail: `${row.tierName} membership` },
    ];
    if (fee?.paidAt) {
      timeline.push({ kind: 'fee_paid', at: fee.paidAt.toISOString(), title: 'Registration fee paid', detail: `RWF ${fee.amountRwf.toLocaleString('en-US')}` });
    }
    const codeAt = events.find((e) => e.to === 'submitted')?.at;
    if (row.businessCode && codeAt) {
      timeline.push({ kind: 'code_issued', at: codeAt.toISOString(), title: 'Business code given', detail: row.businessCode });
    }
    if (reviewFrom) {
      timeline.push({
        kind: 'in_review',
        at: reviewFrom.toISOString(),
        title: 'With PSF for review',
        detail: row.districtName ? `PSF ${row.districtName} district office` : 'PSF',
      });
    }
    if (tinRejected) {
      const at = events.find((e) => e.to === 'rejected')?.at ?? now;
      timeline.push({ kind: 'declined', at: at.toISOString(), title: 'TIN not confirmed', detail: 'The Rwanda Revenue Authority could not confirm the TIN.' });
    }
    if (row.decidedAt && (row.status === 'approved' || row.status === 'member')) {
      timeline.push({
        kind: 'approved',
        at: row.decidedAt.toISOString(),
        title: 'Approved by PSF',
        detail: row.approvedMembershipNumber ? `Membership number ${row.approvedMembershipNumber}` : null,
      });
    }
    if (row.decidedAt && row.status === 'declined' && row.declineReason) {
      timeline.push({ kind: 'declined', at: row.decidedAt.toISOString(), title: 'Declined by PSF', detail: PSF_DECLINE_REASON_LABEL[row.declineReason] });
    }
    if (row.paidAt) {
      timeline.push({
        kind: 'paid',
        at: row.paidAt.toISOString(),
        title: 'Membership fee paid',
        detail: row.paidAmountRwf !== null ? `RWF ${row.paidAmountRwf.toLocaleString('en-US')}` : null,
      });
    }
    if (membership?.endedAt) {
      timeline.push({ kind: 'expired', at: membership.endedAt.toISOString(), title: 'Membership ended', detail: membership.membershipNumber });
    }
    if (row.withdrawnAt) timeline.push({ kind: 'withdrawn', at: row.withdrawnAt.toISOString(), title: 'Withdrawn', detail: null });
    for (const r of paidRenewals) {
      if (r.paidAt) timeline.push({ kind: 'renewed', at: r.paidAt.toISOString(), title: 'Membership renewed', detail: `${r.tierName}, ${r.startsOn} to ${r.expiresOn}` });
    }
    timeline.sort((a, b) => a.at.localeCompare(b.at));

    const payments: PsfTrackView['payments'] = [];
    if (fee?.paidAt) payments.push({ kind: 'registration_fee', amountRwf: fee.amountRwf, at: fee.paidAt.toISOString(), status: 'paid', reference: null });
    if (row.paidAt && row.paidAmountRwf !== null) {
      payments.push({ kind: 'membership_fee', amountRwf: row.paidAmountRwf, at: row.paidAt.toISOString(), status: 'paid', reference: row.paymentRef });
    }
    for (const r of [...paidRenewals].reverse()) {
      payments.push({ kind: 'membership_renewal', amountRwf: r.amountRwf, at: r.paidAt?.toISOString() ?? null, status: 'paid', reference: r.paymentRef });
    }
    const phone = row.applicantPhoneE164 ?? row.phoneE164;
    const email = row.applicantEmail ?? (row.email || null);
    return {
      docId: row.docId,
      intake: row.intake,
      stage,
      submittedAt: row.createdAt.toISOString(),
      waitingDays: stage === 'under_review' && reviewFrom ? wholeDaysBetween(reviewFrom, now) : null,
      business: {
        name: row.businessName,
        code: row.businessCode,
        districtName: row.districtName,
        provinceName: row.provinceName ? provinceDisplayName(row.provinceName) : null,
        sectorName: row.sectorName,
        clusterName: row.clusterName,
        subsectorName: row.subsectorName,
        associationName: row.associationName,
        ownerGroups: row.ownerGroups,
        registrationKind: row.registrationKind,
        districtId: row.districtId,
        logoUrl: row.logoObjectKey ? `/api/v1/psf/track/${encodeURIComponent(row.docId)}/logo` : null,
        branches: branches.map((b) => ({ districtName: b.districtName, sectorName: b.sectorName, status: b.status, note: b.decisionNote })),
      },
      request: {
        family: row.tierFamily,
        familyName: PSF_FAMILY_LABEL[row.tierFamily],
        tierName: row.tierName,
        declaredFeeRwf: row.declaredFeeRwf,
      },
      reviewingOffice: row.districtName ? `PSF ${row.districtName} district office` : 'PSF',
      approval:
        row.approvedMembershipNumber && row.approvedFeeRwf !== null && row.decidedAt
          ? { membershipNumber: row.approvedMembershipNumber, feeRwf: row.approvedFeeRwf, approvedAt: row.decidedAt.toISOString() }
          : null,
      decline:
        row.status === 'declined' && row.declineReason && row.decidedAt
          ? {
              reason: row.declineReason,
              reasonLabel: PSF_DECLINE_REASON_LABEL[row.declineReason],
              note: row.decisionNote,
              decidedAt: row.decidedAt.toISOString(),
            }
          : tinRejected
            ? {
                reason: 'business_not_recognised',
                reasonLabel: 'TIN not confirmed by RRA',
                note: 'The Rwanda Revenue Authority could not confirm this TIN. Check it, then register again.',
                decidedAt: (events.find((e) => e.to === 'rejected')?.at ?? now).toISOString(),
              }
            : null,
      membership: membership
        ? {
            number: membership.membershipNumber,
            tierName: membership.tierName ?? row.tierName,
            tierCode: membership.tierCode,
            family: row.tierFamily,
            feeRwf: membership.annualFeeRwf,
            startsOn: membership.startsOn,
            expiresOn: membership.expiresOn,
            paidAt: row.paidAt ? row.paidAt.toISOString() : null,
            reference: row.paymentRef,
          }
        : null,
      contact: {
        name: `${row.firstName} ${row.lastName}`.trim(),
        phoneMasked: maskPhone(phone),
        emailMasked: email ? maskEmail(email) : null,
      },
      events: timeline,
      payments,
      // There is no registration fee (2026-10-23): what is due is the membership fee.
      dueRwf: stage === 'fee_due' ? (row.paidAt ? 0 : (row.declaredFeeRwf ?? 0)) : null,
      renewal: row.status === 'member' ? this.renewalState(membership, pendingRenewal) : null,
      renewals: paidRenewals.map((r) => ({
        paidAt: (r.paidAt ?? r.createdAt).toISOString(),
        membershipNumber: r.membershipNumber,
        tierName: r.tierName,
        amountRwf: r.amountRwf,
        startsOn: r.startsOn,
        expiresOn: r.expiresOn,
        reference: r.paymentRef,
      })),
    };
  }
}
