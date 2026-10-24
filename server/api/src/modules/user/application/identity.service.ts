import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import { DEMO_OTP_CODE } from '@injishi/auth';
import {
  ELEVATION_REFUSED_MESSAGE,
  mayElevate,
  type IdentityStatus,
  type NationalIdLookupResult,
  type PassportVerifyResult,
  type RegistrationConflictCode,
  type VerifiedPerson,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

import { PLATFORM, type Platform } from '../../../shared/config/platform';
import { maskIdentifier } from '../../../shared/identity/mask';
import { StorageService } from '../../storage/application/storage.service';
import { SMS_PORT, maskE164, type SmsPort } from '../../sms/domain/sms-port';
import {
  DOCUMENT_VERIFIER,
  IDENTITY_REGISTRY,
  type DocumentVerifierPort,
  type IdentityRegistryPort,
  type RegistryLookup,
} from '../domain/identity-ports';
import { IdentityRepository } from '../infrastructure/identity.repository';
import { DuplicateIdentityDocumentError } from '../infrastructure/profile.repository';

/** How long a lookup's code lives, and how many wrong guesses it takes. */
export const IDENTITY_CODE_TTL_SECONDS = 600;
export const IDENTITY_CODE_MAX_ATTEMPTS = 5;

const DUPLICATE_MESSAGE =
  'That identity document is already registered to another account. Recover that account rather than creating a second one.';

/**
 * Identity verification (ADR-060): a National ID looked up in the population
 * register and bound to the person by a code sent to the phone the register
 * holds, or a passport read by a document verifier and matched to a selfie.
 *
 * THE LOOKUP REVEALS NOBODY. Whoever types an ID number might not hold it, so
 * a lookup that answered with a name and a birth date would be a directory of
 * strangers. It sends a code to the register's phone and returns only where it
 * went, masked. `confirm` reveals the person, to whoever reads that code.
 *
 * Verification is what finally moves `kyc_status` (ADR-053's open follow-up):
 * `ProfileService` captures, this verifies.
 */
@Injectable()
export class IdentityService {
  private readonly log = new Logger(IdentityService.name);
  /** The fixed code is issued only on the demo, over a sample database (ADR-043). */
  private readonly isDemo: boolean;

  constructor(
    private readonly repo: IdentityRepository,
    @Inject(IDENTITY_REGISTRY) private readonly registry: IdentityRegistryPort,
    @Inject(DOCUMENT_VERIFIER) private readonly documents: DocumentVerifierPort,
    @Inject(SMS_PORT) private readonly sms: SmsPort,
    @Inject(PLATFORM) platform: Platform,
    private readonly storage: StorageService,
  ) {
    this.isDemo = platform.environment === 'demo';
  }

  /** Whether registering a business here is held to a verified identity. */
  get verificationRequired(): boolean {
    return this.registry.mode !== 'off' || this.documents.mode !== 'off';
  }

  /**
   * The population register, asked directly, for the public PSF form
   * (2026-10-19), which binds the answer to the phone itself and records it
   * on the application rather than on an account. Never throws: an outage is
   * `unavailable`, like every lookup here.
   */
  lookupRegister(documentNumber: string): Promise<RegistryLookup> {
    return this.lookupSafely(documentNumber);
  }

  /** The fixed code the demo issues over a sample database, else null. */
  get demoCode(): string | null {
    return this.isDemo ? DEMO_OTP_CODE : null;
  }

  get registryMode(): string {
    return this.registry.mode;
  }

  async status(userId: string): Promise<IdentityStatus> {
    const row = await this.repo.find(userId);
    const verified =
      row.kycStatus === 'verified' && row.legalFullName && row.dateOfBirth && row.document
        ? {
            fullName: row.legalFullName,
            dateOfBirth: row.dateOfBirth,
            gender: row.gender,
            documentType: row.document.documentType,
            documentNumberMasked: maskIdentifier(row.document.documentNumber),
            issuingCountry: row.document.issuingCountry,
            generated: this.registry.mode === 'mock' && row.method === 'registry'
              || this.documents.mode === 'mock' && row.method === 'document_scan',
          }
        : null;
    return {
      kycStatus: row.kycStatus,
      method: row.method,
      verified,
      available: {
        nationalId: this.registry.mode !== 'off',
        passport: this.documents.mode !== 'off',
      },
      required: this.verificationRequired,
      modes: { registry: this.registry.mode, documents: this.documents.mode },
    };
  }

  /**
   * Refuse a business registration from someone not verified, when a check
   * can run here (ADR-060). Where both seams are off there is nothing a person
   * could do to pass, so nothing is required: a gate nobody can open is not a
   * gate, it is an outage.
   */
  async assertMayRegister(userId: string): Promise<void> {
    if (!this.verificationRequired) return;
    if (mayElevate(await this.repo.elevationFacts(userId))) return;
    throw new ForbiddenException({
      code: 'identity_not_verified' satisfies RegistrationConflictCode,
      message: ELEVATION_REFUSED_MESSAGE,
    });
  }

  async lookupNationalId(userId: string, documentNumber: string): Promise<NationalIdLookupResult> {
    if (
      await this.repo.heldByAnother(userId, {
        documentType: 'national_id',
        documentNumber,
        issuingCountry: 'RW',
      })
    ) {
      throw new ConflictException(DUPLICATE_MESSAGE);
    }

    const found = await this.lookupSafely(documentNumber);
    if (found.status === 'unavailable') {
      return {
        status: 'unavailable',
        message:
          this.registry.mode === 'off'
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
        message:
          'The register holds no phone for this National ID, so we cannot send you a code. Scan your passport instead, or update your phone with NIDA.',
      };
    }

    const code = this.isDemo ? DEMO_OTP_CODE : String(randomInt(0, 1_000_000)).padStart(6, '0');
    const challengeId = await this.repo.replaceChallenge({
      userId,
      documentNumber,
      codeHash: hash(code),
      expiresAt: new Date(Date.now() + IDENTITY_CODE_TTL_SECONDS * 1000),
    });
    try {
      await this.sms.send({
        toE164: phone,
        body: `${code} is your Injishi identity code. It lasts ${IDENTITY_CODE_TTL_SECONDS / 60} minutes. Never share it.`,
      });
    } catch (error) {
      await this.repo.deleteChallenge(challengeId);
      this.log.warn(`Identity code could not be sent: ${(error as Error).message}`);
      return {
        status: 'unavailable',
        message: 'We could not send the code just now. Try again in a few minutes.',
      };
    }
    return {
      status: 'code_sent',
      challengeId,
      sentTo: maskE164(phone),
      expiresInSeconds: IDENTITY_CODE_TTL_SECONDS,
    };
  }

  async confirmNationalId(userId: string, challengeId: string, code: string): Promise<VerifiedPerson> {
    const challenge = await this.repo.findChallenge(challengeId, userId);
    if (!challenge) {
      throw new GoneException('That code has been used or replaced. Ask for a new one.');
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
      await this.repo.deleteChallenge(challengeId);
      throw new GoneException('That code has expired. Ask for a new one.');
    }
    if (challenge.attempts >= IDENTITY_CODE_MAX_ATTEMPTS) {
      await this.repo.deleteChallenge(challengeId);
      throw new GoneException('Too many wrong codes. Ask for a new one.');
    }
    if (!digestsMatch(challenge.codeHash, hash(code.trim()))) {
      await this.repo.countWrongAttempt(challengeId);
      const left = IDENTITY_CODE_MAX_ATTEMPTS - challenge.attempts - 1;
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

    // The register is asked again rather than trusted from the lookup: nothing
    // about the person is stored between the two calls.
    const found = await this.lookupSafely(challenge.documentNumber);
    if (found.status !== 'found') {
      throw new GoneException('The population register did not answer. Ask for a new code.');
    }
    await this.recordOrRefuse(userId, {
      fullName: found.person.fullName,
      dateOfBirth: found.person.dateOfBirth,
      gender: found.person.gender,
      phoneE164: found.person.phoneE164,
      documentType: 'national_id',
      documentNumber: challenge.documentNumber,
      issuingCountry: 'RW',
      method: 'registry',
    });
    await this.repo.deleteChallenge(challengeId);
    return {
      fullName: found.person.fullName,
      dateOfBirth: found.person.dateOfBirth,
      gender: found.person.gender,
      phoneE164: found.person.phoneE164,
      documentType: 'national_id',
      documentNumberMasked: maskIdentifier(challenge.documentNumber),
      issuingCountry: 'RW',
      generated: found.generated,
    };
  }

  async verifyPassport(
    userId: string,
    input: { documentObjectKey: string; selfieObjectKey: string },
  ): Promise<PassportVerifyResult> {
    if (this.documents.mode === 'off') {
      return { status: 'unavailable', message: 'Passport scanning is not available here yet.' };
    }
    if (input.documentObjectKey === input.selfieObjectKey) {
      return {
        status: 'rejected',
        reason: 'face_mismatch',
        message: 'The selfie has to be a new photo of your face, not the passport page.',
      };
    }
    const [document, selfie] = await Promise.all([
      this.ownPhoto(userId, input.documentObjectKey, 'documentObjectKey'),
      this.ownPhoto(userId, input.selfieObjectKey, 'selfieObjectKey'),
    ]);

    let check;
    try {
      check = await this.documents.verifyPassport({ document, selfie });
    } catch (error) {
      this.log.warn(`Document verifier failed: ${(error as Error).message}`);
      check = { status: 'unavailable' as const };
    }
    if (check.status === 'unavailable') {
      return {
        status: 'unavailable',
        message: 'We could not check the passport just now. Try again in a few minutes.',
      };
    }
    if (check.status === 'rejected') {
      return { status: 'rejected', reason: check.reason, message: REJECTION_MESSAGE[check.reason] };
    }
    if (check.holder.expiresOn <= new Date().toISOString().slice(0, 10)) {
      return { status: 'rejected', reason: 'expired', message: REJECTION_MESSAGE.expired };
    }
    await this.recordOrRefuse(userId, {
      fullName: check.holder.fullName,
      dateOfBirth: check.holder.dateOfBirth,
      gender: check.holder.gender,
      phoneE164: null,
      documentType: 'passport',
      documentNumber: check.holder.documentNumber,
      issuingCountry: check.holder.issuingCountry,
      method: 'document_scan',
    });
    return {
      status: 'verified',
      person: {
        fullName: check.holder.fullName,
        dateOfBirth: check.holder.dateOfBirth,
        gender: check.holder.gender,
        phoneE164: null,
        documentType: 'passport',
        documentNumberMasked: maskIdentifier(check.holder.documentNumber),
        issuingCountry: check.holder.issuingCountry,
        generated: check.generated,
      },
    };
  }

  /** An `id_photo` the caller uploaded, as bytes, or a refusal naming the field. */
  private async ownPhoto(
    userId: string,
    objectKey: string,
    field: 'documentObjectKey' | 'selfieObjectKey',
  ): Promise<{ mime: string | null; bytes: Buffer }> {
    const described = await this.storage.describe(objectKey);
    if (!described || described.kind !== 'id_photo' || described.uploadedByUserId !== userId) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: [field], message: 'Upload that photo again.' }],
      });
    }
    return { mime: described.mime, bytes: await this.storage.readBytes(objectKey) };
  }

  private async lookupSafely(documentNumber: string): Promise<RegistryLookup> {
    try {
      return await this.registry.lookupNationalId(documentNumber);
    } catch (error) {
      this.log.warn(`Identity register failed: ${(error as Error).message}`);
      return { status: 'unavailable' as const };
    }
  }

  private async recordOrRefuse(
    userId: string,
    input: Parameters<IdentityRepository['recordVerified']>[1],
  ): Promise<void> {
    try {
      await this.repo.recordVerified(userId, input);
    } catch (error) {
      if (error instanceof DuplicateIdentityDocumentError) {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }
}

const REJECTION_MESSAGE = {
  not_authentic: 'That passport did not pass the authenticity check. Scan the original, not a copy.',
  face_mismatch: 'The selfie does not match the passport photo. Take a new selfie in good light.',
  unreadable: 'We could not read that photo. Retake it flat, in good light, with the whole page in view.',
  expired: 'That passport has expired. Scan a valid one.',
} as const;

function hash(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}
